import { hierarchyView } from './lib/reunionHierarchy'
import { tenGodLens } from './lib/systemReading'
import { ReadingBadge, ReadingDirections, ReadingTimeline } from './ReadingSignals'
import { ReadingExplanation } from './ReadingExplanation'
import { AlertTriangle, ImageDown, LoaderCircle, Orbit, Sparkles } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import type { Aspect, RelationshipAiResponse, RelationshipAnalysisMode, ReunionTimingContext } from './appTypes'
import { buildRelationshipUserSummary, type RelationshipPattern } from './lib/relationshipUserSummary'
import { relationshipAiCostPreview } from './lib/aiCostPreview'
import { firstSentences, relationshipGenerationCost, reunionSajuCopy } from './lib/reunionPresentation'
import { exportReadingImages } from './lib/readingImageExport'
import './reading-image-export.css'

function readableParagraphs(value: string, targetChars = 190) {
  const text = String(value ?? '').trim()
  if (!text) return []
  const sentences = text.replace(/([.!?])\s+/g, '$1\n').split('\n').map((part) => part.trim()).filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current.length + sentence.length > targetChars || current.split(/[.!?]/).filter(Boolean).length >= 2)) {
      out.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) out.push(current)
  return out.length ? out : [text]
}

function ReadableCopy({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = readableParagraphs(text)
  if (!paragraphs.length) return null
  return <div className={`reunion-readable-copy ${className}`.trim()}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
}

const REUNION_STAGE_HUMAN: Record<string, string> = {
  emotional_reactivation: '서로를 다시 의식하거나 감정과 기억이 먼저 올라오는 단계야. 이것만으로 실제 연락이 생겼다고 보지는 않아.',
  contact_recontact: '메시지·답장·안부·간접 반응처럼 실제 상호작용이 다시 시작되는 단계야. 연락이 닿아도 곧바로 재결합을 뜻하지는 않아.',
  in_person_meeting: '대화가 현실 약속이나 직접 만남으로 이어지는 단계야. 온라인 반응과 실제 만남은 따로 봐.',
  relationship_rebuilding: '다시 만나는 것보다 관계를 어떤 조건으로 다시 이어갈지 정하는 단계야. 예전 패턴이 달라지는지가 핵심이야.',
}
function reunionStageHuman(stageKey: string, fallbackLabel = '') {
  if (REUNION_STAGE_HUMAN[stageKey]) return REUNION_STAGE_HUMAN[stageKey]
  if (fallbackLabel.includes('감정')) return REUNION_STAGE_HUMAN.emotional_reactivation
  if (fallbackLabel.includes('연락') || fallbackLabel.includes('접촉')) return REUNION_STAGE_HUMAN.contact_recontact
  if (fallbackLabel.includes('만남')) return REUNION_STAGE_HUMAN.in_person_meeting
  if (fallbackLabel.includes('재정') || fallbackLabel.includes('재구') || fallbackLabel.includes('관계')) return REUNION_STAGE_HUMAN.relationship_rebuilding
  return '이 단계가 실제 관계에서 어떤 행동으로 이어지는지 다른 단계와 분리해서 봐.'
}

export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, angleTimeAvailable, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, returnSupport, hierarchy, technicalDetails }: {
  sajuContext?: Record<string, unknown>;
  aspects: Aspect[]; partnerExact: boolean; angleTimeAvailable?: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;
  onAi: () => void; analysisMode: RelationshipAnalysisMode; timeSensitivePoints: ReadonlySet<string>; formatAspect: (aspect: Aspect) => string;
  hierarchy?: Record<string, unknown> | null;
  timing?: ReunionTimingContext | null; returnSupport?: Record<string, unknown> | null; technicalDetails?: ReactNode
}) {
  const reunion = analysisMode === 'reunion'
  const hierarchyData = hierarchyView(hierarchy)
  const exportRef = useRef<HTMLElement | null>(null)
  const [imageExporting, setImageExporting] = useState(false)
  const [imageExportStatus, setImageExportStatus] = useState('')
  const imageExportLabel = reunion ? '재회 결과' : analysisMode === 'marriage_married' ? '결혼생활 결과' : analysisMode === 'marriage_unmarried' ? '결혼궁합 결과' : '궁합 결과'
  const saveResultImages = async () => {
    if (!exportRef.current || imageExporting) return
    setImageExporting(true)
    setImageExportStatus('')
    try {
      const result = await exportReadingImages(exportRef.current, imageExportLabel)
      if (!result.cancelled) setImageExportStatus(result.shared ? `${result.pages}장 공유 화면을 열었어.` : `${result.pages}장 이미지로 저장했어.`)
    } catch (error) {
      setImageExportStatus(error instanceof Error ? error.message : '이미지 저장 중 문제가 생겼어.')
    } finally {
      setImageExporting(false)
    }
  }
  const view = buildRelationshipUserSummary({ aspects, partnerExact, angleTimeAvailable, mode: analysisMode, sensitive: timeSensitivePoints, timing: reunion ? timing : null })
  const relation = sajuContext?.available === true && sajuContext.day_master_relation && typeof sajuContext.day_master_relation === 'object' ? sajuContext.day_master_relation as Record<string, unknown> : {}
  const sajuRows = [['내가 상대를 대할 때',relation.user_to_counterpart_ten_god],['상대가 나를 대할 때',relation.counterpart_to_user_ten_god]].flatMap(([label,value])=>typeof value === 'string' && tenGodLens(value) ? [{label:String(label),value,lens:tenGodLens(value)!}] : [])

  const reunionInitiativeSummary = (() => {
    if (!reunion || !timing) return ''
    return '현재 상대측/내측 활성도만으로 누가 먼저 연락한다고 판정하지 않아. 실제 방향성 행동 근거가 서로 독립된 체계에서 확인될 때만 방향을 제시해.'
  })()

  const reunionDateHighlights = (() => {
    if (!reunion || !timing || hierarchy) return [] as Array<{date:string; labels:string[]; score:number}>
    const byDate = new Map<string,{date:string; labels:string[]; score:number}>()
    const sources = [
      { stat: timing.reconnection, label: '과거 인연 재접점' },
      { stat: timing.incoming, label: '상대측 활성' },
      { stat: timing.outgoing, label: '내측 활성' },
    ]
    for (const { stat, label } of sources) {
      for (const point of stat?.best_days?.slice(0, 5) ?? []) {
        if (point.date < timing.period.start || point.date > timing.period.end) continue
        const current = byDate.get(point.date)
        if (current) {
          if (!current.labels.includes(label)) current.labels.push(label)
          current.score = Math.max(current.score, point.score)
        } else {
          byDate.set(point.date, { date: point.date, labels: [label], score: point.score })
        }
      }
    }
    return [...byDate.values()]
      .sort((a,b)=>b.score-a.score || a.date.localeCompare(b.date))
      .slice(0,5)
      .sort((a,b)=>a.date.localeCompare(b.date))
  })()

  const reunionReturnSummary = (() => {
    if (!reunion || !returnSupport || typeof returnSupport !== 'object' || hierarchy) return null
    const support = returnSupport as any
    const rows = (value: unknown): any[] => Array.isArray(value) ? value : []
    const numberOrNull = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null
    const band = (score: number) => score >= 65 ? '강하게' : score >= 45 ? '보통 이상으로' : score >= 25 ? '가볍게' : '약하게'
    const monthLabel = (value: unknown) => {
      const raw = String(value ?? '')
      const match = /^(\d{4})-(\d{2})$/.exec(raw)
      return match ? `${match[1]}년 ${Number(match[2])}월` : raw
    }
    const periodStart = String(support?.period?.start ?? timing?.period.start ?? '')
    const activeSolar = (person: 'user'|'counterpart') => {
      const events = rows(support?.solar_return?.[person]?.events)
      if (!events.length) return null
      return events.find((event:any) => {
        const start = String(event?.window_start ?? '')
        const end = String(event?.window_end_exclusive ?? '')
        return !!periodStart && start <= periodStart && (!end || periodStart < end)
      }) ?? events[0]
    }
    const solarValues = [activeSolar('user'), activeSolar('counterpart')]
      .map((event:any) => numberOrNull(event?.activation_score))
      .filter((value): value is number => value !== null)
    const annualScore = solarValues.length ? solarValues.reduce((sum,value)=>sum+value,0) / solarValues.length : null
    const lunarRows = rows(support?.monthly_context)
      .map((row:any) => ({ month:String(row?.calendar_month ?? ''), score:numberOrNull(row?.lunar_return?.pair_activation_score) }))
      .filter((row:any) => row.month && row.score !== null && row.score > 0)
      .sort((a:any,b:any) => b.score-a.score || a.month.localeCompare(b.month))
    const topLunar = lunarRows.slice(0,2)
    const candidates = rows(support?.candidate_dates)
    const annualText = annualScore === null
      ? '연간 관계 배경은 계산 가능한 근거가 부족해서 별도 강도를 붙이지 않았어.'
      : `연간 관계 배경은 ${band(annualScore)} 활성돼 있어. 관계 문제를 다시 의식하거나 정리하는 분위기가 두드러질 수 있다는 뜻이지, 연락이나 재결합 확률을 뜻하지는 않아.`
    const monthlyText = topLunar.length
      ? `${topLunar.map((row:any)=>monthLabel(row.month)).join(' · ')}의 월간 배경이 상대적으로 도드라져. 감정과 관계 주제가 올라오기 쉬운 달이라는 뜻이고, 실제 연락·만남은 빠른 행동 트리거가 따로 겹쳐야 해.`
      : '월간 배경에서 따로 강조할 구간은 잡히지 않았어. 생시가 없으면 달 기반 월간 배경은 계산하지 않아.'
    return { annualScore, annualText, monthlyText, topLunar, candidateCount:candidates.length }
  })()

  const leadPattern = view.patterns[0] ?? view.friction[0]
  const leadFriction = view.friction[0]
  const firstWindow = reunion ? view.windows[0] : undefined
  const strength = view.strengths[0]
  const overview = reunion ? {
    title: '재회 흐름 전체 해설',
    conclusion: `${reunionInitiativeSummary} 재접점은 ${view.reconnection.band}으로 잡혀 있어. 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비는 따로 봐야 해. ${view.sustainabilityText}`,
    reason: leadPattern ? `${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` ${leadFriction.reason}` : ''}` : '재접촉 자체보다 현재 계산에서 확인되는 관계 패턴과 유지력을 함께 봐야 해.',
    practice: firstWindow ? `${firstWindow.date}의 ${firstWindow.label} 흐름은 ${firstWindow.detail} ${leadPattern?.action ?? '실제 연락이나 만남이 생긴다면 예전과 달라진 행동이 있는지 먼저 확인해.'}` : `${leadPattern?.action ?? '실제 연락이나 만남이 생긴다면 예전과 달라진 행동이 있는지 먼저 확인해.'} 날짜 신호가 약하면 시기를 억지로 특정하지 말고 실제 행동을 기준으로 봐.`,
    caution: leadFriction ? `${leadFriction.caution} 연락이 다시 닿았다는 사실만으로 재결합이나 관계 회복이 확정됐다고 읽지는 마.` : '연락이 다시 닿았다는 사실만으로 재결합이나 관계 회복이 확정됐다고 읽지는 마.',
  } : analysisMode === 'marriage_married' ? {
    title: '결혼생활 전체 해설',
    conclusion: `현재 관계는 누가 더 맞느냐보다, 애정과 생활 책임을 어떤 방식으로 나누고 회복하는지가 더 중요해. ${strength ? `강점으로는 ${strength}이 먼저 보여.` : '뚜렷한 강점 하나보다 여러 생활 축을 같이 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 반대로 ${leadFriction.conclusion}` : ''}` : '현재 계산에서 읽을 수 있는 접점이 제한적이라 한 가지 성향으로 부부 관계 전체를 단정하지 않을게.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 오래 함께했다는 사실과 지금 편안하게 유지되고 있다는 건 같은 뜻이 아니야.` : '갈등 접점이 적어도 생활 부담이 자동으로 사라지는 건 아니야. 말하지 않은 기대까지 합의된 것으로 보지는 마.',
  } : analysisMode === 'marriage_unmarried' ? {
    title: '결혼궁합 전체 해설',
    conclusion: `이 사람과 결혼을 생각한다면 끌림만 보지 말고, 대화·생활 방식·책임을 실제로 함께 감당할 수 있는지까지 봐야 해. ${strength ? `지금 계산에서는 ${strength}이 관계의 강점으로 보여.` : '한 가지 강점보다 여러 관계 축을 같이 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 동시에 ${leadFriction.conclusion}` : ''}` : '두 사람 사이에서 검증 가능한 접점만 남겨 읽고 있어서 특정 성격이나 미래를 억지로 채우지 않았어.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 호감과 결혼 결정은 다른 단계이니 생활 조건과 약속을 실제 대화로 확인해.` : '잘 맞는 접점이 보여도 생활비, 집안일, 가족 관계, 혼자 쉴 시간 같은 조건까지 자동으로 맞는다는 뜻은 아니야.',
  } : {
    title: '궁합 전체 해설',
    conclusion: `이 관계는 한 줄로 좋은 궁합·나쁜 궁합을 정하기보다, 자연스럽게 맞는 부분과 반복해서 조정해야 할 부분을 같이 보는 게 맞아. ${strength ? `가장 먼저 보이는 강점은 ${strength}이야.` : '뚜렷한 강점 하나보다 여러 접점을 함께 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 반면 ${leadFriction.conclusion}` : ''}` : '계산 가능한 접점만으로 관계의 특징을 읽고 있어. 상대의 속마음이나 관계 결과를 빈칸처럼 채우지는 않아.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 한 번의 강한 끌림이나 한 번의 갈등만으로 관계 전체를 판단하지 마.` : '강한 충돌 접점이 적더라도 모든 생활 방식이 맞는다는 뜻은 아니야. 실제 약속과 행동을 같이 확인해.',
  }

  const interpretation = (p: RelationshipPattern) => <article className="relationship-pattern" key={p.key}><h4>{p.title}</h4><p className="reading-conclusion">{p.conclusion}</p><ReadingExplanation kind="reason">{p.reason}</ReadingExplanation><ReadingExplanation kind="practice">{p.action}</ReadingExplanation>{p.challenging&&<ReadingExplanation kind="caution">{p.caution}</ReadingExplanation>}</article>
  const compactPatterns = (rows: RelationshipPattern[]) => <>{rows.slice(0,2).map(interpretation)}{rows.length>2&&<details className="reading-more"><summary>패턴 {rows.length-2}개 더 보기</summary>{rows.slice(2).map(interpretation)}</details>}</>

  const generatedCost = relationshipGenerationCost(ai)
  const reunionV2 = reunion && ai?.ok ? ai.data?.reunion_synthesis_v2 ?? null : null
  const reunionAi = reunion && ai?.ok && ai.data?.reunion_reading ? {
    bottom: firstSentences(ai.data.reunion_reading.bottom_line || ai.data.overview, 3),
    incoming: firstSentences(ai.data.reunion_reading.incoming_contact, 2),
    outgoing: firstSentences(ai.data.reunion_reading.outgoing_contact, 2),
    windows: firstSentences(ai.data.reunion_reading.reconnection_windows, 3),
    low: firstSentences(ai.data.reunion_reading.low_windows, 2),
    filter: firstSentences(ai.data.reunion_reading.relationship_filter, 2),
    precision: firstSentences(ai.data.reunion_reading.precision_note, 2),
  } : null

  const returnContextBlock = reunionReturnSummary ? <section className="reunion-ai-block reunion-return-context">
    <h4>연간·월간 배경</h4>
    <div className="reunion-return-context-grid">
      <article className="reunion-return-context-card"><b>연간 배경</b><p>{reunionReturnSummary.annualText}</p></article>
      <article className="reunion-return-context-card"><b>월간 배경</b><p>{reunionReturnSummary.monthlyText}</p></article>
    </div>
    <p className="reunion-return-rule">구체 날짜는 빠른 사건 트리거가 먼저 통과한 후보만 쓰고, 이 배경층은 후보 우선순위를 최대 15%만 조정해.</p>
    <details className="reunion-precision-note reunion-return-technical"><summary>왜 이렇게 봤어?</summary>
      <p>Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경으로만 계산해. 둘 다 연락 날짜를 새로 만들거나 누가 먼저 연락할지를 정하는 근거로 쓰지 않아.</p>
      {reunionReturnSummary.annualScore !== null && <p>연간 배경 활성값 {reunionReturnSummary.annualScore.toFixed(1)} · 사건 확률 아님</p>}
      {reunionReturnSummary.topLunar.length>0 && <p>월간 배경 상위: {reunionReturnSummary.topLunar.map((row:any)=>`${row.month} ${row.score.toFixed(1)}`).join(' · ')}</p>}
      <p>빠른 트리거 85% + Return 배경 최대 15% · 후보 날짜 {reunionReturnSummary.candidateCount}개 안에서만 순위를 보정해.</p>
    </details>
  </section> : null

  const dateFocus = reunionDateHighlights.length ? <div className="reunion-date-focus"><div className="reunion-date-focus-head"><strong>날짜로 좁혀 보면</strong><small>월 흐름 안에서 계산값이 특히 도드라지는 날</small></div><div className="reunion-date-focus-list">{reunionDateHighlights.map((row)=><article key={row.date}><time>{row.date}</time><b>{row.labels.join(' · ')}</b><span>{row.score>=60?'강함':row.score<40?'약함':'보통'}</span></article>)}</div><small>날짜 점수도 실제 연락·재회 확률이 아니라 선택 기간 안의 상대활성도 비교값이야.</small></div> : null

  return <section ref={exportRef} className="relationship-experience reading-experience" data-mode={analysisMode} data-reading-export-root="relationship">
    <header className="reading-hero"><span className="celestial-mark" aria-hidden="true"><Orbit size={26}/></span><p className="eyebrow">{view.title}</p><h3>{view.headline}</h3><p className="reading-hero-subtitle">{reunion ? '누가 먼저 움직이는지, 언제 접점이 생기는지, 연락 이후 관계가 버틸 수 있는지를 나눠서 봐.' : analysisMode === 'marriage_married' ? '이미 함께하는 생활 안에서 지킬 것과 조정할 것을 살펴봐.' : analysisMode === 'marriage_unmarried' ? '끌림뿐 아니라 함께 살아갈 때의 약속과 부담까지 살펴봐.' : '잘 맞는 부분과 서로 배워야 할 부분을 함께 읽어봐.'}</p>{view.timePrecisionNote&&<p className="reading-precision-note">{view.timePrecisionNote}</p>}</header>
    <div className="reading-export-toolbar" data-reading-export-ignore="true">
      <button type="button" onClick={saveResultImages} disabled={imageExporting} aria-busy={imageExporting}>
        {imageExporting ? <LoaderCircle className="reading-export-spinner" size={17} aria-hidden="true"/> : <ImageDown size={17} aria-hidden="true"/>}
        {imageExporting ? '이미지 만드는 중…' : '결과 이미지 저장'}
      </button>
      {!!imageExportStatus && <small role="status">{imageExportStatus}</small>}
    </div>

    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v211">
      <h3>지금부터의 재회 흐름</h3>
      {hierarchyData.validation?.status !== 'PASS' ? <p role="alert">계산 검증에 실패해 미래 후보와 해설을 보류했어.</p> : <>
        {hierarchyData.nearest_window ? <article className="relationship-pattern reunion-nearest-window">
          <h4>가장 가까운 활성창</h4>
          <b>{hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</b>
          <p>{reunionStageHuman(hierarchyData.nearest_window.stage, hierarchyData.nearest_window.label)}</p>
          <small>핵심 날짜 {hierarchyData.nearest_window.date} · 보조지표 활성도 {hierarchyData.nearest_window.final}</small>
        </article> : <p>오늘 이후 조회 기간에는 장기·중기·단기 조건을 모두 통과한 활성창이 없어.</p>}

        {typeof view.reconnection.score === 'number' && <section className="reunion-ai-block reunion-contact-indicators">
          <h4>연락 가능성 · 보조지표</h4>
          <div className="reunion-return-context-grid">
            <article className="reunion-return-context-card"><b>재접촉 활성도</b><strong>{view.reconnection.score}/100</strong><small>{view.reconnection.band}</small></article>
            {typeof view.incoming.score === 'number' && <article className="reunion-return-context-card"><b>상대측 반응 활성도</b><strong>{view.incoming.score}/100</strong><small>{view.incoming.band}</small></article>}
            {typeof view.outgoing.score === 'number' && <article className="reunion-return-context-card"><b>내측 연락 적합도</b><strong>{view.outgoing.score}/100</strong><small>{view.outgoing.band}</small></article>}
          </div>
          <p className="reunion-score-meaning">숫자는 같은 조회 기간 안에서 신호가 얼마나 활성돼 있는지 비교하는 보조지표야. 실제 연락 확률·재회 확률이나 누가 먼저 연락할 확률이 아니야.</p>
        </section>}

        {ai?.ok && ai.data && reunionV2 && <section className="reunion-human-narrative reunion-ai-block">
          <h4>지금 두 사람 사이에서 살아 있는 흐름</h4>
          <ReadableCopy className="reading-conclusion" text={reunionV2.summary}/>

          <h4>왜 다시 신경 쓰이거나 연결될 수 있나</h4>
          <ReadableCopy text={reunionV2.why_reconnect.conclusion}/>
          <ReadableCopy text={reunionV2.why_reconnect.interpretation}/>

          {!!reunionV2.timing?.conclusion && <><h4>지금 어디까지 와 있나</h4><ReadableCopy text={reunionV2.timing.conclusion}/></>}

          <h4>연락이 닿은 뒤, 재회까지는 뭐가 남나</h4>
          <ReadableCopy text={reunionV2.rebuild.conclusion}/>
          {reunionV2.rebuild.conditions.length>0 && <ul>{reunionV2.rebuild.conditions.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul>}

          {(reunionV2.repeat_risks.conclusion || reunionV2.repeat_risks.patterns.length>0) && <><h4>다시 멀어질 수 있는 지점</h4><ReadableCopy text={reunionV2.repeat_risks.conclusion}/>{reunionV2.repeat_risks.patterns.length>0 && <ul>{reunionV2.repeat_risks.patterns.slice(0,2).map((x,i)=><li key={i}>{x}</li>)}</ul>}</>}

          {reunionV2.convergence.length>0 && <><h4>여러 근거가 같이 가리키는 부분</h4>{reunionV2.convergence.slice(0,3).map((x,i)=><article className="reunion-narrative-convergence" key={i}><b>{x.theme}</b><ReadableCopy text={x.meaning}/></article>)}</>}
          {!!reunionV2.precision_note && <details className="reunion-precision-note"><summary>생시·정밀도에 따라 달라질 수 있는 부분</summary><ReadableCopy text={reunionV2.precision_note}/></details>}
        </section>}

        <div className="reunion-stage-status">
          <h4>다시 움직인다면 어떤 순서인가</h4>
          {Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stage.label}><b>{stage.label}</b> · {reunionStageHuman(stageKey, stage.label)} <small>{stage.activation === null ? '현재 기간에 공개할 미래 후보 없음' : `보조지표 · 활성도 ${stage.activation}`}</small></p>)}
        </div>
        <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 현재 계산으로는 판정 보류. 상대측/내측 활성도 비교값은 실제 행동 방향이 아니어서 선연락 근거로 쓰지 않아.</p>

        <h4>오늘 이후 후보 시기</h4>
        {hierarchyData.top_periods.map((w)=><article className="relationship-pattern reunion-future-window" key={`${w.start}:${w.stage}`}>
          <b>{w.start} ~ {w.end} · {w.label} 후보 창</b><p>{reunionStageHuman(w.stage, w.label)}</p><small>대표 날짜 {w.date} · 사건 확정일 아님 · 보조지표 활성도 {w.final}</small>
          <details><summary>왜 후보가 됐는지</summary><p>장기 배경과 중기 흐름이 먼저 겹친 뒤, 이 단계에 맞는 사건 촉발 신호까지 함께 통과했어.</p><small>기술값 · 장기 {w.components.long_term} · 중기 {w.components.mid_term} · 사건 촉발 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</small></details>
        </article>)}
        {!hierarchyData.top_periods.length && <p>오늘 이후 공개할 후보 시기가 없어.</p>}
      </>}
      <p className="reunion-score-meaning">{hierarchyData.score_meaning}</p>
      <details className="reading-more reunion-fixed-structure"><summary>고정 관계 구조 · 필요할 때만 보기</summary>
        <p>이 부분은 같은 두 사람이라면 매 계산에서 크게 달라지지 않는 출생차트·시너스트리 구조야. 새 시기 신호처럼 반복해서 강조하지 않아.</p>
        {reunionV2?.why_reconnect?.conclusion && <p>{firstSentences(reunionV2.why_reconnect.conclusion, 2)}</p>}
        {reunionV2?.rebuild?.conclusion && <p>{firstSentences(reunionV2.rebuild.conclusion, 2)}</p>}
        {reunionV2?.repeat_risks?.conclusion && <p>{firstSentences(reunionV2.repeat_risks.conclusion, 2)}</p>}
        {hierarchyData.stability_structure && <p>구조 근거: 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
      </details>
      <details className="reading-more reunion-past-audit"><summary>지난 활성기 · 사후검증용</summary>{hierarchyData.past_windows.length ? hierarchyData.past_windows.map((w)=><p key={`${w.start}:${w.stage}`}>{w.start} ~ {w.end} · {w.label} · {w.final}점</p>) : <p>분리해 표시할 지난 활성기가 없어.</p>}</details>
      <details className="reading-more"><summary>전문 근거·검증 범위</summary><p>Secondary Progression(세컨더리 프로그레션/2차 진행) · Solar Arc(솔라아크/태양호) · Transit(트랜짓·경과) · 다섯 행성 회귀 · 사주 절입</p><p>감정 활성 ≠ 연락 ≠ 만남 ≠ 재결합 ≠ 안정적 관계 유지</p>{hierarchyData.limitations.map(x=><p key={x}>{x}</p>)}{(hierarchyData.validation?.checks ?? []).filter((x)=>x.status!=='PASS').map((x)=><p key={x.name}>{x.name}: {x.status} — {x.detail}</p>)}</details>
    </section>}

    {ai?.ok && ai.data && (!reunion || !hierarchyData) ? <section className="reading-section relationship-natural-reading">
      <h3>{ai.data.headline}</h3>
      {reunion ? <ReadableCopy className="reading-conclusion" text={reunionV2?.summary || reunionAi?.bottom || ai.data.overview}/> : <p className="reading-conclusion">{analysisMode.startsWith('marriage_') ? ai.data.marriage_reading?.bottom_line || ai.data.overview : ai.data.overview}</p>}
      {!!generatedCost && <p className="ai-generated-cost">{generatedCost}</p>}
      {reunion && reunionV2 ? <>
        <section className="reunion-ai-block"><h4>다시 연결될 여지가 있는 이유</h4><ReadableCopy text={reunionV2.why_reconnect.conclusion}/><ReadableCopy text={reunionV2.why_reconnect.interpretation}/></section>
        {returnContextBlock}
        <section className="reunion-ai-snapshot"><h4>누가 먼저 움직일 흐름인가</h4><ReadableCopy className="reunion-initiative-summary" text={reunionV2.initiative.conclusion}/><ReadableCopy text={reunionV2.initiative.interpretation}/><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/><small>점수는 실제 연락 확률이 아니라 선택 기간 안의 상대활성도 비교값이야.</small></section>
        <section className="reunion-ai-block"><h4>접점이 강해지는 시기</h4><ReadableCopy text={reunionV2.timing.conclusion}/>{reunionV2.timing.windows.map((w,i)=><article className="reunion-v2-window" key={`${w.period}-${i}`}><b>{w.period}</b><ReadableCopy text={w.meaning}/></article>)}{dateFocus}</section>
        <section className="reunion-ai-block"><h4>다시 붙었을 때 관계 구조</h4><ReadableCopy text={reunionV2.rebuild.conclusion}/>{reunionV2.rebuild.conditions.length>0&&<ul>{reunionV2.rebuild.conditions.map((x,i)=><li key={i}>{x}</li>)}</ul>}</section>
        <section className="reunion-ai-block"><h4>다시 깨뜨릴 수 있는 반복 패턴</h4><ReadableCopy text={reunionV2.repeat_risks.conclusion}/>{reunionV2.repeat_risks.patterns.length>0&&<ul>{reunionV2.repeat_risks.patterns.map((x,i)=><li key={i}>{x}</li>)}</ul>}</section>
        {reunionV2.convergence.length>0&&<details className="reunion-precision-note"><summary>여러 차트가 함께 가리키는 수렴 근거</summary>{reunionV2.convergence.map((x,i)=><div key={i}><b>{x.theme}{x.period?` · ${x.period}`:''}</b><p>{x.meaning}</p></div>)}</details>}
        {!!reunionV2.precision_note&&<details className="reunion-precision-note"><summary>정밀도·제외 근거</summary><ReadableCopy text={reunionV2.precision_note}/></details>}
      </> : reunion && reunionAi ? <>
        <section className="reunion-ai-snapshot">
          <h4>누가 먼저 움직일 흐름인가</h4>
          <p className="reunion-initiative-summary">{reunionInitiativeSummary}</p>
          <ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/>
          <small>점수는 실제 연락 확률이 아니라 선택 기간 안의 상대활성도 비교값이야.</small>
        </section>
        <div className="reunion-ai-direction-copy">
          {!!reunionAi.incoming && <section><h4>상대 → 나</h4><p>{reunionAi.incoming}</p></section>}
          {!!reunionAi.outgoing && <section><h4>나 → 상대</h4><p>{reunionAi.outgoing}</p></section>}
        </div>
        {!!reunionAi.windows && <section className="reunion-ai-block"><h4>재접촉 시기</h4><ReadableCopy text={reunionAi.windows}/>{dateFocus}{!!reunionAi.low && <p className="reunion-low-window"><b>피할 구간</b>{reunionAi.low}</p>}</section>}
        {!!reunionAi.filter && <section className="reunion-ai-block"><h4>연락 이후 관계 유지력</h4><p>{reunionAi.filter}</p></section>}
        {!!reunionAi.precision && <details className="reunion-precision-note"><summary>정밀도·제외 근거</summary><p>{reunionAi.precision}</p></details>}
      </> : analysisMode.startsWith('marriage_') ? <><ReadingExplanation kind="reason">{[ai.data.marriage_reading?.bond,ai.data.marriage_reading?.emotional_home].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="practice">{[ai.data.marriage_reading?.daily_life,ai.data.marriage_reading?.intimacy_resources,ai.data.marriage_reading?.conflict_repair].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="timing">{[ai.data.marriage_reading?.commitment_or_current_cycle,ai.data.marriage_reading?.timing].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="caution">{[ai.data.marriage_reading?.caution,ai.data.marriage_reading?.precision_note].filter(Boolean).join(' ')}</ReadingExplanation></> : <><ReadingExplanation kind="reason">{[ai.data.chemistry,ai.data.emotional_dynamic,ai.data.communication].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="practice">{[ai.data.long_term,...(ai.data.practical_advice??[])].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="timing">{ai.data.timing}</ReadingExplanation><ReadingExplanation kind="caution">{[ai.data.conflict_pattern,ai.data.power_boundaries].filter(Boolean).join(' ')}</ReadingExplanation></>}
    </section> : <section className="reading-section relationship-natural-reading is-ready"><h3>Gemini 자연어 해설</h3><p>계산은 끝났어. 저장된 자연어 해설이 없으면 한 번 생성해. 생성한 해설은 다시 비용이 들지 않도록 저장해둘게.</p><p className="ai-preflight-cost">{relationshipAiCostPreview(analysisMode)}</p><button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={16}/>{aiLoading ? '관계 흐름을 정리하고 있어…' : '자연어 해설 생성'}</button>{aiError && <p className="reading-alert" role="status"><AlertTriangle size={16}/>{aiError}</p>}</section>}

    <details className="relationship-calculated-fallback" open={!(ai?.ok && ai.data)}><summary>계산 근거·보조 해설</summary>
      <section className="reading-section relationship-full-reading"><h3>{overview.title}</h3><p className="reading-conclusion">{overview.conclusion}</p><ReadingExplanation kind="reason">{overview.reason}</ReadingExplanation><ReadingExplanation kind="practice">{overview.practice}</ReadingExplanation><ReadingExplanation kind="caution">{overview.caution}</ReadingExplanation></section>
      {reunion ? <>
        <section className="reading-section"><h3>재접촉 흐름</h3><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/></section>
        {returnContextBlock}
        <section className="reading-section relationship-fallback-card"><div className="relationship-section-heading"><h3>{view.stabilityTitle}</h3><span className="relationship-section-meta"><ReadingBadge kind="rebuilding"/><span className="reading-state">{view.sustainability}</span></span></div><p className="relationship-section-copy">{view.sustainabilityText}</p></section>
        <section className="reading-section relationship-fallback-card"><h3>반복될 가능성이 높은 문제</h3>{view.friction.length ? compactPatterns(view.friction) : <p className="relationship-section-copy">반복 갈등을 뚜렷하게 짚을 접점이 부족해. 문제가 없다는 뜻은 아니야.</p>}</section>
        <section className="reading-section"><h3>주요 시기</h3>{view.windows.length ? <ReadingTimeline events={view.windows.map(w=>({date:w.date,kind:w.kind,label:w.label,status:w.status,detail:w.detail}))}/> : <p>다른 날과 구별할 만큼 뚜렷한 시기는 없어.</p>}</section>
        {!!view.patterns.length && <section className="reading-section"><h3>관계의 핵심 패턴</h3>{compactPatterns(view.patterns)}</section>}
      </> : <>
        <div className="relationship-balance"><section><h3>{view.strengthsTitle}</h3>{view.strengths.length ? <ul>{view.strengths.slice(0, 2).map(p => <li key={p}>{p}</li>)}</ul> : <p>뚜렷하게 잘 맞는 접점은 적어.</p>}</section><section><h3>{view.frictionTitle}</h3>{view.friction.length ? <ul>{view.friction.map(p => <li key={p.key}>{p.title}</li>)}</ul> : <p>강한 충돌 접점은 적지만, 문제가 없다는 뜻은 아니야.</p>}</section></div>
        {view.sections.filter(s => s.rows.length || s.empty).map((s,index) => index<2 ? <section className="reading-section" key={s.id}><h3>{s.title}</h3>{s.rows.length ? s.rows.map(interpretation) : <p className="reading-muted">{s.empty}</p>}</section> : <details className="reading-more reading-pattern-section" key={s.id}><summary>{s.title}<small>{s.rows[0]?.title ?? '읽을 수 있는 범위'}</small></summary>{s.rows.length?s.rows.map(interpretation):<p className="reading-muted">{s.empty}</p>}</details>)}
        <section className="reading-section"><h3>{view.stabilityTitle}<ReadingBadge kind="rebuilding"/><span className="reading-state">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>
        <section className="reading-section"><h3>{view.practicalTitle}</h3><ReadingExplanation kind="practice">{view.practical}</ReadingExplanation></section>
      </>}
      {!!sajuRows.length&&<section className="system-saju system-lens relationship-saju-context"><h3>{reunion ? '사주에서 읽는 재회 맥락' : '사주에서 읽는 관계 맥락'}</h3>{sajuRows.map(r=>{const copy=reunion ? reunionSajuCopy(r.value,r.lens,r.label) : {title:`${r.label} · ${r.value}`,meaning:r.lens.meaning,action:r.lens.action};return <article className="relationship-saju-row" key={r.label}><h4>{copy.title}</h4><p>{copy.meaning}</p><p className="relationship-saju-action">{copy.action}</p></article>})}<p className="reading-muted">두 일간의 관계를 읽는 별도 층이야. 서양점성 점수와 합산하거나 상대의 감정을 확정하지 않아.</p></section>}
    </details>

    <p className="reading-safety-note">{partnerExact ? '계산된 관계 패턴이야. 실제 감정이나 관계의 결과를 확정하지 않아.' : '입력한 생시는 달·진행층·사주 시주 같은 잠정 계산에 활용하고, exact 검증이 필요한 요소는 정확한 값처럼 승격하지 않아. 실제 감정이나 관계의 결과를 확정하지 않아.'}</p>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>{technicalDetails}<div className="technical-aspects"><h4>관계 접점 원자료</h4>{view.ranked.map((a, i) => <p key={i}>{formatAspect(a)} · orb {a.orb.toFixed(2)}°</p>)}</div>{ai?.ok && ai.data && <div className="technical-ai"><h4>추가 해설 원문</h4><pre>{JSON.stringify(ai.data, null, 2)}</pre><h4>생성 정보</h4><pre>{JSON.stringify(ai.usage ?? {}, null, 2)}</pre></div>}</details>
  </section>
}
