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

test('an optional empty exception keeps the grounded daily reading and export ready',()=>{
 const d=data();d.clusters.relationship.love_general.change_condition=''
 const doc=buildDailyReadingDocument(d,'2026-11-04',fortuneGroup('애정'),true)
 assert.equal(doc.state,'ready')
 assert.ok(!doc.blocks.some(b=>b.id.endsWith(':condition')))
 assert.deepEqual(dailyReadingExportModel(doc).sections.flatMap(s=>s.cards).map(c=>c.body),[doc.headline,...doc.blocks.map(b=>b.text)])
})

test('overall financial caveats do not leak to field readings and date-only timing is not repeated',()=>{
 const d=data();d.limits='실제 재정 잔고나 시장 가격 변동을 예측하지 않아.';d.decisions[0].timing='2026-11-04'
 const overall=buildDailyReadingDocument(d,'2026-11-04',undefined,true)
 assert.ok(overall.blocks.some(b=>b.text===d.limits))
 assert.ok(!overall.blocks.some(b=>b.id==='overall:timing'))
 for(const label of ['애정','대인','학업','직업','금전','컨디션']){
   const doc=buildDailyReadingDocument(d,'2026-11-04',fortuneGroup(label),true)
   assert.ok(!doc.blocks.some(b=>b.text===d.limits))
   assert.ok(dailyReadingExportModel(doc).fitContentHeight)
 }
})

test('an archived overview leads with one conclusion and one action while retaining qualifications',()=>{
 const d=data()
 d.overall.summary=d.headline
 d.decisions[0].avoid=d.decisions[0].action
 d.decisions[0].reason='별도 이유를 보존해.'
 const doc=buildDailyReadingDocument(d,'2026-11-04',undefined,true)
 assert.equal(doc.state,'ready')
 assert.equal(doc.blocks[0].id,'overall:action')
 assert.ok(doc.blocks.some(b=>b.text===d.decisions[0].watch))
 assert.ok(doc.blocks.some(b=>b.text===d.limits))
 assert.ok(doc.details.some(b=>b.text===d.decisions[0].reason))
 const texts=[doc.headline,...doc.blocks.map(b=>b.text),...doc.details.map(b=>b.text)]
 assert.equal(texts.filter(t=>t===d.headline).length,1)
 assert.equal(texts.filter(t=>t===d.decisions[0].action).length,1)
})

test('a duplicated headline never produces an empty export',()=>{
 const d=data()
 d.overall.summary=d.headline
 d.decisions=[];d.limits=''
 const doc=buildDailyReadingDocument(d,'2026-11-04',undefined,true)
 assert.equal(doc.blocks[0].id,'overall:reason')
 assert.doesNotThrow(()=>dailyReadingExportModel(doc))
 d.overall.dominant_pattern=''
 const headlineOnly=buildDailyReadingDocument(d,'2026-11-04',undefined,true)
 assert.equal(headlineOnly.state,'ready')
 assert.deepEqual(dailyReadingExportModel(headlineOnly).sections[0].cards.map(card=>card.body),[d.headline])
})

test('the overall core image keeps the action and its timing with the full cautions in the document',()=>{
 const d=data()
 d.decisions[0].timing='상대가 시간을 정했을 때'
 const doc=buildDailyReadingDocument(d,'2026-11-04',undefined,true)
 const cards=dailyReadingExportModel(doc).sections[0].cards
 assert.deepEqual(cards.map(card=>card.body),[d.headline,d.decisions[0].action,d.decisions[0].timing])
 for(const text of [d.decisions[0].watch,d.decisions[0].avoid,d.limits]) assert.ok(doc.blocks.some(block=>block.text===text))
})

test('confirmed archive wording is clarified without changing manuscripts with extra qualifications',()=>{
 const d=data()
 d.headline='의견 교환은 활발하지만 책임과 마감 같은 세부 약속을 확정하기는 까다로운 날이야.'
 d.decisions[0].action='합의한 조건과 역할의 범위를 서면으로 명확히 기록해 둬.'
 const overall=()=>buildDailyReadingDocument(d,'2026-11-12',undefined,true)
 assert.equal(overall().headline,'의견은 잘 오가도 누가 언제까지 맡을지는 서로 다르게 이해할 수 있어.')
 assert.equal(overall().blocks[0].text,'약속한 조건과 각자 맡은 일을 한 줄로 적어 봐.')
 d.headline+=' 단, 이미 정한 약속은 그대로 이어가.'
 d.decisions[0].action+=' 상대가 답하면 다시 확인해.'
 assert.equal(overall().headline,d.headline)
 assert.equal(overall().blocks[0].text,d.decisions[0].action)
})
