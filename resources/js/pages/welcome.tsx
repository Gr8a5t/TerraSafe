import { Head, Link, router, usePage } from "@inertiajs/react";
import { ChevronDown, MapPin, Mic, Plus, Search } from "lucide-react";
import { useState } from "react";

import { dashboard, login, register } from "@/routes";
import { PRESET_LOCATIONS, parseCoordinates } from "@/lib/geocoding";

const popularLocations = ["Abuja, Nigeria", "Lagos Island", "Port Harcourt"];

const sampleMetrics = [
    { label: "Zone Risk", value: "Low", tone: "text-emerald-300" },
    { label: "Flood Exposure", value: "Moderate", tone: "text-amber-300" },
    { label: "Slope Stability", value: "Stable", tone: "text-sky-300" },
];

const constraints = [
    {
        label: "Fire Hazard Zone",
        value: "Not in fire hazard area",
        active: true,
    },
    {
        label: "Earthquake Fault Zone",
        value: "Not in fault zone",
        active: true,
    },
    {
        label: "Liquefaction Zone",
        value: "Not in liquefaction zone",
        active: true,
    },
    { label: "Landslide Zone", value: "Low risk", active: true },
    {
        label: "Historic Preservation",
        value: "Not in HPOZ district",
        active: true,
    },
];

