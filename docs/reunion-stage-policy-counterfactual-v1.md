# Reunion stage-policy counterfactual audit v1

## Purpose

This audit extends the gate-threshold sensitivity replay without changing production calculation rules. It tests whether structurally strict later-stage policies materially suppress reunion candidates when the same private request is rerun from scratch.

## Counterfactuals

1. `meeting_trigger_mars_or_venus`
   - Keep meeting long-term and medium gates unchanged.
   - Keep the same meeting targets, direct aspects, exact-trigger families, orb limits, and event threshold.
   - Change only the stage-defining exact trigger from Mars-only to Mars-or-Venus.

2. `medium_gate_add_solar_return`
   - Keep thresholds unchanged.
   - Add Solar Return to the medium gate alongside Lunar Return.
   - Under the current context map, Solar Return is included only for `relationship_rebuilding`, so this is effectively a rebuilding-specific counterfactual.

3. `medium_gate_add_venus_return`
   - Keep thresholds unchanged.
   - Add Venus Return to the medium gate alongside Lunar Return.
   - This is deliberately a broad stress test because Venus Return context is available to emotional, meeting, and rebuilding stages. It is not a production proposal by itself.

4. `targeted_candidate_v1`
   - Combine only the two narrow changes above that map directly to the diagnosed later-stage bottlenecks:
     - meeting exact trigger: Mars-only → Mars-or-Venus
     - rebuilding medium gate: Lunar Return → Lunar-or-Solar Return through the existing stage context map
   - Keep global thresholds, long-term policies, targets, aspects, orb limits, event threshold, and local-peak selection unchanged.
   - This variant exists so the combined candidate can be measured directly rather than estimating its effect by adding two separate deltas.

## Privacy and interpretation

The replay emits aggregate stage counts and deltas only. It omits names, birth data, coordinates, exact candidate dates, and raw evidence rows.

A positive delta means the policy is restrictive for that saved request. It does not prove that the looser policy is more accurate. Production retuning still requires outcome-labelled, independent cases.

The combined candidate is intentionally narrow. It does **not** address the larger long-term bottleneck already observed for meeting and rebuilding. If `targeted_candidate_v1` barely changes public peaks, the next study should focus on the stage-specific long-term policy instead of lowering global thresholds.

## Decision rule

- If a counterfactual produces no meaningful stage delta, that policy is not the active false-negative bottleneck for that case.
- If it produces a large delta while leaving unrelated stages unchanged, the policy is a strong candidate for a later controlled calibration study.
- Compare `targeted_candidate_v1` against each single-policy variant to detect interaction effects instead of assuming deltas are additive.
- No policy change should be merged into production from this audit alone.
