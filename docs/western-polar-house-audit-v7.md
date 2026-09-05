# Western Polar House Audit V7

## Scope

V7 hardens the three Western calculation paths against Placidus failures at polar latitudes and locks timezone/date-line edge behavior.

Affected calculation paths:

- `integrated_fortune_v1.py`
- `relationship_western_v1.py`
- `personal_marriage_v1.py`

Shared policy lives in `western_house_system_v1.py`.

## House-system policy

1. Request Placidus (`P`) from Swiss Ephemeris first.
2. If Swiss Ephemeris raises its house-calculation error for that latitude/time, retry with Porphyry (`O`).
3. Return explicit metadata:
   - `requested: Placidus`
   - `used: Placidus | Porphyry`
   - `fallback: true | false`
   - a human-readable fallback reason
4. If the Porphyry call itself fails, propagate the error rather than disguising invalid input as a successful fallback.

Backward-compatible `placidus_*` fields remain for older clients, but new output also exposes generic `quadrant_*` fields and the actual `house_system.used` value. The web UI labels the generic quadrant system so Porphyry values are not presented as Placidus.

## One-shot polar probe

The probe used `pyswisseph 2.10.03` at J2000 and 2024 LiChun reference instants.

Observed behavior around the northern polar threshold:

- 66.55° N: Placidus succeeds.
- 66.60° N: Placidus raises `swisseph.houses: error` / `houses_ex: error`.
- Tromsø-like latitude 69.6492° N: Placidus fails; Porphyry succeeds.
- Longyearbyen-like latitude 78.2232° N: Placidus fails; Porphyry succeeds.
- Equivalent southern high latitudes show the same failure behavior.

The probe helper/workflow was removed after the behavior was captured.

## Permanent regression coverage

`tests/test_western_polar_timezone_v7.py` verifies:

- explicit Porphyry fallback for northern and southern polar cases across all three Western paths;
- direct agreement with Swiss Ephemeris Porphyry cusps/ASC/MC;
- Placidus remains active just inside a tested calculable high-latitude case;
- integrated cache pack/unpack preserves fallback metadata;
- fractional UTC offsets `+05:45` and `-03:30`;
- extreme civil offsets `+14:00` and `-12:00`, including local/UTC date rollover;
- identical Julian Day conversion across the three Western product paths;
- continuity at `+179.999°` / `-179.999°` longitude;
- direct shared-policy behavior when Placidus succeeds.

## UI contract

Relationship and personal-marriage precision panels now display a generic quadrant-house label resolved from `quadrant_system`:

- `Placidus` → 플라시두스
- `Porphyry` → 포르피리

This prevents a correct backend fallback from being mislabeled in the user interface.
