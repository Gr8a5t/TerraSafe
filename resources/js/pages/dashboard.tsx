import { Head } from "@inertiajs/react";
import { Map, ParcelPlot } from "@/components/map";
import { StreetViewModal } from "@/components/street-view-modal";
import { AskAnalystDrawer } from "@/components/ask-analyst-drawer";
import { FormattedAiResponse } from "@/components/formatted-ai-response";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Compass,
    Download,
    Eye,
    Layers3,
    Loader2,
    MapPin,
    Maximize2,
    Pencil,
    Plus,
    Search,
    Sparkles,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { geocodeLocation, parseCoordinates, PRESET_LOCATIONS, getSatelliteTileUrl, getTopoTileUrl, getStreetTileUrl } from "@/lib/geocoding";

const constraints = [
    ["Fire Hazard Zone", "Not in fire hazard area"],
    ["Earthquake Fault Zone", "Not in fault zone"],
    ["Liquefaction Zone", "Not in liquefaction zone"],
    ["Landslide Zone", "Not in landslide zone"],
    ["Historic Preservation (HPOZ)", "Not in HPOZ district"],
];

const neighborhoodStats = [
    ["Crime Incidents (1yr)", "159", "LAPD"],
    ["Serious Crimes (Part I)", "102", "LAPD"],
    ["Top Crime Type", "Property theft", "31"],
];

type AnalysisZoneCollection = {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        properties: { color: string };
        geometry: { type: "Polygon"; coordinates: number[][][] };
    }>;
};

const analysisZones: AnalysisZoneCollection = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { color: "#8f3f43" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.262, 34.056],
                        [-118.258, 34.058],
                        [-118.253, 34.056],
                        [-118.254, 34.052],
                        [-118.26, 34.052],
                        [-118.262, 34.056],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { color: "#3c754d" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.257, 34.061],
                        [-118.251, 34.06],
                        [-118.248, 34.056],
                        [-118.253, 34.056],
                        [-118.257, 34.061],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { color: "#6c5833" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.253, 34.056],
                        [-118.248, 34.056],
                        [-118.246, 34.051],
                        [-118.252, 34.05],
                        [-118.253, 34.056],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { color: "#463e76" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [-118.26, 34.052],
                        [-118.254, 34.052],
                        [-118.252, 34.047],
                        [-118.258, 34.047],
                        [-118.26, 34.052],
                    ],
                ],
            },
        },
    ],
};

const analysisPoints = [
    [-118.2551, 34.0537],
    [-118.257, 34.0545],
    [-118.2537, 34.0552],
    [-118.2525, 34.0525],
    [-118.2565, 34.0517],
    [-118.2508, 34.0508],
    [-118.258, 34.052],
    [-118.254, 34.0495],
    [-118.2495, 34.053],
    [-118.259, 34.056],
    [-118.256, 34.057],
    [-118.2518, 34.0568],
    [-118.2488, 34.055],
    [-118.2478, 34.052],
    [-118.251, 34.049],
    [-118.2555, 34.0485],
    [-118.259, 34.05],
    [-118.2528, 34.054],
    [-118.2548, 34.056],
    [-118.2498, 34.0515],
    [-118.2575, 34.0505],
    [-118.253, 34.051],
];

const streetImageUrl =
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=80";

const satelliteImageUrl =
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=900&q=80";

