# Private app email Magic Link access

## Goal

Keep the Vercel URL reachable on the Hobby plan while making the actual app and calculation API usable only by explicitly allowed email accounts.

## Access model

- GitHub repository: private.
- Browser auth: Supabase default email Magic Link; no custom SMTP/template is required for the current owner cutover.
- New anonymous sessions: disabled in web code.
- Existing anonymous session: linked once to an email so the existing Supabase `user_id` and cloud archive ownership can be preserved.
- Anonymous-to-email conversion uses `updateUser({ email })`; manual identity linking must be enabled.
- New email users are not auto-created by the login form (`shouldCreateUser: false`).
- App allowlist: `public.app_access` with RLS; the real owner email is seeded through an admin path and is not committed to Git.
- The owner allowlist row is also bound to the existing archive owner's Auth `user_id`, so an unexpected different Auth account fails closed.
- Render API: `api/private_app.py` validates the Supabase bearer token, email allowlist and bound `user_id` before any `/v1/*` route.
- Paid AI guard: a `BEFORE INSERT` trigger on `ai_interpret_jobs` blocks non-allowlisted users before job-backed Edge Functions can proceed to a Gemini call.
- During the one-time cutover, only the pre-bound owner UUID may remain anonymous; every other anonymous account is still rejected. Remove this transition exception after owner conversion.
- Legacy AI Edge Functions that can call Gemini without the current job guard must be retired/tombstoned during the private-app cutover.

## Existing-record safety

- Before abandoning an old anonymous session because the requested email already belongs to another account, the web client counts that anonymous account's cloud `readings` and `relationship_readings`.
- If any cloud records exist, automatic account switching is blocked instead of silently orphaning those records.
- During first-time anonymous-to-email conversion, the client stores the pre-link anonymous `user_id` + requested email in short-lived local storage so the marker survives the email-link redirect/new tab.
- After the confirmation link returns, the resulting permanent session must have the same `user_id` and email before the app can render.
- The server/DB also bind the owner allowlist row to the same UUID as a second independent check.
- Local archive/browser data is never deleted by the auth gate.

## Production DB preparation already completed

- `20260905_private_app_access.sql`: access table + RLS applied.
- Owner allowlist row: seeded by admin path outside Git.
- `20260905_private_app_paid_ai_guard.sql`: paid-AI trigger applied.
- `20260906_private_app_paid_ai_guard_acl.sql`: direct `anon`/`authenticated` EXECUTE removed.
- `20260906_private_app_access_user_binding.sql`: allowlist owner row can be bound to a specific Auth UUID and API/RLS checks support that binding.
- The owner row has been bound to the unique UUID that owns both existing `readings` and `relationship_readings`; that Auth user is still anonymous before cutover.
- `20260906_private_app_bound_anonymous_owner_transition.sql`: temporarily allows only that pre-bound anonymous owner through the paid-AI DB guard while rejecting all other anonymous users.
- Transaction-only DB regression confirmed the bound anonymous owner is accepted and a different anonymous account is rejected. No Edge Function or Gemini request is involved in this test.

## Remaining owner rollout sequence

1. Confirm Supabase Authentication → URL Configuration points email confirmations back to the real production Vercel URL.
2. Retire/tombstone legacy Gemini-capable Edge Functions except the current guarded endpoints documented in `private-app-ai-endpoints.md`.
3. Verify Render has `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as runtime environment variables; `private_app.py` intentionally fails closed if they are absent.
4. Deploy the web auth gate and change the current Render command `uvicorn api.main:app --host 0.0.0.0 --port $PORT` to `uvicorn api.private_app:app --host 0.0.0.0 --port $PORT` as one coordinated cutover.
5. On the owner's existing device, enter the owner email and click the email confirmation link. Do not log out or clear site data before this conversion.
6. Verify the Auth `user_id` remains the pre-bound archive UUID, the account is no longer anonymous, and the existing cloud archive remains present.
7. Verify unauthenticated/non-allowlisted `/v1/*` calls fail and current paid-AI endpoints remain usable only for the owner.
8. Disable Supabase anonymous sign-ins.
9. Apply a cleanup migration removing the temporary anonymous-owner exception.

## Sharing with a friend later

No architecture redesign is required, but `app_access` alone intentionally does not create an account because `shouldCreateUser` is `false`.

For a new trusted friend:
1. provision/invite the email account through an admin-controlled Supabase Auth path,
2. add the normalized email to `public.app_access` with `role='member'`,
3. optionally bind that row to the created Auth UUID,
4. the friend then uses the same email Magic Link login.

If this grows beyond a few trusted users, add per-user quotas/roles, account-management UI, abuse protection/CAPTCHA, custom SMTP/deliverability controls, and explicit AI spend limits before broader access.

## Deployment safety

Render is currently on `main`, auto-deploys on commits, and has repository root as its working root. Do not merge or change the Render start command until URL Configuration and Render auth environment variables are verified and the coordinated cutover is explicitly approved.
