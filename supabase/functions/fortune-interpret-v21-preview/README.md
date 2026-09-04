# Fortune Interpretation V21 cost guard

This preview generation keeps deterministic calculation depth while limiting paid Gemini work.

- Current runtime guard: `supabase-ai-v21.3.1-investment-output-guard`.
- Normal generation path: one Gemini core call.
- Paid Gemini generation is fail-closed: only an explicit authenticated `action: start` can enter a paid generation path; missing or unknown actions return HTTP 400.
- Hard network-call ceiling: two Gemini calls per job, including repair/fallback.
- The 365-day calculation remains available to the app, but the raw 365-row daily matrix is not sent to Gemini.
- Topic analysis for all 15 topics is generated deterministically on the server; there is no separate topics Gemini call.
- Prompt-size budget is checked before a paid request is sent.
- Cross-system prompt evidence reserves slots for Saju and Thai context so a Western-heavy annual packet cannot crowd them out.
- Rolling emergency breaker: per user 6 new jobs/10 minutes and 20/24 hours; service-wide 18/10 minutes and 60/24 hours. Cached/pending reuse is checked before these limits, so free reuse does not consume the breaker.
- The rolling breaker counts newly inserted V21 jobs regardless of final status. This is intentionally conservative so cancel/error loops cannot silently keep spending.
- Thai safety cleanup and eligible quality/evidence repairs are local and do not trigger an extra model call.
- Successful, failed, and canceled in-flight calls preserve token/call traces when available.
- The compressed AI prompt can be copied without calling Gemini.
- Investment activity indices must not be presented as price, yield, buy, or sell predictions. Post-generation structural sanitization also replaces model-written buy/sell/hold/cash-out timing actions with market-data and risk-limit checks.
- Western, Saju, and Thai evidence remain independent contexts; timing overlap is not a combined score, causal confirmation, or guaranteed outcome.
- Live Gemini smoke tests are opt-in only and require explicit cost approval before execution.

## Approved live smoke record

The user approved one paid V21.3 annual smoke job with a maximum of two Gemini calls and an approximate KRW 150 ceiling. The job finished on the first `gemini-3.7-flash` call: prompt 29,292 tokens, candidate 6,241, thinking 930, total 36,463, with 5-stage quality validation 100/100. At the pricing assumptions already used by the app, the observed call is approximately USD 0.0489 / KRW 68. The compressed prompt contained 110 evidence rows: Western 100, Saju 8, Thai 2.

Human review still found a gap that the 100/100 validator did not catch: some model-written investment `key_windows`/`decisions` converted relative activity indices into cash-out, sell-delay, profit-taking, or investment-hold actions. V21.3.1 fixes this without another Gemini call by structurally sanitizing investment-linked actions, avoids, watches, priorities, clusters, and phase caveats after generation. The AI cache and pending-job contracts were bumped so the pre-fix V21.3 live result cannot be reused as a current cached interpretation.

V21.3.1 itself was intentionally not sent through another paid Gemini smoke because the approved paid allowance was already consumed by the single V21.3 job. Its post-smoke fix is covered by deterministic regression tests, Web CI, Interpretation Release CI, type checking, and production build validation.

## Mobile interpretation hierarchy audit

The first no-cost UI audit reproduced the approved annual smoke content at an iPhone-width layout and reviewed the separate annual and period interpretation components. The main discoverability defect was structural: important dates were pushed below long relationship/detail sections, so the user could reach the mobile fold before seeing an actual key-date card.

The candidate UI now uses the following reading hierarchy for annual, month, week, and day interpretations:
1. headline and overall conclusion
2. compact `가장 먼저 볼 날짜 / 핵심 시기 TOP 3` rows
3. `이 기간에 실제로 할 일`
4. full key-date/window detail
5. relationship/contact detail when relevant
6. secondary validation, generation-cost, cross-system, topic, and evidence detail

The period component also replaces the English `GEMINI PERIOD READING` kicker with `AI(인공지능) 기간 해설`, increases the smallest actionable date/body typography, and moves the 5-stage validation badge below user-facing interpretation content. The annual quick-date rows remain clickable so a date can jump back to the annual score inspection UI.

The first-pass audit is complete. The remaining readability issue is content-level rather than layout-level: the top overall summary still repeats too many averages/spreads and should be condensed into a short conclusion while preserving the detailed statistics below. That belongs to the next interpretation UX pass rather than this hierarchy patch.

This UI audit used no additional Gemini call and created no Vercel deployment. It changes presentation only; the V21.3.1 runtime/cache contracts do not need another version bump.

## Interpretation readability pass 2

The second no-cost UX pass removes the metric-heavy `overall.summary` from the primary conclusion position without deleting any generated information. A deterministic UI helper now selects the first narrative sentence that is not dominated by averages, spreads, extrema, or repeated numeric values. The top card presents that as `핵심 흐름`, then uses the first non-metric priority, decision action, or key-window label as `먼저 기억할 것` when available.

The original `overall.summary` remains intact below as `수치 포함 전체 계산 요약`, so detailed averages and variation statistics are still available when the user wants them. The change applies to annual, month, week, and day interpretation panels, and removes the redundant standalone dominant-pattern block where the same material was being repeated.

This pass is presentation-only and requires no Gemini regeneration, no Supabase runtime redeployment, and no cache-contract bump. A regression fixture explicitly checks that a summary beginning with values such as `평균 46.3점` and `변동폭 42점` does not leak that metric-heavy sentence into the new top-level narrative brief.

Final candidate verification is performed on the PR head. The Supabase `fortune-interpret-v21-preview` deployment is intentionally a preview-only target; main and production remain unchanged until explicit release approval.
