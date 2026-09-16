import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture } from './readingExperience.fixtures.mjs'

const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
  const {buildFortuneUserSummary}=await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
  const f=fortuneFixture('today')
  const row=f.data.topic_analysis['대인관계']
  row.verdict='검증된 해설 한 문장은 그대로 보존해.'
  row.evidence_refs=['W:fixture']
  const context={...f.context,focusTopics:['대인관계'],verifiedNarrative:true,topicEntries:[['대인관계',row]]}

  const short=buildFortuneUserSummary(f.data,context).focusTopics[0].conclusion
  assert.ok(short.startsWith(row.verdict),'verified verdict must remain the leading sentence')
  assert.ok(short.length>row.verdict.length+20,'a short verified verdict should receive one grounded life-context sentence')

  row.verdict='검증된 해설은 첫 문장에서 결론을 말해. 두 번째 문장에서 이미 충분한 생활 맥락을 설명해.'
  const complete=buildFortuneUserSummary(f.data,context).focusTopics[0].conclusion
  assert.equal(complete,row.verdict,'already substantial verified prose must not be padded')

  console.log('Narrative depth contract: short verified prose is deepened once; substantial prose stays authored.')
} finally { await server.close() }
