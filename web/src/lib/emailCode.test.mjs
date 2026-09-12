import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
const server = await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
 const m = await server.ssrLoadModule('/src/lib/supabase.ts')
 const values=new Map()
 globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
 let sent, verified, signedOut=0
 m.supabase.auth.signInWithOtp=async v=>{sent=v;return {data:{},error:null}}
 m.supabase.auth.signOut=async()=>{signedOut++;return {error:null}}
 m.supabase.auth.verifyOtp=async v=>{verified=v;return {data:{session:{user:{id:'owner-id',email:'owner@example.com',is_anonymous:false}}},error:null}}
 await m.requestEmailCode(' OWNER@example.com ')
 assert.deepEqual(sent,{email:'owner@example.com',options:{shouldCreateUser:false}})
 assert.equal((await m.verifyEmailCode('owner@example.com','123456')).user.id,'owner-id')
 assert.deepEqual(verified,{email:'owner@example.com',token:'123456',type:'email'})
 for(const bad of ['abc123','12345','12345678901','https://example.com']) await assert.rejects(m.verifyEmailCode('owner@example.com',bad),/숫자 인증번호/)
 m.rememberPendingAnonymousLink('owner-id','owner@example.com')
 await m.verifyEmailCode('owner@example.com','123456')
 assert.equal(verified.type,'email_change')
 await assert.rejects(m.verifyEmailCode('other@example.com','123456'),/원래 주소/)
 m.rememberPendingAnonymousLink('other-id','owner@example.com')
 await assert.rejects(m.verifyEmailCode('owner@example.com','123456'),/기존 기록 계정/)
 assert.equal(signedOut,1)
 m.clearPendingAnonymousLink()
 m.supabase.auth.verifyOtp=async()=>({data:{},error:{status:400}})
 await assert.rejects(m.verifyEmailCode('owner@example.com','123456'),/맞지 않거나 만료/)
 m.supabase.auth.verifyOtp=async()=>({data:{},error:{status:429}})
 await assert.rejects(m.verifyEmailCode('owner@example.com','123456'),/너무 자주/)
 assert.equal(values.size,0)
 const pending = await server.ssrLoadModule('/src/lib/pendingEmailCode.ts')
 globalThis.window.sessionStorage=globalThis.window.localStorage
 pending.rememberEmailCode('owner@example.com',Date.now()+60000)
 assert.equal(pending.pendingEmailCode().email,'owner@example.com')
 assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])).sort(),['email','requestedAt','resendAt'])
 const key=[...values.keys()][0]
 values.set(key,JSON.stringify({email:'owner@example.com',requestedAt:Date.now()-3600001,resendAt:0}))
 assert.equal(pending.pendingEmailCode(),null)
 assert.equal(values.size,0)
 values.set(key,'malformed')
 assert.equal(pending.pendingEmailCode(),null)
 pending.forgetEmailCode()
 assert.equal(values.size,0)
 console.log('OTP: request, success, malformed/expired/rate-limited code, email-change identity protection passed. No live email sent.')
} finally {delete globalThis.window; await server.close()}
