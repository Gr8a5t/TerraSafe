/**
 * Spherical geometry utilities for land parcel boundary calculations.
 * Uses WGS84 Earth radius (6,378,137m) for accurate geodesic area and perimeter.
 */

const EARTH_RADIUS_METERS = 6378137;
const SQM_TO_SQFT = 10.7639104;
const SQM_TO_ACRES = 0.000247105;
const SQM_TO_HECTARES = 0.0001;
const METERS_TO_FEET = 3.28084;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Calculates geodesic distance between two [lat, lng] points using Haversine formula.
 */
export function calculateDistanceMeters(
    p1: [number, number],
    p2: [number, number]
): number {
    const lat1 = toRadians(p1[0]);
    const lon1 = toRadians(p1[1]);
    const lat2 = toRadians(p2[0]);
    const lon2 = toRadians(p2[1]);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates perimeter of a closed or open polygon.
 */
export function calculatePerimeterMeters(
    coordinates: [number, number][],
    isClosed = true
): number {
    if (coordinates.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        total += calculateDistanceMeters(coordinates[i], coordinates[i + 1]);
    }

    if (isClosed && coordinates.length >= 3) {
        total += calculateDistanceMeters(coordinates[coordinates.length - 1], coordinates[0]);
    }

    return total;
}

/**
 * Calculates spherical area of a polygon using the spherical excess / Gauss-Bonnet theorem.
 * Input coordinates: [[lat, lng], [lat, lng], ...]
 */
export function calculatePolygonAreaSqM(coordinates: [number, number][]): number {
    if (coordinates.length < 3) return 0;

    let total = 0;
    const len = coordinates.length;

    for (let i = 0; i < len; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % len];
        const p3 = coordinates[(i + 2) % len];

        const lat1 = toRadians(p1[0]);
        const lon2 = toRadians(p2[1]);
        const lat3 = toRadians(p3[0]);

        // Spherical excess component
        total += (lon2 - toRadians(p1[1])) * (2 + Math.sin(lat1) + Math.sin(lat3));
    }

    // Standard formula: Area = R^2/2 * |Sum (lon_{i+1} - lon_{i-1}) * sin(lat_i)|
    let sum = 0;
    for (let i = 0; i < len; i++) {
        const prev = coordinates[(i - 1 + len) % len];
        const curr = coordinates[i];
        const next = coordinates[(i + 1) % len];

        const lat = toRadians(curr[0]);
        const dLon = toRadians(next[1]) - toRadians(prev[1]);
        sum += dLon * Math.sin(lat);
    }

    const area = (Math.abs(sum) * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2;
    return area;
}

export interface ParcelMetrics {
    areaSqM: number;
    areaSqFt: number;
    areaAcres: number;
    areaHectares: number;
    perimeterMeters: number;
    perimeterFt: number;
    formattedArea: string;
    formattedPerimeter: string;
    vertexCount: number;
}

/**
 * Full parcel metrics generator from an array of [lat, lng] coordinates.
 */
export function calculateParcelMetrics(coordinates: [number, number][]): ParcelMetrics {
    const vertexCount = coordinates.length;
    if (vertexCount < 3) {
        const perimeter = calculatePerimeterMeters(coordinates, false);
        return {
            areaSqM: 0,
            areaSqFt: 0,
            areaAcres: 0,
            areaHectares: 0,
            perimeterMeters: perimeter,
            perimeterFt: perimeter * METERS_TO_FEET,
            formattedArea: "0 m²",
            formattedPerimeter: `${Math.round(perimeter)} m`,
            vertexCount,
        };
    }

    const areaSqM = calculatePolygonAreaSqM(coordinates);
    const areaSqFt = areaSqM * SQM_TO_SQFT;
    const areaAcres = areaSqM * SQM_TO_ACRES;
    const areaHectares = areaSqM * SQM_TO_HECTARES;
    const perimeterMeters = calculatePerimeterMeters(coordinates, true);
    const perimeterFt = perimeterMeters * METERS_TO_FEET;

    let formattedArea = "";
    if (areaAcres >= 1) {
        formattedArea = `${areaAcres.toFixed(2)} Acres (${Math.round(areaSqM).toLocaleString()} m²)`;
    } else {
        formattedArea = `${Math.round(areaSqM).toLocaleString()} m² (${Math.round(areaSqFt).toLocaleString()} SF)`;
    }

    const formattedPerimeter = `${Math.round(perimeterMeters).toLocaleString()} m (${Math.round(perimeterFt).toLocaleString()} ft)`;

    return {
        areaSqM,
        areaSqFt,
        areaAcres,
        areaHectares,
        perimeterMeters,
        perimeterFt,
        formattedArea,
        formattedPerimeter,
        vertexCount,
    };
}

/**
 * Calculates perpendicular distance from a point to a line segment in approximate meters.
 */
function pointToSegmentDistanceMeters(
    p: [number, number],
    a: [number, number],
    b: [number, number]
): number {
    const cosLat = Math.cos((a[0] * Math.PI) / 180);
    const x = (p[1] - a[1]) * 111320 * cosLat;
    const y = (p[0] - a[0]) * 110540;
    const bx = (b[1] - a[1]) * 111320 * cosLat;
    const by = (b[0] - a[0]) * 110540;

    const lenSq = bx * bx + by * by;
    if (lenSq === 0) return Math.hypot(x, y);

    const t = Math.max(0, Math.min(1, (x * bx + y * by) / lenSq));
    const projX = t * bx;
    const projY = t * by;
    return Math.hypot(x - projX, y - projY);
}

/**
 * Simplifies a polyline or polygon using the Ramer-Douglas-Peucker algorithm.
 * Reduces raw touch/mouse drag points into a clean polygon boundary.
 */
export function simplifyCoordinates(
    coords: [number, number][],
    toleranceMeters: number = 2.0
): [number, number][] {
    if (coords.length <= 2) return coords;

    let maxDist = 0;
    let maxIndex = 0;
    const start = coords[0];
    const end = coords[coords.length - 1];

    for (let i = 1; i < coords.length - 1; i++) {
        const dist = pointToSegmentDistanceMeters(coords[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    if (maxDist > toleranceMeters) {
        const left = simplifyCoordinates(coords.slice(0, maxIndex + 1), toleranceMeters);
        const right = simplifyCoordinates(coords.slice(maxIndex), toleranceMeters);
        return [...left.slice(0, -1), ...right];
    }

    return [start, end];
}

/**
 * Computes midpoints between consecutive vertices of a polygon for midpoint insertion handles.
 */
export function getPolygonEdgeMidpoints(coordinates: [number, number][]): {
    index: number;
    point: [number, number];
}[] {
    if (coordinates.length < 3) return [];
    const midpoints: { index: number; point: [number, number] }[] = [];
    const len = coordinates.length;

    for (let i = 0; i < len; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % len];
        midpoints.push({
            index: i + 1, // index where a new point will be inserted
            point: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2],
        });
    }

    return midpoints;
}
