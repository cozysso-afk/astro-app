import assert from 'node:assert/strict'
import fs from 'node:fs'

const supabase = fs.readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8')
const auth = fs.readFileSync(new URL('./auth.ts', import.meta.url), 'utf8')
const gate = fs.readFileSync(new URL('../AuthGate.tsx', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')

assert.equal(supabase.includes('signInAnonymously'), false, 'web auth must not create new anonymous users')
assert.equal(supabase.includes('shouldCreateUser: false'), true, 'magic-link login must not auto-create arbitrary users')
assert.equal(supabase.includes('requestEmailMagicLink'), true, 'private login must use the default email magic-link flow')
assert.equal(supabase.includes('verifyOtp({'), false, 'custom six-digit OTP verification must not be required')
assert.equal(supabase.includes('updateUser({ email:'), true, 'existing anonymous session must be converted by linking its email identity')
assert.equal(supabase.includes('rememberPendingAnonymousLink'), true, 'pre-link anonymous user id must survive the email redirect')
assert.equal(supabase.includes('window.localStorage.setItem'), true, 'pending UUID marker must survive a new browser tab')
assert.equal(supabase.includes('countCurrentCloudRecords'), true, 'anonymous-to-existing-account fallback must inspect cloud records first')
assert.equal(auth.includes('/v1/auth/me'), true, 'frontend must verify server-side allowlist before rendering the app')
assert.equal(auth.includes("headers.set('Authorization'"), true, 'Render API calls must carry the Supabase bearer token')
assert.equal(gate.includes('<AuthGate'), false, 'AuthGate must not recursively render itself')
assert.equal(gate.includes('checkAppAccess'), true, 'AuthGate must enforce server-side authorization')
assert.equal(gate.includes('readPendingAnonymousLink'), true, 'redirect completion must reload the preserved anonymous-link marker')
assert.equal(gate.includes('nextSession.user.id !== pending.userId'), true, 'mismatched user ids must block app entry')
assert.equal(gate.includes('authenticatedEmail !== pending.email'), true, 'redirected email must match the requested owner email')
assert.equal(gate.includes('cloudRecordCount > 0'), true, 'cloud-bearing anonymous accounts must never be silently abandoned')
assert.equal(gate.includes('6자리 인증 코드'), false, 'UI must not require a custom OTP template')
assert.equal(gate.includes('로그인 링크 받기'), true, 'UI must describe the actual magic-link flow')
assert.equal(gate.includes('onAuthStateChange'), false, 'auth-state callbacks must not bypass explicit boot-time UUID checks')

assert.equal(app.includes("const FORTUNE_AI_FUNCTION = 'fortune-interpret-v21-preview'"), true, 'current fortune AI must use the guarded v21 endpoint')
assert.equal(app.includes("functions.invoke('relationship-interpret-v9-preview'"), true, 'current relationship AI must use the guarded v9 endpoint')
for (const legacy of [
  'fortune-interpret',
  'fortune-interpret-v3-preview',
  'fortune-interpret-v4-preview',
  'fortune-interpret-v5-preview',
  'fortune-interpret-v6-preview',
  'fortune-interpret-v14-preview',
  'fortune-gemini-v14-probe',
  'gemini-quota-probe-v1',
  'relationship-interpret',
  'relationship-interpret-v4-preview',
  'relationship-interpret-v5-preview',
  'relationship-interpret-v6-preview',
  'relationship-interpret-v7-preview',
  'relationship-interpret-v8-preview',
]) {
  assert.equal(app.includes(`functions.invoke('${legacy}'`), false, `current web app must not invoke legacy AI endpoint ${legacy}`)
}

console.log('private email auth contract: ok')
