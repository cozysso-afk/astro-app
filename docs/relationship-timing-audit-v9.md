# Relationship Timing Audit V9

## Scope

This audit covers the date/time contract used by the advanced Western relationship timing layers:

- daily reunion transit scan
- secondary progressed synastry
- progressed composite
- Marks Tertiary-I
- transit orb and score aggregation

## Bugs found

### 1. UTC zero was treated as a missing value in reunion transits

The previous implementation used:

```python
utc_offset_hours or 9.0
```

That means a valid numeric offset of `0` was falsey and silently replaced by `+9`. A user whose calendar dates are UTC therefore had each daily transit sample evaluated nine hours away from the requested local noon.

V9 defaults to `+9` only when the value is actually `None`. Numeric zero is preserved.

### 2. Monthly progressed layers were hard-coded to KST noon

The API accepts fixed UTC offsets from `-14` through `+14`, but monthly representative dates were always evaluated at 12:00 KST. This made the absolute timing instant depend on Korea even for users whose input dates belonged to another local calendar.

V9 uses this contract consistently:

> A user-facing calendar date is evaluated at local noon in the **user profile's fixed `utc_offset_hours`**, then converted to UTC.

The same absolute target instant is used for both people's secondary progressions because progressed synastry compares both charts at one relationship-analysis moment.

This also matters to Marks Tertiary-I: the tertiary engine advances in completed tropical lunar-month steps, so a timezone shift near a step boundary can move the symbolic chart by a full ephemeris day.

## Fixed-offset limitation

The current profile schema stores a numeric UTC offset, not an IANA timezone such as `America/New_York`. V9 therefore does **not** infer daylight-saving transitions or historical timezone-law changes. The engine follows the fixed offset supplied by the profile.

This is explicit in the returned `timing_timezone_policy` field.

## Scoring contract locked by regression

V9 also freezes the existing reunion timing score contract so later refactors cannot silently change it:

- transit orbs: 1.0° for faster listed transit planets, 1.4° for Jupiter through Pluto
- score = transit weight × natal-target weight × aspect weight × linear orb factor × 100
- side score uses the first four already-ranked hits and divides their sum by 2.35, capped at 100
- adjacent dates within one calendar day are suppressed in best/caution-day summaries

These values are product heuristics. They are descriptive activation scores, not event probabilities and not claims about another person's private intent.

## Permanent regression file

`tests/test_relationship_timing_v9.py` covers:

- UTC+0 preservation
- +05:45 and -03:30 fractional offsets
- default +09 only for `None`
- reunion scan consuming the zero offset correctly
- monthly progressed layers using user-local noon rather than hard-coded KST
- transit score math and orb cutoff
- side-score aggregation
- adjacent-peak spacing

## Validation

The first PR audit exposed one stale V8 regression assertion that hard-coded the previous engine version string. It was changed to follow `ENGINE_VERSION`; no calculation failure was involved.

Final required audit before merge:

- Western/Saju/relationship/personal calculation corpus: **103 passed**
- Thai corpus: **38 passed + 31 subtests passed**
- required status check: **SUCCESS**
