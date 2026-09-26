# Reunion hierarchy v2.9 — generalization cohort audit

## Scope

v2.9 is validation infrastructure only. It does not change reunion scoring, stage semantics, thresholds, weights, local-peak selection, ranking, or public candidate eligibility.

The goal is to prevent repeated variants of the same private couple from being mistaken for independent validation cases.

## Current private cohort finding

A read-only aggregate audit of `public.relationship_readings` found 15 saved rows.

The stored `profile_id` / `counterpart_id` columns are not populated for these rows, so independence cannot be inferred from those columns. The request payloads were therefore compared using a privacy-preserving profile-core definition.

Observed aggregate structure:

- saved rows: 15
- distinct user profile cores after removing alias and birth-time precision fields: 1
- distinct counterpart profile cores after removing alias and birth-time precision fields: 1
- distinct couple cores: 1
- counterpart display-name variants: 4
- counterpart birth dates: 1 distinct value
- counterpart birth locations: 1 distinct value
- counterpart legacy UTC offsets: 1 distinct value

No raw names, birth dates, coordinates, UUIDs, or hashes are included in this document.

Therefore the current saved corpus is classified as `single_pair` and `INSUFFICIENT_DIVERSITY` for cross-couple generalization work.

## Profile-core policy

`scripts/reunion_generalization_audit.py` groups profile variants by a calculation-oriented profile core containing:

- birth date
- birth latitude
- birth longitude
- IANA `timezone_id` when available, otherwise legacy `utc_offset_hours`

The following are deliberately excluded from the grouping core so that rectification and alias variants of the same underlying saved profile do not become fake independent cases:

- display name
- birth time
- `time_known`
- `time_confidence`
- `time_source`
- `rectified_window`

Coordinates and offsets are normalized numerically before grouping. Internal SHA-256 keys are used only in process memory; fingerprints are never emitted in the report.

This is a calculation-profile grouping heuristic, not a claim of real-world identity. Two genuinely different people with the same profile core could theoretically collapse into one group. The audit therefore errs against overstating sample diversity.

## Diversity classes

The harness emits one of these structural classes:

- `single_pair`
- `same_user_multiple_counterparts`
- `multiple_users_same_counterpart`
- `multi_user_multi_counterpart`

Only `multi_user_multi_counterpart` is labelled `AUDITABLE_DIVERSE_COHORT`.

All other classes are labelled `INSUFFICIENT_DIVERSITY`.

`AUDITABLE_DIVERSE_COHORT` does **not** mean predictive generalization has been validated. It means only that the cohort has enough structural diversity to justify a subsequent outcome audit.

The harness always returns `generalization_claim_allowed=false` because cohort diversity alone cannot establish predictive validity.

## Privacy contract

The CLI reads private request objects from stdin and prints aggregate counts only.

It does not emit:

- names
- dates of birth
- birth times
- coordinates
- timezone values
- profile fingerprints
- request bodies
- exception payloads

On failure, the CLI prints only a generic failure message.

## Synthetic regression coverage

`tests/test_reunion_generalization_audit_v29.py` verifies:

1. name aliases collapse to one profile core
2. birth-time / rectification variants collapse to one profile core
3. genuinely different birth profiles separate into distinct cores
4. coordinate changes separate profile cores
5. same-user / multiple-counterpart cohorts remain insufficient for broad generalization
6. multi-user / multi-counterpart cohorts become auditable but never automatically verified
7. report output does not contain raw sentinel profile values
8. aggregate output is order deterministic
9. wrapped saved-row request payloads are supported
10. incomplete profiles and empty batches fail closed

## Interpretation of the current corpus

The 15 existing saved rows are useful for deterministic replay, regression protection, birth-time sensitivity checks, and same-case robustness testing.

They are not an independent cross-couple validation corpus.

No stage weights, thresholds, or candidate-count rules should be retuned using this single-pair corpus. Doing so would increase overfitting risk.

## What is required next

To perform a real generalization audit, collect independent consented validation cases spanning multiple user profile cores and multiple counterpart profile cores. Keep calculation inputs separate from outcome labels until the calculation output is frozen for each case.

A later outcome audit should compare predeclared engine outputs against independently recorded outcomes without changing thresholds after seeing the labels.

Until such a cohort exists, cross-couple generalization remains `UNVERIFIED`.
