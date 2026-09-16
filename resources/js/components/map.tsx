import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
    Polygon,
    Polyline,
    Tooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Pencil,
    Check,
    RotateCcw,
    Trash2,
    Sparkles,
    MapPin,
    MousePointerClick,
    Square,
    X,
    Move,
    Edit3,
} from 'lucide-react';
import {
    calculateParcelMetrics,
    calculateDistanceMeters,
    simplifyCoordinates,
    getPolygonEdgeMidpoints,
    ParcelMetrics,
} from '@/lib/geometry';

export interface ParcelPlot {
    coordinates: [number, number][];
    areaSqM: number;
    areaSqFt: number;
    areaAcres: number;
    perimeterMeters: number;
    formattedArea: string;
    formattedPerimeter: string;
}

export type DrawMode = 'freehand' | 'pins' | 'rectangle';

interface MapProps {
    className?: string;
    center?: [number, number];
    zoom?: number;
    markerLabel?: string;
    onPlotChange?: (plot: ParcelPlot | null) => void;
    initialPlot?: ParcelPlot | null;
    isDrawingActive?: boolean;
    onDrawingActiveChange?: (active: boolean) => void;
    invalidateSizeTrigger?: any;
}

// Custom pulsing center pin for Leaflet
const createCustomIcon = (label?: string) => {
    return L.divIcon({
        className: 'custom-map-marker',
        html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                <div style="
                    position: absolute;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(16, 185, 129, 0.35);
                    animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>
                <div style="
                    position: relative;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #10b981;
                    border: 2px solid #ffffff;
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.85);
                "></div>
            </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
};

// Draggable corner vertex handle
const createVertexIcon = () =>
    L.divIcon({
        className: 'parcel-vertex-pin',
        html: `
            <div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #ffffff;
                border: 2.5px solid #10b981;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.7), 0 2px 5px rgba(0,0,0,0.6);
                cursor: grab;
                margin-left: -7px;
                margin-top: -7px;
                transition: transform 0.15s ease;
            "></div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });

// Start corner pin (with pulsing closing target)
const createStartVertexIcon = () =>
    L.divIcon({
        className: 'parcel-start-vertex-pin',
        html: `
            <div style="
                position: relative;
                width: 18px;
                height: 18px;
                margin-left: -9px;
                margin-top: -9px;
                cursor: pointer;
            ">
                <div style="
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    background: rgba(16, 185, 129, 0.5);
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>
                <div style="
                    position: relative;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #10b981;
                    border: 2.5px solid #ffffff;
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.95), 0 2px 6px rgba(0,0,0,0.6);
                "></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });

// Midpoint handle icon for inserting intermediate vertices
const createMidpointIcon = () =>
    L.divIcon({
        className: 'parcel-midpoint-pin',
        html: `
            <div style="
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: rgba(16, 185, 129, 0.9);
                border: 1.5px solid #ffffff;
                box-shadow: 0 0 6px rgba(16, 185, 129, 0.8), 0 1px 4px rgba(0,0,0,0.5);
                cursor: pointer;
                margin-left: -6px;
                margin-top: -6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: 9px;
                font-weight: 800;
                line-height: 1;
                user-select: none;
            ">+</div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();

    useEffect(() => {
        map.flyTo(center, zoom, {
            duration: 1.5,
            easeLinearity: 0.25,
        });
    }, [center[0], center[1], zoom, map]);

    return null;
}

function MapAutoResize({ trigger }: { trigger?: any }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        const handleResize = () => {
            map.invalidateSize();
        };

        handleResize();

        const container = map.getContainer();
        if (!container || typeof ResizeObserver === 'undefined') return;

        let frameId: number;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(handleResize);
        });

        observer.observe(container);
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(frameId);
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [map]);

    useEffect(() => {
        if (!map) return;

        map.invalidateSize();
        const t1 = setTimeout(() => map.invalidateSize(), 50);
        const t2 = setTimeout(() => map.invalidateSize(), 150);
        const t3 = setTimeout(() => map.invalidateSize(), 300);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [map, trigger]);

    return null;
}

interface DrawingControllerProps {
    isDrawing: boolean;
    isEditing: boolean;
    drawMode: DrawMode;
    points: [number, number][];
    onAddPoint: (point: [number, number]) => void;
    onSetPoints: (points: [number, number][]) => void;
    onFinishDrawing: () => void;
    freehandStroke: [number, number][];
    setFreehandStroke: React.Dispatch<React.SetStateAction<[number, number][]>>;
    cursorPos: [number, number] | null;
    setCursorPos: (pos: [number, number] | null) => void;
    rectStart: [number, number] | null;
    setRectStart: (pos: [number, number] | null) => void;
    rectPreview: [number, number][] | null;
    setRectPreview: (pts: [number, number][] | null) => void;
}

function DrawingController({
    isDrawing,
    isEditing,
    drawMode,
    points,
    onAddPoint,
    onSetPoints,
    onFinishDrawing,
    freehandStroke,
    setFreehandStroke,
    cursorPos,
    setCursorPos,
    rectStart,
    setRectStart,
    rectPreview,
    setRectPreview,
}: DrawingControllerProps) {
    const map = useMap();
    const isPointerDownRef = useRef(false);
    const strokePointsRef = useRef<[number, number][]>([]);
    const lastTapTimeRef = useRef(0);

    // Disable Leaflet's built-in double-click & double-tap zoom when drawing or editing
    useEffect(() => {
        if (!map) return;
        if (isDrawing || isEditing) {
            map.doubleClickZoom.disable();
        } else {
            map.doubleClickZoom.enable();
        }
    }, [isDrawing, isEditing, map]);

    // Optimize container cursor and touch gestures to prevent browser double-tap zoom
    useEffect(() => {
        const container = map.getContainer();
        if (isDrawing) {
            container.style.cursor = 'crosshair';
            // Disable double-tap zoom and pan gestures on mobile during freehand drawing
            container.style.touchAction = drawMode === 'freehand' ? 'none' : 'manipulation';
        } else if (isEditing) {
            container.style.cursor = 'default';
            container.style.touchAction = 'manipulation';
        } else {
            container.style.cursor = '';
            container.style.touchAction = '';
        }
    }, [isDrawing, isEditing, drawMode, map]);

    useMapEvents({
        click(e) {
            if (!isDrawing) return;

            // In Corner Pins mode, single click adds a corner vertex
            if (drawMode === 'pins') {
                const now = Date.now();
                // Prevent rapid double-tap from adding redundant overlapping points
                if (now - lastTapTimeRef.current < 250 && points.length >= 3) {
                    onFinishDrawing();
                    lastTapTimeRef.current = now;
                    return;
                }
                lastTapTimeRef.current = now;
                onAddPoint([e.latlng.lat, e.latlng.lng]);
            } else if (drawMode === 'rectangle') {
                if (!rectStart) {
                    setRectStart([e.latlng.lat, e.latlng.lng]);
                } else {
                    const start = rectStart;
                    const end: [number, number] = [e.latlng.lat, e.latlng.lng];
                    const rectCorners: [number, number][] = [
                        [start[0], start[1]],
                        [start[0], end[1]],
                        [end[0], end[1]],
                        [end[0], start[1]],
                    ];
                    onSetPoints(rectCorners);
                    setRectStart(null);
                    setRectPreview(null);
                }
            }
        },
        dblclick(e) {
            L.DomEvent.stop(e);
            // Double-clicking or double-tapping completes the parcel polygon
            if (isDrawing && drawMode === 'pins' && points.length >= 3) {
                onFinishDrawing();
            }
        },
        mousemove(e) {
            if (!isDrawing) return;
            const current: [number, number] = [e.latlng.lat, e.latlng.lng];

            if (drawMode === 'pins') {
                setCursorPos(current);
            } else if (drawMode === 'rectangle' && rectStart) {
                const start = rectStart;
                const corners: [number, number][] = [
                    [start[0], start[1]],
                    [start[0], current[1]],
                    [current[0], current[1]],
                    [current[0], start[1]],
                ];
                setRectPreview(corners);
            } else if (drawMode === 'freehand' && isPointerDownRef.current) {
                const lastPt = strokePointsRef.current[strokePointsRef.current.length - 1];
                if (!lastPt || calculateDistanceMeters(lastPt, current) >= 1.2) {
                    strokePointsRef.current.push(current);
                    setFreehandStroke([...strokePointsRef.current]);
                }
            }
        },
    });

    // Handle Freehand Mouse & Touch Dragging directly on map container
    useEffect(() => {
        if (!isDrawing || drawMode !== 'freehand') {
            map.dragging.enable();
            return;
        }

        const container = map.getContainer();

        const handlePointerDown = (e: MouseEvent | TouchEvent) => {
            // Ignore events initiated on HUD buttons or markers
            const target = e.target as HTMLElement;
            if (target.closest('button') || target.closest('.leaflet-marker-icon')) {
                return;
            }

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const rect = container.getBoundingClientRect();
            const point = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);

            isPointerDownRef.current = true;
            map.dragging.disable();
            strokePointsRef.current = [[point.lat, point.lng]];
            setFreehandStroke([[point.lat, point.lng]]);
        };

        const handlePointerMove = (e: MouseEvent | TouchEvent) => {
            if (!isPointerDownRef.current) return;
            if (e.cancelable) e.preventDefault();

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const rect = container.getBoundingClientRect();
            const point = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
            const current: [number, number] = [point.lat, point.lng];

            const lastPt = strokePointsRef.current[strokePointsRef.current.length - 1];
            if (!lastPt || calculateDistanceMeters(lastPt, current) >= 1.2) {
                strokePointsRef.current.push(current);
                setFreehandStroke([...strokePointsRef.current]);
            }
        };

        const handlePointerUp = () => {
            if (!isPointerDownRef.current) return;
            isPointerDownRef.current = false;
            map.dragging.enable();

            const raw = strokePointsRef.current;
            if (raw.length >= 4) {
                // Simplify the freehand path into crisp, accurate polygon vertices
                const simplified = simplifyCoordinates(raw, 2.5);
                if (simplified.length >= 3) {
                    onSetPoints(simplified);
                }
            }
            strokePointsRef.current = [];
            setFreehandStroke([]);
        };

        container.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);

        container.addEventListener('touchstart', handlePointerDown, { passive: false });
        window.addEventListener('touchmove', handlePointerMove, { passive: false });
        window.addEventListener('touchend', handlePointerUp);

        return () => {
            map.dragging.enable();
            container.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('mouseup', handlePointerUp);

            container.removeEventListener('touchstart', handlePointerDown);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, [isDrawing, drawMode, map, onSetPoints, setFreehandStroke]);

    return null;
}

export function Map({
    className = '',
    center = [34.0537, -118.2551],
    zoom = 15.2,
    markerLabel,
    onPlotChange,
    initialPlot,
    isDrawingActive,
    onDrawingActiveChange,
    invalidateSizeTrigger,
}: MapProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [internalIsDrawing, setInternalIsDrawing] = useState(false);
    const isDrawing = isDrawingActive !== undefined ? isDrawingActive : internalIsDrawing;
    const setIsDrawing = useCallback(
        (val: boolean) => {
            setInternalIsDrawing(val);
            onDrawingActiveChange?.(val);
        },
        [onDrawingActiveChange]
    );
    const [isEditing, setIsEditing] = useState(false);
    const [drawMode, setDrawMode] = useState<DrawMode>('freehand');

    const [points, setPoints] = useState<[number, number][]>(initialPlot?.coordinates || []);
    const [metrics, setMetrics] = useState<ParcelMetrics | null>(null);

    // Freehand and Rectangle drawing previews
    const [freehandStroke, setFreehandStroke] = useState<[number, number][]>([]);
    const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
    const [rectStart, setRectStart] = useState<[number, number] | null>(null);
    const [rectPreview, setRectPreview] = useState<[number, number][] | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (points.length >= 3) {
            const m = calculateParcelMetrics(points);
            setMetrics(m);
        } else {
            setMetrics(null);
        }
    }, [points]);

    const handleAddPoint = useCallback((newPoint: [number, number]) => {
        setPoints((prev) => [...prev, newPoint]);
    }, []);

    const handleUpdateVertex = useCallback((index: number, newCoord: [number, number]) => {
        setPoints((prev) => {
            const updated = [...prev];
            updated[index] = newCoord;
            return updated;
        });
    }, []);

    const handleInsertVertex = useCallback((insertIndex: number, newCoord: [number, number]) => {
        setPoints((prev) => {
            const updated = [...prev];
            updated.splice(insertIndex, 0, newCoord);
            return updated;
        });
    }, []);

    const handleDeleteVertex = useCallback((index: number) => {
        setPoints((prev) => {
            if (prev.length <= 3) return prev;
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    const handleUndoPoint = () => {
        setPoints((prev) => prev.slice(0, -1));
    };

    const handleClearPlot = () => {
        setPoints([]);
        setMetrics(null);
        setIsDrawing(false);
        setIsEditing(false);
        setFreehandStroke([]);
        setRectStart(null);
        setRectPreview(null);
        onPlotChange?.(null);
    };

    const handleFinishDrawing = () => {
        if (points.length >= 3) {
            const m = calculateParcelMetrics(points);
            const plotData: ParcelPlot = {
                coordinates: points,
                areaSqM: m.areaSqM,
                areaSqFt: m.areaSqFt,
                areaAcres: m.areaAcres,
                perimeterMeters: m.perimeterMeters,
                formattedArea: m.formattedArea,
                formattedPerimeter: m.formattedPerimeter,
            };
            setIsDrawing(false);
            setIsEditing(false);
            setFreehandStroke([]);
            setRectStart(null);
            setRectPreview(null);
            onPlotChange?.(plotData);
        }
    };

    const handleSaveEdits = () => {
        if (points.length >= 3) {
            const m = calculateParcelMetrics(points);
            const plotData: ParcelPlot = {
                coordinates: points,
                areaSqM: m.areaSqM,
                areaSqFt: m.areaSqFt,
                areaAcres: m.areaAcres,
                perimeterMeters: m.perimeterMeters,
                formattedArea: m.formattedArea,
                formattedPerimeter: m.formattedPerimeter,
            };
            setIsEditing(false);
            onPlotChange?.(plotData);
        }
    };

    if (!isMounted) {
        return (
            <div className={`w-full h-full min-h-[400px] flex items-center justify-center bg-[#101313] text-[#777d78] text-xs ${className}`}>
                Loading satellite map...
            </div>
        );
    }

    const centerIcon = createCustomIcon(markerLabel);
    const vertexIcon = createVertexIcon();
    const startVertexIcon = createStartVertexIcon();
    const midpointIcon = createMidpointIcon();
    const edgeMidpoints = (isDrawing || isEditing) && points.length >= 3 ? getPolygonEdgeMidpoints(points) : [];

    return (
        <div className={`relative w-full h-full min-h-[400px] z-0 overflow-hidden select-none ${className}`}>
            {/* Top Toolbar Overlay - Prominently on top of map */}
            <div className="absolute top-4 left-4 z-[1200] flex flex-wrap items-center gap-2 pointer-events-auto">
                {!isDrawing && !isEditing ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsDrawing(true);
                                setIsEditing(false);
                            }}
                            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-[0_10px_30px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all cursor-pointer ${
                                points.length >= 3
                                    ? 'border-emerald-500/60 bg-[#0d1413]/95 text-emerald-300 hover:bg-[#152220]'
                                    : 'border-emerald-500/50 bg-[#0d1413]/95 text-white hover:border-emerald-400 hover:bg-[#152220] hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] active:scale-95'
                            }`}
                        >
                            <span className="flex items-center justify-center size-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                <Pencil className="size-3.5" />
                            </span>
                            <span>{points.length >= 3 ? 'Redraw Parcel' : 'Draw Land Boundary'}</span>
                        </button>

                        {points.length >= 3 && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1.5 rounded-xl border border-[#38413e] bg-[#0d1413]/95 px-3 py-2 text-xs font-semibold text-[#e1e5e0] shadow-xl backdrop-blur-md transition-all hover:border-emerald-500/60 hover:text-emerald-300 hover:bg-[#152220] cursor-pointer"
                                title="Adjust corner pins by dragging them"
                            >
                                <Edit3 className="size-3.5 text-emerald-400" />
                                <span>Adjust Corners</span>
                            </button>
                        )}
                    </div>
                ) : isEditing ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-[#0d1413]/95 px-3.5 py-2 text-xs text-emerald-300 shadow-2xl backdrop-blur-md">
                        <Move className="size-3.5 text-emerald-400" />
                        <span className="font-semibold text-white">Corner Adjustment Mode</span>
                        <span className="hidden sm:inline text-[11px] text-emerald-400/80 border-l border-emerald-800/60 pl-2">
                            Drag white pins to reposition • Click [+] to insert a corner
                        </span>
                        <button
                            type="button"
                            onClick={handleSaveEdits}
                            className="ml-2 flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-emerald-400 cursor-pointer"
                        >
                            <Check className="size-3 stroke-[3]" />
                            <span>Done</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-[#0d1413]/95 px-3.5 py-2 text-xs text-emerald-300 shadow-2xl backdrop-blur-md">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="font-semibold text-white">Boundary Demarcation</span>
                    </div>
                )}

                {points.length >= 3 && !isDrawing && !isEditing && (
                    <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-[#0d1715]/95 px-3 py-2 text-[11px] text-emerald-300 shadow-xl backdrop-blur-md">
                        <Sparkles className="size-3 text-emerald-400" />
                        <span>Demarcated Plot:</span>
                        <span className="font-bold text-white">{metrics?.formattedArea}</span>
                    </div>
                )}
            </div>

            {/* Drawing Controls Floating HUD */}
            {isDrawing && (
                <div className="absolute top-16 left-4 right-4 sm:right-auto z-[1200] flex flex-col gap-2 rounded-xl border border-[#2e3734] bg-[#101414]/95 p-2.5 shadow-2xl backdrop-blur-md pointer-events-auto max-w-full sm:max-w-xl">
                    {/* Top Row: Mode Switcher + Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Mode Selector Tabs */}
                        <div className="flex items-center rounded-lg bg-[#0b0e0e] p-0.5 border border-[#242b29]">
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawMode('freehand');
                                    setRectStart(null);
                                    setRectPreview(null);
                                }}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                    drawMode === 'freehand'
                                        ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                                        : 'text-[#9ca39f] hover:text-white hover:bg-[#161c1a]'
                                }`}
                                title="Freehand Pencil: Drag your finger or mouse to draw"
                            >
                                <Pencil className="size-3.5" />
                                <span>Freehand Pencil</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setDrawMode('pins');
                                    setFreehandStroke([]);
                                    setRectStart(null);
                                    setRectPreview(null);
                                }}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                    drawMode === 'pins'
                                        ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                                        : 'text-[#9ca39f] hover:text-white hover:bg-[#161c1a]'
                                }`}
                                title="Corner Pins: Tap or click each corner"
                            >
                                <MousePointerClick className="size-3.5" />
                                <span>Corner Pins</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setDrawMode('rectangle');
                                    setFreehandStroke([]);
                                    setRectStart(null);
                                    setRectPreview(null);
                                }}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                    drawMode === 'rectangle'
                                        ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                                        : 'text-[#9ca39f] hover:text-white hover:bg-[#161c1a]'
                                }`}
                                title="Rectangle: Drag opposite corners"
                            >
                                <Square className="size-3.5" />
                                <span>Rectangle</span>
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 ml-auto">
                            {drawMode === 'pins' && (
                                <button
                                    type="button"
                                    onClick={handleUndoPoint}
                                    disabled={points.length === 0}
                                    className="flex items-center gap-1 rounded-md border border-[#303835] bg-[#161c1b] px-2 py-1 text-xs text-[#c4cbc6] transition hover:bg-[#202726] disabled:opacity-30"
                                    title="Undo last placed corner"
                                >
                                    <RotateCcw className="size-3" />
                                    <span className="hidden xs:inline">Undo</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleClearPlot}
                                className="flex items-center gap-1 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1 text-xs text-red-400 transition hover:bg-red-950/40"
                                title="Clear entire boundary"
                            >
                                <Trash2 className="size-3" />
                                <span className="hidden xs:inline">Clear</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleFinishDrawing}
                                disabled={points.length < 3}
                                className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-bold text-black shadow-lg transition hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500"
                            >
                                <Check className="size-3.5 stroke-[3]" />
                                <span>Finish</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsDrawing(false);
                                    setFreehandStroke([]);
                                    setRectStart(null);
                                    setRectPreview(null);
                                }}
                                className="flex items-center rounded-md border border-[#303835] bg-[#161c1b] p-1 text-xs text-[#8e9792] transition hover:text-white"
                                title="Cancel drawing"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Contextual Helper & Stats */}
                    <div className="flex items-center justify-between border-t border-[#1d2422] pt-1.5 px-1 text-[11px]">
                        <div className="text-[#a4aca6]">
                            {drawMode === 'freehand' && (
                                <span>
                                    ✏️ <strong className="text-emerald-300">Touch or click & drag</strong> to trace the boundary. Release to close.
                                </span>
                            )}
                            {drawMode === 'pins' && (
                                <span>
                                    📐 <strong className="text-emerald-300">Click corners</strong> to place pins. Double-click or tap start pin to finish.
                                </span>
                            )}
                            {drawMode === 'rectangle' && (
                                <span>
                                    ⏹️ <strong className="text-emerald-300">Click two opposite corners</strong> to create a rectangular lot.
                                </span>
                            )}
                        </div>

                        {metrics ? (
                            <span className="font-semibold text-emerald-400 ml-2 whitespace-nowrap">
                                {metrics.formattedArea}
                            </span>
                        ) : (
                            <span className="text-[#68706b] ml-2 whitespace-nowrap">
                                {points.length} {points.length === 1 ? 'Corner' : 'Corners'}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Leaflet Satellite Map */}
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
                zoomControl={false}
                attributionControl={false}
                doubleClickZoom={!isDrawing && !isEditing}
            >
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={18}
                />

                <MapRecenter center={center} zoom={zoom} />
                <MapAutoResize trigger={invalidateSizeTrigger} />

                <DrawingController
                    isDrawing={isDrawing}
                    isEditing={isEditing}
                    drawMode={drawMode}
                    points={points}
                    onAddPoint={handleAddPoint}
                    onSetPoints={setPoints}
                    onFinishDrawing={handleFinishDrawing}
                    freehandStroke={freehandStroke}
                    setFreehandStroke={setFreehandStroke}
                    cursorPos={cursorPos}
                    setCursorPos={setCursorPos}
                    rectStart={rectStart}
                    setRectStart={setRectStart}
                    rectPreview={rectPreview}
                    setRectPreview={setRectPreview}
                />

                {/* Primary search center marker */}
                {!isDrawing && (
                    <Marker position={center} icon={centerIcon}>
                        {markerLabel && (
                            <Popup>
                                <div className="text-xs font-sans font-medium text-slate-900 py-0.5">
                                    {markerLabel}
                                </div>
                            </Popup>
                        )}
                    </Marker>
                )}

                {/* Drawn Boundary Polygon */}
                {points.length >= 3 && (
                    <Polygon
                        positions={points}
                        pathOptions={{
                            color: '#10b981',
                            weight: isDrawing ? 2 : 2.5,
                            dashArray: isDrawing ? '6, 6' : undefined,
                            fillColor: '#10b981',
                            fillOpacity: isDrawing ? 0.2 : 0.28,
                        }}
                    >
                        {!isDrawing && (
                            <Tooltip sticky>
                                <div className="text-xs font-sans font-semibold text-slate-900">
                                    {metrics?.formattedArea || 'Land Parcel'}
                                </div>
                            </Tooltip>
                        )}
                    </Polygon>
                )}

                {/* In-progress Polyline for Corner Pins (if 1 or 2 points) */}
                {isDrawing && drawMode === 'pins' && points.length === 2 && (
                    <Polyline
                        positions={points}
                        pathOptions={{
                            color: '#10b981',
                            weight: 2.5,
                            dashArray: '6, 6',
                        }}
                    />
                )}

                {/* Guideline connecting last placed pin to active cursor */}
                {isDrawing && drawMode === 'pins' && points.length >= 1 && cursorPos && (
                    <Polyline
                        positions={[points[points.length - 1], cursorPos]}
                        pathOptions={{
                            color: '#34d399',
                            weight: 1.8,
                            dashArray: '4, 4',
                            opacity: 0.75,
                        }}
                    />
                )}

                {/* Freehand Live Stroke Polyline */}
                {isDrawing && drawMode === 'freehand' && freehandStroke.length >= 2 && (
                    <Polyline
                        positions={freehandStroke}
                        pathOptions={{
                            color: '#10b981',
                            weight: 3,
                            opacity: 0.9,
                        }}
                    />
                )}

                {/* Rectangle Drag Preview */}
                {isDrawing && drawMode === 'rectangle' && rectPreview && (
                    <Polygon
                        positions={rectPreview}
                        pathOptions={{
                            color: '#10b981',
                            weight: 2,
                            dashArray: '5, 5',
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                        }}
                    />
                )}

                {/* Draggable Corner Vertices (Interactive in both Drawing & Editing modes) */}
                {(isDrawing || isEditing) &&
                    points.map((pt, idx) => {
                        const isStartPoint = idx === 0 && points.length >= 3;
                        return (
                            <Marker
                                key={`vertex-${idx}`}
                                position={pt}
                                draggable={true}
                                icon={isStartPoint && isDrawing ? startVertexIcon : vertexIcon}
                                eventHandlers={{
                                    drag: (e) => {
                                        const newLatLng = e.target.getLatLng();
                                        handleUpdateVertex(idx, [newLatLng.lat, newLatLng.lng]);
                                    },
                                    click: () => {
                                        if (isDrawing && isStartPoint) {
                                            handleFinishDrawing();
                                        }
                                    },
                                }}
                            >
                                {isDrawing && isStartPoint && (
                                    <Tooltip direction="top" offset={[0, -12]} opacity={0.95} permanent>
                                        <span className="text-[10px] font-bold text-emerald-800">
                                            Click to close parcel
                                        </span>
                                    </Tooltip>
                                )}
                                {isEditing && points.length > 3 && (
                                    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                                        <div className="text-[10px] font-medium text-slate-800 flex items-center gap-1">
                                            <span>Corner #{idx + 1} (Drag to adjust)</span>
                                            <button
                                                type="button"
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    handleDeleteVertex(idx);
                                                }}
                                                className="text-red-600 font-bold ml-1 hover:underline"
                                            >
                                                ✕ Delete
                                            </button>
                                        </div>
                                    </Tooltip>
                                )}
                            </Marker>
                        );
                    })}

                {/* Midpoint Insertion Handles */}
                {(isDrawing || isEditing) &&
                    points.length >= 3 &&
                    edgeMidpoints.map((mp, idx) => (
                        <Marker
                            key={`midpoint-${idx}-${mp.point[0]}-${mp.point[1]}`}
                            position={mp.point}
                            icon={midpointIcon}
                            eventHandlers={{
                                click: () => {
                                    handleInsertVertex(mp.index, mp.point);
                                },
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                                <span className="text-[10px] font-semibold text-emerald-800">
                                    Click to add corner
                                </span>
                            </Tooltip>
                        </Marker>
                    ))}
            </MapContainer>
        </div>
    );
}
