import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    Send,
    Sparkles,
    Bot,
    User,
    Loader2,
    ShieldCheck,
    MapPin,
    ChevronRight,
    HelpCircle,
    Maximize2,
    Minimize2,
    Copy,
    Check,
} from 'lucide-react';
import { ParcelPlot } from '@/components/map';
import { FormattedAiResponse } from '@/components/formatted-ai-response';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    timestamp: Date;
}

interface AskAnalystDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    locationName: string;
    coords: [number, number];
    activePlot: ParcelPlot | null;
}

const QUICK_PROMPTS = [
    "What is the average price per m² & land availability in this district?",
    "What building typology can I construct on this parcel?",
    "What are the mandatory setback & coverage ratios here?",
    "Analyze flood, drainage & topography risk for this lot",
    "What statutory title verification steps (AGIS / C-of-O) are required?",
    "Estimate maximum ground floor footprint in m²",
];

export function AskAnalystDrawer({
    isOpen,
    onClose,
    locationName,
    coords,
    activePlot,
}: AskAnalystDrawerProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial greeting when modal opens
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const hasPlot = activePlot && activePlot.areaSqM > 0;
            const greeting: ChatMessage = {
                id: 'welcome',
                role: 'assistant',
                content: hasPlot
                    ? `Hello! I've loaded your demarcated parcel in **${locationName}** (${activePlot.formattedArea}, perimeter: ${activePlot.formattedPerimeter}).\n\nI can evaluate buildable footprint, regulatory setbacks (e.g. FCDA/AGIS standards in Abuja), environmental hazards, or site topography. What would you like to examine?`
                    : `Hello! I'm your TerraSafe Land Intelligence Analyst for **${locationName}**.\n\nYou can ask me about regional zoning, environmental hazards, or use the **Pencil tool** on the satellite map to draw your specific parcel outline for exact dimensional analysis!`,
                timestamp: new Date(),
            };
            setMessages([greeting]);
        }
    }, [isOpen, activePlot, locationName, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const copyMessage = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isOpen) return null;

    const handleSendMessage = async (textToSend?: string) => {
        const messageText = (textToSend || input).trim();
        if (!messageText || isLoading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const csrfToken = (typeof document !== 'undefined' && (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content) || '';
            const res = await fetch('/api/ai/ask-analyst', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    message: messageText,
                    location_name: locationName,
                    history: messages.map((m) => ({ role: m.role, content: m.content })),
                    parcel: activePlot
                        ? {
                              coordinates: activePlot.coordinates,
                              area_sqm: activePlot.areaSqM,
                              area_sqft: activePlot.areaSqFt,
                              area_acres: activePlot.areaAcres,
                              perimeter_meters: activePlot.perimeterMeters,
                          }
                        : null,
                }),
            });

            const contentType = res.headers.get('content-type') || '';
            let data: any = {};
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                console.error("Ask Analyst non-JSON response:", res.status, text.substring(0, 300));
                const errorMsg: ChatMessage = {
                    id: `ai-err-${Date.now()}`,
                    role: 'assistant',
                    content: `Server Error (HTTP ${res.status}): non-JSON response received from server.`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errorMsg]);
                return;
            }

            if (res.ok && data.success && data.reply) {
                const aiMsg: ChatMessage = {
                    id: `ai-${Date.now()}`,
                    role: 'assistant',
                    content: data.reply,
                    reasoning: data.reasoning,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, aiMsg]);
            } else {
                const errorMsg: ChatMessage = {
                    id: `ai-err-${Date.now()}`,
                    role: 'assistant',
                    content: data.error || `Apologies, encountered HTTP ${res.status} issue.`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errorMsg]);
            }
        } catch (err: any) {
            console.error('Ask Analyst fetch error:', err);
            const errorMsg: ChatMessage = {
                id: `ai-err-${Date.now()}`,
                role: 'assistant',
                content: `Connection error: ${err?.message || 'Unknown error'}. Please try again.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 md:p-6 backdrop-blur-md transition-all duration-300"
            onClick={onClose}
        >
            <div
                className={`relative flex flex-col overflow-hidden rounded-2xl border border-[#2d3633] bg-[#0c0f10] text-[#d6dad5] shadow-2xl transition-all duration-300 ${
                    isMaximized
                        ? 'h-[96vh] w-[98vw] max-w-7xl'
                        : 'h-[88vh] max-h-[860px] w-[94vw] max-w-4xl lg:max-w-5xl'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#232927] bg-[#111515] px-4 sm:px-6 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex size-9 items-center justify-center rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 shrink-0">
                            <Bot className="size-5" />
                            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#111515]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                                    AI Land &amp; Zoning Analyst
                                </h2>
                                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/30 shrink-0">
                                    NVIDIA 20B
                                </span>
                            </div>
                            <p className="text-[11px] text-[#868f89] truncate max-w-md">
                                {locationName}
                            </p>
                        </div>
                    </div>

                    {/* Window Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="rounded-lg p-2 text-[#868f89] transition hover:bg-[#1a201f] hover:text-white"
                            title={isMaximized ? 'Restore window size' : 'Maximize window'}
                            aria-label={isMaximized ? 'Restore window size' : 'Maximize window'}
                        >
                            {isMaximized ? (
                                <Minimize2 className="size-4" />
                            ) : (
                                <Maximize2 className="size-4" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-[#868f89] transition hover:bg-[#1a201f] hover:text-white"
                            title="Close"
                            aria-label="Close modal"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                {/* Active Parcel Demarcation Banner */}
                {activePlot && activePlot.areaSqM > 0 ? (
                    <div className="flex items-center justify-between border-b border-emerald-900/40 bg-emerald-950/20 px-4 sm:px-6 py-2.5 text-xs text-emerald-300">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-3.5 text-emerald-400 shrink-0" />
                            <span className="font-semibold">Active Parcel Analysis:</span>
                            <span className="text-white font-medium">{activePlot.formattedArea}</span>
                            <span className="hidden sm:inline text-[#8a9890]">
                                (Perimeter: {activePlot.formattedPerimeter})
                            </span>
                        </div>
                        <span className="rounded-full bg-emerald-900/50 border border-emerald-700/50 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
                            {activePlot.coordinates.length} Boundary Vertices
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 border-b border-[#232927] bg-[#141818]/60 px-4 sm:px-6 py-2 text-[11px] text-[#939b95]">
                        <MapPin className="size-3 text-[#f2c44f] shrink-0" />
                        <span>Tip: Draw boundary on the map with the pencil tool for exact parcel dimensional intelligence.</span>
                    </div>
                )}

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-none">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-3 sm:gap-4 ${
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="size-8 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                                    <Bot className="size-4" />
                                </div>
                            )}

                            <div
                                className={`group relative rounded-2xl ${
                                    msg.role === 'user'
                                        ? 'max-w-[85%] sm:max-w-[75%] bg-emerald-600 text-black px-4 py-3 font-medium text-xs sm:text-sm rounded-br-none shadow-md'
                                        : 'max-w-[92%] sm:max-w-[85%] bg-[#141818] border border-[#262f2d] p-4 sm:p-5 text-xs sm:text-sm rounded-bl-none shadow-lg'
                                }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <>
                                        <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-[#222a28] text-[10px] text-[#7a857f]">
                                            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                                                <Sparkles className="size-3" /> Land Intelligence Report
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => copyMessage(msg.id, msg.content)}
                                                className="flex items-center gap-1 text-[#8b9690] hover:text-white transition px-1.5 py-0.5 rounded hover:bg-[#1e2624]"
                                                title="Copy message"
                                            >
                                                {copiedId === msg.id ? (
                                                    <>
                                                        <Check className="size-3 text-emerald-400" />
                                                        <span className="text-emerald-400">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="size-3" />
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <FormattedAiResponse content={msg.content} />
                                    </>
                                ) : (
                                    <div className="whitespace-pre-wrap leading-relaxed">
                                        {msg.content}
                                    </div>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="size-8 rounded-xl bg-[#262f2d] flex items-center justify-center text-[#c2c9c4] shrink-0 mt-0.5">
                                    <User className="size-4" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 sm:gap-4 justify-start">
                            <div className="size-8 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                                <Bot className="size-4" />
                            </div>
                            <div className="rounded-2xl rounded-bl-none border border-[#262f2d] bg-[#141818] p-4 text-xs text-[#a4aca6] flex items-center gap-2.5 shadow-lg">
                                <Loader2 className="size-4 animate-spin text-emerald-400" />
                                <span>AI Analyst is reasoning parcel specs &amp; zoning frameworks...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                <div className="border-t border-[#232927] bg-[#101314] px-4 sm:px-6 py-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#79827c] mb-2 flex items-center gap-1.5">
                        <HelpCircle className="size-3 text-emerald-400" /> Suggested Inquiries
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {QUICK_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => handleSendMessage(prompt)}
                                disabled={isLoading}
                                className="shrink-0 rounded-full border border-[#2a3330] bg-[#161c1b] px-3.5 py-1.5 text-xs text-[#c1c9c3] transition hover:border-emerald-500/50 hover:bg-[#1f2725] hover:text-white disabled:opacity-40"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Bar */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex items-center gap-3 border-t border-[#232927] bg-[#121616] p-4 sm:p-5"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask analyst about zoning, buildable area, setbacks, drainage..."
                        disabled={isLoading}
                        className="flex-1 rounded-xl border border-[#2e3734] bg-[#161c1b] px-4 py-3 text-xs sm:text-sm text-white placeholder:text-[#6a736d] outline-none focus:border-emerald-500 transition"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="flex h-11 px-5 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black font-semibold shadow-lg transition hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 shrink-0 text-xs sm:text-sm"
                        aria-label="Send message"
                    >
                        <span>Send</span>
                        <Send className="size-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}

