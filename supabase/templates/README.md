# In-app email code rollout

Project: `dbynfabwfcakxayyggzi` (astro-app).

These files are prepared, **not applied** to production. Keep the application change in draft until email delivery is verified.

1. In Supabase Authentication → Email Templates, save the existing **Magic Link** and **Change Email Address** templates for rollback.
2. Replace Magic Link body with `email-code.html`, and Change Email Address body with `email-change-code.html`. Use the Korean subjects in `email-code-auth-patch.json`.
3. Alternatively, an authorized Management API client can PATCH `/v1/projects/dbynfabwfcakxayyggzi/config/auth` with `email-code-auth-patch.json`. Modify only its four template/subject fields; do not change SMTP, redirects, signup policy, or OTP expiration. Do not commit tokens or full Auth configuration dumps.
4. Verify a real allowed account receives a numeric code. The existing link login UI will not support code-only emails, so coordinate template change with application deployment; do not leave only one side changed. If the release cannot follow immediately, restore the saved template.
5. On an installed iPhone app, request and enter the code, confirm the same standalone window remains open, allowlist passes, and existing records remain. Check resend, expired code, reload while waiting, and logout/login. Validate existing anonymous-account email conversion without changing its UUID.
6. If verification fails, restore both previous application release and saved email templates together.

The connector available in this session cannot update Auth email templates, and the authenticated browser could not connect. No real authentication email was sent by automated tests.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
