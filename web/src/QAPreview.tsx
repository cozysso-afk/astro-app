import { useMemo, useState } from 'react'
import { FortuneFlowCards } from './FortuneFlowCards'
import { buildFortuneUserSummary } from './lib/fortuneUserSummary'
import { normalizeTopicEntries } from './lib/interpretationTopics'
import { topicOrder } from './lib/fortuneTopics'

function stat(score: number) {
  return {
    average: score,
    band: score < 40 ? '약함' : score >= 60 ? '강함' : '보통',
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
    <div className="period-ai-head"><div><span className="period-ai-kicker">QA fixture · {summary.when} 핵심</span><span className="reading-period-date">{period === 'today' ? '2026-09-21' : '2026-09-21 → 2026-09-27'}</span><h3>{summary.headline}</h3><p className="reading-hero-subtitle">{summary.summary}</p></div></div>
    <div className="reading-flows">
      <h4 className="reading-section-heading">한눈에 보는 흐름</h4>
      <FortuneFlowCards title={summary.doTitle} items={summary.favorableCards}/>
      <FortuneFlowCards title={summary.cautionTitle} items={summary.cautionCards} caution/>
    </div>
  </div>
}

function ReunionQA() {
  return <div className="period-ai-card period-ai-v18">
    <div className="period-ai-head"><div><span className="period-ai-kicker">QA fixture · 재회운 사람말 본문</span><h3>다시 대화할 여지는 열려 있지만, 관계 회복은 연락 이후 행동을 보고 판단하는 흐름이야.</h3><p className="reading-hero-subtitle">감정이 다시 올라오는 신호와 실제 연락·만남·재구축은 같은 단계가 아니야. 이번 검수 화면은 기술 용어보다 사람말 본문이 충분히 길고 앞에 오는지 보기 위한 fixture야.</p></div></div>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 두 사람 사이에서 살아 있는 흐름</span></div><p>서로를 다시 의식하게 만드는 자극은 남아 있어. 다만 지금 계산에서 가장 먼저 살아나는 건 감정과 기억 쪽이고, 실제 행동은 그보다 한 단계 늦게 따라오는 구조야. 한 번의 반응이나 답장만으로 관계가 복구됐다고 읽기보다, 대화가 이어지고 다음 약속으로 넘어가는지를 따로 봐야 해.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>왜 다시 연결될 수 있나</span></div><p>완전히 끝난 관계처럼 무감각해지는 흐름보다는 다시 생각나고 확인하고 싶어지는 흐름이 반복돼. 특히 대화를 다시 열 수 있는 계기와 과거 기억이 자극되는 시기가 겹치면 접점이 생길 여지가 커져. 다만 그 접점은 재결합 확정이 아니라 다시 말을 섞을 수 있는 문이 열리는 정도로 읽는 게 맞아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 막히는 지점</span></div><p>감정이 올라오는 속도보다 실제 행동 전환이 느린 편이야. 서로의 의도를 확인하기 전에 예전 갈등을 떠올리거나, 먼저 움직였다가 다시 상처받는 상황을 피하려는 태도가 끼어들기 쉬워. 그래서 이번 흐름은 누가 더 마음이 있느냐보다 실제로 대화를 이어가고 약속을 지키는지가 더 중요해.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>다시 움직인다면 어떤 순서인가</span></div><p>감정 재활성화 → 짧은 연락이나 반응 → 대화 지속 → 실제 만남 → 관계를 어떤 조건으로 다시 이어갈지 정하는 순서로 봐. 앞 단계를 건너뛰고 바로 관계 정의를 요구하면 흐름이 끊기기 쉬워. 연락이 왔다는 사실보다 그 다음 행동이 이어지는지를 확인해야 해.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>오늘 이후 핵심 시기</span></div><p><strong>2026-10-21</strong>은 재접촉 계기가 먼저 살아나는 후보, <strong>2027-01-21</strong>은 상대측 반응을 관찰하기 좋은 후보, <strong>2027-04-18</strong>은 내가 먼저 움직일 때의 반응을 보기 좋은 후보로 두고 읽어. 날짜는 사건 확률이 아니라 엔진이 통과시킨 활성 창이야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>연락 이후, 재회까지 남은 것</span></div><p>대화가 다시 시작돼도 예전 갈등 구조가 그대로면 감정만 재점화되고 다시 멀어질 수 있어. 실제 재구축으로 가려면 말투나 태도보다 약속을 지키는 방식, 관계의 경계, 갈등이 생겼을 때 끊어버리지 않고 조정하는 방식이 달라져야 해. 이번에는 ‘연락이 왔다’보다 ‘연락 이후 무엇이 달라졌나’를 재회 판단의 기준으로 두는 게 맞아.</p></section>
  </div>
}

export function QAPreview() {
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
