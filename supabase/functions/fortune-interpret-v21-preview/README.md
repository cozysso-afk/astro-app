# Fortune Interpretation V21 cost guard

This preview generation keeps deterministic calculation depth while limiting paid Gemini work.

- Normal generation path: one Gemini core call.
- Paid Gemini generation is fail-closed: only an explicit authenticated `action: start` can enter a paid generation path; missing or unknown actions return HTTP 400.
- Hard network-call ceiling: two Gemini calls per job, including repair/fallback.
- The 365-day calculation remains available to the app, but the raw 365-row daily matrix is not sent to Gemini.
- Topic analysis for all 15 topics is generated deterministically on the server; there is no separate topics Gemini call.
- Prompt-size budget is checked before a paid request is sent.
- Thai safety cleanup and eligible quality/evidence repairs are local and do not trigger an extra model call.
- Successful, failed, and canceled in-flight calls preserve token/call traces when available.
- The compressed AI prompt can be copied without calling Gemini.
- Investment activity indices must not be presented as price, yield, buy, or sell predictions.
- Western, Saju, and Thai evidence remain independent contexts; timing overlap is not a combined score, causal confirmation, or guaranteed outcome.
- Live Gemini smoke tests are opt-in only and require explicit cost approval before execution.
