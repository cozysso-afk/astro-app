# Relationship Midpoint Audit V8

## Scope

V8 audits the midpoint-derived Western relationship layers in `relationship_western_v1.py`:

- midpoint composite;
- Davison relationship chart;
- Bob Marks charts built from the Davison base;
- secondary progressions;
- Tertiary-I progressions.

## External method references

Astrodienst distinguishes multiple Davison variants.

### Classical uncorrected Davison

The uncorrected Davison Relationship Chart uses the midpoint in birth time and averages the two geographical coordinates separately:

- latitude = `(lat1 + lat2) / 2`
- longitude = `(lon1 + lon2) / 2`

This is distinct from Astrodienst's `spherical midpoint` Davison, which uses the midpoint along the shortest great-circle route between the two birth places.

The pre-V8 implementation used a great-circle geographic midpoint while labeling the result `uncorrected Davison`. V8 makes the existing product contract match its name: `uncorrected` is now the default classical mean-latitude/mean-longitude variant. The spherical method remains available as an explicit internal variant.

References:
- Astrodienst Chart Types / Davison Relationship Chart variants
- Astrodienst Astrowiki: Davison Relationship Chart

## Composite midpoint contract

Planetary and angular composite points use the shortest-arc midpoint. This correctly maps cases such as 350° + 10° to 0°.

An exact 180° separation has two geometrically valid midpoint candidates. Pre-V8, the branch choice depended on argument order, so `_mid_angle(0, 180)` and `_mid_angle(180, 0)` could return opposite candidates. V8 chooses a deterministic canonical candidate for the exact-antipode case so swapping person A and B cannot change the composite chart.

## Spherical midpoint antipodes

A spherical midpoint is mathematically undefined for exact antipodal locations because the two unit position vectors sum to zero. Floating-point `atan2` on that near-zero vector can otherwise produce an arbitrary longitude. V8 explicitly raises `ValueError` for this case instead of returning numerical noise.

This guard affects only the optional spherical Davison variant. The default classical uncorrected Davison uses separate arithmetic coordinate means and therefore remains defined by its own convention.

## Tertiary-I contract

Astrodienst specifies Tertiary-I as:

- 1 ephemeris day = 27.32158218 days of life (one tropical lunar month);
- the chart remains unchanged through a whole life-month and advances after that month is completed.

Therefore the existing `floor(elapsed_days / 27.32158218)` behavior is intentional, not a bug. V8 adds a regression test locking this stepwise convention.

Secondary progressions remain continuous at the existing day-for-year scale.

## Permanent regression coverage

`tests/test_relationship_midpoints_v8.py` covers:

- 0°/360° shortest-arc composite midpoint;
- A/B swap invariance;
- exact 180° composite midpoint canonicalization;
- classical uncorrected Davison mean latitude/longitude;
- Davison UTC midpoint and A/B swap invariance;
- explicit difference between uncorrected and spherical Davison at the date line;
- rejection of antipodal spherical midpoints;
- Tertiary-I completed-lunar-month stepping;
- continuous secondary progression scaling.
