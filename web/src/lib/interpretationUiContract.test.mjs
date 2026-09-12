import './systemReading.test.mjs'
import './compactDeepPrompt.test.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildFortuneUserSummary } from './fortuneUserSummary.ts'
import { normalizeTopicEntries } from './interpretationTopics.ts'

const annual = readFileSync(new URL('../AiInterpretationPanel.tsx', import.meta.url), 'utf8')
const period = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')
const topicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션','투자심리','수익실현','신규진입','투자주의']

function sectionFrom(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing UI marker: ${marker}`)
  const end = source.indexOf('</section>', start)
  assert.notEqual(end, -1, `missing section end after: ${marker}`)
  return source.slice(start, end + '</section>'.length)
}

function assertQuickDatesStayCompact(source, marker) {
  const quick = sectionFrom(source, marker)
  assert.doesNotMatch(quick, /item\.(?:summary|action|avoid|reason)/, 'TOP 3 must remain date/topic navigation, not repeat detailed prose')
  assert.match(quick, /item\.label/)
  assert.match(quick, /item\.topics/)
  assert.match(quick, /item\.signal/)
}

function stat(score) {
  return {
    average: score,
    band: score < 40 ? '약함' : score >= 60 ? '강함' : '보통',
    spread: 0,
    best_days: [],
    caution_days: [],
  }
}

function topicRow(topic, importance) {
  return {
    importance,
    verdict: `${topic}는 이날 활성도가 37점으로 상대적으로 약한 편이야.`,
    reason: '직접 근거 4개와 근거 연결의 선명도를 함께 사용했어.',
    timing: '2026-09-12',
    action: '실제로 확인되는 행동을 확인해.',
    avoid: '한 방향의 상대활성도가 올라가도 다른 방향의 결과까지 자동으로 뜻하지 않아.',
    confidence: importance === '참고' ? '낮음' : '보통',
    confidence_reason: '기간 통계와 직접 근거를 사용했어.',
    evidence_refs: importance === '참고' ? [] : [`W:daily:2026-09-12:${topic}`],
  }
}

function fixture({
  periodKey = 'today',
  dayCount = 1,
  focus = { 연애: '핵심', 연락: '핵심', 컨디션: '주목' },
  scores = { 연애: 37, 연락: 37, 컨디션: 36 },
  relationshipScores = { 수신신호: 37, 발신적합: 37, 과거인연접점: 37 },
  keyWindows = [],
} = {}) {
  const topicAnalysis = Object.fromEntries(topicOrder.map((topic)=>[topic,topicRow(topic,focus[topic] ?? '참고')]))
  const data = {
    headline: '2026-09-12 연애 · 연락 · 컨디션 흐름을 계산근거 중심으로 확인하는 날이야.',
    overall: {
      summary: '기간 평균은 37.0점이고 변동폭은 0.0점이야.',
      dominant_pattern: '학업 · 연애 · 연락의 상대활성도 변화가 이번 기간의 우선 확인 대상이야.',
      best_phase: '',
      caution_phase: '',
      evidence_refs: [],
    },
    key_windows: keyWindows,
    cross_checks: [],
    decisions: [],
    clusters: { relationship: '기계식 관계 요약', work_study: '', money_news: '', investment: '', condition: '' },
    relationship_reading: {
      context: '세 방향의 직접 근거를 따로 확인해.',
      flow: '한 방향의 상대활성도가 높아도 다른 방향의 결과까지 자동으로 뜻하지 않아.',
      focus_timing: '',
      watch: '실제 연락을 확인해.',
      avoid: '결과를 단정하지 마.',
      evidence_refs: [],
    },
    contact_flow: { incoming: '상대 → 나', outgoing: '나 → 상대', reconnection: '과거 인연 재접점' },
    systems: { western: 'Venus opposition Venus orb 1.42', saju: '충과 합', thai: 'Thai detail' },
    priorities: Object.keys(focus).map((topic)=>`${topic} 우선 확인 대상`),
    topic_analysis: topicAnalysis,
    limits: '기술적 한계',
  }
  const overall = Object.fromEntries(topicOrder.map((topic)=>[topic,stat(scores[topic] ?? 50)]))
  const calculation = {
    period: { start: '2026-09-12', end: dayCount === 1 ? '2026-09-12' : '2026-09-18', day_count: dayCount, month_segments: 1 },
    western: {
      overall,
      relationship_signals: Object.fromEntries(Object.entries(relationshipScores).map(([topic,score])=>[topic,stat(score)])),
      daily_scores: [],
    },
  }
  const topicEntries = normalizeTopicEntries(data.topic_analysis, topicOrder)
  return { data, calculation, summary: buildFortuneUserSummary(data, { period: periodKey, calculation, topicEntries }) }
}

function defaultVisibleText(summary) {
  return [
    summary.headline,
    summary.summary,
    ...summary.bestFlow,
    ...summary.cautionFlow,
    ...summary.importantWindows.flatMap((item)=>[item.date,item.guidance]),
    ...summary.focusTopics.flatMap((item)=>[item.topic,item.conclusion,item.reason,item.timing,item.action,item.observe,item.caution].filter(Boolean)),
    summary.relationship?.summary,
    summary.relationship?.incoming,
    summary.relationship?.outgoing,
    summary.relationship?.reconnection,
  ].filter(Boolean).join('\n')
}

test('annual reading separates TOP 3, action cards, and date detail', () => {
  assertQuickDatesStayCompact(annual, 'className="ai-quick-date-list"')

  const actions = sectionFrom(annual, 'className="ai-decision-section"')
  assert.match(actions, /item\.action/)
  assert.match(actions, /item\.timing/)
  assert.match(actions, /item\.watch/)
  assert.match(actions, /className="ai-decision-more"/)
  const disclosure = actions.indexOf('className="ai-decision-more"')
  assert.ok(actions.indexOf('item.reason') > disclosure, 'decision reason should be preserved inside disclosure')
  assert.ok(actions.indexOf('item.avoid') > disclosure, 'decision avoid should be preserved inside disclosure')

  const windows = sectionFrom(annual, 'className="ai-key-window-section"')
  assert.match(windows, /!hasDecisions&&item\.action/, 'date detail should repeat action only when no decision cards exist')
  assert.match(windows, /item\.summary/)
  assert.match(windows, /item\.avoid/)
})

test('period default view uses the natural view model and keeps raw prose in one technical disclosure', () => {
  const renderStart = period.indexOf('return <section className="period-ai-card period-ai-v18">')
  const technicalStart = period.indexOf('<summary>계산 근거 자세히 보기</summary>', renderStart)
  assert.ok(renderStart >= 0 && technicalStart > renderStart)
  const defaultMarkup = period.slice(renderStart, technicalStart)
  const technicalMarkup = period.slice(technicalStart)

  assert.match(defaultMarkup, /userSummary\.headline/)
  assert.match(defaultMarkup, /userSummary\.favorableCards/)
  assert.match(defaultMarkup, /userSummary\.cautionCards/)
  assert.match(defaultMarkup, /userSummary\.focusTopics/)
  assert.match(defaultMarkup, /userSummary\.importantWindows/)
  assert.doesNotMatch(defaultMarkup, /data\.(?:headline|overall|clusters|systems|priorities)|item\.(?:verdict|confidence)|technicalEvidence/)
  assert.match(defaultMarkup, /ReadingExplanation kind="reason"/)

  assert.equal((period.slice(renderStart).match(/<summary>계산 근거 자세히 보기<\/summary>/g) || []).length, 1)
  assert.match(technicalMarkup, /data\.overall\.summary/)
  assert.match(technicalMarkup, /calculation\.western\.overall/)
  assert.match(technicalMarkup, /technicalEvidence\.map/)
  assert.match(technicalMarkup, /item\.confidence/)
  assert.match(technicalMarkup, /data\.systems/)
  assert.match(technicalMarkup, /data\.limits/)
})

test('relationship focus uses plain labels and only renders useful structured directions', () => {
  const annualKey = annual.indexOf('className="ai-key-window-section"')
  const annualRel = annual.indexOf('className="ai-relationship-section"')
  assert.ok(annualKey >= 0 && annualRel > annualKey, 'annual relationship focus should follow date detail')
  assert.equal((annual.match(/className="ai-relationship-section"/g) || []).length, 1)
  assert.equal((annual.match(/className="ai-direction-grid ai-relationship-direction"/g) || []).length, 1)

  assert.match(period, />연락 흐름</)
  assert.match(period, /kind:'incoming',label:'상대가 먼저 오는 흐름'/)
  assert.match(period, /kind:'outgoing',label:'내가 먼저 연락하기'/)
  assert.match(period, /kind:'reconnection' as const,label:'과거 인연 재접점'/)
  assert.match(period, /userSummary\.relationship\.(?:incoming|outgoing|reconnection)/)
  assert.doesNotMatch(period.slice(period.indexOf('return <section className="period-ai-card period-ai-v18">'), period.lastIndexOf('<summary>계산 근거 자세히 보기</summary>')), /세 방향을 따로 보면|상대 → 나|나 → 상대/)
})

test('primary topics stay concise and reference topics are one-line collapsed items', () => {
  const focusStart = period.indexOf('className="period-ai-window-section period-ai-user-focus"')
  const referenceStart = period.indexOf('className="period-ai-topic-disclosure period-ai-topic-reference-disclosure period-ai-user-reference"')
  const technicalStart = period.lastIndexOf('<summary>계산 근거 자세히 보기</summary>')
  assert.ok(focusStart >= 0 && referenceStart > focusStart && technicalStart > referenceStart)

  const focus = period.slice(focusStart, referenceStart)
  assert.match(focus, /userSummary\.focusTopics\.map/)
  assert.match(focus, /item\.conclusion/)
  assert.match(focus, /item\.observe/)
  assert.match(focus, /item\.caution/)
  assert.match(focus, /item\.reason/)
  assert.match(focus, /item\.timing/)
  assert.match(focus, /item\.action/)
  assert.doesNotMatch(focus, /item\.(?:verdict|avoid|confidence)/)

  const reference = period.slice(referenceStart, technicalStart)
  assert.match(reference, /<summary>다른 분야 보기<\/summary>/)
  assert.match(reference, /userSummary\.referenceTopics\.map/)
  assert.match(reference, /item\.summary/)
  assert.doesNotMatch(reference, /item\.(?:reason|timing|action|avoid|confidence)/)
})

test('period topic normalization supports legacy arrays without exposing numeric indexes', () => {
  const topic = (importance, verdict) => ({importance,verdict,reason:'근거',timing:'',action:'',avoid:'',confidence:'보통',confidence_reason:'근거 연결'})
  const legacy = [
    {topic:'연애',...topic('핵심','연애 해설')},
    {topic:'연락',...topic('핵심','연락 해설')},
  ]
  const legacyEntries = normalizeTopicEntries(legacy,topicOrder)
  assert.deepEqual(legacyEntries.map(([name])=>name),['연애','연락'])
  const headings = legacyEntries.map(([name,item])=>`${name} · ${item.importance}`).join('\n')
  assert.match(headings,/연애 · 핵심/)
  assert.match(headings,/연락 · 핵심/)
  assert.doesNotMatch(headings,/(?:0|1) · 핵심/)

  const current = {연애:topic('핵심','연애 해설'),연락:topic('주목','연락 해설')}
  assert.deepEqual(normalizeTopicEntries(current,topicOrder).map(([name])=>name),['연애','연락'])
  assert.deepEqual(normalizeTopicEntries([null,{}, {topic:'0',...topic('핵심','잘못된 해설')}, {topic:'미등록',...topic('핵심','잘못된 해설')}],topicOrder),[])
})

test('daily QA fixture becomes concise natural Korean without default technical language', () => {
  const { summary } = fixture()
  const visible = defaultVisibleText(summary)
  assert.match(summary.headline, /^오늘은/)
  assert.equal(summary.bestFlow.length, 0)
  assert.equal(summary.cautionItems.length, 2)
  assert.equal(summary.focusTopics.length, 3)
  assert.match(summary.focusTopics.find((item)=>item.topic === '연애').conclusion, /오늘 연애는 서두르지 않는 편이 좋아/)
  assert.match(summary.focusTopics.find((item)=>item.topic === '컨디션').conclusion, /쉽게 지칠 수 있으니 일정을 너무 빡빡하게 잡지 않는 게 좋아/)
  assert.doesNotMatch(visible, /상대활성도|우선 확인 대상|계산근거 중심|경계 압력|근거 연결의 선명도|직접 근거|기간 통계|일별 궤적|evidence ledger/i)
  assert.doesNotMatch(visible, /37(?:\.0)?\s*점|orb|서양점성술|Western|Thai/i)
  assert.doesNotMatch(visible, /(?:[가-힣A-Za-z]+\s*·\s*){2,}[가-힣A-Za-z]+/)
  assert.ok((visible.match(/확인해/g) || []).length <= 1)

  const sentences = [summary.headline,...summary.focusTopics.flatMap((item)=>[item.conclusion,item.observe,item.caution].filter(Boolean))]
  assert.equal(new Set(sentences).size,sentences.length,'default advice should not be duplicated verbatim')
  const love = summary.focusTopics.find((item)=>item.topic === '연애')
  const contact = summary.focusTopics.find((item)=>item.topic === '연락')
  assert.notEqual(love.conclusion.replace('연애',''),contact.conclusion.replace('연락',''))
  assert.notEqual(love.observe,contact.observe)
})

test('weekly QA fixture states a real priority and keeps meaningful dates natural', () => {
  const { summary } = fixture({
    periodKey: 'week',
    dayCount: 7,
    focus: { 학업: '핵심', 연애: '주목', 연락: '주목' },
    scores: { 학업: 68, 연애: 37, 연락: 37 },
    keyWindows: [{ label:'내부 계산 라벨', start:'2026-09-14', end:'2026-09-15', signal:'활용', topics:['학업'], summary:'원문', action:'원문', avoid:'', evidence_refs:['W:x'] }],
  })
  assert.match(summary.headline, /^이번 주는 공부/)
  assert.deepEqual(summary.bestFlow, ['학업'])
  assert.deepEqual(new Set(summary.cautionFlow), new Set(['연애','연락']))
  assert.equal(summary.importantWindows.length,1)
  assert.equal(summary.importantWindows[0].guidance,'공부에 힘을 써보기 좋아.')
  const visible = defaultVisibleText(summary)
  assert.doesNotMatch(visible,/학업\s*·\s*연애\s*·\s*연락|흐름을 확인하는 기간|우선 확인 대상/)
  assert.doesNotMatch(visible,/내부 계산 라벨|원문/)
})

test('directional relationship wording separates my initiative from the other person response', () => {
  const { summary } = fixture({
    focus: { 연락: '핵심', 연애: '주목' },
    scores: { 연락: 65, 연애: 50 },
    relationshipScores: { 수신신호: 32, 발신적합: 70, 과거인연접점: 50 },
  })
  assert.equal(summary.relationship.incomingBand,'약함')
  assert.equal(summary.relationship.outgoingBand,'강함')
  assert.match(summary.relationship.incoming,/먼저 연락이 오길 크게 기대하기보다는/)
  assert.match(summary.relationship.outgoing,/내가 먼저 가볍게 말을 꺼내보기 좋은/)
  assert.equal(summary.relationship.reconnection,undefined)
  assert.doesNotMatch(defaultVisibleText(summary),/한 방향의 상대활성도|세 축 기준/)
})

test('weak reference topics remain available as one line without scores or fake depth', () => {
  const { summary } = fixture()
  assert.equal(summary.focusTopics.length + summary.referenceTopics.length,15)
  assert.equal(summary.referenceTopics.length,12)
  for (const item of summary.referenceTopics) {
    assert.ok(item.summary.length > 0)
    assert.doesNotMatch(item.summary,/\n|37(?:\.0)?\s*점|직접 근거|확신도/)
    assert.equal((item.summary.match(/[.!?]/g) || []).length,1,`${item.topic} should stay one sentence`)
  }
  assert.match(summary.referenceTopics.find((item)=>item.topic === '투자주의').summary,/안전을 보장하진 않아/)
})

test('every topic gets its own conclusion instead of a swapped-name template', () => {
  const conclusions = topicOrder.map((topic) => {
    const { summary } = fixture({ focus: { [topic]: '핵심' }, scores: { [topic]: 37 } })
    const conclusion = summary.focusTopics[0].conclusion
    assert.doesNotMatch(conclusion,/상대활성도|직접 근거|확인 대상|\d+(?:\.\d+)?\s*점/)
    return conclusion.replaceAll(topic,'').replace(/^오늘(?:은)?\s*/,'').trim()
  })
  assert.equal(new Set(conclusions).size,topicOrder.length)
})

test('period result labels natural presentation without claiming deterministic text came from Gemini', () => {
  assert.match(period, /result\.model === 'deterministic-provisional-v2' \|\| localQualityFallback/)
  assert.match(period, /자동 운세 해설/)
  assert.match(period, /맞춤 운세 해설/)
  const defaultMarkup = period.slice(period.indexOf('return <section className="period-ai-card period-ai-v18">'),period.lastIndexOf('<summary>계산 근거 자세히 보기</summary>'))
  assert.doesNotMatch(defaultMarkup,/계산근거 기반 자동 해설|AI\(인공지능\) 기간 해설/)
})

test('A/B: study leads favorable flow while relationship weakness stays in caution', () => {
  const { summary } = fixture({ focus: { 연애:'핵심', 학업:'핵심', 직장:'주목', 컨디션:'주목' }, scores:{ 학업:82, 직장:73, 연애:22, 컨디션:31 } })
  assert.deepEqual(summary.bestFlow,['학업','직장'])
  assert.deepEqual(summary.cautionFlow,['연애','컨디션'])
  assert.match(summary.headline,/^오늘은 공부와 업무/)
  assert.ok(summary.headline.indexOf('공부') < summary.headline.indexOf('연애'))
  assert.equal(summary.relationship,undefined)
})

test('C: important contact always shows both directions, even at identical bands or outside top three', () => {
  const { summary } = fixture({focus:{학업:'핵심',직장:'핵심',시험:'핵심',연락:'주목'}, scores:{학업:80,직장:75,시험:70,연락:50}})
  assert.equal(summary.focusTopics.some(t=>t.topic==='연락'),false)
  assert.equal(summary.relationship.incomingBand,'약함')
  assert.equal(summary.relationship.outgoingBand,'약함')
  assert.ok(summary.relationship.incoming)
  assert.ok(summary.relationship.outgoing)
  assert.notEqual(summary.relationship.incoming,summary.relationship.outgoing)
})

test('E: reference-only relationships never create a large contact/relationship section', () => {
  const { summary } = fixture({focus:{학업:'핵심',직장:'주목'},scores:{학업:75,직장:65,연애:5,연락:5,재회:5}})
  assert.equal(summary.relationship,undefined)
  assert.doesNotMatch(summary.headline,/연애|연락|재회|관계/)
  assert.deepEqual(summary.cautionFlow,[])
})

test('F: actual topic-linked planets and contribution are translated, unrelated evidence is excluded', () => {
  const { data, calculation } = fixture({focus:{학업:'핵심',연락:'주목'},scores:{학업:80,연락:35}})
  calculation.western.daily_scores=[{date:'2026-09-12',evidence:[
    {transit:'Mercury',target:'Jupiter',aspect:'trine',orb:1.42,contribution:3,text:'opaque W:internal orb 1.42',source_topics:['학업']},
    {transit:'Venus',target:'Saturn',contribution:-2,text:'unrelated',source_topics:['연락']},
  ]}]
  const input=JSON.stringify({data,calculation})
  const summary=buildFortuneUserSummary(data,{period:'today',calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)})
  const study=summary.focusTopics.find(t=>t.topic==='학업')
  assert.match(study.reason,/수성과 목성/)
  assert.match(study.reason,/이해하고 집중하는 데 힘이 실려/)
  assert.doesNotMatch(study.reason,/금성|토성|orb|1\.42|W:|trine/)
  assert.match(summary.focusTopics.find(t=>t.topic==='연락').reason,/마찰이나 부담/)
  assert.equal(JSON.stringify({data,calculation}),input,'view model must not mutate payload or scores')
})

test('neutral ranking uses deviation then support then backend order, not array order', () => {
  const {data,calculation}=fixture({focus:{연애:'핵심',학업:'핵심',직장:'핵심'},scores:{연애:61,학업:80,직장:80}})
  data.topic_analysis.직장.evidence_refs.push('W:second')
  const entries=normalizeTopicEntries(data.topic_analysis,topicOrder)
  const view=(topicEntries)=>buildFortuneUserSummary(data,{period:'today',calculation,topicEntries})
  assert.deepEqual(view(entries).bestFlow,['직장','학업'])
  assert.deepEqual(view([...entries].reverse()).bestFlow,['직장','학업'])
  data.topic_analysis.직장.evidence_refs.pop()
  data.priorities=['학업 우선','직장 다음']
  assert.deepEqual(view(entries).bestFlow,['학업','직장'])
})

test('week/month/year timing uses actual distinct high/low dates and day never invents a trend', () => {
  for(const [periodKey,days,label] of [['week',7,'이번 주 안에서도'],['month',30,'이번 달에는'],['year',365,'올해 주요 시기']]) {
    const {data,calculation}=fixture({periodKey,dayCount:days,focus:{학업:'핵심'},scores:{학업:70}})
    calculation.period.end=periodKey==='week'?'2026-09-18':periodKey==='month'?'2026-10-11':'2027-09-11'
    calculation.western.overall.학업={...stat(70),spread:35,best_days:[{date:'2026-09-14',score:85}],caution_days:[{date:'2026-09-17',score:40}]}
    const context={period:periodKey,calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)}
    const summary=buildFortuneUserSummary(data,context)
    assert.ok(summary.focusTopics[0].timing.includes(label))
    assert.match(summary.focusTopics[0].timing,/2026-09-14.*2026-09-17/)
    assert.equal(buildFortuneUserSummary(data,{...context,period:'today'}).focusTopics[0].timing,undefined)
  }
})

test('cross-system context requires shared evidence refs and never invents agreement', () => {
  const {data,calculation}=fixture({focus:{학업:'핵심'},scores:{학업:75}})
  const check={start:'2026-09-12',end:'2026-09-12',western:'supported',saju:'supported',thai:'',mode:'상반맥락',evidence_refs:['unrelated']}
  data.cross_checks=[check]
  const context={period:'today',calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)}
  assert.doesNotMatch(buildFortuneUserSummary(data,context).focusTopics[0].reason,/사주/)
  check.evidence_refs=[...data.topic_analysis.학업.evidence_refs]
  assert.match(buildFortuneUserSummary(data,context).focusTopics[0].reason,/사주.*엇갈려/)
  check.mode='복수체계'
  assert.match(buildFortuneUserSummary(data,context).focusTopics[0].reason,/같은 결론이라고 보진 않아/)
})

test('missing statistics do not create favorable/caution signals; investment risk is not upside', () => {
  const {data,calculation}=fixture({focus:{학업:'핵심',투자주의:'주목'},scores:{투자주의:90}})
  calculation.western.overall.학업=null
  const summary=buildFortuneUserSummary(data,{period:'today',calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)})
  assert.deepEqual(summary.bestFlow,[])
  assert.deepEqual(summary.cautionFlow,['투자주의'])
  assert.match(summary.focusTopics.find(t=>t.topic==='학업').conclusion,/정보가 부족/)
})

test('year uses real monthly phases when available instead of repeating a daily date', () => {
  const {data,calculation}=fixture({periodKey:'year',dayCount:365,focus:{학업:'핵심'},scores:{학업:70}})
  calculation.period.end='2027-09-11'
  calculation.western.months=[
    {start:'2026-10-01',end:'2026-10-31',topics:{학업:stat(85)}},
    {start:'2027-02-01',end:'2027-02-28',topics:{학업:stat(30)}},
  ]
  const result=buildFortuneUserSummary(data,{period:'year',calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)})
  assert.match(result.focusTopics[0].timing,/올해는 2026-10-01~2026-10-31.*2027-02-01~2027-02-28/)
})

// Exercise the redesigned view models and real component rendering through the existing CI entrypoint.
import './readingExperience.test.mjs'
import './readingExperience.render.test.mjs'
