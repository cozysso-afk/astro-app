# Private app auth implementation status

Branch: `restack/private-email-auth-main-20260911`

## Source implementation

- Supabase default email Magic Link with `shouldCreateUser:false`.
- No new anonymous session creation in the browser.
- Existing anonymous owner conversion through `updateUser({email})`.
- One-hour pending user-ID/email marker across the confirmation redirect.
- Fail-closed mismatch handling before app entry.
- Cloud-record check before abandoning an anonymous account for an existing email account.
- `AuthGate` blocks `AppNext` until `/v1/auth/me` authorizes the session.
- Render API requests preserve existing headers and add the Supabase bearer.
- Invocation-time Fortune V21→V22 transport remains installed before React renders.
- Fortune and Relationship public-error boundaries remain unchanged.
- `api/private_app.py` protects every `/v1/*` route and hides FastAPI schema/docs paths.

## Production DB state observed read-only

All five historical private-auth migrations are present in migration history.
The allowlist table, RLS policy, user binding, paid-AI trigger, restricted
function ACL, and temporary bound-anonymous-owner transition are effective.

The later `ai_interpret_jobs` lockdown is also effective:

- `anon` and `authenticated`: no direct SELECT/INSERT access.
- `service_role`: required access retained.
- obsolete browser SELECT policy absent.

The auth/API implementation does not depend on direct browser access to that table.

## Owner safety state

- Exactly one enabled, bound owner row.
- The bound Auth user exists and is still anonymous.
- No email identity has been linked yet.
- Bound archive counts: 33 readings and 3 relationship readings.
- Both are at or above the preserved 29/3 baseline.
- No email address or user identifier is stored in source documentation.

## Platform preflight

Supabase public Auth settings confirm Email ON, email confirmation ON, and
anonymous sign-ins ON. Manual linking, Site URL, and Redirect URLs must be
rechecked in the Dashboard before cutover because they are not exposed by the
available read-only API.

Render currently uses `main`, auto-deploy OFF, and
`uvicorn api.main:app --host 0.0.0.0 --port $PORT`. The connector does not
expose environment-variable names, so both required auth variables remain a
cutover precondition.

All fourteen non-current AI/probe functions are already no-Gemini HTTP 410
tombstones. No function deletion is part of this pass.

## Not performed

- Replacement PR merge or Vercel production deployment.
- Render command/environment changes.
- Supabase Auth setting changes.
- Owner identity conversion.
- Anonymous sign-in disablement.
- Migration application or cleanup migration.
- Edge deletion or deployment.
- Gemini call.
