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
- Secondary progression uses mean day-for-year (`1 ephemeris day = 1 tropical year`) and scans every requested calendar day. Monthly values use the actual strongest daily peak instead of a mid-month proxy.
- Exact birth time allows progressed Sun/Moon/Venus and birth-time-sensitive natal targets in production progression scoring.
- Provisional birth time keeps production secondary progression conservative: progressed Moon and birth-time-sensitive natal targets are excluded from production scores and kept only as diagnostic evidence. Stable progressed Sun/Venus may remain production evidence.
- A credible approximate clock time (`official_record`, `family_memory`, `user_estimate`, or non-exact `rectified`, with non-unknown confidence) may allow stable-planet secondary progression to participate in convergence. `arbitrary_input` and unknown birth time never make secondary progression convergence-eligible.
- Unknown birth time may expose date-only proxy Sun/Venus progression plus midnight/noon/end-of-day longitude-spread diagnostics, but those dates are explicitly approximate and cannot create convergence.
- Major and daily transit scoring follows the same birth-time safety boundary. With provisional or unknown birth time, natal Moon and any other birth-time-sensitive target are excluded from production transit scores.
- For a provisional clock time, excluded transit-to-Moon/time-sensitive contacts are retained as `diagnostic_time_sensitive_hits` with `diagnostic_only=true`; they cannot inflate the major-transit activation used by convergence.
- Exact birth time still allows the full eligible natal target set for major/daily transit scoring.

The calculation and API regression contract lives in `tests/test_personal_love_engine_v16.py` and `tests/test_personal_love_api_v16.py`.
