# Review checklist

- [ ] Web CI passes TypeScript/Vite build and auth contract.
- [x] Owner email seeded only through an admin path, never committed.
- [x] Supabase manual identity linking enabled.
- [x] Default Supabase Magic Link/email-change link flow retained; no custom SMTP/template required for owner cutover.
- [x] Owner allowlist row bound to the existing archive owner's Auth UUID.
- [x] Paid-AI DB guard rejects non-allowlisted users and direct guard-function RPC execution is revoked from `anon`/`authenticated`.
- [x] Temporary cutover guard allows only the pre-bound anonymous owner while rejecting other anonymous users.
- [ ] Supabase Site URL / redirect configuration points to the production Vercel app.
- [ ] Existing owner device links the current anonymous session before any logout/site-data cleanup.
- [ ] Render runtime auth environment variables are present.
- [ ] Render start command changes from `uvicorn api.main:app --host 0.0.0.0 --port $PORT` to `uvicorn api.private_app:app --host 0.0.0.0 --port $PORT` only as part of the coordinated cutover.
- [ ] Web auth gate is deployed to Vercel/main only as part of the coordinated cutover.
- [ ] Unauthenticated `/v1/*` = blocked after cutover.
- [ ] Authenticated but non-allowlisted `/v1/*` = blocked after cutover.
- [ ] Owner archive `user_id` remains unchanged and account becomes non-anonymous after email confirmation.
- [ ] Anonymous sign-ins disabled after owner conversion.
- [ ] Temporary anonymous-owner AI exception removed after conversion.
- [ ] Legacy/probe Gemini-capable Edge Functions retired/tombstoned before broader sharing.
