# Reunion rebuilding medium-anchor semantics audit v1

## Purpose

PR #235 already expands the rebuilding medium gate from Lunar Return only to Lunar-or-Solar Return without changing the global threshold. Private replay on top of #235 still shows 6~7 future rebuilding days passing the long gate and zero passing the medium gate.

This audit asks which already-calculated return family, if any, can supply a meaningful rebuilding medium anchor without changing the long policy or lowering the `mid_term >= 25` threshold.

## Counterfactuals

Only `relationship_rebuilding` medium-gate admission changes. Other stages keep their PR #235 behavior.

- baseline: Lunar + Solar
- Lunar only
- Solar only
- Venus only
- Lunar + Venus
- Solar + Venus
- Lunar + Solar + Venus

Venus Return is already present in rebuilding medium context; the audit only tests whether it may open the medium gate. No new ephemeris technique is introduced.

## Output and privacy

The private replay emits only aggregate stage counts plus aggregate medium-score diagnostics on future long-pass days:

- evaluated day count
- positive medium-score day count
- medium pass count
- maximum gate score
- maximum broader context score
- count of days where context exceeds gate score
- aggregate day counts by admitted return type

Names, birth data, coordinates, raw evidence rows, and exact dates are omitted.

## Non-goals

This audit does not lower thresholds, alter long-term policy, alter exact trigger policy, change aspect/orb rules, or claim event probabilities. A variant that increases candidates is not automatically more accurate; outcome-labelled independent cases would still be required for calibration.
