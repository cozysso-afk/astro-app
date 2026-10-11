# Interpretation Answerability Audit V1

Baseline: `main@8a1b59b95a3758e60b610d781df28b3a815f2c61`

Purpose: audit how much already-calculated information survives the path from engine output to user-visible interpretation. This audit does **not** change calculation scores, thresholds, weights, gates, prompts, or safety rules.

## Classification

- **A · Calculation Missing** — the engine does not calculate the requested information.
- **B · Calculated but Dropped** — the engine has it, but a transport/compact/merge layer omits it.
- **C · Calculated but Suppressed** — the data survives, but policy blocks a stronger interpretation.
- **D · Schema Cannot Express** — the shared interpretation schema has no dedicated slot for the user question.
- **E · Frontend Hidden** — structured data exists, but the presentation layer does not surface it clearly.
- **P · Preserved** — information is currently preserved and should not regress.

## Architecture map

```
calculation engines
  -> public API result / resultFormatters
  -> evidence ledger / compact packets
  -> provider schema + Gemini authored prose
  -> deterministic topic injection / validator / repair / fallback
  -> frontend user-summary/editorial/presentation
  -> export / user-visible result
```

Primary ownership surfaces reviewed in V1:

- `integrated_fortune_v1.py`
- `relationship_western_v1.py`
- `reunion_hierarchy_v2.py`
- `web/src/lib/resultFormatters.ts`
- `web/src/lib/compactDeepPrompt.ts`
- `supabase/functions/fortune-interpret-v23-preview/providerSchemaV23.ts`
- `supabase/functions/fortune-interpret-v23-preview/periodNarrativeV23.ts`
- `supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts`
- `web/src/lib/fortuneUserSummary.ts`
- `web/src/lib/fortuneEditorialV3.ts`
- `web/src/lib/reunionHierarchy.ts`
- `web/src/ReunionHierarchyPanelV3.tsx`

## Verified findings

| ID | Domain/question | Classification | Verified source -> loss/presentation point |
| --- | --- | --- | --- |
| R1 | Reunion historical windows | **P** | `past_windows` now survives both the production relationship Edge packet and the external compact relationship packet. It is explicitly historical/retrospective context and cannot become a future timing window. |
| R2 | Reunion current windows | **P** | `current_windows` now survives both interpretation transports and is labeled as current-state context, separate from future candidates. |
| R3 | Reunion future candidates | **P** | `top_periods` and `nearest_window` are explicitly transported and rendered. |
| R4 | Contact direction comparison | **P/C** | incoming/outgoing scores are preserved and frontend can compare them; independent action-direction gate is intentionally unavailable, so “who contacts first” remains undetermined. Keep the safety distinction. |
| R5 | Technical evidence in readable reunion prose | **P/partial** | `readerSentences` still prefers plain language, but if plain prose underfills the requested limit it now retains a technical causal sentence instead of deleting all remaining explanation. Full structured causal ownership remains a later architecture task. |
| F1 | Fortune editorial structure | **P/extended** | the 25 legacy editorial sections keep the six-field compatibility base, while V23 now adds `domain_answers[]` with question-specific keys and `direct/partial/not_calculated` states. |
| F2 | Contact-specific interpretation | **P** | the schema has distinct `contact_activation` and `contact_continuity` sections. |
| F3 | Other domain-specific subquestions | **P/partial** | work, career change, study, exam, money, news, love, contact, reunion and condition now have explicit question contracts. Unsupported subquestions remain `not_calculated` instead of being padded with generic advice. This still does not claim the engine calculates every subquestion. |
| F4 | Compact fortune evidence depth | **B/intentional compression** | `compactDeepPrompt.ts` limits selected topics, dates and evidence rows. This is not automatically a bug, but it is a verified information-loss boundary and must be measured before further compression. |
| F5 | Period granularity | **P** | `periodNarrativeV23.ts` has distinct day/week/month/annual objectives and sequencing. Preserve this. |
| F6 | Low activation vs negative direction | **P** | Tone Calibration V1 separates activation magnitude from evidence direction. Preserve this. |
| S1 | Event probability safety | **P** | relationship/reunion timing explicitly keeps event probability uncalculated and does not allow side activation alone to determine action direction. Preserve this. |

