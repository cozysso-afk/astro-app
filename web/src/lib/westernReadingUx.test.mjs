import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildPeriodReadingDocument } from './authoredReadingDocument.ts'
import { fortuneField } from './fortuneFields.ts'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const periodPanel = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const signals = readFileSync(new URL('../ReadingSignals.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../system-reading-ux-v40.css', import.meta.url), 'utf8')
const polish = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')
const finalFont = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('western independent view starts with an actual period takeaway', () => {
  assert.match(view, /const westernReaderHeadline = topic==='애정' && loveScores.length/)
  assert.match(view, /westernHeadline\(selectedWestern,westernPeriod,c\)/)
  assert.match(view, /className="system-hero western-reader-hero"/)
  assert.match(view, /<span>서양점성술 · \{westernPeriod\}<\/span><h3>\{westernReaderHeadline\}<\/h3>/)
  assert.doesNotMatch(view, /분야의 강약과 날짜를 나눠 읽어봐/)
  assert.doesNotMatch(view, /<span>서양점성술 · \{period\}<\/span>/)
})

test('western reader copy names the score difference and gives a concrete next action', () => {
  assert.doesNotMatch(view, /상대적으로 더 살아 있어|힘이 덜 실리|무난해|이어가기 괜찮아|상대적으로 강하고|약한 편이야/)
  assert.match(view, /westernRankCopy\(rows, when\)/)
  assert.doesNotMatch(view, /점수가 가장 높고|흐름이 점수가/)
  assert.match(view, /공부할 분량을 정하고/)
  assert.match(view, /직무·보상·시작 일정/)
})

test('western score cards expose plain guidance before date detail', () => {
  assert.match(view, /className="system-score-grid western-score-grid"/)
  assert.match(view, /className="western-score-guidance">\{westernGuidance\(name,s,c\)\}/)
  assert.match(view, /western-score-more.*계산일 보기.*날짜 보기/)
  assert.match(view, /westernLoveHeadline\(loveScores\)/)
  assert.doesNotMatch(view, /특히 연락·재회·투자 관련 값은/)
})

test('western date detail passes the selected range and original statistic', () => {
  assert.match(view, /westernPeriodFact\(s,c\.period\.start,c\.period\.end\)/)
})

function periodFixture(){
  const section={conclusion:'직업의 고유 판단',real_scene:'직업의 적용 장면 원문',action:'맡은 일의 범위를 확인해.',change_condition:'동의한 범위가 달라지면 다시 판단해.',evidence_refs:['W:work'],applicability:'conditional'}
  return {headline:'기간 전체 판단',overall:{summary:'기간 전체 요약 원문',dominant_pattern:'기간의 이유 원문',evidence_refs:['W:work']},clusters:{work_study:{work:section}},
    decisions:[{action:'기간 행동 원문',reason:'기간 이유 원문',timing:'조건이 확인된 뒤',watch:'조건이 바뀌면 다시 판단해.',avoid:'확인 전에는 확정하지 마.',evidence_refs:['W:work']}],
    limits:'기간 해석의 제한 원문',
    key_windows:[{start:'2026-11-05',end:'2026-11-05',topics:['직장'],summary:'직업 시기의 원문',action:'직업 시기의 행동 원문',avoid:'직업 시기의 조건 원문',evidence_refs:['W:work']},{start:'2026-11-08',end:'2026-11-08',topics:['금전'],summary:'금전 시기의 원문',action:'금전 시기의 행동 원문',avoid:'금전 시기의 조건 원문',evidence_refs:['W:money']}],
    year_phases:[{label:'근거 있는 구간',start:'2026-11-01',end:'2026-11-30',theme:'구간 흐름 원문',change:'구간 차이 원문',evidence_refs:['W:period']}],
    priorities:['기간 우선순위 원문'],cross_checks:[{label:'독립 체계 비교',start:'2026-11-05',end:'2026-11-05',western:'서양 원문',saju:'사주 원문',thai:'태국 원문',synthesis:'통합의 제한을 설명한 원문',evidence_refs:['W:work','S:period']}],
  }
}
const documentTexts=doc=>[doc.headline,...doc.core.map(b=>b.text),...doc.sections.flatMap(s=>s.blocks.map(b=>b.text))]

test('important windows retain authored actions and conditions and obey the selected topic', () => {
  const data=periodFixture(),before=structuredClone(data)
  const overview=buildPeriodReadingDocument(data,'month','2026-11-01','2026-11-30',undefined,true)
  for(const window of data.key_windows)for(const key of ['summary','action','avoid'])assert.ok(documentTexts(overview).includes(window[key]))
  assert.equal(overview.sections.find(s=>s.id==='window:0').label,'2026-11-05')
  const work=buildPeriodReadingDocument(data,'month','2026-11-01','2026-11-30',fortuneField('work'),true)
  assert.ok(documentTexts(work).includes(data.key_windows[0].action))
  assert.ok(!documentTexts(work).includes(data.key_windows[1].action))
  assert.deepEqual(data,before)
})

