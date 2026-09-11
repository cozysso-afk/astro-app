# Private email auth pre-cutover checklist

Restack base: `bff55663336371d233a254fa3757de101ea17e53`

- [ ] Replacement PR CI is green.
- [x] Owner email is seeded only through an admin path and is not committed.
- [x] Email provider is enabled.
- [x] Email confirmation is required.
- [ ] Manual identity linking: live Dashboard recheck required before cutover.
- [ ] Supabase Site URL matches `https://astro-app-web-ten.vercel.app`.
- [ ] The same production origin is present in Redirect URLs.
- [x] Owner allowlist row is enabled, unique, and bound to the existing archive Auth user.
- [x] Bound owner is still anonymous and has no email identity before conversion.
- [x] Bound archive counts are 33 readings and 3 relationship readings, not below the preserved 29/3 baseline.
- [x] Paid-AI guard and direct-function ACL remain effective.
- [x] The 2026-09-11 `ai_interpret_jobs` browser lockdown remains effective; service-role access remains.
- [x] All fourteen legacy/probe functions are already static HTTP 410 tombstones.
- [ ] Render `SUPABASE_URL` presence is verified.
- [ ] Render `SUPABASE_PUBLISHABLE_KEY` presence is verified.
- [x] Render branch is `main`; auto-deploy is currently OFF.
- [x] Current Render command is `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.
- [ ] During an authorized cutover, change it to `uvicorn api.private_app:app --host 0.0.0.0 --port $PORT`.
- [ ] Merge/deploy the web gate only during the coordinated cutover.
- [ ] On the existing owner device, link the anonymous user to email without logging out or clearing site data.
- [ ] Verify the user ID and archive ownership remain unchanged after confirmation.
- [ ] Disable anonymous sign-ins only after owner conversion succeeds.
- [ ] Remove the temporary bound-anonymous-owner exception only after conversion succeeds.

No cutover or production mutation belongs in the restack pass.
