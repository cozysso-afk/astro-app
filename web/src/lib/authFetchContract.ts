// Private-app auth contract marker used by code review and regression checks.
// All browser calls to VITE_API_BASE_URL are decorated with the current Supabase
// bearer token by lib/auth.ts after AuthGate verifies /v1/auth/me.
export const AUTHENTICATED_API_FETCH_CONTRACT = 'supabase-email-otp-v1'
