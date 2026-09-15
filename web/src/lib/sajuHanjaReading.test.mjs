import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {ganzhiWithReading}=await server.ssrLoadModule('/src/lib/systemReading.ts')
after(()=>server.close())

test('ganzhi display adds Korean reading without changing the original Chinese characters',()=>{
  assert.equal(ganzhiWithReading('丁酉'),'丁酉(정유)')
  assert.equal(ganzhiWithReading('丙午'),'丙午(병오)')
  assert.equal(ganzhiWithReading('甲子'),'甲子(갑자)')
})

test('already annotated or unknown labels are not double-converted',()=>{
  assert.equal(ganzhiWithReading('丁酉(정유)'),'丁酉(정유)')
  assert.equal(ganzhiWithReading('unknown'),'unknown')
})
