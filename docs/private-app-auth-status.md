# Private app auth implementation status

Current branch: `feat/private-email-otp-auth`

Implemented in branch:
- Supabase default email Magic Link login; custom six-digit OTP/template is no longer required.
- No new anonymous sessions from the web client.
- One-time linking path for the existing anonymous archive owner to preserve its `user_id`.
- Short-lived local pending-link marker so the expected UUID survives the email redirect/new tab.
- Cloud-record preflight before falling back from an anonymous session to an already-existing email account.
- Post-link `user_id` + email equality check before app entry.
- React auth gate before `AppNext` renders.
- Server-side `/v1/auth/me` allowlist check contract.
- Authenticated fetch injection for all calls to the configured Render API origin.
- `api/private_app.py` fail-closed guard for every `/v1/*` API route; Render runtime auth env vars are mandatory.
- FastAPI docs/schema routes hidden by the private wrapper.
- Current-vs-legacy AI Edge Function inventory and retirement checklist.
- Web/static regression contracts.

Production DB/Auth preparation completed:
- Manual identity linking confirmed enabled in Supabase UI.
- Email provider and email confirmation confirmed enabled.
- `public.app_access` RLS migration applied.
- Owner allowlist row seeded through admin path outside Git.
- Paid-AI `ai_interpret_jobs` BEFORE INSERT guard applied.
- Trigger function direct EXECUTE revoked from `anon` and `authenticated`; service role remains allowed.
- Existing `readings` and `relationship_readings` each have one owner and the owner UUID is shared.
- Owner allowlist row bound to that existing archive UUID without exposing the UUID in Git or UI.
- That bound owner is still anonymous before cutover.
- Transitional DB guard applied: only the pre-bound anonymous owner may pass the paid-AI guard during conversion; every other anonymous user remains blocked.
- Transaction-only DB test confirmed the pre-bound owner path is accepted and a different anonymous user is rejected. No Edge Function/Gemini call occurred.
- Security Advisor no longer reports direct SECURITY DEFINER EXECUTE exposure for the private-app guard. Existing anonymous-policy warnings remain until anonymous sign-ins are disabled after conversion.

Still not applied / not completed:
- Supabase Authentication → URL Configuration production redirect verification.
- Legacy/probe Gemini Edge Function tombstones.
- Render runtime `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` verification.
- Render start-command switch to `private_app:app`.
- Vercel/main deployment of the web auth gate.
- Owner anonymous → permanent email identity conversion on the existing device.
- Post-conversion UUID/archive verification.
- Disabling anonymous sign-ins and removing the transitional anonymous-owner exception.

GitHub Actions on new PR heads has still not produced a workflow run, so this work must not be described as CI-passed yet.

No Gemini/external paid-AI call is required for the implementation or DB verification above, and none has been made by this auth work.
