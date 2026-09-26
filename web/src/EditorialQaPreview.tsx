import { useMemo, useState } from 'react'
import { FortuneFlowCards } from './FortuneFlowCards'
import { buildFortuneUserSummary } from './lib/fortuneUserSummary'
import { normalizeTopicEntries } from './lib/interpretationTopics'
import { topicOrder } from './lib/fortuneTopics'

function stat(score: number) {
  return {
    average: score,
    band: score >= 60 ? '강함' : score >= 52 ? '다소 강함' : score >= 45 ? '보통' : score >= 38 ? '다소 약함' : '약함',
    spread: 0,
    best_days: [],
    caution_days: [],
  }
}

function topicRow(topic: string, importance: string) {
  return {
    importance,
    verdict: `${topic} 흐름`,
    reason: 'QA fixture',
    timing: '',
    action: 'QA fixture',
    avoid: '',
    confidence: '보통',
    confidence_reason: 'QA fixture',
    evidence_refs: [`W:qa:${topic}`],
  }
}

function makeFortuneFixture(period: 'today' | 'week') {
  const day = period === 'today'
  const scores: Record<string, number> = day
    ? { 대인관계: 58, 이직: 55, 금전: 45, 연애: 45, 학업: 41, 연락: 41, 직장: 48, 컨디션: 47 }
    : { 대인관계: 64, 직장: 62, 학업: 59, 이직: 56, 연락: 48, 연애: 46, 금전: 43, 컨디션: 52 }

  const topicAnalysis = Object.fromEntries(topicOrder.map((topic) => {
    const score = scores[topic] ?? 50
    const importance = score >= 55 ? '핵심' : score >= 40 ? '주목' : '참고'
    return [topic, topicRow(topic, importance)]
  }))

  const dates = day
    ? ['2026-09-21']
    : ['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']

  const dailyScores = dates.map((date, index) => ({
    date,
    evidence: index < 2
      ? [{ source_topics:['대인관계'], transit:'Mercury', target:'Jupiter', aspect:'trine', contribution:4, polarity:.7, motion:index === 0 ? 'Separating' : 'Applying', text:'qa' }]
      : index < 5
        ? [{ source_topics:['직장','학업'], transit:'Saturn', target:'Sun', aspect:'trine', contribution:3, polarity:.55, motion:'Applying', text:'qa' }]
        : [{ source_topics:['직장','학업'], transit:'Mars', target:'Moon', aspect:'sextile', contribution:4, polarity:.65, motion:'Exact', text:'qa' }],
  }))

  const overall = Object.fromEntries(topicOrder.map((topic) => [topic, stat(scores[topic] ?? 50)]))
  const data = {
    headline: 'legacy saved headline should not own QA hero',
    overall: { summary:'legacy saved summary', dominant_pattern:'', best_phase:'', caution_phase:'', evidence_refs:[] },
    key_windows: [],
    cross_checks: [],
    decisions: [],
    clusters: { relationship:'', work_study:'', money_news:'', investment:'', condition:'' },
    relationship_reading: { context:'', flow:'', focus_timing:'', watch:'', avoid:'', evidence_refs:[] },
    contact_flow: { incoming:'', outgoing:'', reconnection:'' },
    systems: { western:'', saju:'', thai:'' },
    priorities: day ? ['대인관계 우선','이직 다음'] : ['대인관계 우선','직장 다음','학업 다음'],
    topic_analysis: topicAnalysis,
    limits: '',
  } as any

  const calculation = {
    period: { start:'2026-09-21', end: day ? '2026-09-21' : '2026-09-27', day_count: day ? 1 : 7, month_segments:1 },
    western: {
      overall,
      relationship_signals: { 수신신호:stat(48), 발신적합:stat(52), 과거인연접점:stat(46) },
      daily_scores: dailyScores,
    },
  } as any

  return buildFortuneUserSummary(data, {
    period,
    calculation,
    topicEntries: normalizeTopicEntries(data.topic_analysis, topicOrder),
  })
}

