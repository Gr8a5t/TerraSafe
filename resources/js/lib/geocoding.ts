export interface GeocodedLocation {
    name: string;
    lat: number;
    lng: number;
}

export const PRESET_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
    "abuja, nigeria": { lat: 9.0579, lng: 7.4951, name: "Abuja, Nigeria" },
    "abuja": { lat: 9.0579, lng: 7.4951, name: "Abuja, Nigeria" },
    "lagos island": { lat: 6.4549, lng: 3.4246, name: "Lagos Island, Nigeria" },
    "lagos": { lat: 6.5244, lng: 3.3792, name: "Lagos, Nigeria" },
    "port harcourt": { lat: 4.8156, lng: 7.0498, name: "Port Harcourt, Nigeria" },
    "los angeles": { lat: 34.0537, lng: -118.2551, name: "Los Angeles, CA, USA" },
    "633 w 5th st, los angeles, ca 90071, usa": { lat: 34.051, lng: -118.2545, name: "633 W 5th St, Los Angeles, CA 90071, USA" },
};

/**
 * Parses coordinate strings like "9.0579, 7.4951" or "34.05, -118.25"
 */
export function parseCoordinates(query: string): { lat: number; lng: number } | null {
    const coordPattern = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const match = query.match(coordPattern);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);

    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
}

function getMapboxToken(): string {
    if (typeof window !== 'undefined') {
        try {
            const pageEl = document.getElementById('app');
            if (pageEl?.dataset?.page) {
                const pageData = JSON.parse(pageEl.dataset.page);
                if (pageData?.props?.env?.mapboxToken) {
                    return pageData.props.env.mapboxToken;
                }
            }
        } catch {}
    }
    return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN) || '';
}

/**
 * Known city/region hints — if the query mentions one of these,
 * bias the geocoder toward that location so partial addresses resolve.
 */
const CITY_HINTS: Record<string, { lng: number; lat: number; country: string }> = {
    abuja:         { lng: 7.4951,    lat: 9.0579,   country: 'ng' },
    lagos:         { lng: 3.3792,    lat: 6.5244,   country: 'ng' },
    'port harcourt': { lng: 7.0498, lat: 4.8156,   country: 'ng' },
    ibadan:        { lng: 3.9470,    lat: 7.3775,   country: 'ng' },
    kano:          { lng: 8.5167,    lat: 12.0,     country: 'ng' },
    enugu:         { lng: 7.5085,    lat: 6.4584,   country: 'ng' },
    kaduna:        { lng: 7.4388,    lat: 10.5222,  country: 'ng' },
    'los angeles': { lng: -118.2437, lat: 34.0522,  country: 'us' },
    'new york':    { lng: -74.006,   lat: 40.7128,  country: 'us' },
    london:        { lng: -0.1276,   lat: 51.5074,  country: 'gb' },
    nairobi:       { lng: 36.8219,   lat: -1.2921,  country: 'ke' },
    accra:         { lng: -0.187,    lat: 5.6037,   country: 'gh' },
};

/**
 * Detect a city/region context from the query and return proximity bias params.
 */
function detectCityBias(query: string): { proximity?: string; country?: string } | null {
    const lower = query.toLowerCase();
    // Check longer keys first (e.g. "port harcourt" before "port")
    const sortedKeys = Object.keys(CITY_HINTS).sort((a, b) => b.length - a.length);
    for (const city of sortedKeys) {
        if (lower.includes(city)) {
            const hint = CITY_HINTS[city];
            return {
                proximity: `${hint.lng},${hint.lat}`,
                country: hint.country,
            };
        }
    }
    return null;
}

/**
 * Geocode using Mapbox Geocoding API (primary) with smart city bias,
 * then fall back to Nominatim if Mapbox returns nothing.
 */
export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;

    // 1. Check if user typed coordinates directly
    const directCoords = parseCoordinates(trimmed);
    if (directCoords) {
        return {
            name: `${directCoords.lat.toFixed(4)}, ${directCoords.lng.toFixed(4)}`,
            lat: directCoords.lat,
            lng: directCoords.lng,
        };
    }

    // 2. Check instant preset dictionary
    const normalized = trimmed.toLowerCase();
    if (PRESET_LOCATIONS[normalized]) {
        const preset = PRESET_LOCATIONS[normalized];
        return {
            name: preset.name,
            lat: preset.lat,
            lng: preset.lng,
        };
    }

    // 3. Try Mapbox Geocoding (much better than Nominatim for partial/fuzzy addresses)
    const token = getMapboxToken();
    if (token) {
        const mapboxResult = await geocodeWithMapbox(trimmed);
        if (mapboxResult) return mapboxResult;
    }

    // 4. Fallback to Nominatim
    return await geocodeWithNominatim(trimmed);
}

/**
 * Mapbox geocoding with automatic city/country bias detection.
 */
async function geocodeWithMapbox(query: string): Promise<GeocodedLocation | null> {
    try {
        const token = getMapboxToken();
        const bias = detectCityBias(query);
        const params = new URLSearchParams({
            access_token: token,
            limit: '1',
            language: 'en',
            types: 'address,poi,place,locality,neighborhood',
        });
        if (bias?.proximity) params.set('proximity', bias.proximity);
        if (bias?.country) params.set('country', bias.country);

        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const features = data.features;
        if (Array.isArray(features) && features.length > 0) {
            const first = features[0];
            const [lng, lat] = first.center;
            return {
                name: first.place_name ?? query,
                lat,
                lng,
            };
        }
    } catch (err) {
        console.warn('Mapbox geocoding failed:', err);
    }
    return null;
}

/**
 * Nominatim (OpenStreetMap) geocoding fallback.
 */
async function geocodeWithNominatim(query: string): Promise<GeocodedLocation | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            {
                headers: {
                    "Accept-Language": "en",
                },
            }
        );

        if (!response.ok) return null;

        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
            const first = results[0];
            return {
                name: first.display_name ?? query,
                lat: parseFloat(first.lat),
                lng: parseFloat(first.lon),
            };
        }
    } catch (err) {
        console.warn("Nominatim geocoding failed:", err);
    }

    return null;
}

/**
 * Calculates the exact Esri satellite tile URL for a given coordinate & zoom
 */
export function getSatelliteTileUrl(lat: number, lng: number, zoom: number = 16): string {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

/**
 * Calculates the exact Topographic / Terrain elevation tile URL
 */
export function getTopoTileUrl(lat: number, lng: number, zoom: number = 15): string {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${zoom}/${y}/${x}`;
}

/**
 * Calculates the exact Streets & Cadastral tile URL
 */
export function getStreetTileUrl(lat: number, lng: number, zoom: number = 15): string {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${x}`;
}

