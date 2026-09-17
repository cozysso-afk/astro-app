# Fortune Interpretation V23 · period narrative candidate

V23 is a narrative-layer candidate. It does not change calculation, evidence-ledger generation, precision contracts, or current production routing.

## Why this exists

The current interpretation stack is strong at evidence tracing and safety, but day/week/month/annual can converge on the same topic-first prose with different period labels. V23 changes the editorial starting point without weakening evidence validation.

## Core change

V23 interprets in this order:

1. group repeated observations into **phenomena** first;
2. identify whether each phenomenon is a trigger, background condition, tension, support, caution, or context;
3. apply a **period-specific time lens**;
4. only then explain how the phenomenon manifests across topics;
5. keep existing evidence IDs available for downstream validation.

Topic names are deliberately not part of the primary astronomical clustering key. One Mercury/Jupiter observation that touches both 학업 and 시험 should be interpreted once, then mapped to the two manifestations instead of narrated twice as unrelated evidence.

## Four distinct narrative contracts

- **day**: trigger → felt effect → intraday/one-day turn → immediate action → reality check
- **week**: weekly trajectory → early/mid/late → turning point → carryover action
- **month**: large monthly flow → early/mid/late → recurrence → temporary vs persistent change → priority
- **annual**: structural theme → quarters → long background → short trigger → yearly priority

Each contract has its own evidence priority and explicit forbidden patterns. The purpose is to prevent a shared template from surviving by changing only period nouns and dates.

## Regression guard

`auditPeriodDistinctness()` measures lexical overlap across period outputs. The first V23 regression suite also checks that:

- same phenomenon across different topics clusters once;
- mixed supportive/caution observations become tension instead of duplicated events;
- Western/Saju/Thai are not fused merely because their topic labels match;
- day and annual choose different evidence when trigger vs recurring-background evidence is available;
- copy-pasted day/week/month prose fails distinctness QA.

## Integration status

This branch adds the V23 narrative frame and prompt adapter only. Current V21/V22 production routing stays untouched until the V23 regressions pass and the next integration patch explicitly wires V23 into the Gemini generation path.
