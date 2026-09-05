# Private app email OTP access

## Goal

Keep the Vercel URL reachable on the Hobby plan while making the actual app and calculation API usable only by explicitly allowed email accounts.

## Access model

- GitHub repository: private.
- Browser auth: Supabase email OTP.
- New anonymous sessions: disabled in web code.
- Existing anonymous session: may be linked once to an email so the existing Supabase `user_id` and cloud archive ownership can be preserved.
- Anonymous-to-email conversion uses `updateUser({ email })`; Supabase requires manual identity linking to be enabled for this conversion flow.
- New email users are not auto-created by the login form (`shouldCreateUser: false`).
- App allowlist: `public.app_access` with RLS; no real email is committed to Git.
- Render API: `api/private_app.py` validates the Supabase bearer token and the allowlist before any `/v1/*` route.
- Paid AI guard: after an owner is seeded, a `BEFORE INSERT` trigger on `ai_interpret_jobs` rejects anonymous or non-allowlisted users before job-backed Edge Functions can proceed to a Gemini call.
- Legacy AI Edge Functions that can call Gemini without the current job guard must be retired/tombstoned during the private-app cutover.

## Existing-record safety

- Before abandoning an old anonymous session because the requested email already belongs to another account, the web client counts that anonymous account's cloud `readings` and `relationship_readings`.
- If any cloud records exist, automatic account switching is blocked instead of silently orphaning those records.
- During first-time anonymous-to-email conversion, the client stores the pre-link anonymous `user_id` and verifies that the post-verification session has the same `user_id` before rendering the app.
- Local browser storage is not deleted by the auth gate.

## Owner rollout sequence

1. In Supabase Auth providers, confirm email auth is enabled and enable manual identity linking for anonymous-to-email conversion.
2. Apply `supabase/migrations/20260905_private_app_access.sql` (table + RLS only; no paid-AI trigger yet).
3. Seed the chosen owner email into `public.app_access` as `role='owner'` using an admin-only path. Do not put the real email in Git.
4. Change the Supabase Magic Link email template to a six-digit OTP template containing `{{ .Token }}`. Confirm the email-change template also supplies the code needed by the anonymous-account conversion flow.
5. Apply `supabase/migrations/20260905_private_app_paid_ai_guard.sql`. It refuses to install unless an enabled owner row already exists.
6. Retire/tombstone all legacy Gemini-capable Edge Functions except the two current web endpoints documented in `private-app-ai-endpoints.md`.
7. Deploy the web auth gate.
8. Change the Render start command from `uvicorn main:app` to `uvicorn private_app:app` while preserving the service's existing host/port/worker options.
9. On the owner's existing device, enter the owner email. If an old anonymous session exists, link it to that email instead of creating a new user ID.
10. Verify the `user_id` remains unchanged and the cloud archive is still present.
11. Verify unauthenticated and non-allowlisted `/v1/*` calls fail, and direct calls to paid-AI Edge Functions cannot start a Gemini request.

## Sharing with a friend later

No architecture redesign is required, but `app_access` alone is intentionally not enough to create a new account because `shouldCreateUser` is `false`.

For a new trusted friend:
1. provision/invite the email account through an admin-controlled Supabase Auth path,
2. add the normalized email to `public.app_access` with `role='member'`,
3. the friend then uses the same six-digit email OTP login.

If this grows beyond a few trusted users, add per-user quotas/roles, account-management UI, abuse protection/CAPTCHA, and review AI spend limits before broader access.

## Deployment safety

Do not switch Render/Vercel to the auth-gated build until the owner email row and OTP templates are ready. The second migration is deliberately owner-gated and fail-closed. Do not enable the paid-AI insert trigger with an empty allowlist.
