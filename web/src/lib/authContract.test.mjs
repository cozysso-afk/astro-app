import assert from 'node:assert/strict'
import fs from 'node:fs'

const supabase = fs.readFileSync(new URL('./supabase.ts', import.meta.url), 'utf8')
const auth = fs.readFileSync(new URL('./auth.ts', import.meta.url), 'utf8')
const gate = fs.readFileSync(new URL('../AuthGate.tsx', import.meta.url), 'utf8')

assert.equal(supabase.includes('signInAnonymously'), false, 'web auth must not create new anonymous users')
assert.equal(supabase.includes('shouldCreateUser: false'), true, 'email OTP must not auto-create arbitrary users')
assert.equal(supabase.includes("type: 'email_change'"), true, 'existing anonymous session migration must preserve user id via email change')
assert.equal(auth.includes('/v1/auth/me'), true, 'frontend must verify server-side allowlist before rendering the app')
assert.equal(auth.includes("headers.set('Authorization'"), true, 'Render API calls must carry the Supabase bearer token')
assert.equal(gate.includes('<AuthGate'), false, 'AuthGate must not recursively render itself')
assert.equal(gate.includes('checkAppAccess'), true, 'AuthGate must enforce server-side authorization')

console.log('private email auth contract: ok')
