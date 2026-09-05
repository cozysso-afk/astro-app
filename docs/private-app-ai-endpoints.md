# Private app AI Edge Function inventory

## Keep active

The current web application invokes only:

- `fortune-interpret-v21-preview`
- `relationship-interpret-v9-preview`

Both remain ACTIVE with JWT verification enabled. They create `ai_interpret_jobs` before paid generation, where the private-app database guard rejects unauthorized job creation.

## Retired / tombstoned on 2026-09-06

The following legacy/probe functions were confirmed not to be referenced by the current web app and were redeployed as no-Gemini HTTP 410 tombstones. JWT verification remains enabled. Their current code returns a static retired response only and contains no Gemini/API call path:

- `fortune-interpret`
- `relationship-interpret`
- `relationship-interpret-v4-preview`
- `relationship-interpret-v5-preview`
- `relationship-interpret-v6-preview`
- `relationship-interpret-v7-preview`
- `relationship-interpret-v8-preview`
- `fortune-interpret-v3-preview`
- `fortune-interpret-v4-preview`
- `fortune-interpret-v5-preview`
- `fortune-interpret-v6-preview`
- `fortune-interpret-v14-preview`
- `fortune-gemini-v14-probe`
- `gemini-quota-probe-v1`

This closes the alternate legacy Gemini cost paths without deleting the function slugs, so retirement is explicit and reversible if historical source recovery is ever necessary.

## Verification

Completed without invoking Gemini:

1. Current `web/src/AppNext.tsx` source search shows runtime `functions.invoke` calls only for `fortune-interpret-v21-preview` and `relationship-interpret-v9-preview`.
2. All 14 legacy/probe slugs above were redeployed as static HTTP 410 tombstones.
3. The two current slugs were inspected after retirement work and remain on their previous active versions with `verify_jwt=true`.
4. Database transaction regression already verifies the bound transitional owner may create an AI job while other anonymous users are blocked; the generic allowlist/binding guards remain in place.

Still required after owner cutover:

- Verify a non-allowlisted permanent authenticated token cannot create an `ai_interpret_jobs` row.
- Verify the converted owner can reach current AI authorization paths. Do not trigger actual paid Gemini generation without explicit user permission.

No test in this checklist should intentionally perform a paid Gemini request.
