<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalystController extends Controller
{
    private function getClientConfig(): array
    {
        return [
            'base_url' => config('services.google_ai.base_url', 'https://generativelanguage.googleapis.com/v1beta/openai'),
            'api_key' => config('services.google_ai.api_key'),
            'model' => config('services.google_ai.model', 'gemini-3.6-flash'),
        ];
    }

    /**
     * Generate an AI site assessment for a drawn parcel boundary.
     */
    public function assessParcel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'location_name' => 'required|string',
            'coordinates' => 'nullable|array',
            'area_sqm' => 'nullable|numeric',
            'area_sqft' => 'nullable|numeric',
            'area_acres' => 'nullable|numeric',
            'perimeter_meters' => 'nullable|numeric',
            'center' => 'nullable|array',
        ]);

        $config = $this->getClientConfig();
        if (empty($config['api_key'])) {
            return response()->json([
                'success' => false,
                'error' => 'Google AI API key is not configured in server environment.',
            ], 500);
        }

        $locationName = $validated['location_name'];
        $coords = $validated['coordinates'] ?? [];
        $areaSqm = round($validated['area_sqm'] ?? 0, 1);
        $areaSqft = round($validated['area_sqft'] ?? 0, 1);
        $areaAcres = round($validated['area_acres'] ?? 0, 3);
        $perimeterM = round($validated['perimeter_meters'] ?? 0, 1);
        $center = $validated['center'] ?? null;

        $coordsJson = json_encode(array_slice($coords, 0, 12));

        $systemPrompt = "You are TerraSafe's Senior Land Intelligence & Geospatial Risk Analyst. You evaluate physical land parcels, planning constraints, and zoning viability for property buyers, builders, and investors. Deliver razor-sharp, highly practical site assessments. When evaluating Nigerian locations (such as Abuja, Lagos, or Port Harcourt), reference relevant planning frameworks such as the Abuja Master Plan, FCDA / AGIS guidelines, LASPPPA, or state land registries.";

        $userPrompt = "The user has drawn a parcel boundary on the satellite map:\n"
            . "- Location / Search: {$locationName}\n"
            . ($center ? "- Center Coordinates: Lat {$center[0]}, Lng {$center[1]}\n" : "")
            . "- Measured Lot Area: {$areaSqm} m² ({$areaSqft} SF / {$areaAcres} Acres)\n"
            . "- Measured Perimeter: {$perimeterM} meters\n"
            . "- Demarcated Vertices (" . count($coords) . " points): {$coordsJson}\n\n"
            . "Please provide a professional Parcel Intelligence Assessment structured with:\n"
            . "1. **Boundary & Footprint Assessment**: Spatial efficiency, buildable footprint ratio, and estimated road frontage.\n"
            . "2. **Zoning & Development Viability**: Suitable building typology (e.g. residential duplex, multi-family, commercial, or agricultural) and typical setback/coverage requirements for {$locationName}.\n"
            . "3. **Terrain & Environmental Risk**: Drainage, slope, and flood vulnerability considerations based on the geographical coordinates.\n"
            . "4. **Strategic Recommendation**: Key verification checklist before acquisition or construction.";

        $maxAttempts = 2;
        $timeouts = [25, 30]; // 25s, then 30s retry (total max ~56s, safely under Render's 100s proxy timeout)
        $lastException = false;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $timeout = $timeouts[$attempt - 1] ?? 30;

            try {
                $response = Http::withToken($config['api_key'])
                    ->timeout($timeout)
                    ->connectTimeout(10)
                    ->post(rtrim($config['base_url'], '/') . '/chat/completions', [
                        'model' => $config['model'],
                        'messages' => [
                            ['role' => 'system', 'content' => $systemPrompt],
                            ['role' => 'user', 'content' => $userPrompt],
                        ],
                        'max_completion_tokens' => 2048,
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $choice = $data['choices'][0]['message'] ?? [];
                    $content = $choice['content'] ?? '';

                    if (!empty(trim($content))) {
                        return response()->json([
                            'success' => true,
                            'assessment' => $content,
                            'metrics' => [
                                'area_sqm' => $areaSqm,
                                'area_sqft' => $areaSqft,
                                'area_acres' => $areaAcres,
                                'perimeter_meters' => $perimeterM,
                                'vertex_count' => count($coords),
                            ],
                        ]);
                    }
                } else {
                    $status = $response->status();
                    if ($status >= 400 && $status < 500) {
                        Log::error("Google AI assessParcel client error ({$status}): " . $response->body());
                        break;
                    }
                    Log::warning("Google AI assessParcel attempt {$attempt}/{$maxAttempts}: HTTP {$status}");
                }
            } catch (\Throwable $e) {
                Log::warning("Google AI assessParcel attempt {$attempt}/{$maxAttempts}: " . $e->getMessage());
                $lastException = true;
            }

            if ($attempt < $maxAttempts) {
                sleep($attempt);
            }
        }

        // Graceful fallback site intelligence if upstream AI engine is slow or unavailable
        $fallbackContent = $this->generateFallbackAssessment(
            $locationName,
            $areaSqm,
            $areaSqft,
            $areaAcres,
            $perimeterM,
            count($coords)
        );

        return response()->json([
            'success' => true,
            'assessment' => $fallbackContent,
            'fallback' => true,
            'metrics' => [
                'area_sqm' => $areaSqm,
                'area_sqft' => $areaSqft,
                'area_acres' => $areaAcres,
                'perimeter_meters' => $perimeterM,
                'vertex_count' => count($coords),
            ],
        ]);
    }

    /**
     * Interactive conversational endpoint for "Ask Analyst" drawer.
     */
    public function askAnalyst(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string',
            'location_name' => 'required|string',
            'history' => 'nullable|array',
            'parcel' => 'nullable|array',
        ]);

        $config = $this->getClientConfig();
        if (empty($config['api_key'])) {
            return response()->json([
                'success' => false,
                'error' => 'AI Analyst service is currently offline. Please configure API credentials.',
            ], 500);
        }

        $locationName = $validated['location_name'];
        $userMessage = $validated['message'];
        $history = $validated['history'] ?? [];
        $parcel = $validated['parcel'] ?? null;

        $parcelContext = "";
        if (!empty($parcel) && !empty($parcel['area_sqm'])) {
            $parcelContext = "\nActive Drawn Parcel on Satellite Map:\n"
                . "- Lot Area: {$parcel['area_sqm']} m² ({$parcel['area_sqft']} SF / {$parcel['area_acres']} Acres)\n"
                . "- Perimeter: {$parcel['perimeter_meters']} m\n"
                . "- Vertices: " . count($parcel['coordinates'] ?? []) . " boundary pins\n";
            if (!empty($parcel['coordinates'])) {
                $parcelContext .= "- Sample Coordinates: " . json_encode(array_slice($parcel['coordinates'], 0, 6)) . "\n";
            }
        }

        $systemPrompt = "You are TerraSafe's Senior AI Land, Cadastral & Geospatial Intelligence Analyst. You possess exhaustive, expert-level domain knowledge in real estate market valuation, parcel zoning, master plans, statutory title verification, setback regulations, and site acquisition due diligence.\n\n"
            . "CRITICAL OPERATIONAL DIRECTIVES:\n"
            . "1. YOU ARE AN AUTONOMOUS INTELLIGENCE AGENT: NEVER say 'As of my knowledge cutoff', 'I don't have real-time access', or tell the user to go search external websites (such as Jumia, PropertyPro, etc.) themselves. You must directly provide deep, authoritative, and structured site intelligence.\n"
            . "2. DISTRICT & REAL ESTATE INQUIRIES: When asked about land availability, plots for sale, or market valuations in any district or location, immediately provide a detailed breakdown covering:\n"
            . "   - District Pricing Benchmark (₦/m² and $/m², and total estimated plot price range)\n"
            . "   - Available Plot Typologies in the area (e.g. Medium-Density Residential 600m²-900m², High-Density Multi-Family 1,200m²-2,500m², Commercial Arterial 1,500m²-5,000m²)\n"
            . "   - Title Status & Cadastral Framework (e.g. AGIS C-of-O, R-of-O, Governor's Consent, Gazette, Excision, Deeded Survey)\n"
            . "   - Zoning & Development Controls (Setbacks, max storeys/FAR, coverage ratio)\n"
            . "   - Strategic Acquisition & Due Diligence Checklist (File search, beacon pickup, soil CBR)\n"
            . "3. ACCURATE MARKET VALUATION BENCHMARKS (Nigeria & International):\n"
            . "   - ABUJA FCT:\n"
            . "     * Phase 1 Prime (Maitama, Asokoro): ₦500k - ₦1.2M/m² (₦400M - ₦2.5B+ per plot)\n"
            . "     * Phase 1 Commercial / Mixed (Wuse II, CBD, Garki): ₦350k - ₦900k/m² (₦300M - ₦1.5B/plot)\n"
            . "     * High-Value Hilltop / Expansion (Guzape): ₦220k - ₦650k/m² (₦180M - ₦650M/plot)\n"
            . "     * Phase 2 High Demand (Jabi, Utako, Mabushi, Katampe Main & Ext): ₦150k - ₦550k/m² (₦120M - ₦450M/plot)\n"
            . "     * Phase 3 / Middle Belt (Lokogoma, Galadimawa, Apo, Idu Industrial, Karmo): ₦50k - ₦200k/m² (₦35M - ₦150M/plot)\n"
            . "     * High-Growth Satellites (Lugbe Airport Corridor, Kubwa, Kuje, Bwari): ₦15k - ₦75k/m² (₦10M - ₦45M/plot)\n"
            . "   - LAGOS STATE:\n"
            . "     * Ultra-Prime Island (Ikoyi, Victoria Island): ₦900k - ₦3.5M/m² (₦800M - ₦4B+/plot)\n"
            . "     * Prime Island (Lekki Phase 1): ₦400k - ₦950k/m² (₦350M - ₦900M/plot)\n"
            . "     * Mid-Island (Chevron, Osapa, Ikate): ₦250k - ₦600k/m²\n"
            . "     * Developing Corridor (Sangotedo, Abijo, Ibeju-Lekki, Epe): ₦20k - ₦200k/m²\n"
            . "     * Prime Mainland (Ikeja GRA, Magodo Phase 2): ₦200k - ₦1.2M/m²\n"
            . "   - RIVERS STATE (Port Harcourt):\n"
            . "     * Old GRA, New GRA Phases 1-3, Peter Odili: ₦120k - ₦450k/m²\n"
            . "   - US / CALIFORNIA (e.g. Los Angeles, CA):\n"
            . "     * Downtown LA, Beverly Hills, Hollywood, Santa Monica: $150 - $900+/SF depending on zoning and FAR.\n\n"
            . "Active Context: Location is '{$locationName}'.{$parcelContext}\n"
            . "Respond in clear, professional markdown with high-impact structuring, bold terms, bullet points, and actionable directives.";

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
        ];

        // Append recent chat history (limit to last 6 for token efficiency)
        if (is_array($history)) {
            $recent = array_slice($history, -6);
            foreach ($recent as $msg) {
                if (isset($msg['role']) && isset($msg['content'])) {
                    $messages[] = [
                        'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                        'content' => (string) $msg['content'],
                    ];
                }
            }
        }

        // Current user message
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $maxAttempts = 2;
        $timeouts = [25, 30]; // 25s, then 30s retry (total max ~56s, safely under Render's 100s proxy timeout)
        $lastError = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $timeout = $timeouts[$attempt - 1] ?? 30;

            try {
                $response = Http::withToken($config['api_key'])
                    ->timeout($timeout)
                    ->connectTimeout(10)
                    ->post(rtrim($config['base_url'], '/') . '/chat/completions', [
                        'model' => $config['model'],
                        'messages' => $messages,
                        'max_completion_tokens' => 2048,
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $choice = $data['choices'][0]['message'] ?? [];
                    $content = $choice['content'] ?? '';

                    return response()->json([
                        'success' => true,
                        'reply' => $content,
                    ]);
                }

                // Non-200 but not a timeout — don't retry on 4xx client errors
                $status = $response->status();
                if ($status >= 400 && $status < 500) {
                    Log::error("Google AI Ask Analyst client error ({$status}): " . $response->body());
                    return response()->json([
                        'success' => false,
                        'error' => 'AI Analyst service rejected the request. Please try rephrasing your question.',
                    ], 502);
                }

                $lastError = "HTTP {$status}: " . $response->body();
                Log::warning("Google AI Ask Analyst attempt {$attempt}/{$maxAttempts} failed ({$status})");

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $lastError = $e->getMessage();
                Log::warning("Google AI Ask Analyst attempt {$attempt}/{$maxAttempts} connection error: {$lastError}");
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                Log::warning("Google AI Ask Analyst attempt {$attempt}/{$maxAttempts} exception: {$lastError}");
            }

            // Sleep before retrying (skip sleep after last attempt)
            if ($attempt < $maxAttempts) {
                sleep($attempt); // 1s, then 2s backoff
            }
        }

        Log::error("Google AI Ask Analyst failed after {$maxAttempts} attempts. Last error: {$lastError}");
        return response()->json([
            'success' => false,
            'error' => 'AI Analyst could not be reached after multiple attempts. The service may be experiencing high demand — please try again in a moment.',
        ], 500);
    }

    /**
     * Intelligent local fallback parcel site intelligence assessment.
     */
    private function generateFallbackAssessment(
        string $locationName,
        float $areaSqm,
        float $areaSqft,
        float $areaAcres,
        float $perimeterM,
        int $vertexCount
    ): string {
        $footprintRatio = 0.50; // typical 50% coverage
        $estimatedFootprint = round($areaSqm * $footprintRatio);
        $estimatedFrontage = round($perimeterM / 4);

        return "### 1. Boundary & Footprint Assessment\n"
            . "- **Total Demarcated Area**: " . number_format($areaSqm) . " m² (" . number_format($areaSqft) . " SF / " . number_format($areaAcres, 3) . " Acres)\n"
            . "- **Perimeter & Perimeter Ratio**: " . number_format($perimeterM) . " meters ({$vertexCount} boundary corner pins)\n"
            . "- **Maximum Allowable Footprint (~50% coverage)**: ~" . number_format($estimatedFootprint) . " m² ground level\n"
            . "- **Estimated Frontage**: ~{$estimatedFrontage} meters\n\n"
            . "### 2. Zoning & Development Viability ({$locationName})\n"
            . "- **Recommended Typology**: Medium-density residential (semi-detached / detached duplex) or mixed commercial depending on primary access road.\n"
            . "- **Standard Setbacks**: Minimum 6.0m front building line, 3.0m side boundaries, and 3.0m rear buffer under master plan building regulations.\n"
            . "- **Parking & Access**: Minimum 2 dedicated parking stalls per dwelling unit or 1 stall per 30 m² commercial gross floor area.\n\n"
            . "### 3. Terrain & Environmental Risk\n"
            . "- **Stormwater Drainage**: Install dedicated on-site soakaway pits or connect directly to municipal drainage channels.\n"
            . "- **Topography**: Verify site levels before foundation excavation to maintain natural gravity runoff away from structural elements.\n\n"
            . "### 4. Strategic Verification Checklist\n"
            . "- [ ] Verify coordinate survey beacons with a licensed cadastral surveyor.\n"
            . "- [ ] Check official zoning classification and root of title with the relevant Land Registry / Urban Planning authority.\n"
            . "- [ ] Complete subsoil bearing capacity (CBR) testing prior to structural engineering approval.";
    }
}
