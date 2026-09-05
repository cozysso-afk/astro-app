# Private app auth implementation status

Current branch: `feat/private-email-otp-auth`

Implemented in branch only:
- Supabase email OTP helpers and no new anonymous sessions.
- One-time linking path for an existing anonymous session to preserve its `user_id`.
- React auth gate before `AppNext` renders.
- Server-side `/v1/auth/me` allowlist check contract.
- Authenticated fetch injection for all calls to the configured Render API origin.
- `api/private_app.py` fail-closed guard for every `/v1/*` API route.
- `public.app_access` RLS migration and `ai_interpret_jobs` pre-insert guard.
- Web/static regression contracts.

Not applied to production yet:
- Supabase migration.
- Owner email allowlist row.
- Supabase email template change to `{{ .Token }}` OTP.
- Render start command switch to `private_app:app`.
- Vercel/main deployment.

No Gemini call is required for any of the above implementation or verification steps.
