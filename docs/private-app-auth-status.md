# Private app auth implementation status

Current branch: `feat/private-email-otp-auth`

Implemented in branch only:
- Supabase email OTP helpers and no new anonymous sessions.
- One-time linking path for an existing anonymous session to preserve its `user_id`.
- Cloud-record preflight before falling back from an anonymous session to an already-existing email account.
- Post-link `user_id` equality check before app entry.
- React auth gate before `AppNext` renders.
- Server-side `/v1/auth/me` allowlist check contract.
- Authenticated fetch injection for all calls to the configured Render API origin.
- `api/private_app.py` fail-closed guard for every `/v1/*` API route.
- Phase 1 `public.app_access` RLS migration.
- Phase 2 owner-gated `ai_interpret_jobs` pre-insert guard; it refuses installation before an enabled owner exists.
- Current-vs-legacy AI Edge Function inventory and retirement checklist.
- Web/static regression contracts.

Production audit findings used to shape the migration:
- Existing cloud readings are concentrated on a single anonymous owner account, so preserving that account's UUID during the first email link is the safest path.
- Multiple anonymous Auth users exist from the old automatic anonymous-session behavior; new anonymous creation is therefore removed from the web client.
- AI job history spans multiple anonymous user IDs, so UI-only hiding is not sufficient; the paid-AI database guard and legacy endpoint retirement are required.

Not applied to production yet:
- Supabase access-table migration.
- Owner email allowlist row.
- Supabase manual identity-linking setting confirmation.
- Supabase email/email-change template change to six-digit OTP.
- Paid-AI trigger migration.
- Legacy/probe Edge Function tombstones.
- Render start command switch to `private_app:app`.
- Vercel/main deployment.

No Gemini call is required for any of the above implementation or verification steps. No Gemini call has been made by this auth work.
