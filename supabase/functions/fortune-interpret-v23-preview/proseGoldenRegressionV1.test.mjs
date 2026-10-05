import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { EDITORIAL_SECTION_KEYS, normalizeProviderCore } from './providerSchemaV23.ts'
import { mergeAuthoredTopicAnalysis } from './editorialPolishV23.ts'
import { inspectInterpretationQuality, repairInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts'

const qualitySource=fs.readFileSync(new URL('../fortune-interpret-v6-preview/qualityV2.ts',import.meta.url),'utf8')
const stabilizerSource=fs.readFileSync(new URL('../fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')
const indexSource=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8')
const editorialSource=fs.readFileSync(new URL('../../../web/src/lib/fortuneEditorialV3.ts',import.meta.url),'utf8')
const narrativeSource=fs.readFileSync(new URL('../../../web/src/PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
const panelSource=fs.readFileSync(new URL('../../../web/src/PeriodAiInterpretationPanel.tsx',import.meta.url),'utf8')

function providerSection(key,index=0){
  return {
    key,
    conclusion:`${key} 결론 ${index}은 현실 장면과 직접 연결해 읽는다.`,
    real_scene:`${key} 현실 장면 ${index}에서 실제 반응을 구분한다.`,
    action:`${key} 행동 ${index}은 확인 가능한 한 가지로 좁힌다.`,
    change_condition:`${key} 조건 ${index}이 달라지면 판단을 갱신한다.`,
    evidence_refs:[`W:test:${index}`],
    applicability:'direct',
  }
}

function providerRows(){return EDITORIAL_SECTION_KEYS.map((key,index)=>providerSection(key,index))}

// Golden 01 — one missing provider key must not erase the other authored sections.
test('golden 01: missing provider key is isolated, not promoted to whole-cluster failure',()=>{
  const rows=providerRows().slice(1)
  const normalized=normalizeProviderCore({headline:'보존',clusters:rows})
  assert.equal(normalized.clusters.relationship.summary.applicability,'insufficient')
  assert.equal(normalized.clusters.relationship.friends.conclusion,providerRows()[1].conclusion)
  assert.equal(normalized.clusters.condition.condition.conclusion,providerRows()[24].conclusion)
})

// Golden 02 — one duplicate key must invalidate only that key.
test('golden 02: duplicate provider key invalidates only the duplicated section',()=>{
  const rows=providerRows()
  const normalized=normalizeProviderCore({clusters:[...rows,providerSection(EDITORIAL_SECTION_KEYS[0],99)]})
  assert.equal(normalized.clusters.relationship.summary.applicability,'insufficient')
  assert.equal(normalized.clusters.relationship.friends.conclusion,rows[1].conclusion)
  assert.equal(normalized.clusters.work_study.work.conclusion,rows[15].conclusion)
})

// Golden 03 — malformed/unknown rows cannot poison valid neighbors.
test('golden 03: malformed known row and unknown row stay locally contained',()=>{
  const rows=providerRows()
  rows[20]={...rows[20],applicability:'broken'}
  rows.push(providerSection('unknown.extra',99))
  const normalized=normalizeProviderCore({clusters:rows})
  assert.equal(normalized.clusters.money_news.news.applicability,'insufficient')
  assert.equal(normalized.clusters.money_news.money.conclusion,rows[19].conclusion)
  assert.equal(normalized.clusters.investment.psychology.conclusion,rows[21].conclusion)
})

function authoredWorkSection(){
  return {
    conclusion:'업무 요청이 겹쳐도 우선순위를 한 번에 하나로 줄이는 편이 낫다.',
    real_scene:'마감이 겹치는 순간 담당자와 완료 기준을 다시 맞추는 장면이 생길 수 있다.',
    action:'새 일을 받기 전에 기존 작업의 완료 기준부터 합의해.',
    change_condition:'담당자나 마감이 확정되면 그 조건에 맞춰 우선순위를 다시 정해.',
    evidence_refs:['W:work'],
    applicability:'direct',
  }
}
function deterministicWork(){
  return [{topic:'직장',verdict:'서버 기본 결론',reason:'서버 기본 이유',action:'서버 기본 행동',avoid:'서버 기본 조건',importance:'핵심',confidence:'보통',confidence_reason:'기본',evidence_refs:['W:base']}]
}
function authoredPayload(){
  return {evidence_ledger:[
    {id:'W:work',system:'western',topic:'직장',date:'2026-10-06',direction:'supportive',text:'직장 직접 근거'},
    {id:'W:base',system:'western',topic:'직장',date:'2026-10-06',direction:'supportive',text:'직장 기본 근거'},
  ]}
}

// Golden 04 — grounded Gemini prose owns reader-facing topic prose.
test('golden 04: grounded authored topic prose wins over deterministic prose',()=>{
  const section=authoredWorkSection()
  const merged=mergeAuthoredTopicAnalysis({clusters:{work_study:{work:section}}},deterministicWork(),authoredPayload())
  assert.equal(merged['직장'].verdict,section.conclusion)
  assert.equal(merged['직장'].reason,section.real_scene)
  assert.equal(merged['직장'].action,section.action)
  assert.equal(merged['직장'].avoid,section.change_condition)
  assert.ok(merged['직장'].evidence_refs.includes('W:work'))
})

// Golden 05 — authorship never bypasses grounding.
test('golden 05: ungrounded authored topic cannot replace deterministic fallback',()=>{
  const merged=mergeAuthoredTopicAnalysis({clusters:{work_study:{work:authoredWorkSection()}}},deterministicWork(),{evidence_ledger:[]})
  assert.equal(merged['직장'].verdict,'서버 기본 결론')
  assert.equal(merged['직장'].action,'서버 기본 행동')
})

// Golden 06 — validator is observational only.
test('golden 06: quality inspection is pure and cannot rewrite candidate prose',()=>{
  const data={
    headline:'짧지만 구체적인 제목',
    overall:{summary:'짧지만 구체적인 총평',evidence_refs:[]},
    key_windows:[],cross_checks:[],decisions:[],topic_analysis:{},clusters:{},
  }
  const before=structuredClone(data)
  inspectInterpretationQuality(data,{period_kind:'day',period:{start:'2026-10-06',end:'2026-10-06'},evidence_ledger:[]})
  assert.deepEqual(data,before)
})

// Golden 07 — targeted repair may remove unsupported timing, but unrelated prose survives byte-for-byte.
test('golden 07: targeted timing repair touches only unsupported timing-linked fields',()=>{
  const data={
    headline:'이 제목은 repair와 무관하므로 그대로 남아야 한다.',
    overall:{summary:'이 총평도 timing repair와 무관하므로 그대로 남아야 한다.'},
    key_windows:[
      {label:'지원됨',start:'2026-10-06',end:'2026-10-06',evidence_refs:['W:date:2026-10-06:직장']},
      {label:'지원안됨',start:'2026-10-07',end:'2026-10-07',evidence_refs:['W:date:2026-10-06:직장']},
    ],
    decisions:[],
    relationship_reading:{focus_timing:'',evidence_refs:[]},
  }
  const repair=repairInterpretationQuality(data,{
    __v23_evidence_timing_repair:true,
    period:{start:'2026-10-06',end:'2026-10-07'},
    evidence_ledger:[{id:'W:date:2026-10-06:직장',date:'2026-10-06',topic:'직장'}],
  })
  assert.equal(repair.changed,true)
  assert.deepEqual(data.key_windows.map(row=>row.label),['지원됨'])
  assert.equal(data.headline,'이 제목은 repair와 무관하므로 그대로 남아야 한다.')
  assert.equal(data.overall.summary,'이 총평도 timing repair와 무관하므로 그대로 남아야 한다.')
})

// Golden 08 — no arbitrary character-count padding pressure may return to Stage 5.
test('golden 08: Quality Stage 5 has no arbitrary minimum-character prose gates',()=>{
  assert.doesNotMatch(qualitySource,/총평 깊이 부족|너무 짧음|근거 설명이 얕음|관계·재회 .*설명 부족|투자 상세 설명 부족/)
  assert.match(qualitySource,/총평 누락/)
  assert.match(qualitySource,/지나치게 김/)
  assert.match(qualitySource,/상담 유용성·의미 비중복/)
})

// Golden 09 — stabilizer can fill a missing field but cannot length-pad an existing authored field.
test('golden 09: stabilizer uses missing-field fallback instead of minimum-length padding',()=>{
  assert.doesNotMatch(stabilizerSource,/out\.summary=ensureMinText\(/)
  assert.doesNotMatch(stabilizerSource,/data\.overall\.summary=ensureMinText\(/)
  assert.doesNotMatch(stabilizerSource,/out\.action=ensureMinText\(out\?\.action/)
  assert.match(stabilizerSource,/out\.summary=String\(out\?\.summary\?\?""\)\.trim\(\)\|\|/)
  assert.match(stabilizerSource,/data\.overall\.summary=String\(data\.overall\.summary\?\?""\)\.trim\(\)\|\|/)
})

// Golden 10 — technical evidence may be filtered from explanation layers, not by deleting the whole authored topic block.
test('golden 10: frontend topic selection does not discard a whole block for one technical term',()=>{
  const start=editorialSource.indexOf('function readerFacing')
  const end=editorialSource.indexOf('function relationshipPartUsable')
  const readerFacing=editorialSource.slice(start,end)
  assert.ok(start>=0&&end>start)
  assert.doesNotMatch(readerFacing,/TECHNICAL_RE\.test/)
  assert.match(editorialSource,/const value = clean\(topicSectionCopy\(section\)\)/)
})

// Golden 11 — concise 2–3 sentence authored copy remains renderable.
test('golden 11: frontend focus card accepts concise authored prose instead of requiring four sentences',()=>{
  assert.match(narrativeSource,/if \(sentences\.length < 2\) return null/)
  assert.doesNotMatch(narrativeSource,/if \(sentences\.length < 4\) return null/)
  assert.match(narrativeSource,/sceneAction: sentences\.length >= 3/)
})

// Golden 12 — pipeline ordering keeps authored prose first, targeted repair explicit, and verified model hero visible.
test('golden 12: backend and frontend ownership order cannot silently regress',()=>{
  const mergePos=indexSource.indexOf('mergeAuthoredTopicAnalysis(core,buildDeterministicTopicAnalysis(payload),payload)')
  const stabilizePos=indexSource.indexOf('stabilizeCoreForQuality(withTopics,payload)')
  const repairPos=indexSource.indexOf('repairInterpretationQuality(data,payload)')
  const validatePos=indexSource.indexOf('inspectInterpretationQuality(data,payload)')
  assert.ok(mergePos>=0&&stabilizePos>mergePos)
  assert.ok(repairPos>=0&&validatePos>repairPos)
  assert.match(panelSource,/const semanticHero = !westernOnly && \(period === 'today' \|\| period === 'week'\) && !verifiedHero/)
  assert.match(panelSource,/verifiedHero \? visibleAiText\(data\.headline\)/)
  assert.match(panelSource,/verifiedHero[\s\S]*visibleAiText\(data\.overall\.summary\)/)
})
