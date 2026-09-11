# Private app AI Edge Function inventory

## Keep active

The current production architecture has three active endpoints:

- `fortune-interpret-v21-preview`
- `fortune-interpret-v22-preview`
- `relationship-interpret-v9-preview`

`AppNext.tsx` intentionally names Fortune V21. The invocation-time
`precisionTransport.ts` guard rewrites that browser request to the V22 gateway,
which preserves the current V21/V22 architecture. V22 is current infrastructure,
not an unrelated legacy endpoint.

All three functions remain ACTIVE with JWT verification enabled. The browser does
not read or write `ai_interpret_jobs` directly. Job access stays behind the Edge
public-response boundary, while the Edge service-role path remains compatible
with the private paid-AI trigger and the 2026-09-11 table lockdown.

## Retired HTTP 410 tombstones

Production source inspection on 2026-09-11 confirmed that every endpoint below
returns a static HTTP 410 retired response and contains no Gemini key or provider
call path:

- `fortune-interpret`
- `fortune-interpret-v3-preview`
- `fortune-interpret-v4-preview`
- `fortune-interpret-v5-preview`
- `fortune-interpret-v6-preview`
- `fortune-interpret-v14-preview`
- `relationship-interpret`
- `relationship-interpret-v4-preview`
- `relationship-interpret-v5-preview`
- `relationship-interpret-v6-preview`
- `relationship-interpret-v7-preview`
- `relationship-interpret-v8-preview`
- `fortune-gemini-v14-probe`
- `gemini-quota-probe-v1`

These slugs are safe tombstones now. They are exact deletion candidates for a
later authorized cleanup, but deleting them is not part of the auth source
restack or owner cutover.

## Non-paid verification

Source and metadata inspection only:

1. Current web source invokes V21 and Relationship V9.
2. Precision transport rewrites V21 to the V22 gateway.
3. The three current functions remain ACTIVE with `verify_jwt=true`.
4. All fourteen non-current slugs are static HTTP 410 tombstones.
5. No Edge invocation or Gemini request is required by this checklist.