export default function Dashboard() {
    const [mapError, setMapError] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const [coords, setCoords] = useState<[number, number]>([34.0537, -118.2551]);
    const [activeLocationName, setActiveLocationName] = useState("633 W 5th St, Los Angeles, CA 90071, USA");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
    const [streetViewOpen, setStreetViewOpen] = useState(false);

    // Land Boundary Drawing & AI Analyst State
    const [drawnPlot, setDrawnPlot] = useState<ParcelPlot | null>(null);
    const [isDrawingMap, setIsDrawingMap] = useState(false);
    const [aiAssessment, setAiAssessment] = useState<string | null>(null);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [askAnalystOpen, setAskAnalystOpen] = useState(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const q = searchParams.get("q");
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");

        if (lat && lng) {
            const parsedLat = parseFloat(lat);
            const parsedLng = parseFloat(lng);
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                setCoords([parsedLat, parsedLng]);
                if (q) {
                    setActiveLocationName(q);
                    setSearchQuery(q);
                }
                return;
            }
        }

        if (q) {
            setSearchQuery(q);
            setIsSearching(true);
            geocodeLocation(q).then((res) => {
                setIsSearching(false);
                if (res) {
                    setCoords([res.lat, res.lng]);
                    setActiveLocationName(res.name);
                }
            });
        }
    }, []);

    const handlePlotChange = async (plot: ParcelPlot | null) => {
        setDrawnPlot(plot);
        if (!plot || plot.areaSqM <= 0) {
            setAiAssessment(null);
            return;
        }

        setIsGeneratingAi(true);
        try {
            const csrfToken = (typeof document !== 'undefined' && (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content) || '';
            const res = await fetch('/api/ai/site-assessment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    location_name: activeLocationName,
                    coordinates: plot.coordinates,
                    area_sqm: plot.areaSqM,
                    area_sqft: plot.areaSqFt,
                    area_acres: plot.areaAcres,
                    perimeter_meters: plot.perimeterMeters,
                    center: coords,
                }),
            });
            const data = await res.json();
            if (data.success && data.assessment) {
                setAiAssessment(data.assessment);
            }
        } catch (err) {
            console.error("AI assessment failed", err);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleDashboardSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;

        setIsSearching(true);
        const result = await geocodeLocation(query);
        setIsSearching(false);

        if (result) {
            setCoords([result.lat, result.lng]);
            setActiveLocationName(result.name);
            setDrawnPlot(null);
            setAiAssessment(null);
            const url = new URL(window.location.href);
            url.searchParams.set("q", result.name);
            url.searchParams.set("lat", result.lat.toString());
            url.searchParams.set("lng", result.lng.toString());
            window.history.replaceState({}, "", url.toString());
        }
    };

    return (
        <>
            <Head title="Land Analysis" />
            <div className="min-h-screen xl:h-screen xl:overflow-hidden bg-[#090b0c] text-[#d7d9d6]">
                <div className={`grid min-h-screen xl:h-full ${detailsOpen ? "xl:grid-cols-[218px_minmax(420px,1fr)_minmax(0,1.42fr)]" : "xl:grid-cols-[218px_1fr]"}`}>
                    <aside className="border-b border-[#242727] bg-[#101212] p-3 xl:h-full xl:overflow-y-auto xl:border-r xl:border-b-0 scrollbar-none">
                        <div className="flex items-center justify-between border-b border-[#292d2d] pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#aeb2ad]">
                            <span className="truncate mr-2">{activeLocationName.split(",")[0]} Engine</span>
                            <span className="text-[#f2c44f] shrink-0">&#9679;</span>
                        </div>
                        <div className="grid grid-cols-2 border-b border-[#292d2d] text-[10px] uppercase tracking-[0.12em] text-[#7d827e]">
                            <div className="flex items-center justify-center gap-1 border-b border-[#c4c6c1] py-3 text-[#d8dad5]">
                                <Layers3 className="size-3" /> Layers
                            </div>
                            <div className="flex items-center justify-center gap-1 py-3">
                                <Eye className="size-3" /> Analysis
                            </div>
                        </div>
                        <div className="border-b border-[#292d2d] py-3 text-[10px] font-semibold text-[#d2d5d0] truncate" title={activeLocationName}>
                            {activeLocationName}
                        </div>
                        <div className="py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8d928e]">
                            Live Geospatial Sensors
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 gap-3">
                            {/* Google Street View 360° */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-[#777d78]">
                                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                        <Compass className="size-2.5" /> Google 360° Street View
                                    </span>
                                    <span
                                        className="text-[8px] text-emerald-400 font-bold cursor-pointer hover:underline"
                                        onClick={() => setStreetViewOpen(true)}
                                    >
                                        Launch &rarr;
                                    </span>
                                </div>
                                <div
                                    onClick={() => setStreetViewOpen(true)}
                                    className="group relative h-32 sm:h-36 w-full cursor-pointer overflow-hidden rounded-xl border border-emerald-500/30 bg-[#121918] transition hover:border-emerald-400/60 shadow-lg"
                                >
                                    {/* Google Street View Live Embed Preview */}
                                    <iframe
                                        src={`https://maps.google.com/maps?q=${coords[0]},${coords[1]}&layer=c&cbll=${coords[0]},${coords[1]}&cbp=11,0,0,0,0&output=embed`}
                                        title="Google Street View Preview"
                                        className="size-full border-0 pointer-events-none opacity-80 transition group-hover:opacity-100 group-hover:scale-105 duration-300"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                                    <div className="absolute top-2 right-2 rounded-md bg-black/80 border border-white/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300 backdrop-blur-sm pointer-events-none">
                                        Interactive 360°
                                    </div>
                                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[9px] font-semibold text-white pointer-events-none">
                                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>Click to Explore 360°</span>
                                    </div>
                                </div>
                            </div>

                            {/* Satellite Live Sensor Tile */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-[#777d78]">
                                    <span>Satellite Sensor</span>
                                    <span className="text-[8px] text-[#10b981] font-semibold">Esri World Imagery</span>
                                </div>
                                <div
                                    onClick={() =>
                                        setPreviewImage({
                                            url: getSatelliteTileUrl(coords[0], coords[1], 17),
                                            title: `${activeLocationName} - High-Resolution Satellite Imagery`,
                                        })
                                    }
                                    className="group relative h-28 sm:h-32 w-full cursor-pointer overflow-hidden rounded-xl border border-[#303535] bg-[#182527] transition hover:border-emerald-500/40"
                                >
                                    <img
                                        src={getSatelliteTileUrl(coords[0], coords[1], 16)}
                                        alt="Satellite imagery"
                                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Maximize2 className="size-4 text-white drop-shadow" />
                                    </div>
                                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-mono text-white/90">
                                        {coords[0].toFixed(3)}°, {coords[1].toFixed(3)}°
                                    </span>
                                    <span className="absolute top-1.5 right-1.5 rounded bg-[#10b981]/90 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-black">
                                        Live Sensor
                                    </span>
                                </div>
                            </div>

                            {/* Topography & Elevation Sensor */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-[#777d78]">
                                    <span>Topography &amp; Slope</span>
                                    <span className="text-[8px] text-[#e0a442] font-semibold">Elevation Model</span>
                                </div>
                                <div
                                    onClick={() =>
                                        setPreviewImage({
                                            url: getTopoTileUrl(coords[0], coords[1], 15),
                                            title: `${activeLocationName} - Topography & Elevation Model`,
                                        })
                                    }
                                    className="group relative h-24 sm:h-28 w-full cursor-pointer overflow-hidden rounded-xl border border-[#303535] bg-[#24211a] transition hover:border-amber-500/40"
                                >
                                    <img
                                        src={getTopoTileUrl(coords[0], coords[1], 15)}
                                        alt="Topography elevation"
                                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Maximize2 className="size-4 text-white drop-shadow" />
                                    </div>
                                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] text-white/90">
                                        Terrain Contours
                                    </span>
                                    <span className="absolute top-1.5 right-1.5 rounded bg-[#e0a442]/90 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-black">
                                        Elevation
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-[#8d928e]">
                            <span>AI Analysis</span>
                            {drawnPlot && (
                                <span className="flex items-center gap-1 text-[8px] text-emerald-400 normal-case font-medium">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Parcel Active
                                </span>
                            )}
                        </div>
                        <div className="mt-2 rounded border border-[#303535] bg-[#181b1b] p-2.5 text-[9px] text-[#a5aaa5]">
                            {isGeneratingAi ? (
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Loader2 className="size-3 animate-spin" />
                                    <span>Analyzing drawn parcel...</span>
                                </div>
                            ) : drawnPlot ? (
                                <div className="space-y-1.5">
                                    <div className="font-semibold text-white flex items-center gap-1">
                                        <Sparkles className="size-2.5 text-emerald-400" /> {drawnPlot.formattedArea}
                                    </div>
                                    <div className="text-[#8e9690] text-[8px]">
                                        Perimeter: {drawnPlot.formattedPerimeter}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAskAnalystOpen(true)}
                                        className="mt-1.5 w-full rounded bg-emerald-500/20 border border-emerald-500/40 py-1 text-[9px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition text-center cursor-pointer"
                                    >
                                        Chat with Analyst
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <span>Site assessment ready.</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsDrawingMap(true)}
                                        className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400 hover:text-emerald-300 transition w-fit cursor-pointer"
                                    >
                                        <Pencil className="size-2.5" />
                                        <span>Use Pencil on Map &rarr;</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>

                    <section
                        className="relative min-h-[520px] border-b border-[#242727] bg-[#172127] xl:h-full xl:border-r xl:border-b-0"
                    >
                        <Map
                            center={coords}
                            zoom={15.2}
                            markerLabel={activeLocationName}
                            onPlotChange={handlePlotChange}
                            initialPlot={drawnPlot}
                            isDrawingActive={isDrawingMap}
                            onDrawingActiveChange={setIsDrawingMap}
                            invalidateSizeTrigger={detailsOpen}
                            className="absolute inset-0"
                        />
                        {mapError && (
                            <div className="absolute inset-0 bg-[#172127]">
                                <div className="absolute bottom-4 left-4 rounded-md border border-white/10 bg-[#111515]/90 px-3 py-2 text-[10px] text-[#b9c0bb]">
                                    <MapPin className="mr-1 inline size-3 text-[#f7cf5c]" />
                                    {mapError}
                                </div>
                            </div>
                        )}
                        {!detailsOpen && (
                            <button
                                type="button"
                                onClick={() => setDetailsOpen(true)}
                                className="group absolute right-5 top-5 z-20 flex w-[220px] items-center justify-between rounded-lg border border-[#596a61] bg-[#111515]/95 px-4 py-3 text-left shadow-[0_12px_35px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-[#a5b6a8] hover:bg-[#1b2221]"
                            >
                                <span>
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#e0e5dc]">
                                        More
                                    </span>
                                    <span className="mt-1 block text-[10px] text-[#a5afa7]">
                                        Property details, constraints &amp;
                                        safety
                                    </span>
                                </span>
                                <ChevronRight className="size-4 text-[#d6ded5] transition-transform group-hover:translate-x-1" />
                            </button>
                        )}
                        <div className="absolute bottom-8 left-6 z-20 rounded-xl border border-white/10 bg-[#111515]/95 p-3.5 text-[9px] leading-4 text-[#afb3ac] shadow-2xl backdrop-blur-md">
                            <div className="mb-1.5 font-bold uppercase tracking-[0.14em] text-[#d4d6ce]">
                                Zoning Districts
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[#e4e0cb]">
                                    &#9679;
                                </span>
                                <span>R - Residential</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[#b56b5e]">
                                    &#9679;
                                </span>
                                <span>C - Commercial</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[#7ca56f]">
                                    &#9679;
                                </span>
                                <span>P - Park</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[#8b78a4]">
                                    &#9679;
                                </span>
                                <span>Other</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAskAnalystOpen(true)}
                            className="absolute bottom-8 right-6 z-20 flex items-center gap-2 rounded-full bg-white hover:bg-emerald-400 hover:text-black px-4.5 py-3 text-xs font-bold text-[#1b2325] shadow-2xl transition hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                        >
                            <Sparkles className="size-3.5 text-emerald-600" />
                            <span>Ask Analyst</span>
                            {drawnPlot ? (
                                <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-extrabold">
                                    {drawnPlot.coordinates.length} pts
                                </span>
                            ) : (
                                <span className="text-[#788083] font-normal">AI Chat</span>
                            )}
                        </button>
                    </section>

                    <main
                        className={`bg-[#0b0d0e] p-3 sm:p-5 xl:h-full xl:overflow-y-auto scrollbar-none ${detailsOpen ? "" : "hidden"}`}
                    >
                        {detailsOpen ? (
                            <>
                                <form onSubmit={handleDashboardSearch} className="flex items-center gap-2">
                                    <div className="flex flex-1 items-center gap-2 rounded-md border border-[#303333] bg-[#101313] px-3 py-2 text-xs text-[#d8dad5]">
                                        {isSearching ? (
                                            <Loader2 className="size-3.5 animate-spin text-[#10b981]" />
                                        ) : (
                                            <Search className="size-3.5 text-[#6f7672]" />
                                        )}
                                        <input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search address, city, or coordinates..."
                                            className="w-full bg-transparent text-xs text-[#e6e7e3] placeholder:text-[#6f7672] outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSearching}
                                        className="flex items-center gap-1 rounded-md border border-[#303333] bg-[#171a1a] px-3 py-2 text-[10px] font-medium text-[#d8dad5] transition hover:bg-[#202525]"
                                    >
                                        <Search className="size-3" /> Locate
                                    </button>
                                </form>
                                <div className="mt-5 flex items-center justify-between border-b border-[#252828] pb-4 text-xs text-[#858b86]">
                                    <button
                                        type="button"
                                        onClick={() => setDetailsOpen(false)}
                                        className="flex items-center gap-2 transition-colors hover:text-white"
                                    >
                                        <ArrowLeft className="size-3" /> Back
                                    </button>
                                    <span className="flex items-center gap-3">
                                        <button className="flex items-center gap-1 rounded border border-[#2f3333] px-2 py-1 text-[10px]">
                                            <Download className="size-3" />{" "}
                                            Export Report
                                        </button>
                                        <span>1 / 1</span>
                                        <ChevronLeft className="size-3" />
                                        <ChevronRight className="size-3" />
                                    </span>
                                </div>
                                <h1 className="mt-5 text-lg font-semibold text-[#e6e7e3] break-words">
                                    {activeLocationName}
                                </h1>
                                <p className="mt-1 text-[10px] tracking-[0.12em] text-[#777d79]">
                                    Lat: {coords[0].toFixed(4)} · Lng: {coords[1].toFixed(4)}
                                </p>
                                <div className="mt-5 flex rounded-md border border-[#252929] bg-[#171a1a] p-1 text-[10px] text-[#7f8580]">
                                    <span className="flex-1 py-2 text-center">
                                        Buyer / Investor
                                    </span>
                                    <span className="flex-1 rounded-md bg-[#f0f0ed] py-2 text-center font-semibold text-[#252827]">
                                        Renter
                                    </span>
                                </div>
                                <p className="mt-2 text-[9px] text-[#666c68]">
                                    Renter lens - habitability constraints,
                                    neighborhood safety, area activity, property
                                    basics.
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {[
                                        ["Zoning", "VARIOUS"],
                                        [
                                            "Lot Area",
                                            drawnPlot
                                                ? `${Math.round(drawnPlot.areaSqM).toLocaleString()} m²`
                                                : "Demarcate on map",
                                        ],
                                        [
                                            drawnPlot ? "Lot Sq Ft" : "Building SF",
                                            drawnPlot
                                                ? `${Math.round(drawnPlot.areaSqFt).toLocaleString()} SF`
                                                : "1,346,113 SF",
                                        ],
                                        [
                                            drawnPlot ? "Perimeter" : "Units",
                                            drawnPlot
                                                ? `${Math.round(drawnPlot.perimeterMeters).toLocaleString()} m`
                                                : "-",
                                        ],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className={`rounded-md border p-3 ${
                                                drawnPlot && (label === "Lot Area" || label === "Lot Sq Ft" || label === "Perimeter")
                                                    ? "border-emerald-500/40 bg-emerald-950/15"
                                                    : "border-[#252929] bg-[#151818]"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.12em] text-[#757b76]">
                                                <span>{label}</span>
                                                {drawnPlot && (label === "Lot Area" || label === "Lot Sq Ft") && (
                                                    <span className="text-[7px] text-emerald-400 font-bold">Drawn</span>
                                                )}
                                            </div>
                                            <div className="mt-2 text-xs font-semibold text-[#e4e5e0]">
                                                {value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 inline-block rounded bg-[#3c1718] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#e17062]">
                                    Low potential
                                </div>
                                <section className="mt-4 rounded-lg border border-[#2b2f2e] bg-[#171919] p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="size-3 text-emerald-400" />
                                            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#d3d4cf]">
                                                AI Land Analysis
                                            </span>
                                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-400 border border-emerald-500/30">
                                                NVIDIA 20B
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAskAnalystOpen(true)}
                                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                                        >
                                            Ask Questions &rarr;
                                        </button>
                                    </div>

                                    {isGeneratingAi ? (
                                        <div className="mt-4 flex items-center gap-2.5 text-xs text-emerald-400 py-3">
                                            <Loader2 className="size-4 animate-spin" />
                                            <span>Analyzing demarcated parcel coordinates and zoning profile...</span>
                                        </div>
                                    ) : aiAssessment ? (
                                        <div className="mt-3 text-xs leading-relaxed text-[#d4d8d3]">
                                            <FormattedAiResponse content={aiAssessment} />
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-xs leading-5 text-[#c1c5bf]">
                                            <p>
                                                The subject property in <strong className="text-white">{activeLocationName}</strong> is ready for intelligence assessment.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setIsDrawingMap(true)}
                                                className="mt-3 w-full rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-300 flex items-center justify-between gap-3 hover:bg-emerald-950/40 hover:border-emerald-500/50 transition cursor-pointer text-left"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex items-center justify-center size-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 shrink-0">
                                                        <Pencil className="size-3.5 text-emerald-400" />
                                                    </div>
                                                    <span>Click here or use the <strong>Pencil tool</strong> on top of the map to outline this parcel.</span>
                                                </div>
                                                <span className="text-emerald-400 font-bold text-xs whitespace-nowrap">&rarr;</span>
                                            </button>
                                        </div>
                                    )}
                                </section>
                                <section className="mt-4 rounded-lg border border-[#2b2f2e] bg-[#171919] p-4">
                                    <div className="text-[10px] font-bold text-[#d7d9d3]">
                                        03&nbsp; Constraints &amp; Flags
                                    </div>
                                    <p className="mt-1 text-[9px] text-[#777d78]">
                                        Regulatory and environmental constraints
                                    </p>
                                    <div className="mt-4 space-y-3">
                                        {constraints.map(([label, value]) => (
                                            <div
                                                key={label}
                                                className="flex items-center justify-between gap-4 border-b border-[#272b2a] pb-2 text-[10px] last:border-0"
                                            >
                                                <span className="flex items-center gap-2 text-[#929792]">
                                                    <span className="size-1.5 rounded-full bg-[#4bd46f]" />
                                                    {label}
                                                </span>
                                                <span className="text-[#c6c9c3]">
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                                <section className="mt-4 rounded-lg border border-[#2b2f2e] bg-[#171919] p-4">
                                    <div className="text-[10px] font-bold text-[#d7d9d3]">
                                        05&nbsp; Neighborhood Safety
                                    </div>
                                    <p className="mt-1 text-[9px] text-[#777d78]">
                                        Crime, complaints, and violations within
                                        200-300m
                                    </p>
                                    <div className="mt-4 space-y-3">
                                        {neighborhoodStats.map(
                                            ([label, value, source]) => (
                                                <div
                                                    key={label}
                                                    className="flex items-center justify-between border-b border-[#272b2a] pb-2 text-[10px] last:border-0"
                                                >
                                                    <span className="text-[#929792]">
                                                        {label}
                                                    </span>
                                                    <span className="font-semibold text-[#d8dad4]">
                                                        {value}{" "}
                                                        <small className="ml-1 text-[8px] font-normal text-[#777d78]">
                                                            {source}
                                                        </small>
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setDetailsOpen(true)}
                                className="group mt-1 flex w-full max-w-[220px] items-center justify-between rounded-lg border border-[#303735] bg-[#151a1a] px-4 py-3 text-left shadow-[0_12px_35px_rgba(0,0,0,0.28)] transition hover:border-[#718477] hover:bg-[#1b2221]"
                            >
                                <span>
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#d7d9d3]">
                                        More
                                    </span>
                                    <span className="mt-1 block text-[10px] text-[#777f79]">
                                        Property details, constraints &amp;
                                        safety
                                    </span>
                                </span>
                                <ChevronRight className="size-4 text-[#aeb7af] transition-transform group-hover:translate-x-1" />
                            </button>
                        )}
                    </main>
                </div>
            </div>

            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-3xl w-full overflow-hidden rounded-xl border border-white/15 bg-[#121517] p-3 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3 text-xs font-semibold text-white">
                            <span className="truncate mr-4">{previewImage.title}</span>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                                aria-label="Close preview"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="flex items-center justify-center overflow-hidden rounded bg-black/40">
                            <img
                                src={previewImage.url}
                                alt={previewImage.title}
                                className="max-h-[70vh] w-auto max-w-full rounded object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

            <StreetViewModal
                isOpen={streetViewOpen}
                onClose={() => setStreetViewOpen(false)}
                coords={coords}
                locationName={activeLocationName}
            />

            <AskAnalystDrawer
                isOpen={askAnalystOpen}
                onClose={() => setAskAnalystOpen(false)}
                locationName={activeLocationName}
                coords={coords}
                activePlot={drawnPlot}
            />
        </>
    );
}
