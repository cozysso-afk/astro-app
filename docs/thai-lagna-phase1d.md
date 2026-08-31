# Thai Suriyayat Lagna — Phase 1D validation policy

Status: research only; not eligible for product interpretation.

## What is independently validated

Bangkok MyHora numeric references currently validate two common Antoanatee families:

- fixed 06:00 dial, with and without local-mean-time (LMT) adjustment — 7 vectors spanning 1777–2026;
- astronomical local-sunrise dial, with and without LMT — 5 vectors spanning 1777–2026.

The latitude-aware astronomical Suriyayat candidate is retained only as a cross-check and is not treated as the canonical Thai method.

## What external Thai sources support for foreign births

The world-coordinate extension is methodologically supported, but it is not yet a numeric gold-standard validation:

1. MyHora documents that local-time adjustment is obtained from the birthplace coordinates and the legal timezone/standard meridian. Its Bangkok worked example uses UTC+7 = 105°E and longitude 100.494066°E, producing roughly -18 minutes. It states that the same principle applies to other coordinates and that foreign-time calculations use the coordinate/timezone and local sunrise, including DST where applicable.
2. A Thai astrology usage guide (Payakorn Thailand) explicitly tells users born abroad to enter latitude/longitude and select the common Antoanatee 06:00 method with local-time correction.
3. Other Thai practice material recommends actual local sunrise for foreign births because sunrise may be much farther from 06:00 at other latitudes/seasons. This is evidence of school/method variance, not a reason to silently choose one method globally.

Therefore both `common_anto_0600_lmt` and `common_anto_actual_sunrise_lmt` remain explicit research candidates. Neither is promoted globally merely because it computes successfully.

## Permanent Phase-1D invariants

`tests/test_thai_lagna_phase1d.py` verifies properties that do not depend on a missing foreign numeric oracle:

- LMT is zero on a timezone's standard meridian.
- A one-degree longitude difference equals four civil minutes of LMT correction.
- The non-LMT 06:00 common dial calibrates to the Suriyayat Sun at 06:00, matching MyHora's published basic calibration rule.
- Actual-sunrise computation remains finite across a world-coordinate matrix.
- Polar winter with no sunrise returns an explicit unavailable state instead of fabricating a sunrise.
- A full-day one-minute sweep is continuous through zodiac/sign boundaries.
- The promotion gate remains closed: houses, dignities, and Gemini interpretation stay disabled.

## Remaining blocker before promotion

An independent non-Thailand numeric reference corpus is still required. Direct dynamic requests to MyHora from GitHub Actions returned HTTP 403 for Yeosu, Seoul, Tokyo, and New York. This access failure must not be converted into a claim of validation.

Promotion requires externally reproduced foreign-coordinate numeric values (preferably multiple latitudes/timezones and near sign boundaries), followed by a comparison gate with recorded maximum/mean errors.
