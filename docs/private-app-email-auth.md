# Private app email OTP access

## Goal

Keep the Vercel URL reachable on the Hobby plan while making the actual app and calculation API usable only by explicitly allowed email accounts.

## Access model

- GitHub repository: private.
- Browser auth: Supabase email OTP.
- New anonymous sessions: disabled in web code.
- Existing anonymous session: may be linked once to an email so the existing Supabase `user_id` and cloud archive ownership can be preserved.
- New email users are not auto-created by the login form (`shouldCreateUser: false`).
- App allowlist: `public.app_access` with RLS; no real email is committed to Git.
- Render API: `api/private_app.py` validates the Supabase bearer token and the allowlist before any `/v1/*` route.
- Paid AI guard: a `BEFORE INSERT` trigger on `ai_interpret_jobs` rejects anonymous or non-allowlisted users before an Edge Function can proceed to a Gemini call.

## Owner rollout sequence

1. Apply `supabase/migrations/20260905_private_app_access.sql`.
2. Seed the chosen owner email into `public.app_access` as `role='owner'` using an admin-only path. Do not put the real email in Git.
3. Change the Supabase email template from Magic Link to six-digit OTP by including `{{ .Token }}`.
4. Deploy the web auth gate.
5. Change the Render start command from `uvicorn main:app` to `uvicorn private_app:app` (same working directory and port options as the existing command).
6. On the owner's existing device, enter the owner email. If an old anonymous session exists, it is linked to that email instead of creating a new user ID.
7. Verify: unauthenticated and non-allowlisted `/v1/*` calls must fail; the owner must retain existing cloud archive ownership.

## Sharing with a friend later

No redesign is required. Add the friend's verified email to `public.app_access` with `role='member'`. The same OTP login and API guard apply. If this grows beyond a few trusted users, add per-user quotas/roles and review AI spend limits before opening broader access.

## Deployment safety

Do not apply the DB trigger or switch the Render start command until the owner email has been seeded. The guard is deliberately fail-closed and would otherwise block every authenticated app request / new AI job.
