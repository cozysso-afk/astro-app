import type { Aspect, RelationshipAiResponse, ReunionObservationContext } from './appTypes'
import { ReadingTimeline, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy } from './lib/reunionHierarchy'
import { polishKoreanSentence } from './lib/fortuneNarrativePolish'
import { compareObservedEvents } from './lib/reunionObservation'
import { buildReunionReadingV4 } from './lib/reunionReadingV4'

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>

const STAGE_LABEL: Record<string,string> = {
  emotional_reactivation: '서로를 다시 의식하는 배경',
  contact_recontact: '연락·대화 재개',
  in_person_meeting: '실제 만남',
  relationship_rebuilding: '관계 재구축',
}

const TECHNICAL_RE = /(?:태양|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|노드|하우스|트랜짓|프로그레스|컴포지트|시너스트리|삼분|사분|육합|육파|오브|\d+도각|사주\s*(?:일지|월지|시주)|[甲乙丙丁戊己庚辛壬癸寅卯辰巳午未申酉戌亥子丑])/i

function sentenceList(value?: string | null) {
  const clean = polishKoreanSentence(String(value ?? '')).trim()
  if (!clean) return []
  return clean
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
}

function readerSentences(value?: string | null, limit = 2) {
  const rows = sentenceList(value)
  const plain = rows.filter(row => !TECHNICAL_RE.test(row))
  return plain.slice(0, limit).join(' ')
}

function rowScore(row?: DirectionRow) {
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
}

function evidenceLabel(row: Aspect) {
  const a = String(row.a ?? '')
  const b = String(row.b ?? '')
  const aspect = String(row.aspect ?? '')
  const orb = typeof row.orb === 'number' && Number.isFinite(row.orb) ? (row.orb < 0.01 ? '<0.01°' : `${row.orb.toFixed(2)}°`) : '오차 정보 없음'
  return [a,aspect,b,orb].filter(Boolean).join(' · ')
}