export default function Welcome() {
    const { auth } = usePage().props;
    const [location, setLocation] = useState("");
    const currentLocation = location || "Abuja, Nigeria";

    const handleSearch = (targetLocation?: string) => {
        const loc = (targetLocation ?? location).trim();
        if (!loc) {
            router.visit("/dashboard");
            return;
        }

        const preset = PRESET_LOCATIONS[loc.toLowerCase()];
        if (preset) {
            router.visit(`/dashboard?q=${encodeURIComponent(preset.name)}&lat=${preset.lat}&lng=${preset.lng}`);
            return;
        }

        const coords = parseCoordinates(loc);
        if (coords) {
            router.visit(`/dashboard?q=${encodeURIComponent(loc)}&lat=${coords.lat}&lng=${coords.lng}`);
            return;
        }

        router.visit(`/dashboard?q=${encodeURIComponent(loc)}`);
    };

    return (
        <>
            <Head title="Know your land" />
            <main
                className="relative flex min-h-screen overflow-hidden bg-[#9fd9f6] text-[#0b1b22]"
                style={{ fontFamily: '"Anthropic Serif", Georgia, serif' }}
            >
                <img
                    src="/images/bg.png"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(161,222,250,0.08)_0%,rgba(191,235,250,0.02)_47%,rgba(4,34,37,0.1)_100%)]"
                />

                <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 pb-8 sm:px-8 lg:px-12">
                    <header className="flex items-center justify-between py-6 sm:py-8">
                        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-[13px] font-medium text-[#15343a] lg:flex">
                            <button className="flex items-center gap-1 transition-colors hover:text-[#0b6b4f]">
                                Solutions <ChevronDown className="size-3.5" />
                            </button>
                            <button className="flex items-center gap-1 transition-colors hover:text-[#0b6b4f]">
                                Resources <ChevronDown className="size-3.5" />
                            </button>
                            <a
                                href="#community"
                                className="transition-colors hover:text-[#0b6b4f]"
                            >
                                Community
                            </a>
                            <a
                                href="#enterprise"
                                className="transition-colors hover:text-[#0b6b4f]"
                            >
                                Enterprise
                            </a>
                            <a
                                href="#pricing"
                                className="transition-colors hover:text-[#0b6b4f]"
                            >
                                Pricing
                            </a>
                            <a
                                href="#security"
                                className="transition-colors hover:text-[#0b6b4f]"
                            >
                                Security
                            </a>
                        </nav>

                        <div className="ml-auto flex items-center gap-2.5 text-sm">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="rounded-full border border-white/60 bg-white/15 px-5 py-2.5 font-medium text-[#15343a] backdrop-blur-sm transition hover:bg-white/35"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="rounded-full border border-white/65 bg-white/15 px-5 py-2.5 font-medium text-[#15343a] backdrop-blur-sm transition hover:bg-white/35"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="rounded-full bg-[#202a2f] px-5 py-2.5 font-medium text-white shadow-lg shadow-[#223d3d]/20 transition hover:bg-[#102026]"
                                    >
                                        Get started
                                    </Link>
                                </>
                            )}
                        </div>
                    </header>

                    <section className="flex flex-1 flex-col items-center pt-[clamp(4rem,11vh,6.5rem)] text-center">
                        <h1 className="terra-hero-title max-w-4xl text-[clamp(2.75rem,4.4vw,4.2rem)] leading-[0.9] text-[#071a21]">
                            Know Your Land.
                            <br />
                            <span className="text-[#0a7a57]">
                                Build Safer. Build Smarter.
                            </span>
                        </h1>
                        <p className="mt-6 max-w-[570px] text-[clamp(1rem,1.5vw,1.2rem)] leading-7 text-[#163e42]">
                            TerraSafe is the smart land intelligence platform
                            that helps you assess risk, ensure compliance, and
                            plan safer construction.
                        </p>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleSearch();
                            }}
                            className="mt-8 w-full max-w-[845px]"
                        >
                            <div className="flex min-h-[82px] items-center gap-3 rounded-[27px] border border-white/75 bg-white/80 p-3 pl-4 text-left shadow-[0_18px_45px_rgba(30,92,99,0.16)] backdrop-blur-xl sm:pl-5">
                                <MapPin className="size-5 shrink-0 text-[#496267]" />
                                <input
                                    value={location}
                                    onChange={(event) =>
                                        setLocation(event.target.value)
                                    }
                                    placeholder="Search by location, address, or coordinates"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-[#1d3035] outline-none placeholder:text-[#718084]"
                                    aria-label="Search by location, address, or coordinates"
                                />
                                <button
                                    type="button"
                                    className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-[#e5f3ed] text-[#287050] transition hover:bg-[#d2ecdf] sm:flex"
                                    aria-label="Add location"
                                >
                                    <Plus className="size-5" />
                                </button>
                                <div className="hidden h-9 w-px bg-[#dce6e4] md:block" />
                                <button
                                    type="button"
                                    className="hidden items-center gap-2 whitespace-nowrap px-2 text-sm font-semibold text-[#1d2e33] md:flex"
                                >
                                    Land Assessment{" "}
                                    <ChevronDown className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#3b5053] transition hover:bg-[#e8f2ef]"
                                    aria-label="Use voice search"
                                >
                                    <Mic className="size-[18px]" />
                                </button>
                                <button
                                    type="submit"
                                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#173b35] text-white shadow-md transition hover:bg-[#0d5b41]"
                                    aria-label="Search"
                                >
                                    <Search className="size-[18px]" />
                                </button>
                            </div>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-[#123a3a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)]">
                                <span className="font-bold text-[#0b3031]">
                                    Try:
                                </span>
                                {popularLocations.map((place) => (
                                    <button
                                        key={place}
                                        type="button"
                                        onClick={() => {
                                            setLocation(place);
                                            handleSearch(place);
                                        }}
                                        className="flex items-center gap-1.5 text-[#123a3a] transition hover:text-[#087341]"
                                    >
                                        <MapPin className="size-3.5 text-[#397b61]" />{" "}
                                        {place}
                                    </button>
                                ))}
                            </div>
                        </form>

                        {false && (
                            <section className="mt-8 w-full max-w-[1280px] rounded-[22px] border border-white/10 bg-[#0c1218]/95 px-5 py-4 text-left shadow-[0_25px_80px_rgba(3,8,10,0.55)] backdrop-blur-xl">
                                <div className="flex items-center justify-between border-b border-[#2a3943] pb-4">
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#181f27] text-[#dfeaf1]">
                                            <MapPin className="size-4" />
                                        </span>
                                        <span className="font-medium text-slate-200">
                                            Search LA address ...
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <button className="rounded-md border border-[#2d3a43] bg-[#111a22] px-2.5 py-1.5 text-xs font-medium text-slate-200">
                                            + Add
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1.7fr]">
                                    <aside className="border-r border-[#212f38] pr-4">
                                        <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
                                            <span>Layers</span>
                                            <span>Analysis</span>
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                "Street View",
                                                "Satellite",
                                                "Street View 360°",
                                                "AI Analysis",
                                            ].map((item, index) => (
                                                <div
                                                    key={item}
                                                    className={`flex h-20 items-center justify-center overflow-hidden rounded-xl border ${
                                                        index === 3
                                                            ? "border-[#2b4a4d] bg-[#131d22] text-slate-200"
                                                            : "border-[#24313a] bg-[#0d151b] text-slate-400"
                                                    }`}
                                                >
                                                    <div className="h-full w-full bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.22),_rgba(16,24,28,0.8)_38%,_rgba(10,16,20,0.9)_100%)]" />
                                                </div>
                                            ))}
                                        </div>
                                    </aside>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2a3943] bg-[#121b22] px-4 py-3">
                                            <div>
                                                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                                    Back
                                                </div>
                                                <div className="mt-2 text-[15px] font-semibold text-white">
                                                    {currentLocation}
                                                </div>
                                                <div className="text-sm text-slate-400">
                                                    BBL - LA-CHJ988FhPBoAri -
                                                    Los Angeles
                                                </div>
                                            </div>
                                            <button className="rounded-lg border border-[#30424f] bg-[#141d25] px-3 py-2 text-xs font-medium text-slate-200">
                                                Export Report
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2d3a43] bg-[#121b22] p-4">
                                            <div className="flex items-center gap-3 text-sm text-slate-300">
                                                <span className="rounded-md border border-[#2d3a43] bg-[#19242d] px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-300">
                                                    Buyer / Investor
                                                </span>
                                            </div>
                                            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#111827]">
                                                Renter
                                            </button>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-4">
                                            {[
                                                ["Lot Area", "50,934 SF"],
                                                ["Building SF", "1,340,113 SF"],
                                                ["Units", "-"],
                                                ["Potential", "Low risk"],
                                            ].map(([label, value]) => (
                                                <div
                                                    key={label}
                                                    className="rounded-xl border border-[#2d3a43] bg-[#121b22] px-3 py-3"
                                                >
                                                    <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                                                        {label}
                                                    </div>
                                                    <div className="mt-2 text-base font-semibold text-white">
                                                        {value}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-xl border border-[#2d3a43] bg-[#121b22] p-4 text-slate-300">
                                            <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                                                AI Analysis
                                            </div>
                                            <p className="text-sm leading-6 text-slate-300">
                                                The subject property at{" "}
                                                {currentLocation} is currently
                                                improved with a 1.34 million SF
                                                office asset, fully maximizing
                                                its base zoning with a 26.43
                                                built FAR. Parcel LM 12.2 A.3.1,
                                                utilizing TOC Tier 3 incentives
                                                unlocks an additional 269,238 SF
                                                of developable area.
                                            </p>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <div className="rounded-xl border border-[#2d3a43] bg-[#121b22] p-4">
                                                <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                                    03 Constraints & Flags
                                                </div>
                                                <div className="space-y-3 text-sm text-slate-300">
                                                    {constraints.map((item) => (
                                                        <div
                                                            key={item.label}
                                                            className="flex items-center justify-between gap-3 border-b border-[#24313a] pb-2 last:border-b-0 last:pb-0"
                                                        >
                                                            <span className="inline-flex items-center gap-2">
                                                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                                                {item.label}
                                                            </span>
                                                            <span className="text-slate-400">
                                                                {item.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-[#2d3a43] bg-[#121b22] p-4">
                                                <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                                    05 Neighborhood Safety
                                                </div>
                                                <div className="space-y-3 text-sm text-slate-300">
                                                    {[
                                                        [
                                                            "Crime Incidents (1yr)",
                                                            "159",
                                                        ],
                                                        [
                                                            "Serious Crimes (Part II)",
                                                            "102",
                                                        ],
                                                        [
                                                            "Top Crime Type",
                                                            "Property theft",
                                                        ],
                                                    ].map(([label, value]) => (
                                                        <div
                                                            key={label}
                                                            className="flex items-center justify-between gap-3 border-b border-[#24313a] pb-2 last:border-b-0 last:pb-0"
                                                        >
                                                            <span className="text-slate-400">
                                                                {label}
                                                            </span>
                                                            <span className="font-semibold text-white">
                                                                {value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