function FortuneQA({ period }: { period: 'today' | 'week' }) {
  const summary = useMemo(() => makeFortuneFixture(period), [period])
  return <div className="period-ai-card period-ai-v18">
    <div className="period-ai-head"><div><span className="period-ai-kicker">{summary.when} 핵심</span><span className="reading-period-date">{period === 'today' ? '2026-09-21' : '2026-09-21 → 2026-09-27'}</span><h3>{summary.headline}</h3><p className="reading-hero-subtitle">{summary.summary}</p></div></div>
    <div className="reading-flows">
      <h4 className="reading-section-heading">한눈에 보는 흐름</h4>
      <FortuneFlowCards title={summary.doTitle} items={summary.favorableCards}/>
      <FortuneFlowCards title={summary.cautionTitle} items={summary.cautionCards} caution/>
    </div>
  </div>
}

function ReunionQA() {
  return <div className="period-ai-card period-ai-v18">
    <div className="period-ai-head" style={{order:-1}}><div><span className="period-ai-kicker">재회운 핵심</span><h3>감정 쪽 신호가 먼저 보이고, 연락 단계에는 후보가 하나 있지만 만남·재구축 단계까지 열린 흐름은 아니야.</h3><p className="reading-hero-subtitle">이 화면은 실제 사용자 계산이 아니라 문구와 구조를 검수하는 fixture야. 아래 숫자도 예시값이며, 확률이 아니라 단계별 후보를 비교하는 보조지표야.</p></div></div>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>단계별 활성도 · 보조지표</span></div><div className="reunion-return-context-grid"><article className="reunion-return-context-card"><b>감정 재활성화</b><strong>68/100</strong><small>미래 후보 2개</small></article><article className="reunion-return-context-card"><b>연락·재접촉</b><strong>57/100</strong><small>미래 후보 1개</small></article><article className="reunion-return-context-card"><b>실제 만남</b><strong>—</strong><small>공개할 미래 후보 없음</small></article><article className="reunion-return-context-card"><b>관계 재구축</b><strong>—</strong><small>공개할 미래 후보 없음</small></article></div><p>57은 연락 확률 57%도, 현재 마음의 세기도 아니야. 이 예시에서는 연락 단계 관문을 통과한 미래 후보가 하나 있고 그 후보의 활성도가 57이라는 뜻이야. 반대로 후보가 없는 만남·재구축 단계는 점수를 억지로 만들어 보여주지 않아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 두 사람 사이에서 살아 있는 흐름</span></div><p>지금 가장 앞선 건 감정과 기억이 다시 움직이는 단계야. 서로가 다시 생각나거나 과거 대화를 되짚는 장면은 생길 수 있지만, 그것만으로 연락이 온다고 읽지는 않아. 연락·재접촉 단계에는 후보가 하나 잡혀 있어서 대화가 다시 열릴 가능성을 관찰할 구간은 있어. 다만 실제 만남과 관계 재구축 단계에는 공개할 미래 후보가 없으므로, 현재 흐름을 ‘재회가 가까워졌다’고 묶어 말하면 과장이야. 지금의 핵심은 감정 반응과 실제 행동 사이에 아직 간격이 있다는 점이야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>왜 다시 신경 쓰이거나 연결될 수 있나</span></div><p>이번 예시에서는 감정 단계가 연락 단계보다 먼저, 더 여러 번 후보로 잡혀 있어. 그래서 현실에서는 문득 상대가 생각나거나 예전 대화가 다시 의미 있게 느껴지는 식으로 먼저 나타날 수 있어. 연락 단계 후보가 있다는 건 그 감정이 실제 메시지·답장·안부 같은 상호작용으로 넘어갈 수 있는 창이 하나 있다는 뜻이야. 하지만 후보 하나가 있다는 것과 연락이 실제로 발생한다는 것은 다르고, 상대가 먼저 움직인다는 뜻도 아니야. 연락이 닿더라도 한 번의 답장보다 대화가 며칠 이상 이어지는지, 다음 질문이나 약속 제안으로 넘어가는지를 봐야 해. 그런 후속 행동이 없다면 감정 재활성화에서 멈춘 흐름으로 읽는 게 맞아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 어디까지 와 있나</span></div><p>단계로 보면 ‘감정 재활성화’는 열려 있고 ‘연락·재접촉’은 제한적인 후보가 있지만, ‘실제 만남’과 ‘관계 재구축’은 아직 열리지 않은 상태야. 그래서 지금은 재회 여부를 묻기보다 연락 단계로 실제 이동하는지가 먼저야. 메시지 한 번, 좋아요 한 번, 우연한 반응 하나만으로 다음 단계가 열렸다고 보지 않아. 대화가 이어지고 서로 시간을 쓰려는 제안이 생겨야 만남 단계와 구분할 수 있어. 그 전에는 기대보다 관찰이 앞서는 흐름이야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>다시 움직인다면 어떤 순서인가</span></div><p>감정이 다시 올라옴 → 짧은 연락이나 반응이 실제로 생김 → 대화가 한 번 이상 이어짐 → 구체적인 약속을 잡음 → 실제로 만남 → 이전 문제를 어떻게 다르게 다룰지 합의함의 순서로 봐. 각 화살표는 자동으로 넘어가는 단계가 아니야. 예를 들어 연락이 와도 대화가 금방 끊기면 연락 단계에서 끝난 거고, 대화가 이어져도 만남 약속이 없으면 만남 단계로 승격하지 않아. 이 구분이 있어야 ‘연락 왔다 = 재회’ 같은 과잉해석을 막을 수 있어.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지난 활성기 · 사후 확인용</span></div><p><strong>2026-07-18 전후</strong>는 감정 재활성화 단계가 강했던 예시 과거 구간이야. <strong>2026-08-09 전후</strong>는 연락·재접촉 관문까지 통과했던 예시 구간이야. 실제 당시 메시지·답장·만남 기록과 비교해 볼 수 있지만, 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>현재 흐름</span></div><p>이 예시의 기준일에는 감정 재활성화 단계만 현재 창에 걸쳐 있고, 연락·만남·재구축 단계는 현재 창으로 열려 있지 않아. 현재 창이 없거나 약하다는 말과 실제 감정이 없다는 말은 구분해서 읽어야 해.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>앞으로의 후보 시기</span></div><p><strong>2026-10-21 전후</strong>는 연락·재접촉 단계가 실제로 열리는지 살피는 예시 후보 창이야. <strong>2027-01-21 전후</strong>는 감정 재활성화 쪽 근거가 다시 모이는 예시 후보 창으로 두 단계의 의미가 달라. 특정 하루를 사건일로 찍는 게 아니라, 해당 단계의 장기·중기·사건 촉발 근거가 함께 통과하는 기간을 후보로 보는 방식이야. 만남·재구축 후보가 없다면 그보다 뒤 단계를 억지로 만들어 내지 않아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>연락 이후, 재회까지 남은 것</span></div><p>연락이 다시 시작돼도 재회 판단은 그 다음 행동에서 해야 해. 첫째, 대화가 일회성 안부에서 끝나지 않고 서로 질문과 답을 주고받는지 봐야 해. 둘째, 실제 만남이나 함께 시간을 쓰는 약속이 구체적으로 잡히는지가 필요해. 셋째, 예전 갈등을 다시 꺼냈을 때 피하거나 끊는 대신 무엇을 바꿀지 합의할 수 있어야 해. 이 세 단계가 따라오지 않으면 연락은 재접촉일 뿐 관계 재구축이라고 부르지 않는 게 맞아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>다시 멀어질 수 있는 지점</span></div><p>가장 큰 위험은 감정이 다시 올라온 것을 관계가 회복될 신호로 너무 빨리 해석하는 거야. 연락 후보가 하나 있다는 이유로 답장을 기다리며 모든 행동에 의미를 붙이면 실제로 확인된 단계보다 앞서가게 돼. 또 연락이 닿더라도 예전처럼 갈등이 생겼을 때 대화를 끊거나 약속을 흐리는 방식이 반복되면 재구축 단계로 넘어가기 어렵다고 봐야 해.</p></section>
  </div>
}

export function EditorialQaPreview() {
  const [tab, setTab] = useState<'today'|'week'|'reunion'>('today')
  return <main style={{maxWidth:760,margin:'0 auto',padding:'24px 16px 80px'}}>
    <section className="period-ai-card" style={{marginBottom:16}}><strong>비용 0원 QA 미리보기</strong><p>로그인·프로필·Gemini/API 호출 없이 문구와 레이아웃만 확인하는 화면이야.</p></section>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
      <button type="button" onClick={()=>setTab('today')}>일일</button>
      <button type="button" onClick={()=>setTab('week')}>주간</button>
      <button type="button" onClick={()=>setTab('reunion')}>재회운</button>
    </div>
    {tab === 'today' ? <FortuneQA period="today"/> : tab === 'week' ? <FortuneQA period="week"/> : <ReunionQA/>}
  </main>
}
