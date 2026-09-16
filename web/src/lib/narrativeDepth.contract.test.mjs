import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
  const {visibleTopicDepth}=await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')
  const short='검증된 해설 한 문장은 그대로 보존해.'
  const detail='실제 생활에서는 상대의 말보다 이후 태도와 약속이 이어지는지를 같이 봐.'
  assert.equal(visibleTopicDepth(short,detail),detail,'one short conclusion should surface one existing real-life sentence')
  assert.equal(visibleTopicDepth('첫 문장에서 결론을 말해. 두 번째 문장에서 이미 충분히 설명해.',detail),'','two-sentence prose should not be padded')
  assert.equal(visibleTopicDepth(short,short),'','the same sentence must not be duplicated')
  assert.equal(visibleTopicDepth(short,''),'','missing real-life depth must not invent prose')
  console.log('Narrative depth contract: one grounded sentence is surfaced only when the visible conclusion is short.')
} finally { await server.close() }
