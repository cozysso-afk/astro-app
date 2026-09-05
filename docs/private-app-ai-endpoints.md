# Private app AI Edge Function inventory

## Keep active

The current web application invokes only:

- `fortune-interpret-v21-preview`
- `relationship-interpret-v9-preview`

Both are authenticated endpoints and create `ai_interpret_jobs` before paid generation. After the private-app paid-AI migration is enabled, the database trigger rejects job creation for anonymous or non-allowlisted users.

## Retire / tombstone at private-app cutover

The following deployed functions are legacy/probe endpoints and are not referenced by the current web app. They must not remain as alternate Gemini entry points after private access is enabled:

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

Retirement means redeploying the same slug with a no-Gemini response (HTTP 410/403) or deleting the function if an administrative delete path is available. Do not merely hide these functions in the UI: a callable legacy endpoint is still an alternate cost path.

## Verification

Before considering the app private:

1. Search the current web source for `functions.invoke` and confirm only the two keep-active slugs are referenced.
2. List deployed Edge Functions and confirm every legacy/probe slug above has been retired/tombstoned.
3. Verify a non-allowlisted authenticated token cannot create an `ai_interpret_jobs` row.
4. Verify an anonymous token cannot create an `ai_interpret_jobs` row.
5. Verify retired endpoints do not contact Gemini even when called with a syntactically valid JWT.

No test in this checklist should intentionally perform a paid Gemini request.
