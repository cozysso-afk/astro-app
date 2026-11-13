import {relationshipProvider} from './fixtures/relationshipProvider.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {buildFortuneUserSummary} from './fortuneUserSummary.ts'
import {fortuneFixture} from './readingExperience.fixtures.mjs'
import {hierarchy,renderReunion} from './fixtures/reunionPanel.mjs'
import {validateReunionGroundingV2} from '../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'

const fortune=readFileSync(new URL('./fortuneUserSummary.ts',import.meta.url),'utf8')
const fallback=readFileSync(new URL('./basicFortuneReading.ts',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('daily home headline never drops back to the generic topic-list sentence',()=>{
  const {data,context,calculation}=fortuneFixture('today')
  const visible=()=>buildFortuneUserSummary(data,context)
  assert.match(visible().headline,/대인관계야.*약속이나 일정/)
  assert.match(visible().summary,/대인관계.*컨디션/)
  calculation.western.daily_scores=[]
  assert.match(visible().headline,/실제로 들어오는 요청·답변·일정/)
  assert.doesNotMatch(fallback,/\$\{best\.topic\} 쪽은 활용할 만하고, \$\{watch\.topic\} 쪽은 속도를 낮추는 편이 좋아/)
})

test('hierarchy reunion shows a full human story before technical evidence',()=>{
  const sections={why_reconnect:{conclusion:'예전 약속에서 대화의 실마리를 찾아봐.'},timing:{conclusion:'같은 기간 안에서도 약속을 확인할 때가 달라.'},rebuild:{conclusion:'둘이 다시 정한 약속이 이어지는지 봐.'},repeat_risks:{conclusion:'답장을 기다리며 서로의 기대가 어긋날 수 있어.'}}
  const ai={...relationshipProvider,data:{headline:'연락이 이어지는 동안 볼 변화',core_summary:'대화는 이어졌고 다음 약속을 기다리는 때야.',core_reason:'같은 대화라도 다음 만남을 정하는지는 별개야.',core_action:'둘 다 가능한 날을 하나 골라봐.',reunion_synthesis_v2:sections}}
  const [story,evidence]=renderReunion({ai}).split('계산 근거와 점수 보기')
  assert.ok(evidence?.includes('연락·대화: 42'))
  for(const value of [ai.data.headline,ai.data.core_summary,ai.data.core_reason,ai.data.core_action,...Object.values(sections).map(s=>s.conclusion)]) assert.ok(story.includes(value),value)
  assert.match(story,/연락 방향 참고값/)

})

test('rich reunion prose has a new cache contract and explicit depth instruction',()=>{
  const serverVersion=edge.match(/const REUNION_VERSION="([^"]+)"/)?.[1]
  assert.match(serverVersion,/^relationship-v\d+\.\d+-[a-z-]+$/)
  assert.equal(cache.match(/const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = '([^']+)'/)?.[1],serverVersion)
  assert.match(edge,/reunion_observation\.state가 messaging이면 연락 발생은 이미 끝난 질문이다/)
  assert.match(edge,/why_reconnect는.*관계 패턴.*현실 연락에서 어떤 장면/)
  assert.match(edge,/본문은 사람말이 먼저다.*기술 근거로 밀어라/)

})


test('display bands separate nearby scores without changing ranking thresholds',()=>{
  assert.match(fortune,/FLOW_BAND_V26/)
  assert.match(fortune,/score >= 52.*다소 강함/)
  assert.match(fortune,/score >= 38.*다소 약함/)
  assert.match(fortune,/WEEKLY_ARC_HUMAN_V28/)
  assert.doesNotMatch(fortune,/beat\.label\}에는 .*두드러져/)
})

test('reunion dates are framed as candidate windows and QA labels stay minimal',()=>{
  const window=(stage,day,start=day)=>({stage,date:day,start,end:day,final:65})
  const candidateHierarchy={...hierarchy,top_periods:[
    ...['13','14','15'].map(d=>window('emotional_reactivation','2026-09-'+d)),
    window('in_person_meeting','2026-09-16','2026-09-10'),
    window('in_person_meeting','2026-09-17'),
    window('in_person_meeting','2026-09-18'),
    window('in_person_meeting','2026-09-19'),
  ]}
  const html=renderReunion({hierarchy:candidateHierarchy})
  const timeline=html.split('다음 단계의 계산상 참고 시기')[1]?.split('</section>')[0]
  assert.match(timeline,/만남을 살펴볼 시기/)
  assert.match(timeline,/2026-09-12~2026-09-16/)
  assert.match(timeline,/2026-09-17/)
  assert.match(timeline,/2026-09-18/)
  assert.doesNotMatch(timeline,/2026-09-10|2026-09-19|다시 의식하는 배경|핵심 날짜/)
  assert.doesNotMatch(renderReunion({hierarchy:candidateHierarchy,observation:{state:'reunited',events:[]}}),/다음 단계의 계산상 참고 시기/)

})

test('daily and weekly hero copy never leaks internal shorthand or checklist nouns',()=>{
  assert.doesNotMatch(fortune,/DAILY_SYMBOL_FOCUS/)
  assert.doesNotMatch(fortune,/말·정리 자극|목표·주도권 자극|책임·제약 자극/)
  assert.match(fortune,/누가 무엇을 언제까지 맡을지 분명히 하는 것/)
  assert.doesNotMatch(fortune,/요청·담당자·마감을 구체화하는 쪽/)
})

test('hierarchy numeric support uses stage-gated candidates rather than generic direction scores',()=>{
  const html=renderReunion({observation:{state:'disconnected',events:[]}})
  assert.match(html,/data-stage-state="blocked"[^>]*><span>실제 만남/)
  assert.match(html,/data-stage-state="no_candidate"[^>]*><span>연락이 닿음/)
  assert.match(html,/수신 · 상대 → 나<\/b><strong>약함 · 30점/)
  assert.match(html,/발신 · 나 → 상대<\/b><strong>강함 · 70점/)
  assert.match(html,/점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요/)

})

test('reunion prose contract is score-aware and validates every major human section',()=>{
  const payload={reunion_evidence_v2:{evidence:[{id:'example'}]}}
  const section={conclusion:'가'.repeat(12),interpretation:'나'.repeat(24)}
  const full={why_reconnect:section,initiative:section,timing:section,rebuild:section,repeat_risks:section}
  const rejection=sections=>validateReunionGroundingV2({reunion_synthesis_v2:sections},payload).reason
  assert.equal(rejection(full),'missing_direct_consultation')
  for(const key of ['why_reconnect','initiative']) {
    for(const part of ['conclusion','interpretation']) assert.equal(rejection({...full,[key]:{...section,[part]:section[part].slice(1)}}),'missing_core_section_text')
  }
  for(const key of ['timing','rebuild','repeat_risks']) assert.equal(rejection({...full,[key]:{...section,conclusion:section.conclusion.slice(1)}}),'missing_core_conclusion')
  assert.match(edge,/후보가 없으면 없다고 말한다/)
  assert.match(edge,/계산 stage gate를 바꾸거나 건너뛰지 않는다/)
})
