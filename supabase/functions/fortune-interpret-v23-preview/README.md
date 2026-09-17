# Fortune interpretation V23 preview

V23 changes the interpretation narrative layer without changing the calculation engines.

## Main idea

Interpret astronomical evidence as phenomena first, then explain how those phenomena manifest across life topics. Do not start the story from a topic score.

## Period contracts

- `day`: direct trigger, same-day felt effect, intraday/dated evidence, immediate action.
- `week`: early/mid/late trajectory, turning points, accumulation and release across seven days.
- `month`: early/mid/late month, recurrence, persistence, temporary vs continuing patterns.
- `annual`: structural background, quarter/month changes, long-running background vs short triggers.

## Exact mode

`fortune-interpret-v23-preview/index.ts` keeps the existing V21 Gemini safety, evidence, cost, quality, cache, Thai-safety and fallback contracts, while adding the V23 phenomenon-first prompt packet and period narrative instruction.

V22 routes exact requests to V23 only when the request includes `narrative_engine: "v23"`. Without that opt-in, the V21 compatibility route remains available.

## Provisional mode

Entered birth time is not automatically treated as verified exact provenance. V23 therefore also applies the period-specific narrative horizon to the existing local deterministic Western-only provisional fallback.

`provisionalV23.ts` does **not** relax the precision contract:

- Saju and Thai stay excluded from provisional interpretation.
- natal Moon, ASC/MC, houses and house-ruler bonuses stay excluded.
- exact intraday timing stays excluded.
- no Gemini call is made for provisional V23 generation.
- day/week/month/annual use different narrative horizons and a separate V23 cache identity.

The final provisional result still passes through the existing sanitizer and residue audit.

## QA

Regression coverage checks that repeated observations cluster before topic mapping, the four period types remain structurally distinct, provisional V23 remains local with zero provider fetches, final provisional prose remains birth-time safe and Western-only, and legacy requests keep their compatibility route and cache identity.

The V22/V23 Edge Function preview code has been deployed separately on the existing Supabase project. Production web activation remains a separate release step.