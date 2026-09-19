# Reunion hierarchy v2.2 selectivity review

PR #186 independent review follow-up. This note does not replace the original v2.0 saved-case audit; it records which selectivity defects were reproduced and fixed after that audit.

## Fixed in v2.2

1. **Past peak suppressing future candidates — fixed**
   - Public local-peak comparison begins at `max(start_date, as_of_date)`.
   - Past rows remain available for historical/long activation windows but cannot eliminate a future public peak.

2. **Stage-primary trigger token-only gate — fixed**
   - A required stage planet must itself have `strength >= event_trigger threshold (12)`.
   - A weak Mercury/Mars/Venus/Sun token no longer upgrades a day whose score was produced by unrelated fast evidence.

3. **Cross-stage ±2-day suppression — removed**
   - Same-stage ±7-day local-peak selection remains.
   - Different stages are no longer removed merely because their peaks are within two days.
   - `nearest_window` is selected from the same public candidate set used downstream.

4. **Capped-score plateau ambiguity — reduced**
   - Public peak comparison uses uncapped top-three fast-trigger signal before the capped event/final score.
   - Exactly flat signals remain deterministic; after `as_of` the first equal representative is retained instead of being suppressed by a past equal maximum.

5. **Primary evidence disappearing from public trace — fixed**
   - The strongest material stage-primary trigger is forced into `fast_evidence`.

6. **Fast Moon sampling gap / duplicate work — improved**
   - Fast transit sampling changed from 6-hour to 3-hour spacing.
   - Transit charts are cached per day/sample and reused across all four stages.

7. **Selectivity diagnostics — expanded**
   - Gate-pass days, material-stage-trigger days, local-peak days and their future equivalents are tracked separately.
   - `NO_FUTURE_STAGE_TRIGGER` and `NO_FUTURE_PEAK` warnings supplement the existing gate selectivity status.

8. **Explicit selection only — fixed**
   - `_selected()` no longer falls back from `selection_eligible` to raw `eligible`.

## Regression tests added

- past maximum immediately before `as_of` cannot suppress the first future peak
- weak required planet (`strength=0.1`) fails while material required trigger (`>=12`) passes
- stage-primary evidence is preserved in the public evidence trace
- same-stage 7-day competition vs 8-day separation
- cross-stage peaks one day apart both survive
- capped 100 scores use uncapped signal as a peak tie-break
- a flat plateau crossing `as_of` keeps a future representative
- bounded downstream lists retain `nearest_window`
- 3-hour fast-sampling contract
- API integration checks nearest/public-window consistency and material primary evidence

## CI at v2.2 patch

At commit `bb45ed61a4d1529feb3368ff5e3fe5eef5b769bf`:

- Calculation Audit CI: PASS
- Web CI: PASS
- Interpretation Release CI: PASS

The Calculation Audit workflow is the authoritative CI for `reunion_hierarchy_v2.py` and `tests/test_reunion_hierarchy_v2.py`. Interpretation Release CI validates interpretation/grounding contracts and build compatibility, not the reunion engine's numerical correctness.

## Remaining limits

### Query-edge context
Local peaks are compared only inside the requested calculation interval. A peak near `start_date` or `end_date` does not yet have an external ±7-day comparison buffer. The limitation is disclosed in the calculation payload and should be resolved before claiming boundary-complete local-peak detection.

### Saved-case v2.2 rerun
The original `docs/reunion-hierarchy-v2-audit.md` and trace contain v2.0 saved-case results. They are historical evidence only. The private 2026/2027 saved requests still need to be rerun on v2.2 to measure:

- gate-pass count
- material stage-trigger count
- future local-peak count
- nearest candidate
- TOP candidates by stage
- stage distribution (especially emotional vs contact/meeting)
- runtime after 3-hour cached sampling

Do not cite the old Nov/Dec 2026 or Feb 2027 TOP dates as v2.2 output until this rerun is complete.

### Other known limitations

- Zi Wei Dou Shu engine remains absent and is excluded from independent-system convergence.
- Historical DST provenance remains unverified while profiles provide only a fixed UTC offset.
- Return-angle location still uses the available birth-place location rather than a separately supplied forecast/current residence.
- No empirical hit-rate calibration is claimed; weights and thresholds remain versioned comparison policy.