## Answerability baseline

This table describes the interpretation structure, not a claim that every requested subquestion is currently calculated.

| Domain | Current answerability | Primary issue |
| --- | --- | --- |
| Contact | Partial | activation/direction/continuity exist, but “no timing candidate” can dominate the explanation and history is not consistently preserved into interpretation packets. |
| Love | Partial | multiple relationship contexts exist, but they still resolve through the shared editorial field shape. |
| Reunion | Improved partial | stage model plus past/current/future chronology are now transported; candidate absence, current activation and direction comparison are separated. Domain-level causal structure still needs the later answer-contract work. |
| Work | Improved partial | explicit 업무 진행 / 협업·책임 / 변화·시기 questions exist; only grounded direct/partial answers render. |
| Career change | Improved partial | 탐색·제안 / 조건·실제 이동 / 시기 questions are separated, while unsupported hiring outcomes remain uncalculated. |
| Study | Improved partial | 집중·이해 / 복습·수행 / 시기 questions are separated; missing distinctions remain uncalculated. |
| Exam | Improved partial | 준비 / 수행·실수 / 시기 questions are separated; 합격 여부 remains outside the contract. |
| Money | Improved partial | 유입·유출 / 계약·회수 / 시기 questions exist; absent contract/recovery evidence stays `not_calculated`. |
| News | Improved partial | 회신·공식 통보 / 지연 / 시기 questions are separated when evidence supports them. |
| Condition | Improved partial | 회복·피로 / 지속력·일정 소화 / 시기 questions are separated while diagnosis remains forbidden. |
| Investment | Partial but safety-sensitive | psychology/realization/entry are separated; real market data and risk limits remain authoritative. |

## P0 implementation targets

1. ✅ Preserve already-calculated historical/current/future timing through interpretation transport with bounded compact windows.
2. ✅ Distinguish semantic states:
   - not calculated
   - calculated but no candidate
   - candidate exists but weak
   - directional comparison exists
   - initiative/action direction remains undetermined
3. Never translate “no public candidate” into “no information” if other verified comparison data exists.
4. Keep one readable causal/evidence sentence when technical prose is filtered; move raw technical detail behind disclosure instead of deleting all explanation.
5. ✅ Add domain answer contracts as extensions over the shared base schema. Unsupported questions remain `not_calculated` and are not rendered as generic filler.
6. Keep authored grounded prose ownership and current safety gates.

## Answerability Golden V1 target contracts

These are the contracts that subsequent implementation PRs must turn into behavioral tests.

1. If a calculated value is transported, the final interpretation may not claim that the value is unavailable.
2. “No timing candidate” and “not calculated” are different states.
3. “Low activation” and “challenging direction” remain different states.
4. Directional comparison may be shown without claiming who will act first.
5. Initiative may only be stated when an independent action-direction gate exists.
6. If historical/current/future windows exist, the interpretation layer must preserve their temporal roles instead of collapsing them into future-only prose.
7. Past windows are validation/context, never future predictions.
8. Current windows are not relabeled as future candidates.
9. Technical evidence may be simplified, but at least one causal explanation must survive when available.
10. A technical sentence may not be deleted if it is the only sentence that explains why the conclusion exists.
11. Contact activation and contact continuity remain separate questions.
12. Domain-specific answer fields may only be populated from existing evidence; absent calculations remain explicitly absent.
13. Work/study/money/news text must not become identical after only swapping the topic name.
14. Generic `action/change_condition` fields must not be used to fabricate domain-specific calculations.
15. Provider-authored grounded prose must not be overwritten merely to satisfy a template.
16. Event probability must remain uncalculated unless a separately validated probability model is introduced.
17. Relationship side activation alone must not become “the counterpart will contact first”.
18. Investment prose must not convert relative astrology scores into price direction or return forecasts.
19. Health/condition prose must not become diagnosis.
20. Birth-time-sensitive evidence must retain its precision limitation.

## What not to change in this audit PR

- calculation engine
- score/threshold/weight/ranking logic
- reunion stage gates
- provider prompt/schema
- safety rules
- production presentation

This PR establishes the baseline. The next implementation PR should update the classifications as gaps are actually fixed rather than silently invalidating the audit.
