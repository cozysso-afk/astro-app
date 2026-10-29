# Relationship Gemini QA

The relationship interpreter supports four separate purposes: `compatibility`, `reunion`, `marriage_unmarried`, and `marriage_married`. Gemini is the only author of reader-facing interpretation prose. TypeScript may compact calculation evidence and reject invalid output, but it must not compose, translate, trim, repair, or replace Gemini prose or evidence references.

## Automatic checks

`relationship-quality-audit.yml` runs fixture-only evaluator tests, the Edge Function handler boundary tests, reunion grounding tests, and the mobile web build on pull requests and pushes. Fixture passes are always reported separately and never count as live Gemini quality evidence.

The manually approved job accepts at most two synthetic calls and initially covers `compatibility,reunion`. It requires the QA-only Supabase URL, publishable/anon key, QA account email/password, and calculation API URL. Password login obtains a fresh access token for each run; tokens and profiles are never written to artifacts.

Each live case must pass six stages:

1. Verified Gemini call trace, stored generation version, and `STOP` finish reason.
2. Purpose-specific response shape.
3. Unsupported deterministic claims and uncalculated terminology.
4. Exact dates must exist in the calculation response.
5. Cross-section repetition.
6. Purpose-specific direct answers and evidence traceability.

Reports contain only pass/fail codes and aggregate provider metadata. They do not contain raw Gemini prose, birth profiles, calculation payloads, credentials, or tokens.

## Paid-run guard

Run the workflow manually with `confirm_paid_calls=YES`, `max_jobs=2`, and `purposes=compatibility,reunion`. A green fixture job alone is not a live quality result. Completion requires `live_gemini_cases=2`, both purpose coverage values equal to one, and all six stages passing for both cases.
