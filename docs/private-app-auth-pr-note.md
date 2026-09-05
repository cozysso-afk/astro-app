# Review checklist

- [ ] Web CI passes TypeScript/Vite build and auth contract.
- [ ] Owner email is seeded only through an admin path, never committed.
- [ ] Supabase email template sends `{{ .Token }}` six-digit OTP.
- [ ] Existing owner device links the current anonymous session before any cleanup.
- [ ] Render is switched to `private_app:app` only after allowlist seed.
- [ ] Unauthenticated `/v1/*` = blocked.
- [ ] Authenticated but non-allowlisted `/v1/*` = blocked.
- [ ] Non-allowlisted AI job insert = blocked before Gemini call.
- [ ] Owner archive `user_id` remains unchanged after email linking.
