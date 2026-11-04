import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyReadingDocument } from './dailyReadingDocument.ts'
import { fortuneGroup, fortuneField } from './fortuneFields.ts'
import { dailyReadingExportModel } from './readingImageExport.ts'
const section = name=>({conclusion:`${name} 고유 결론.`,real_scene:`${name} 생활 장면.`,action:`${name} 실행할 행동.`,change_condition:`${name} 상황이 바뀌면 마지막 조건까지 확인해.`,evidence_refs:['W:test'],applicability:'conditional'})
const data = ()=>({headline:'전체 고유 결론.',overall:{summary:'전체 고유 요약.',dominant_pattern:'서로 다른 생활 영역을 연결한 이유.',evidence_refs:['W:test']},clusters:{relationship:{love_general:section('애정'),summary:section('대인')},work_study:{work:section('직장'),study:section('학업')},money_news:{money:section('금전')},condition:{condition:section('컨디션')}},decisions:[{action:'종합 실행.',watch:'현실 조건이 달라지면 다시 봐.',avoid:'피할 행동.',evidence_refs:['W:test']}],limits:'현재 관계나 직업을 가정하지 않아.'})

test('actual Korean tab labels resolve to canonical IDs and distinct authored documents',()=>{
  const headings=[]
  for(const label of ['전체','애정','대인','학업','직업','금전','컨디션']){
    const field=fortuneGroup(label),doc=buildDailyReadingDocument(data(),'2026-11-04',field,true)
    assert.equal(doc.state,'ready');headings.push(doc.headline)
    assert.equal(doc.scope,({전체:'overall',애정:'love',대인:'social',학업:'study',직업:'work',금전:'money',컨디션:'condition'})[label])
  }
  assert.equal(new Set(headings).size,7)
})
test('missing, insufficient and unverified prose never gets overall fallback or export',()=>{
  for(const change of [d=>delete d.clusters.relationship.love_general,d=>d.clusters.relationship.love_general.applicability='insufficient',d=>d.clusters.relationship.love_general.evidence_refs=[]]){
    const d=data();change(d)
    const doc=buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true)
    assert.equal(doc.state,'missing');assert.equal(doc.headline,'');assert.throws(()=>dailyReadingExportModel(doc))
  }
  assert.equal(buildDailyReadingDocument(data(),'2026-11-04',undefined,false).state,'unverified')
})
test('summary, actions, conditions and limits survive unchanged into export',()=>{
  const d=data();d.clusters.relationship.love_general.real_scene='첫 문장. 둘째 문장. 셋째 문장에도 반드시 남겨야 할 조건이 있어.'
  const doc=buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true)
  const cards=dailyReadingExportModel(doc).sections.flatMap(s=>s.cards)
  assert.deepEqual(cards.map(c=>c.body),[doc.headline,...doc.blocks.map(b=>b.text)])
  assert.equal(cards[1].body,d.clusters.relationship.love_general.real_scene)
  assert.ok(cards.every(c=>c.complete))
})
test('a missing primary topic cannot promote a secondary field or deterministic topic copy',()=>{
  const d=data();delete d.clusters.work_study.work;d.clusters.work_study.career_change=section('이직');d.topic_analysis={직장:{verdict:'서버 고정 조언'}}
  assert.equal(buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('직업'),true).state,'missing')
  assert.equal(buildDailyReadingDocument(d,'2026-11-04',fortuneField('job-change'),true).headline,'이직 고유 결론.')
})
test('delivery state distinguishes authored insufficient from omitted or invalid source',()=>{
  const d=data();d.clusters.relationship.love_general.applicability='insufficient'
  for(const [delivery,state] of [['authored','insufficient'],['omitted','missing'],['invalid','missing']]){
    d.editorial_delivery={'relationship.love_general':delivery}
    assert.equal(buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true).state,state)
  }
})
test('entry scope stays narrow, contexts and timing stay attached, malformed peer cannot crash',()=>{
  const d=data();d.clusters.work_study.career_change=section('이직');d.clusters.relationship.love_single=section('솔로');d.clusters.condition.condition=undefined
  d.decisions[0].timing='오후 13:30 이후에만 적용해.'
  assert.equal(buildDailyReadingDocument(d,'2026-11-04',fortuneField('work'),true).details.length,0)
  assert.ok(buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('직업'),true).details.some(b=>b.label==='이직'))
  assert.ok(buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true).details.some(b=>b.label==='솔로 · 새 인연'))
  assert.ok(dailyReadingExportModel(buildDailyReadingDocument(d,'2026-11-04',undefined,true)).sections[0].cards.some(c=>c.body===d.decisions[0].timing))
})
test('old overly long or repeated copy requires refresh instead of hidden client cuts',()=>{
  const d=data();d.overall.summary='가'.repeat(361)
  assert.equal(buildDailyReadingDocument(d,'2026-11-04',undefined,true).state,'needs_refresh')
  d.clusters.relationship.love_general.conclusion=d.clusters.money_news.money.conclusion
  assert.equal(buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true).state,'needs_refresh')
  const long=data();long.clusters.relationship.love_general.real_scene='가'.repeat(501)
  assert.equal(buildDailyReadingDocument(long,'2026-11-04',fortuneGroup('애정'),true).state,'needs_refresh')
})
