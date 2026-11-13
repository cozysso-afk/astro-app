import {relationshipProvider} from './fixtures/relationshipProvider.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const fortune=readFileSync(new URL('../../../supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')
const relation=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
import {renderReunion} from './fixtures/reunionPanel.mjs'
const renderContract=readFileSync(new URL('./readingExperience.render.test.mjs',import.meta.url),'utf8')
const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
test('estimated whole-job 300 KRW guard replaces small byte-only cost ceilings',()=>{assert.match(fortune,/MAX_AI_JOB_ESTIMATED_KRW=300/);assert.match(fortune,/HARD_PROMPT_BYTES=180000/);assert.match(relation,/MAX_PROMPT_BYTES=180000,REUNION_PROMPT_TARGET_BYTES=40000,MAX_AI_JOB_ESTIMATED_KRW=300/);assert.match(relation,/relationshipEstimatedJobKrw/)})
test('Gemini is primary, unverified relationship prose stays hidden, and fresh AI auto archives',()=>{
  const data={headline:'실제 검증된 해설의 제목',core_summary:'다음 만남은 날짜가 정해지면 확인할 수 있어.',core_reason:'서로 시간을 내는지 살펴봐.',core_action:'가능한 시간을 함께 정해봐.'}
  const ai={...relationshipProvider,data}
  assert.match(renderReunion({ai}),/실제 검증된 해설의 제목/)
  for (const unverified of [null,{...ai,provenance_verified:false},{...ai,origin:'fallback'},{...ai,ok:false},{...ai,usage:undefined},{...ai,usage:{...ai.usage,call_trace:[{model:'gemini-3.7-flash',http_status:200,outcome:'success'}]}}]) {
    const html=renderReunion({ai:unverified})
    assert.match(html,/data-relationship-state="not_requested"/)
    assert.doesNotMatch(html,/실제 검증된 해설의 제목|data-authored-scope="reunion"/)
  }
  assert.match(app,/archive_mode:'relationship_ai_auto_v1'/)
  assert.match(app,/saveArchive\(\{kind:autoKind,[^\n]+interpretation:payload/)
})

test('relationship visible-reading regression stops before technical raw evidence',()=>{assert.match(renderContract,/html\.split\('<details class="relationship-technical"'\)\[0\]/);assert.doesNotMatch(renderContract,/html\.split\('<details class="relationship-enrichment"'\)\[0\]/)})
