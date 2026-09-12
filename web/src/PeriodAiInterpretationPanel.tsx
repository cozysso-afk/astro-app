import { ReadingExplanation } from './ReadingExplanation'
import { CheckCircle2, CircleStop, Copy, LoaderCircle, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse, IntegratedApiResponse, PeriodKey } from './appTypes'
import { estimateGeminiUsage } from './lib/aiUsage'
import { topicOrder } from './lib/fortuneTopics'
import { buildFortuneUserSummary } from './lib/fortuneUserSummary'
import { normalizeTopicEntries } from './lib/interpretationTopics'
import { FortuneFlowCards } from './FortuneFlowCards'
import type { ReactNode } from 'react'
import { fortuneAiPrecisionReadiness } from './lib/precisionTransport'

function periodLabel(start: string, end: string) {
  if (!start && !end) return ''
  if (!end || start === end) return start
  return `${start} → ${end}`
}

function visibleAiText(value: string | undefined) {
  return String(value ?? '')
    .replace(/\b(?:W|S|T):[^\s),]+/g, '계산 근거')
    .replace(/\(\s*계산 근거\s*\)/g, '')
    .replace(/계산 근거(?:\s*[·,;]\s*계산 근거)+/g, '계산 근거')
    .replace(/이직\s*및\s*진로\s*타깃\s*시간/g, '이직·진로 집중 시간')
    .replace(/타깃/g, '집중')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function signalClass(signal: string) {
  if (signal === '활용') return 'is-use'
  if (signal === '주의') return 'is-caution'
  if (signal === '배경') return 'is-background'
  return 'is-mixed'
}