export function ReunionHierarchyPanel({ hierarchyData, historyHierarchyData, historyCalculated=false, observation={state:'',initiator:'',events:[]}, evidence, reunionV2, directionRows, sustainabilityText }: {
  hierarchyData: ReunionHierarchy
  historyHierarchyData?: ReunionHierarchy | null
  historyCalculated?: boolean
  observation?: ReunionObservationContext
  evidence: Aspect[]
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const readingV4 = buildReunionReadingV4({
    hierarchy: hierarchyData,
    observation,
    directionRows,
    hasSustainabilityEvidence: Boolean(sustainabilityText.trim()),
  })
  const stageRows = [
    {key:'emotional_reactivation',label:'다시 의식하기'},
    {key:'contact_recontact',label:'연락·대화'},
    {key:'in_person_meeting',label:'실제 만남'},
    {key:'relationship_rebuilding',label:'관계 재구축'},
  ]
  const consultation = reunionV2?.consultation_answer
  const hasObservedState = Boolean(observation.state)
  const aiStage = readerSentences(consultation?.current_stage, 2)
  const aiSummary = readerSentences(reunionV2?.summary, 4)
  const aiCheckpoint = readerSentences(consultation?.next_stage_up_conditions?.[0], 2)
  const aiReason = readerSentences(reunionV2?.why_reconnect?.conclusion, 2)
  const aiRises = (consultation?.next_stage_up_conditions ?? []).map(value=>readerSentences(value,2)).filter(Boolean).slice(0,2)
  const aiFalls = (consultation?.down_conditions ?? []).map(value=>readerSentences(value,2)).filter(Boolean).slice(0,2)
  const rawWhy = reunionV2?.why_reconnect
    ? `${reunionV2.why_reconnect.conclusion ?? ''} ${reunionV2.why_reconnect.interpretation ?? ''}`.trim()
    : ''
  const evidenceRows = [...evidence].filter(row => Number.isFinite(Number(row.orb))).sort((a,b) => Number(a.orb) - Number(b.orb)).slice(0, 6)
  const historyRows = historyHierarchyData?.past_windows ?? []
  const comparisons = compareObservedEvents(observation, historyHierarchyData ?? null, historyCalculated)
  const safeNarrative = (value?: string | null) => sentenceList(value)
    .filter(row => !TECHNICAL_RE.test(row) && !/관문|후보|TOP|완전히 닫|통과 점수|활성도|검증|3일 이상/.test(row))
    .slice(0, 2).join(' ')
  const hasAwarenessEvidence = hierarchyData.current_windows.some(row=>row.stage==='emotional_reactivation')
    || hierarchyData.top_periods.some(row=>row.stage==='emotional_reactivation')
  const whyFallback = hasAwarenessEvidence ? '예전 대화나 감정이 다시 떠오르기 쉬운 배경은 있어요. 다만 생각이 나는 것과 실제 연락·만남은 다른 단계예요.' : ''
  const whyNarrative = readerSentences(rawWhy, 4) || safeNarrative(whyFallback)
  const rebuildNarrative = readerSentences(`${consultation?.meeting_gate ?? ''} ${consultation?.rebuild_gate ?? ''} ${reunionV2?.rebuild?.conclusion ?? ''}`, 4)
  const riskNarrative = readerSentences(`${reunionV2?.repeat_risks?.conclusion ?? ''} ${(reunionV2?.repeat_risks?.patterns ?? []).join(' ')}`, 3)
  const sustainabilityNarrative = readerSentences(sustainabilityText, 2)
  const currentAxisKey = [...readingV4.axes].reverse().find(row => row.state === 'observed')?.key
    ?? readingV4.axes.find(row => row.state === 'current_signal')?.key
  return <section className="reading-section reunion-hierarchy reunion-ui-v5">
    {!valid ? <p role="alert">계산 확인이 필요해요. 다시 계산한 뒤 결과를 확인해 주세요.</p> : <>
      <section className="reunion-v5-answer">
        <div className="reunion-v4-answer-meta"><span>현재 판정</span><time>기준일 {hierarchyData.as_of_date}</time></div>
        {!hasObservedState ? <>
          <h3>현재 관계 상태를 먼저 입력해 주세요</h3>
          <p className="reunion-v4-answer-copy">현재 상태를 입력하면 계산 결과와 실제 관계 단계를 구분해서 해설해 드려요.</p>
        </> : aiSummary ? <>
          <h3>{aiStage || '재회운 해설'}</h3>
          <p className="reunion-v4-answer-copy">{aiSummary}</p>
          {aiCheckpoint ? <p className="reunion-v4-next-checkpoint"><b>다음 확인점</b>{aiCheckpoint}</p> : null}
          {aiReason ? <div className="reunion-v4-verdict-points"><p><b>판정 이유</b>{aiReason}</p></div> : null}
        </> : <>
          <h3>자연어 해설을 불러오지 못했어요</h3>
          <p className="reunion-v4-answer-copy">계산 단계는 아래에서 확인할 수 있어요. 해설은 다시 생성해 주세요.</p>
        </>}
      </section>
      <section className="reunion-v5-section reunion-v4-stage-section">
        <h4>관계가 어디까지 왔는지</h4>
        <ol className="reunion-v4-stage-rail" aria-label="재회 6단계 진행표">
          {readingV4.axes.map(row => <li key={row.key} data-stage-state={row.state} aria-current={row.key === currentAxisKey ? 'step' : undefined}>
            <span>{row.label}</span><strong>{row.status}</strong>
          </li>)}
        </ol>
      </section>
      {readingV4.futureWindows.length > 0 ? <section className="reunion-v5-section reunion-v4-future-windows">
        <h4>앞으로 주목할 시기</h4>
        <ReadingTimeline events={readingV4.futureWindows.map(row=>({date:row.date,kind:row.stage==='relationship_rebuilding'?'rebuilding':row.stage==='contact_recontact'?'incoming':'reconnection',label:row.label,status:'주목'}))} context={{now:new Date(hierarchyData.as_of_date+'T12:00:00+09:00')}}/>
      </section> : null}
      <section className="reunion-v5-section reunion-v4-directions-section">
        <h4>연락 방향 참고값</h4>
        <div className="reunion-v5-directions">
          {readingV4.directions.map(row=><article key={row.key}><div className="reunion-v4-direction-head"><b>{row.label}</b><strong>{row.metric}</strong></div><p>{row.meaning}</p></article>)}
        </div>
        {readingV4.observedInitiator ? <p className="reunion-v5-note"><b>실제 첫 연락</b> · {readingV4.observedInitiator}</p> : null}
        <p className="reunion-v5-direction-summary">수신·발신 값은 연락 방향을 비교한 참고값이며, 실제 첫 연락자는 별도 기록으로 확인해요.</p>
      </section>
      {hasObservedState && (aiRises.length || aiFalls.length) ? <section className="reunion-v5-section reunion-v4-next-step">
        <h4>다음 단계로 넘어가는 변화</h4>
        <div className="reunion-v5-conditions">
          {aiRises.length ? <article><b>다음 단계로 보는 변화</b><ul>{aiRises.map((item,index)=><li key={index}>{item}</li>)}</ul></article> : null}
          {aiFalls.length ? <article><b>현재 단계에 머무는 신호</b><ul>{aiFalls.map((item,index)=><li key={index}>{item}</li>)}</ul></article> : null}
        </div>
      </section> : null}
      <section className="reunion-v4-disclosures" aria-label="재회 상세 자료">
      {reunionV2 && hasObservedState ? <details className="reunion-v5-section reunion-v4-context">
        <summary>관계 배경과 반복 위험 더 보기</summary>
        <div className="reunion-v5-meaning-grid">
          {whyNarrative ? <article className="reunion-v5-meaning-card"><b>왜 다시 연결됐나</b><p>{whyNarrative}</p></article> : null}
          {rebuildNarrative ? <article className="reunion-v5-meaning-card"><b>재회로 넘어가려면</b><p>{rebuildNarrative}</p></article> : null}
          {sustainabilityNarrative ? <article className="reunion-v5-meaning-card"><b>다시 만났을 때의 유지력</b><p>{sustainabilityNarrative}</p></article> : null}
          {riskNarrative ? <article className="reunion-v5-meaning-card"><b>다시 깨질 수 있는 지점</b><p>{riskNarrative}</p></article> : null}
        </div>
      </details> : null}
      <details className="reunion-v5-details"><summary>지난 시기와 실제 기록 비교</summary>
        <p>이미 지난 날짜의 비교 자료예요. 예측 적중률을 뜻하지 않아요.</p>
        {!historyCalculated ? <p>과거 분석을 실행하면 기록과 비교할 수 있어요.</p> : null}
        {historyCalculated && historyRows.length === 0 ? <p>선택한 과거 기간을 계산했지만 비교할 시기 신호를 찾지 못했어요.</p> : null}
        {historyRows.map((row,index)=><p key={index}><time>{row.start} ~ {row.end}</time> · {STAGE_LABEL[row.stage] ?? row.label}</p>)}
        {comparisons.map(row=><p key={row.kind+row.date}>{row.label} · {row.date}: {row.detail}</p>)}
      </details>
      <details className="reunion-v5-details"><summary>계산 근거와 점수 보기</summary>
        <p>점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요.</p>
        {stageRows.map(row=><p key={row.key}>{row.label}: {hierarchyData.stages[row.key]?.activation == null ? '점수 없음' : Math.round(hierarchyData.stages[row.key].activation!)}</p>)}
        {directionRows.filter(row=>row.kind!=='reconnection').map(row=><p key={row.kind}>{row.kind==='incoming'?'상대 차트':'내 차트'} 활성도: {rowScore(row) ?? '정보 없음'}</p>)}
        <p>차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요.</p>
        {evidenceRows.map((row,index)=><p key={index}>{evidenceLabel(row)} <small>· 각도 오차</small></p>)}
      </details>
      </section>
    </>}
  </section>
}
