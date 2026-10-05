# Contact relative signal regression · 2026-10-05

## Observed case

A daily result produced `상대 → 나 39` and `나 → 상대 38`. Both absolute values were shown as weak, while the UI also collapsed the 1-point incoming edge into `판정상 동률권` and hid the direction detail. This made the reader-facing result sound like incoming contact was unlikely even though the score is an activation index rather than an event probability.

## Fix scope

- Keep absolute chart-side contact activation separate from relative direction comparison.
- Show 38–44 as `다소 약함` in the reader-facing direction labels without changing engine thresholds or scores.
- Do not translate low incoming activation into "contact probably will not arrive" wording.
- If incoming and outgoing differ, show which side is relatively higher. A difference under 5 points is `근소 우세`, not a tie.
- Only exact equality remains a true direction tie.

## Not changed

- Relationship/contact calculation formula
- Score values or ranking
- Engine thresholds
- Gemini prompt/schema/Quality validation
- Reunion stage gates

The regression test uses the observed 39 vs 38 shape and separately covers 39 vs 39 exact equality.