export function PeriodAiInterpretationPanel({ period, calculation, result, loading, error, cacheSource, onRetry, onCopyPrompt, onCancel, canCancel, technicalDetails }: {
  technicalDetails?: ReactNode
  period: PeriodKey
  calculation: IntegratedApiResponse
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  cacheSource: 'local' | 'server' | 'fresh' | ''
  onRetry: () => void
  onCopyPrompt: () => void
  onCancel: () => void
  canCancel: boolean
}) {
  const technicalFallback = technicalDetails ? <details className="period-ai-details"><summary>계산 근거 자세히 보기</summary>{technicalDetails}</details> : null
  if (!loading && !error && (!result || !result.data)) return <><section className="period-ai-card period-ai-ready"><div className="period-ai-head"><span className="period-ai-orb"><Sparkles size={18}/></span><div><span className="period-ai-kicker">운세 해설</span><h3>자연어 해설 준비됨</h3></div></div><p className="period-ai-summary">계산은 끝났어. 해설이 자동으로 시작되지 않았거나 저장본이 없으면 여기서 불러올 수 있어.</p><div className="period-ai-v21-controls period-ai-ready-controls"><button className="period-ai-generate" type="button" onClick={onRetry}><Sparkles size={15}/>해설 생성</button><button type="button" onClick={onCopyPrompt}><Copy size={15}/>프롬프트 복사</button></div></section>{technicalFallback}</>
  if (loading && !result) return <><section className="period-ai-card is-loading"><LoaderCircle className="spin" size={21}/><div><span className="period-ai-kicker">운세 해설</span><h3>운세 흐름을 정리하고 있어…</h3><p className="period-ai-summary">잠시만 기다려줘. 오래 걸리면 자동으로 중단하고 다시 시도할 수 있게 알려줄게.</p><div className="period-ai-v21-controls"><button type="button" onClick={onCopyPrompt}><Copy size={15}/>프롬프트 복사</button>{canCancel&&<button type="button" className="is-cancel" onClick={onCancel}><CircleStop size={15}/>생성 취소</button>}</div></div></section>{technicalFallback}</>
  const failedUsage = estimateGeminiUsage(result?.usage)
  if (error && !result?.data) {
    const quotaLimited = /Gemini HTTP 429|RESOURCE_EXHAUSTED/i.test(error)
    const message = quotaLimited
      ? '운세 계산은 정상 완료됐어. 지금은 해설 서버의 사용 한도가 소진돼 자연어 해설만 잠시 만들 수 없어. 한도가 복구된 뒤 다시 불러오면 계산 결과는 그대로 이어서 해설할 수 있어.'
      : error
    return <><section className="period-ai-card"><span className="period-ai-kicker">운세 해설</span><h3>{quotaLimited ? '해설 서버 한도를 확인해줘' : '자연어 해설을 아직 불러오지 못했어'}</h3><p className="period-ai-summary">{message}</p>{failedUsage?.total_tokens ? <p className="period-ai-failed-usage">실패 전 실제 사용량 · 입력 {(failedUsage.prompt_tokens??0).toLocaleString()} · 출력 {(failedUsage.candidate_tokens??0).toLocaleString()} · 사고 {(failedUsage.thought_tokens??0).toLocaleString()} tokens · 호출 {failedUsage.attempt_count??1}회 · 약 {Math.round(failedUsage.estimated_krw??0).toLocaleString()}원</p> : null}<div className="period-ai-v21-controls"><button className="period-ai-retry" type="button" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 확인' : '해설 다시 확인'}</button><button type="button" onClick={onCopyPrompt}><Copy size={15}/>프롬프트 복사</button></div></section>{technicalFallback}</>
  }
  if (!result?.ok || !result.data) return technicalFallback

  const data = result.data
  const importanceRank = (value?: string) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  const topicEntries = normalizeTopicEntries(data.topic_analysis, topicOrder).sort((a,b)=>importanceRank(a[1]?.importance)-importanceRank(b[1]?.importance))
  const readiness = fortuneAiPrecisionReadiness(calculation)
  const userSummary = buildFortuneUserSummary(data, { period, calculation, topicEntries, allowIntraday: readiness.ok && readiness.mode === 'exact' })
  const usage = estimateGeminiUsage(result.usage)
  const cached = cacheSource === 'local' || cacheSource === 'server'
  const validation = result.usage?.quality_validation
  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
  const localQualityFallback = Boolean(result.usage?.local_quality_fallback)
  const degradedQuality = Boolean(result.usage?.degraded_quality)
  const decisions = data.decisions ?? []
  const keyWindows = data.key_windows ?? []
  const crossChecks = data.cross_checks ?? []
  const technicalEvidence = (calculation.western.daily_scores ?? []).flatMap((day)=>
    (day.evidence ?? []).map((evidence)=>({ date: day.date, evidence })),
  ).slice(0, 16)
  const deterministicLocal = result.model === 'deterministic-provisional-v2' || localQualityFallback

  const windowGroups = Array.from(new Set(userSummary.importantWindows.map(w => w.date))).map(date => ({ date, lines: [...new Map(userSummary.importantWindows.filter(w => w.date === date).map(w => [`${w.kind}:${w.guidance}`, w])).values()] }))
  return <section className="period-ai-card period-ai-v18">
    <div className="period-ai-head"><span className="period-ai-orb"><Sparkles size={18}/></span><div><span className="period-ai-kicker">{deterministicLocal ? '자동 운세 해설' : '맞춤 운세 해설'} · {userSummary.when} 핵심</span><span className="reading-period-date">{periodLabel(calculation.period.start, calculation.period.end)}</span><h3>{userSummary.headline}</h3><p className="reading-hero-subtitle">{userSummary.summary}</p></div></div>

    <div className="reading-flows"><h4 className="reading-section-heading">한눈에 보는 흐름</h4><FortuneFlowCards title={userSummary.doTitle} items={userSummary.favorableCards}/><FortuneFlowCards title={userSummary.cautionTitle} items={userSummary.cautionCards} caution/></div>

    {!!userSummary.importantWindows.length && <section className="period-ai-quick-dates period-ai-user-windows">
      <div className="period-ai-section-title"><span>중요한 시기</span><strong>활용 시기와 주의 시기</strong></div>
      <div className="period-ai-quick-date-list">{windowGroups.map((item,index)=><article className="period-ai-quick-date" key={`user-window-${item.date}-${index}`}><b>{item.date}</b><div>{item.lines.map(line=><strong className={`reading-window-line is-${line.kind}`} key={`${line.kind}:${line.guidance}`}><small>{line.kind === 'favorable' ? '활용' : line.kind === 'caution' ? '주의' : '혼합'}</small>{line.guidance}</strong>)}</div></article>)}</div>
    </section>}

    {userSummary.relationship ? <section className="period-ai-window-section period-ai-relationship-section">
      <div className="period-ai-section-title"><span>연락 흐름</span></div>
      <article className="period-ai-window period-ai-relationship-summary"><p>{userSummary.relationship.summary}</p>
        <div className="period-ai-relationship-directions">
          <div className="period-ai-direction-item"><strong>상대가 먼저 오는 흐름 · {userSummary.relationship.incomingBand}</strong><p>{userSummary.relationship.incoming}</p>{userSummary.relationship.incomingTiming&&<p>{userSummary.relationship.incomingTiming}</p>}</div>
          <div className="period-ai-direction-item"><strong>내가 먼저 연락하기 · {userSummary.relationship.outgoingBand}</strong><p>{userSummary.relationship.outgoing}</p>{userSummary.relationship.outgoingTiming&&<p>{userSummary.relationship.outgoingTiming}</p>}</div>
          {userSummary.relationship.reconnection&&<div className="period-ai-direction-item"><strong>과거 인연 재접촉</strong><p>{userSummary.relationship.reconnection}</p></div>}
        </div>
      </article>
    </section> : null}

    {!!userSummary.focusTopics.length && <section className="period-ai-window-section period-ai-user-focus">
      <div className="period-ai-section-title"><span>{userSummary.focusTitle}</span><strong>현실에서 이렇게 봐</strong></div>
      <div className="period-ai-topic-list">{userSummary.focusTopics.map((item)=><article className="period-ai-topic" key={`user-topic-${item.topic}`}><strong>{item.topic}</strong><b>{item.conclusion}</b><ReadingExplanation kind="reason">{item.reason}</ReadingExplanation>{item.timing&&<ReadingExplanation kind="timing">{item.timing}</ReadingExplanation>}<ReadingExplanation kind="practice">{item.action} {item.observe !== item.action ? item.observe : null}</ReadingExplanation>{item.caution&&<ReadingExplanation kind="caution">{item.caution}</ReadingExplanation>}</article>)}</div>
    </section>}

    {!!userSummary.referenceTopics.length && <details className="period-ai-topic-disclosure period-ai-topic-reference-disclosure period-ai-user-reference"><summary>다른 분야 보기</summary><div className="period-ai-topic-list">{userSummary.referenceTopics.map((item)=><article className="period-ai-topic is-reference" key={`user-reference-${item.topic}`}><strong>{item.topic} · {item.band}</strong><p>{item.summary}</p></article>)}</div></details>}

    <details className="period-ai-details">
      <summary>계산 근거 자세히 보기</summary>
      <div className="period-ai-detail-body">
        {technicalDetails}
        {(localQualityFallback || degradedQuality) ? <div className="period-ai-quality-fallback"><CheckCircle2 size={15}/><div><strong>{localQualityFallback ? '검증 실패 부분 안전 보정본' : '핵심 검증 통과 · 일부 깊이 보정'}</strong><span>{result.usage?.quality_warning || (localQualityFallback ? '추가 Gemini 호출 없이 계산 근거만으로 보정해 표시했어.' : '결과를 숨기지 않고 통과한 근거를 기준으로 표시했어.')}</span></div></div> : null}
        {validation?.stages?.length ? <div className={`period-ai-validation ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={15}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100</span></div> : null}
        <div className="period-ai-cache-note"><CheckCircle2 size={14}/><span>{cached ? '저장된 검증 해설 조회 · 이번 Gemini API 재호출 0회' : '최초 검증 해설 자동 저장 · 같은 계산값 재조회는 Gemini API 0회'}</span></div>

        <div className="period-ai-section"><strong>원문 전체 요약</strong><p>{data.headline}{'\n\n'}{data.overall.summary}{data.overall.dominant_pattern ? `\n\n${data.overall.dominant_pattern}` : ''}</p></div>
        <div className="period-ai-section"><strong>분야별 원점수</strong><p>{topicEntries.map(([topic])=>{const stat=calculation.western.overall?.[topic];return stat?`${topic} ${stat.average.toFixed(1)}점 · ${stat.band}`:''}).filter(Boolean).join('\n')}</p></div>

        {!!keyWindows.length && <div className="period-ai-section"><strong>날짜와 구간 원문</strong><div className="period-ai-windows">{keyWindows.map((item,index)=><article className={`period-ai-window ${signalClass(item.signal)}`} key={`technical-window-${item.start}-${index}`}><div className="period-ai-window-head"><div><b>{periodLabel(item.start,item.end)}</b><strong>{visibleAiText(item.label)}</strong></div><span>{item.signal}</span></div>{!!item.topics?.length&&<div className="period-ai-window-topics">{item.topics.map((topic)=><span key={topic}>{topic}</span>)}</div>}<p>{visibleAiText(item.summary)}</p>{item.action&&<div className="period-ai-window-line"><b>활용</b><span>{item.action}</span></div>}{item.avoid&&<div className="period-ai-window-line is-avoid"><b>주의</b><span>{item.avoid}</span></div>}</article>)}</div></div>}

        {!!decisions.length && <div className="period-ai-section"><strong>행동 판단 원문</strong><div className="period-ai-actions">{decisions.map((item,index)=><article key={`technical-decision-${index}-${item.action}`}><span className="period-ai-action-index">{index+1}</span><div><strong>{visibleAiText(item.action)}</strong>{item.timing&&<b className="period-ai-action-time">{item.timing}</b>}{item.reason&&<p>{visibleAiText(item.reason)}</p>}{item.watch&&<p className="period-ai-condition"><b>판단</b><span>{visibleAiText(item.watch)}</span></p>}{item.avoid&&<p className="period-ai-condition is-avoid"><b>주의</b><span>{visibleAiText(item.avoid)}</span></p>}</div></article>)}</div></div>}

        <div className="period-ai-section"><strong>분야별 종합 원문</strong><p>{[data.clusters.relationship&&`관계 · ${data.clusters.relationship}`,data.clusters.work_study&&`일·학업 · ${data.clusters.work_study}`,data.clusters.money_news&&`돈·소식 · ${data.clusters.money_news}`,data.clusters.investment&&`투자 · ${data.clusters.investment}`,data.clusters.condition&&`컨디션 · ${data.clusters.condition}`].filter(Boolean).join('\n\n')}</p></div>
        {!!data.priorities?.length && <div className="period-ai-section"><strong>우선순위 원문</strong><p>{data.priorities.map((item,index)=>`${index+1}. ${item}`).join('\n')}</p></div>}

        {data.relationship_reading ? <div className="period-ai-section"><strong>관계 해설 원문</strong><p>{[data.relationship_reading.context,data.relationship_reading.flow,data.relationship_reading.focus_timing,data.relationship_reading.watch,data.relationship_reading.avoid,data.contact_flow?.incoming,data.contact_flow?.outgoing,data.contact_flow?.reconnection].filter(Boolean).map((item)=>visibleAiText(String(item))).join('\n\n')}</p></div> : null}

        {!!technicalEvidence.length && <div className="period-ai-section"><strong>점성 근거 원문</strong><p>{technicalEvidence.map(({date,evidence})=>`${date} · ${evidence.text || [evidence.transit,evidence.aspect,evidence.target].filter(Boolean).join(' ')}${Number.isFinite(evidence.orb) ? ` · orb ${Number(evidence.orb).toFixed(2)}°` : ''}${evidence.motion ? ` · ${evidence.motion}` : ''}`).join('\n')}</p></div>}

        {!!crossChecks.length && <div className="period-ai-section period-ai-cross-section"><strong>체계 교차검증</strong><p className="period-ai-cross-note">세 체계를 합산하거나 다수결하지 않고 같은 시기의 독립 근거를 비교해.</p><div className="period-ai-cross-list">{crossChecks.map((item,index)=><article key={`${item.start}-${item.label}-${index}`}><div><b>{periodLabel(item.start,item.end)}</b><span>{item.mode}</span></div><strong>{visibleAiText(item.label)}</strong><p><b>Western</b> {item.western}</p><p><b>사주</b> {item.saju}</p><p><b>Thai</b> {item.thai}</p><p className="period-ai-cross-synthesis"><b>종합</b> {item.synthesis}</p></article>)}</div></div>}

        {!!topicEntries.length && <div className="period-ai-section"><strong>분야별 해설과 확신도</strong><div className="period-ai-topic-list">{topicEntries.map(([topic,item])=><article className="period-ai-topic" key={`technical-topic-${topic}`}><strong>{topic} · {item.importance}</strong><b>{visibleAiText(item.verdict)}</b>{item.reason&&<p>근거 · {visibleAiText(item.reason)}</p>}{item.timing&&<p>시기 · {item.timing}</p>}{item.action&&<p>활용 · {item.action}</p>}{item.avoid&&<p>주의 · {item.avoid}</p>}<p>확신도 · {item.confidence}{item.confidence_reason?` · ${visibleAiText(item.confidence_reason)}`:''}</p></article>)}</div></div>}

        <div className="period-ai-section"><strong>체계별 계산 해설</strong><p>{[data.systems?.western&&`서양점성술 · ${data.systems.western}`,data.systems?.saju&&`사주 · ${data.systems.saju}`,data.systems?.thai&&`태국점성술 · ${data.systems.thai}`].filter(Boolean).join('\n\n')}</p></div>
        {data.limits && <div className="period-ai-section"><strong>해설 한계</strong><p>{data.limits}</p></div>}
        {usage?.total_tokens ? <div className="period-ai-cost"><span>입력 {(usage.prompt_tokens??0).toLocaleString()} · 출력 {(usage.candidate_tokens??0).toLocaleString()} · 사고 {(usage.thought_tokens??0).toLocaleString()} tokens</span><b>${Number(usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(usage.estimated_krw??0).toLocaleString()}원</b><small>{`실제 Gemini 호출 ${usage.attempt_count??1}회 · 최대 2회 · `}{usage.thai_safety_fallback?'Thai 안전 대체 결과 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장본 재조회 비용 0원</small></div> : null}
        <div className="period-ai-v21-controls period-ai-v21-controls-success"><button type="button" onClick={onCopyPrompt}><Copy size={15}/>같은 압축 프롬프트 복사</button></div>
      </div>
    </details>
  </section>
}
