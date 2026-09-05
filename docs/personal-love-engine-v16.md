# Personal Love / New Relationship Engine V16

This calculation layer is intentionally isolated from two-person relationship astrology.

- `/v1/love/personal` uses only the user's natal/profile data.
- `/v1/love/new-relationship` uses only the user's natal/profile data.
- Known-counterpart, reunion, relationship-status, and private-intent inputs are outside this engine contract.
- Static natal structure is not numerically merged into timing activation.
- Secondary progression, major transit, and daily transit remain separate layers.
- Convergence requires the independent higher-priority layers (secondary progression + major transit); daily transit can only support timing.
- All 0–100 values are astrology activation indices, not event probabilities.
- Exact birth time unlocks house/angle-sensitive 5H/7H/DSC evidence. Provisional time keeps planetary layers without treating angles/houses as exact. Unknown time exposes Moon uncertainty instead of an exact Moon/house result.
- If one physical natal body serves multiple semantic roles (for example Venus + 5th ruler + 7th ruler), one transit/progression contact is counted once. The evidence keeps every role, while the score uses the maximum applicable role weight for each dimension instead of summing duplicate labels.
- Physical deduplication is identity-based, not longitude-based: distinct natal bodies at the same degree remain separate evidence contacts.
- Secondary Progression uses a mean day-for-year key (`1 ephemeris day = 1 tropical year`, `365.2422` days/year).
- Progressed Sun/Moon/Venus are scanned on every requested calendar day. The engine no longer treats one mid-month sample as the month's exact progression date.
- Each calendar month stores the strongest real daily peak separately for `new_connection` and `partnership`, including the actual peak date and evidence.
- Convergence consumes those monthly progression peaks; it does not use arbitrary month-midpoint values.

The calculation and API regression contract lives in `tests/test_personal_love_engine_v16.py` and `tests/test_personal_love_api_v16.py`.
