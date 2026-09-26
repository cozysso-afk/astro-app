import assert from 'node:assert/strict'
import fs from 'node:fs'

const supabase = fs.readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8')
const auth = fs.readFileSync(new URL('./auth.ts', import.meta.url), 'utf8')
const gate = fs.readFileSync(new URL('../AuthGate.tsx', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const precision = fs.readFileSync(new URL('./precisionTransport.ts', import.meta.url), 'utf8')

assert.equal(supabase.includes('signInAnonymously'), false, 'web auth must not create new anonymous users')
assert.equal(supabase.includes('shouldCreateUser: false'), true, 'magic-link login must not auto-create arbitrary users')
assert.equal(supabase.includes('updateUser({ email:'), true, 'existing anonymous session must be converted by linking its email identity')
assert.equal(supabase.includes('rememberPendingAnonymousLink'), true, 'pre-link anonymous user id must survive the email redirect')
assert.equal(supabase.includes('window.localStorage.setItem'), true, 'pending UUID marker must survive a new browser tab')
assert.equal(supabase.includes('countCurrentCloudRecords'), true, 'anonymous-to-existing-account fallback must inspect cloud records first')
assert.equal(auth.includes(".from('app_access')"), true, 'frontend login gate must verify the Supabase RLS allowlist directly')
assert.equal(auth.includes('/v1/auth/me'), false, 'frontend login must not depend on Render API availability')
assert.equal(auth.includes("headers.set('Authorization'"), true, 'Render API calls must carry the Supabase bearer token after login')
assert.equal(auth.includes('new Headers(input instanceof Request ? input.headers : undefined)'), true, 'auth fetch must preserve Request headers')
assert.equal(auth.includes('new Headers(init?.headers).forEach'), true, 'auth fetch must preserve caller init headers')
assert.equal(auth.includes('authorizedApiSession = session'), true, 'only the already-authorized app session should feed private API requests')
assert.equal(auth.includes('AUTH_SESSION_TIMEOUT_MS = 5_000'), true, 'private API session lookup must be bounded on mobile')
assert.equal(auth.includes('Promise.race(['), true, 'private API session refresh must not leave the UI waiting forever')
assert.equal(auth.includes('getAuthorizedApiSession()'), true, 'private API wrapper must use the bounded authorized-session path')
assert.equal(gate.includes('<AuthGate'), false, 'AuthGate must not recursively render itself')
assert.equal(gate.includes('checkAppAccess'), true, 'AuthGate must enforce the RLS-backed private allowlist')
assert.equal(gate.includes('readPendingAnonymousLink'), true, 'redirect completion must reload the preserved anonymous-link marker')
assert.equal(gate.includes('nextSession.user.id !== pending.userId'), true, 'mismatched user ids must block app entry')
assert.equal(gate.includes('authenticatedEmail !== pending.email'), true, 'redirected email must match the requested owner email')
assert.equal(gate.includes('cloudRecordCount > 0'), true, 'cloud-bearing anonymous accounts must never be silently abandoned')
assert.equal(gate.includes('onAuthStateChange'), false, 'auth-state callbacks must not bypass explicit boot-time UUID checks')
assert.equal(main.includes('<AuthGate>'), true, 'AppNext must stay behind the authorization gate')
assert.equal(main.indexOf('installIntegratedPrecisionFetch()') < main.indexOf('ReactDOM.createRoot'), true, 'precision transport must install before React/auth bootstrap')
assert.equal(supabase.includes('global: { fetch: dynamicFetch }'), true, 'Supabase calls must resolve the invocation-time global fetch chain')
assert.equal(supabase.includes("REUNION_NARRATIVE_CONTRACT = 'reunion-consultation-v3'"), true, 'reunion requests must carry the v3 narrative cache identity')
assert.equal(supabase.includes("body.purpose !== 'reunion'"), true, 'narrative cache rewrite must be reunion-only')
assert.equal(supabase.includes("url.includes('/functions/v1/relationship-interpret-v9-preview')"), true, 'narrative cache rewrite must be scoped to the relationship edge endpoint')
assert.equal(supabase.includes('period: { ...period, narrative_contract: REUNION_NARRATIVE_CONTRACT }'), true, 'reunion narrative contract must survive inside the server-hashed period payload')
assert.equal(supabase.includes('return {\n      ...init,\n      body: JSON.stringify'), true, 'reunion request rewrite must preserve method headers and other fetch init fields')

assert.equal(app.includes("const FORTUNE_AI_FUNCTION = 'fortune-interpret-v21-preview'"), true, 'current fortune AI must use the guarded v21 endpoint')
assert.equal(app.includes("functions.invoke('relationship-interpret-v9-preview'"), true, 'current relationship AI must use the guarded v9 endpoint')
assert.equal(precision.includes("'fortune-interpret-v22-preview'"), true, 'fortune v21 browser invokes must be transported through the current v22 gateway')
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
assert.ok(supabase.includes('requestEmailCode') && supabase.includes('verifyEmailCode'))
assert.ok(gate.includes('one-time-code') && gate.includes('인증번호 받기'))
assert.ok(!gate.includes('인증 링크 붙여넣기'))
