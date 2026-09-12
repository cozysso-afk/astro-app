# In-app email code rollout — staged transition

Project: dbynfabwfcakxayyggzi. Production currently retains magic-link login.

1. Save current Magic Link and Change Email Address templates for rollback.
2. Add `<p>인증번호: {{ .Token }}</p>` to BOTH existing template bodies, keeping the existing ConfirmationURL links. Alternatively apply the two bundled HTML templates and the four-field management API patch. Both delivery methods coexist so current production login continues to work.
3. Confirm the saved templates contain Token and ConfirmationURL. Verify a received authentication email includes a numeric code.
4. Merge/deploy the dedicated OTP UI PR after that verification. Enter the code in the installed app; do not follow the compatibility link when the code field is present.
5. Verify the same user UUID/archives, resend cooldown, expired code handling, and anonymous-email linking. Existing security/allowlist, SMTP, expiry, and redirects remain unchanged.

Only the hosted Auth template update is blocked: the connected Supabase tools do not expose Auth configuration updates and no Management API access token is available. These files do not configure hosted Auth by themselves. Do not merge the OTP UI before template verification. No credentials should be pasted into chat.

The retained ConfirmationURL is a transition fallback, not the normal OTP app flow. Browser handoff cannot be used to work around a missing plugin capability under the control-browser skill.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
