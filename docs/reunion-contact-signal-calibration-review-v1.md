# Reunion contact signal calibration review v1

## Scope

This review was triggered by a user-visible contradiction: the UI could say that actual contact likelihood was not high while also showing a `contact_recontact` stage. The calculation code and the UI were answering different questions.

## What the engine actually calculates

`reunion_hierarchy_v2.py` explicitly describes itself as a deterministic timing-selection policy, not a calibrated event predictor. Its public score disclaimer says the scores compare relative activation across periods and do not represent the probability of actual contact, meeting, or reunion.

The hierarchy currently requires versioned product gates for a selected stage candidate:

- long-term activation >= 35
- mid-term activation >= 25
- event-trigger activation >= 12
- stage-primary trigger materiality and selection rules

These gates decide whether a period is surfaced as a stage-relevant timing candidate. They do not estimate `P(contact)` or `P(reunion)`.

The existing selectivity review also records that no empirical hit-rate calibration is claimed; weights and thresholds are product comparison policy.

## Why free-form GPT/Claude readings can look more optimistic

A free-form model can synthesize natal, progression, transit, and symbolic relationship factors into a qualitative judgment such as "moderate reunion potential" without requiring the engine's strict stage gates. That is a different inference policy, not a directly comparable probability estimate.

Therefore neither output should be described as objectively more correct from the current evidence. Astrology-based reunion prediction has no validated ground-truth probability model in this product, and the current hierarchy has not been fitted to observed contact/reunion outcomes.

## Decision for this patch

Do not loosen thresholds merely to make the result resemble a more optimistic LLM reading. That would be uncalibrated tuning by expectation.

Instead:

1. Rename the user-facing `contact_recontact` stage to **연락 흐름 신호**.
2. State explicitly that the engine does not calculate high/low contact probability.
3. Explain that a contact-stage signal means a period is worth watching for contact/dialogue behavior, not that contact is predicted to occur.
4. Keep actual meeting and relationship-rebuilding stages separate.
5. Preserve all numerical gates and semantic safety rules unchanged.

## What would justify a future calibration change

A real calibration pass needs observed outcomes rather than model opinions. Using consented retrospective records, compare surfaced/non-surfaced windows against events such as:

- contact received / sent / both / none
- concrete meeting arranged
- meeting occurred
- relationship discussion occurred
- reunion/rebuilding occurred

Then measure false-positive/false-negative behavior by stage and revise thresholds only if the outcome data supports it.
