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

The calculation and API regression contract lives in `tests/test_personal_love_engine_v16.py` and `tests/test_personal_love_api_v16.py`.
