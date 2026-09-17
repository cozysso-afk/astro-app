# Fortune interpretation V23 preview

V23 changes the narrative layer without changing the calculation engines.

- **day**: direct trigger, same-day felt effect, immediate action.
- **week**: early/mid/late trajectory and turning points.
- **month**: recurrence, persistence, temporary vs continuing patterns.
- **annual**: structural background, quarter/month changes, long vs short influences.

Exact mode keeps the V21 Gemini safety, evidence, cost, quality, cache and Thai-safety contracts while adding the phenomenon-first V23 prompt. V22 routes exact requests to V23 only with `narrative_engine: "v23"`; otherwise the V21 compatibility route remains available.

Provisional mode remains local and Western-only. `provisionalV23.ts` applies the four period horizons to the existing deterministic fallback without relaxing precision exclusions: Saju, Thai, natal Moon, ASC/MC, houses, house-ruler bonuses and exact intraday timing remain excluded, and provisional V23 makes zero Gemini calls. Its cache identity is separate from the legacy provisional cache.

Regression coverage checks phenomenon clustering, period distinctness, zero-provider provisional routing, final provisional safety and legacy compatibility.

The V22/V23 Edge Function preview code is deployed separately on the existing Supabase project. Production web activation is a separate release step.