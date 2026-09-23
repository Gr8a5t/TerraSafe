import React, { useState } from 'react';
import {
    Compass,
    ExternalLink,
    Globe,
    Layers,
    MapPin,
    Navigation,
    X,
    Maximize2,
    Minimize2,
} from 'lucide-react';

interface StreetViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    coords: [number, number]; // [lat, lng]
    locationName: string;
}

export type GoogleViewMode = 'streetview' | 'satellite' | 'roadmap';

export function StreetViewModal({
    isOpen,
    onClose,
    coords,
    locationName,
}: StreetViewModalProps) {
    const [viewMode, setViewMode] = useState<GoogleViewMode>('streetview');
    const [isMaximized, setIsMaximized] = useState(false);

    if (!isOpen) return null;

    // Google Maps Street View 360° URL (snaps to closest street level imagery for coordinates)
    const googleStreetViewEmbedUrl = `https://maps.google.com/maps?q=${coords[0]},${coords[1]}&layer=c&cbll=${coords[0]},${coords[1]}&cbp=11,0,0,0,0&output=embed`;

    // Google Maps Pinpoint Satellite View
    const googleSatelliteEmbedUrl = `https://maps.google.com/maps?q=${coords[0]},${coords[1]}&t=k&z=18&ie=UTF8&iwloc=&output=embed`;

    // Google Maps Pinpoint Road & Terrain View
    const googleRoadmapEmbedUrl = `https://maps.google.com/maps?q=${coords[0]},${coords[1]}&t=m&z=17&ie=UTF8&iwloc=&output=embed`;

    // Direct External link to Google Street View Panorama
    const googleDirectStreetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[0]},${coords[1]}`;

    // Direct External link to Google Maps Pinpoint Location
    const googleDirectMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;

    const activeEmbedUrl =
        viewMode === 'streetview'
            ? googleStreetViewEmbedUrl
            : viewMode === 'satellite'
            ? googleSatelliteEmbedUrl
            : googleRoadmapEmbedUrl;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6 backdrop-blur-md transition-all duration-300"
            onClick={onClose}
        >
            <div
                className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0e1214] shadow-2xl transition-all duration-300 ${
                    isMaximized
                        ? 'h-[96vh] w-[98vw] max-w-7xl'
                        : 'h-[85vh] max-h-[850px] w-full max-w-5xl'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-3.5 bg-[#13181a] text-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                            <Compass className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-xs sm:text-sm font-semibold truncate text-white">
                                Google 360° Street View &amp; Pinpoint
                            </h2>
                            <p className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                                <span className="text-emerald-400 font-medium truncate">{locationName}</span>
                                <span className="hidden sm:inline text-slate-500">&middot;</span>
                                <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
                                    {coords[0].toFixed(5)}°, {coords[1].toFixed(5)}°
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* View Controls & Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Google Layer Switchers */}
                        <div className="hidden sm:flex rounded-lg border border-white/15 bg-[#1a2022] p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setViewMode('streetview')}
                                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
                                    viewMode === 'streetview'
                                        ? 'bg-emerald-500 text-black font-semibold shadow'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Compass className="size-3.5" /> 360° Street
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('satellite')}
                                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
                                    viewMode === 'satellite'
                                        ? 'bg-emerald-500 text-black font-semibold shadow'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Globe className="size-3.5" /> Pinpoint Satellite
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('roadmap')}
                                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
                                    viewMode === 'roadmap'
                                        ? 'bg-emerald-500 text-black font-semibold shadow'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Layers className="size-3.5" /> Area Map
                            </button>
                        </div>

                        {/* External Google Maps Button */}
                        <a
                            href={viewMode === 'streetview' ? googleDirectStreetViewUrl : googleDirectMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                        >
                            <ExternalLink className="size-3.5" /> Open Google Maps
                        </a>

                        {/* Window Size & Close */}
                        <button
                            type="button"
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                            title={isMaximized ? 'Restore size' : 'Maximize'}
                            aria-label={isMaximized ? 'Restore size' : 'Maximize'}
                        >
                            {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                            aria-label="Close Street View"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile View Switcher */}
                <div className="flex sm:hidden border-b border-white/10 bg-[#151a1c] p-1.5 justify-around text-xs">
                    <button
                        type="button"
                        onClick={() => setViewMode('streetview')}
                        className={`flex items-center gap-1 rounded px-2 py-1 ${
                            viewMode === 'streetview' ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-400'
                        }`}
                    >
                        <Compass className="size-3" /> 360° Street
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('satellite')}
                        className={`flex items-center gap-1 rounded px-2 py-1 ${
                            viewMode === 'satellite' ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-400'
                        }`}
                    >
                        <Globe className="size-3" /> Pinpoint
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('roadmap')}
                        className={`flex items-center gap-1 rounded px-2 py-1 ${
                            viewMode === 'roadmap' ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-400'
                        }`}
                    >
                        <Layers className="size-3" /> Area
                    </button>
                </div>

                {/* Google Interactive Embed Viewer */}
                <div className="relative flex-1 bg-black overflow-hidden">
                    <iframe
                        key={`${viewMode}-${coords[0]}-${coords[1]}`}
                        src={activeEmbedUrl}
                        title={`Google Maps View - ${locationName}`}
                        className="size-full border-0"
                        allowFullScreen
                        loading="lazy"
                    />

                    {/* Coordinates Overlay Badge */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg bg-black/80 backdrop-blur-md px-3 py-1.5 text-xs text-white border border-white/10 shadow-lg pointer-events-none">
                        <MapPin className="size-3.5 text-emerald-400" />
                        <span className="font-mono text-[11px]">
                            {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
                        </span>
                        {viewMode === 'streetview' && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                                360° Closest Pano
                            </span>
                        )}
                    </div>
                </div>

                {/* Footer Status Bar */}
                <div className="flex items-center justify-between border-t border-white/10 px-4 sm:px-6 py-2.5 bg-[#13181a] text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                            {viewMode === 'streetview'
                                ? 'Google 360°: Drag mouse to pan 360°. Click arrows on road to navigate around parcel.'
                                : viewMode === 'satellite'
                                ? 'Google Satellite: Centered & pinpointed exactly on parcel coordinates.'
                                : 'Google Road View: Street navigation & nearby landmarks.'}
                        </span>
                    </div>

                    <a
                        href={googleDirectStreetViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-400 transition flex items-center gap-1.5 font-medium shrink-0"
                    >
                        <span>Open 360° in Fullscreen</span>
                        <ExternalLink className="size-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
