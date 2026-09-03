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

Final candidate verification is performed on the PR head. The Supabase `fortune-interpret-v21-preview` deployment is intentionally a preview-only target; main and production remain unchanged until explicit release approval.
