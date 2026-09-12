# Editorial production release

Release source: review commit 859d7f2df7b91b4977c4a78b9ad2c8cceb72c737.
Previous production main: 5f73587808e1349fb9a0358d04087873d694a2aa.

User explicitly authorized deployment, then continued engine improvements.

Preflight: 269 targeted interpretation and UI tests passed; TypeScript/Vite build passed; production magic-link auth contract passed. Calculation API and database schema are unchanged.

Fortune V21 deployed as Edge version 17 and V22 as version 10, with JWT verification retained. Relative dependencies are included. Old tombstone endpoints were not reactivated.

OTP-only login is excluded from this release: managed Auth email templates still require verification/configuration access. AuthGate, auth.css, supabase client and auth contract retain production versions. The two unused OTP helper/test files are omitted. Full OTP implementation remains in review commit 859d7f2df7b91b4977c4a78b9ad2c8cceb72c737 and templates remain available for later activation. Existing login is not represented as fixed for standalone iOS.

UI release contains the accumulated opal visual changes and interpretation detail/consistency fixes. Existing saved readings are not rewritten. No new paid AI generation or authenticated iPhone login has been verified. Production web status and code equality are checked after publication and recorded separately.
