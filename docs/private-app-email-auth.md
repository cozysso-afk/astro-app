# Private app email Magic Link access

## Access model

- Browser authentication uses Supabase Email Magic Link.
- Normal login sets `shouldCreateUser:false`, so arbitrary email submissions do not create users.
- The normal Magic Link redirects to the current browser origin.
- The existing anonymous archive owner links an email with `updateUser({email})` so the Auth user ID remains unchanged.
- A short-lived pending user-ID/email marker survives the confirmation redirect.
- Any returned user-ID or email mismatch signs out and fails closed.
- The gate never clears archive/local application data.
- `AppNext` renders only after the server allowlist accepts both email and bound Auth user ID.

Current Supabase documentation still supports both `shouldCreateUser:false`
for Magic Link login and `updateUser({email})` for converting an anonymous user.
The conversion requires manual identity linking to be enabled.

## API and AI protection

- Browser calls to the Render origin receive the current Supabase bearer without dropping caller headers.
- `api/private_app.py` validates the token, normalized allowlist email, and optional bound user ID for every `/v1/*` request.
- Missing `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` fails closed with HTTP 503.
- `/openapi.json`, `/docs`, and `/redoc` are hidden.
- The auth layer never grants browser access to `ai_interpret_jobs`.
- Fortune keeps its V21 browser-name → V22 transport/gateway architecture.
- Relationship keeps `relationship-interpret-v9-preview`.

## Existing owner safety

Before switching away from an anonymous session, the client counts cloud
`readings` and `relationship_readings`. A nonzero count blocks automatic
fallback to a different existing email account. After email confirmation, the
new session must match both the pending user ID and requested email before the
app can render.

## Production preparation already present

Source-of-truth files for these already-applied migrations remain in the repository:

- `20260905_private_app_access.sql`
- `20260905_private_app_paid_ai_guard.sql`
- `20260906_private_app_paid_ai_guard_acl.sql`
- `20260906_private_app_access_user_binding.sql`
- `20260906_private_app_bound_anonymous_owner_transition.sql`

Do not reapply them during source restack or cutover. The 2026-09-11
`ai_interpret_jobs` lockdown remains authoritative for browser access.

## Coordinated cutover sequence

1. Verify manual identity linking is ON and confirm the production Site/Redirect URLs.
2. Verify Render has both required auth environment variables.
3. Merge the green replacement PR.
4. Wait for the exact merged SHA to become Vercel Production READY.
5. Change Render start command to `uvicorn api.private_app:app --host 0.0.0.0 --port $PORT` and deploy that exact merged source.
6. Verify unauthenticated and unauthorized `/v1/*` requests fail closed.
7. On the existing owner device, request the email link and complete confirmation without clearing site data or signing out first.
8. Verify the Auth user ID, allowlist binding, and archive ownership/counts remain consistent.
9. Verify authorized web/API paths without making a paid Gemini request.
10. Disable anonymous sign-ins.
11. Apply a separately reviewed cleanup migration removing the temporary anonymous-owner exception.
12. Optionally delete the fourteen already-retired HTTP 410 Edge tombstones.

Do not begin this sequence until the unknown Auth URL/manual-linking and Render
environment preconditions are resolved.