test('month and year preserve period decisions, conditions and phases without substituting them for field prose', () => {
  const data=periodFixture()
  for(const period of ['month','year']){
    const doc=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',undefined,true)
    assert.equal(doc.state,'ready')
    for(const key of ['action','reason','timing','watch','avoid'])assert.ok(doc.core.some(b=>b.text===data.decisions[0][key]))
    assert.ok(doc.core.some(b=>b.text===data.limits))
    for(const key of ['theme','change'])assert.ok(doc.sections.find(s=>s.id==='phase:0').blocks.some(b=>b.text===data.year_phases[0][key]))
    const work=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',fortuneField('work'),true)
    assert.equal(work.headline,data.clusters.work_study.work.conclusion)
    for(const text of [data.overall.summary,data.decisions[0].action,data.year_phases[0].theme])assert.ok(!documentTexts(work).includes(text))
    const unverified=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',undefined,false)
    assert.equal(unverified.state,'unverified');assert.deepEqual(unverified.core,[]);assert.deepEqual(unverified.sections,[])
  }
})

test('period priorities and each independent cross-check explanation survive without leaking into topic tabs', () => {
  const data=periodFixture()
  const overview=buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',undefined,true)
  assert.ok(documentTexts(overview).includes(data.priorities[0]))
  for(const key of ['western','saju','thai','synthesis'])assert.ok(overview.sections.find(s=>s.id==='cross:0').blocks.some(b=>b.text===data.cross_checks[0][key]))
  const field=buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',fortuneField('work'),true)
  assert.equal(field.sections.some(s=>s.id.startsWith('priority:')||s.id.startsWith('cross:')),false)
})

test('thai summary connects the active area to an actual placement and follows the selected topic', () => {
  assert.match(view, /thaiPlacementComparison\(firstPlacement,view\.natalWheel,isNatalWheel\)/)
  assert.match(view, /topic==='애정' \? thaiLoveSummary : thaiLifeSummary/)
  assert.match(view, /thaiGuide\(w\.wheel\.filter\(r=>THAI_LIFE_KEYS\[topic\]\.includes\(r\.bhumi_key\)\)/)
  assert.match(view, /<p>\{thaiEvidence\}<\/p>/)
})

test('calculation details translate engine contracts into reader-facing Korean', () => {
  assert.match(view, /현재 입력된 출생시간 정보로는/)
  assert.doesNotMatch(view, /출생시간 검증 정책|탭 전환으로 정밀도 제한/)
  assert.match(view, /연간 계산 순환이 중앙 단계에 도달해, 이 전통 방식에서 정한 목성 기준을 사용해/)
  assert.doesNotMatch(view, /엔진의 목성 대체 규칙/)
  assert.match(view, /전통 천문 위치 자료 · 상승점 참고/)
  assert.match(view, /상승점 위치 · \{view\.suriyayat\.lagna\.display\}/)
  assert.match(view, /생활 영역 연결 참고/)
  assert.doesNotMatch(view, /Suriyayat · 위치와 검증된 라그나|숫자 Lagna|검증된 비예측형 하우스 연결/)
  assert.match(view, /<b>사용하는 계산<\/b>/)
  assert.match(view, /<b>해석 범위<\/b>/)
  assert.match(view, /<b>다른 체계와의 관계<\/b>/)
  assert.match(view, /이번 해설에서 다루지 않는 계산/)
  assert.doesNotMatch(view, /<p>\{view\.thai\?\.predictive_status\}<\/p>|<p>\{view\.thai\?\.consensus_policy\}<\/p>/)
  assert.doesNotMatch(view, /<pre>\{JSON\.stringify\(view\.suriyayat\.ai_safe_descriptive_packet/)
  assert.match(view, /이번 해설에서 다루지 않는 항목 · \{view\.saju\?\.not_calculated\?\.join/)
})

test('integrated synthesis shows each system takeaway instead of methodology prose', () => {
  assert.match(view, /className="system-synthesis"><summary>세 체계에서 지금 확인할 것<\/summary>/)
  assert.match(view, /<b>서양점성술<\/b> · \{westernOverviewSummary\}/)
  assert.match(view, /<b>사주<\/b> · \{sajuOverviewSummary\}/)
  assert.match(view, /<b>태국점성술<\/b> · \{thaiReaderSummary\}/)
  assert.match(view, /세 체계의 수치나 기준은 합산하지 않고 각각의 계산 근거로 확인해/)
  assert.doesNotMatch(view, /서양점성술의 분야 강약과 사주의 운 구간|선택한 분야에서 실제로 겹치는 맥락이 있는지 비교해/)
})

test('western independent view never shows the integrated period panel again', () => {
  assert.match(polish, /system-reading\.system-western > \.period-ai-card,/)
  assert.match(polish, /system-reading\.system-western > \.fortune-experience,/)
  assert.match(polish, /system-reading\.system-western > \.period-deep-reading\s*\{[\s\S]*?display:\s*none\s*!important/)
})

test('mobile integrated reading uses the same Myeongjo family for headline and summary', () => {
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-weight:\s*700\s*!important/)
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-synthesis:\s*none\s*!important/)
  assert.match(finalFont, /period-today[\s\S]*?period-ai-head \.reading-hero-subtitle[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(finalFont, /period-today[\s\S]*?period-ai-head \.reading-hero-subtitle[\s\S]*?font-weight:\s*500\s*!important/)
})

test('top-level life topics use a fixed two-row mobile grid instead of horizontal clipping', () => {
  assert.match(view, /system-topic-selector system-topic-selector-fixed/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow:\s*visible\s*!important/)
  assert.doesNotMatch(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow-x:\s*auto/)
})

test('scoped system UX loads before the shared reading owner, which stays below system UX', () => {
  const western = main.indexOf("import './system-reading-ux-v40.css'")
  const owner = main.indexOf("import './reading-experience.css'")
  assert.ok(western >= 0 && owner > western)
})
