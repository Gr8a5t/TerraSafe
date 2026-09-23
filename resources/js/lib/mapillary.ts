export interface MapillaryImage {
    id: string;
    thumbUrl: string;
    coordinates: [number, number]; // [lng, lat]
    distanceMeters?: number;
}

/**
 * Calculates approximate distance between two lat/lng points in meters.
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
}

async function queryBbox(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    token: string
): Promise<any[]> {
    const bbox = `${minLng.toFixed(5)},${minLat.toFixed(5)},${maxLng.toFixed(5)},${maxLat.toFixed(5)}`;
    const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(token)}&bbox=${bbox}&fields=id,geometry,thumb_1024_url&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
}

/**
 * Multi-tier Mapillary street image search.
 * Searches with expanding radii (500m -> 1.5km -> 5km) to catch nearby roads.
 */
export async function fetchClosestMapillaryImage(
    lat: number,
    lng: number,
    customToken?: string,
    expandRadius: boolean = true
): Promise<MapillaryImage | null> {
    let token = customToken || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAPILLARY_CLIENT_TOKEN);
    if (!token && typeof window !== 'undefined') {
        try {
            const pageEl = document.getElementById('app');
            if (pageEl?.dataset?.page) {
                const pageData = JSON.parse(pageEl.dataset.page);
                token = pageData?.props?.env?.mapillaryToken;
            }
        } catch {}
    }
    if (!token) return null;

    try {
        // Step 1: Immediate tight search (~500m)
        let rawImages = await queryBbox(lng - 0.004, lat - 0.004, lng + 0.004, lat + 0.004, token);

        // Step 2: If none found and expansion allowed, widen to ~1.2km (0.009 degree box limit)
        if (rawImages.length === 0 && expandRadius) {
            rawImages = await queryBbox(lng - 0.0085, lat - 0.0085, lng + 0.0085, lat + 0.0085, token);
        }

        // Step 3: If still none, search 4 adjacent sectors up to ~3km - 5km
        if (rawImages.length === 0 && expandRadius) {
            const step = 0.0085;
            const offsets = [
                [-step, 0], // West
                [step, 0],  // East
                [0, step],  // North
                [0, -step], // South
            ];

            const sectorPromises = offsets.map(([dx, dy]) =>
                queryBbox(
                    lng + dx - step / 2,
                    lat + dy - step / 2,
                    lng + dx + step / 2,
                    lat + dy + step / 2,
                    token
                )
            );

            const sectorResults = await Promise.all(sectorPromises);
            for (const sector of sectorResults) {
                if (sector.length > 0) {
                    rawImages.push(...sector);
                }
            }
        }

        if (rawImages.length > 0) {
            // Pick the image geographically closest to the user's coordinate
            let closest = rawImages[0];
            let minDistance = Infinity;

            for (const img of rawImages) {
                const imgLng = img.geometry?.coordinates?.[0] ?? lng;
                const imgLat = img.geometry?.coordinates?.[1] ?? lat;
                const dist = getDistanceMeters(lat, lng, imgLat, imgLng);
                if (dist < minDistance) {
                    minDistance = dist;
                    closest = img;
                }
            }

            return {
                id: closest.id,
                thumbUrl: closest.thumb_1024_url || '',
                coordinates: closest.geometry?.coordinates || [lng, lat],
                distanceMeters: minDistance,
            };
        }
    } catch (err) {
        console.warn('Mapillary query error:', err);
    }

    return null;
}
