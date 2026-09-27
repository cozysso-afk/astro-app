import type { Aspect, RelationshipAiResponse } from './appTypes'
import { ReadingDirections, ReadingTimeline, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './lib/reunionHierarchy'
import { distinctNarrativeParts, polishKoreanSentence } from './lib/fortuneNarrativePolish'

const STAGE_ORDER = [
  ['emotional_reactivation', '다시 의식하는 흐름'],
  ['contact_recontact', '연락 흐름'],
  ['in_person_meeting', '실제 만남'],
  ['relationship_rebuilding', '관계 회복'],
] as const

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>
type ContactSignalBand = '낮음' | '보통' | '높음'
type ScoredDirectionRow = DirectionRow & { score?: number }
type InitiativeLabel = '상대 쪽 우세' | '상대 쪽 약우세' | '나 쪽 우세' | '나 쪽 약우세' | '비슷함' | '판정 보류'

const PLANET_LABEL: Record<string,string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', Node:'교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const ASPECT_LABEL: Record<string,string> = {
  conjunction:'합', opposition:'대립', square:'사각', trine:'삼각', sextile:'육합', quincunx:'150도 조정각',
}

const MAIN_TECHNICAL_RE = /(?:\bsecondary\b|\b(?:emotional_reactivation|contact_recontact|in_person_meeting|relationship_rebuilding|initiative_gate)\b|오브|\d+(?:\.\d+)?\s*°|트랜짓|컴포지트|시너스트리|육십분위|대립각|사각(?:각)?(?!지대)|삼각(?:각)?(?!관계)|육파|활성도\s*\d|상대측\s*활성|내측\s*활성|재접점\s*활성|보조지표)/i
const READER_SCENE_START_RE = /(?:예전|과거|근황|궁금|정서|감정|연락|메시지|답장|대화|약속|만남|다시|행동|갈등|책임|합의|유지|회복|재회|관계가|관계를|관계에서|관계는)/g
const RELATIVE_DIRECTION_MARGIN = 5
const CLEAR_DIRECTION_MARGIN = 10

function Copy({ value }: { value?: string | null }) {
  const text = polishKoreanSentence(String(value ?? ''))
  return text ? <p>{text}</p> : null
}

function splitSentences(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text) return []
  return text.replace(/([.!?])\s+/g, '$1\n').split('\n').map(row => row.trim()).filter(Boolean)
}

function plainReaderSentence(sentence: string) {
  if (!MAIN_TECHNICAL_RE.test(sentence)) return sentence
  for (const match of sentence.matchAll(READER_SCENE_START_RE)) {
    const index = match.index ?? -1
    if (index < 0) continue
    const candidate = sentence.slice(index).trim()
    if (candidate.length >= 10 && !MAIN_TECHNICAL_RE.test(candidate)) return candidate
  }
  return ''
}

function normalizeReaderLanguage(value?: string | null) {
  return String(value ?? '')
    .replace(/\((?:emotional_reactivation|contact_recontact|in_person_meeting|relationship_rebuilding|initiative_gate)\)/g, '')
    .replace(/\bemotional_reactivation\b/g, '다시 의식하는 흐름')
    .replace(/\bcontact_recontact\b/g, '연락 흐름')
    .replace(/\bin_person_meeting\b/g, '실제 만남')
    .replace(/\brelationship_rebuilding\b/g, '관계 회복')
    .replace(/\binitiative_gate\b/g, '선연락 방향 근거')
    .replace(/용수자리/g, '진북교점')
    .replace(/감정 활성(?:화)?/g, '과거 관계를 다시 떠올리는 흐름')
    .replace(/연락·재접촉(?: 단계| 창)?/g, '연락 흐름')
    .replace(/재접촉/g, '연락·대화 재개')
    .replace(/관계 재구축 단계/g, '관계를 다시 이어 가는 흐름')
    .replace(/현재 열림/g, '현재 관련 시기 안에 있음')
    .replace(/현재 조회 시점 기준으로\s*/g, '지금 ')
    .replace(/가장 먼저 활성화되는 단계는/g, '가장 먼저 확인할 단계는')
    .replace(/국소\s*피크(?:\s*구간)?|피크\s*구간/g, '두드러지는 시기')
    .replace(/유효 후보/g, '살펴볼 시기')
    .replace(/실제 대면 만남|오프라인 대면/g, '실제 만남')
    .replace(/관계 재정의/g, '관계 회복')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function readerText(value?: string | null, fallback='') {
  const normalized = normalizeReaderLanguage(value)
  if (!normalized) return fallback
  const plain = splitSentences(normalized).map(plainReaderSentence).filter(Boolean)
  return distinctNarrativeParts(plain, 3).join(' ') || fallback
}

function stageDisplayLabel(stage: string, fallback='관계 흐름') {
  return STAGE_ORDER.find(([key]) => key === stage)?.[1] ?? normalizeReaderLanguage(fallback)
}

function stageRows(hierarchyData: ReunionHierarchy) {
  return STAGE_ORDER.map(([stage,label]) => ({
    stage,
    label,
    current: hierarchyData.current_windows.some(row => row.stage === stage),
    future: hierarchyData.top_periods.filter(row => row.stage === stage),
  }))
}

function stageSummary(rows: ReturnType<typeof stageRows>) {
  return rows.map(row => row.current
    ? `${row.label}: 기준일이 관련 시기 안에 있음`
    : row.future.length
      ? `${row.label}: 앞으로 살펴볼 시기 ${row.future.length}개`
      : `${row.label}: 현재 조회 범위에서는 뚜렷한 시기 없음`).join(' · ')
}

function phaseVerdict(hierarchyData: ReunionHierarchy) {
  const current = new Set(hierarchyData.current_windows.map(row => row.stage))
  const future = new Set(hierarchyData.top_periods.map(row => row.stage))
  const hasAny = (stage:string) => current.has(stage) || future.has(stage)
  if (current.has('relationship_rebuilding')) return '지금은 관계를 다시 이어 갈 행동과 합의가 붙는지를 볼 단계야. 이전에 끊겼던 문제를 실제로 다르게 다루는지가 핵심이야.'
  if (current.has('in_person_meeting')) return '지금은 연락 횟수보다 실제 약속과 만남이 잡히는지가 더 중요해. 만남 뒤 관계 이야기를 피하지 않는지도 함께 봐.'
  if (current.has('contact_recontact')) return hasAny('in_person_meeting') || hasAny('relationship_rebuilding')
    ? '지금은 연락이나 대화 재개를 살펴볼 시기야. 연락이 생긴 뒤 실제 만남과 관계 회복 단계는 따로 확인해.'
    : '지금은 연락이나 대화 재개를 살펴볼 시기지만, 현재 조회 범위에서는 실제 만남이나 관계 회복 단계까지는 뚜렷하지 않아.'
  if (current.has('emotional_reactivation')) return hasAny('contact_recontact')
    ? '지금은 과거 관계를 다시 떠올리기 쉬운 배경이 먼저 보여. 앞으로 연락 여부를 살펴볼 시기는 별도로 잡혀 있어.'
    : '지금은 과거 관계를 다시 떠올리기 쉬운 배경이 먼저 보여. 현재 조회 범위에서는 연락 단계까지는 뚜렷하지 않아.'
  return '현재 기준일에는 연락·만남·관계 회복 중 뚜렷하게 열린 단계가 없어. 앞으로 잡힌 시기가 있다면 그 구간과 실제 행동을 따로 확인해.'
}

function directionRow(directionRows: DirectionRow[], kind: 'incoming'|'outgoing') {
  return directionRows.find(row => row.kind === kind) as ScoredDirectionRow | undefined
}
function directionScore(row?: ScoredDirectionRow) {
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
}
function directionRank(row?: DirectionRow) {
  if (row?.band === '강함') return 3
  if (row?.band === '보통') return 2
  if (row?.band === '약함') return 1
  return 0
}
function hasContactWindow(hierarchyData: ReunionHierarchy) {
  return hierarchyData.current_windows.some(row => row.stage === 'contact_recontact') || hierarchyData.top_periods.some(row => row.stage === 'contact_recontact')
}
function bothDirectionsWeak(directionRows: DirectionRow[]) {
  const incoming = directionRow(directionRows, 'incoming')
  const outgoing = directionRow(directionRows, 'outgoing')
  const incomingScore = directionScore(incoming)
  const outgoingScore = directionScore(outgoing)
  if (incomingScore != null && outgoingScore != null) return incomingScore < 40 && outgoingScore < 40
  return incoming?.band === '약함' && outgoing?.band === '약함'
}

function contactSignalBand(hierarchyData: ReunionHierarchy, directionRows: DirectionRow[]): ContactSignalBand {
  if (!hasContactWindow(hierarchyData)) return '낮음'
  const incoming = directionRow(directionRows, 'incoming')
  const outgoing = directionRow(directionRows, 'outgoing')
  const maxDirectionScore = Math.max(directionScore(incoming) ?? -Infinity, directionScore(outgoing) ?? -Infinity)
  const activation = hierarchyData.stages?.contact_recontact?.activation
  if (bothDirectionsWeak(directionRows)) return '낮음'
  if (typeof activation === 'number' && activation >= 60 && maxDirectionScore >= 60) return '높음'
  if (maxDirectionScore >= 40 || directionRank(incoming) >= 2 || directionRank(outgoing) >= 2) return '보통'
  return '낮음'
}

function contactOutlook(hierarchyData: ReunionHierarchy, signalBand: ContactSignalBand, directionRows: DirectionRow[]) {
  const current = hierarchyData.current_windows.some(row => row.stage === 'contact_recontact')
  const future = hierarchyData.top_periods.filter(row => row.stage === 'contact_recontact')
  const weak = bothDirectionsWeak(directionRows)
  if (!current && !future.length) return `연락 흐름은 ${signalBand}이야. 현재 조회 범위에서는 연락이나 대화 재개를 따로 강조할 시기가 없어.`
  const direction = weak
    ? '상대 → 나와 나 → 상대가 모두 약해서, 시기 신호가 있어도 연락 쪽 근거는 약하게 읽어.'
    : `연락 흐름은 ${signalBand}으로 잡혀 있어.`
  if (current) return `${direction} 지금은 실제 연락이나 대화 재개가 생기는지를 확인할 구간이야.`
  return `${direction} 가장 먼저 볼 구간은 ${future[0].start}~${future[0].end}이야.`
}

function initiativeOutlook(hierarchyData: ReunionHierarchy, directionRows: DirectionRow[]) {
  if (!hasContactWindow(hierarchyData)) return { label:'판정 보류' as InitiativeLabel, text:'연락을 살펴볼 시기가 열리지 않아 선연락 방향도 따로 정하지 않아.' }
  const incoming = directionRow(directionRows, 'incoming')
  const outgoing = directionRow(directionRows, 'outgoing')
  const incomingScore = directionScore(incoming)
  const outgoingScore = directionScore(outgoing)
  if (incomingScore != null && outgoingScore != null) {
    const diff = incomingScore - outgoingScore
    const gap = Math.abs(diff)
    if (gap < RELATIVE_DIRECTION_MARGIN) return { label:'비슷함' as InitiativeLabel, text:'두 방향의 차이가 작아서 어느 쪽이 먼저라고 읽기 어려워.' }
    const incomingLeads = diff > 0
    const bothWeak = incomingScore < 40 && outgoingScore < 40
    const clear = gap >= CLEAR_DIRECTION_MARGIN && !bothWeak
    const label: InitiativeLabel = incomingLeads ? (clear ? '상대 쪽 우세' : '상대 쪽 약우세') : (clear ? '나 쪽 우세' : '나 쪽 약우세')
    const actor = incomingLeads ? '상대 쪽' : '내 쪽'
    return { label, text: bothWeak ? `두 방향 모두 약하지만 상대 비교에서는 ${actor}이 조금 앞서.` : `${actor}이 반대 방향보다 상대적으로 더 강해.` }
  }
  if (directionRank(incoming) !== directionRank(outgoing) && directionRank(incoming) > 0 && directionRank(outgoing) > 0) {
    const incomingLeads = directionRank(incoming) > directionRank(outgoing)
    return { label: incomingLeads ? '상대 쪽 약우세' : '나 쪽 약우세', text:`${incomingLeads ? '상대 쪽' : '내 쪽'}이 한 단계 더 강하게 잡혀 있어.` }
  }
  return { label:'판정 보류' as InitiativeLabel, text:'두 방향을 비교할 계산값이 충분하지 않아 한쪽을 먼저라고 만들지 않아.' }
}

function changeOutlook(hierarchyData: ReunionHierarchy) {
  const all = new Set([...hierarchyData.current_windows, ...hierarchyData.top_periods].map(row => row.stage))
  if (all.has('relationship_rebuilding')) return { label:'비교적 있음', text:'연락 이후 관계를 다시 운영하는 단계까지 잡혀 있어. 실제 변화는 불편한 문제를 피하지 않는지, 약속을 잡고 지키는지, 말과 행동이 이어지는지로 확인해.' }
  if (all.has('in_person_meeting')) return { label:'일부 있음', text:'연락이 실제 만남으로 넘어갈 여지는 보여. 만남 뒤에도 책임 있는 대화와 행동이 이어지는지를 봐.' }
  if (all.has('contact_recontact')) return { label:'아직 약함', text:'현재 계산은 연락 단계까지야. 연락이 생기면 안부·추억만 반복하는지, 구체적인 만남·사과·조율 같은 새 행동이 붙는지를 비교해.' }
  if (all.has('emotional_reactivation')) return { label:'약함', text:'과거 관계를 다시 떠올리는 배경이 행동 변화보다 앞서 있어. 생각이 많아지는 것만으로 달라진 행동을 판단하지 않아.' }
  return { label:'근거 부족', text:'현재 조회 범위에서는 달라진 행동까지 판단할 단계가 없어. 실제 연락 뒤 약속과 갈등 대처가 달라지는지를 확인해야 해.' }
}

function timingFallback(rows: ReunionPeriod[]) {
  if (!rows.length) return '현재 이후에 따로 강조할 만한 시기가 없어.'
  const firstByStage = new Map<string, ReunionPeriod>()
  for (const row of [...rows].sort((a,b) => a.date.localeCompare(b.date))) if (!firstByStage.has(row.stage)) firstByStage.set(row.stage,row)
  return [...firstByStage.values()].map(row => `${stageDisplayLabel(row.stage)}: ${row.start}~${row.end}`).join(' · ')
}

function directionCopy(row: DirectionRow) {
  const band = row.band ?? '정보 부족'
  if (row.kind === 'incoming') return `상대 → 나 방향은 ${band}.`
  if (row.kind === 'outgoing') return `나 → 상대 방향은 ${band}.`
  return `과거 인연 재접점은 ${band}.`
}

function evidenceLabel(row: Aspect) {
  const a = PLANET_LABEL[row.a] ?? row.a
  const b = PLANET_LABEL[row.b] ?? row.b
  const aspect = ASPECT_LABEL[row.aspect] ?? row.aspect
  const orb = Number.isFinite(Number(row.orb)) ? `${Number(row.orb).toFixed(2)}°` : '—'
  return `${a} ${aspect} ${b} · 오브 ${orb}`
}
function topEvidence(evidence: Aspect[], limit=8) {
  return [...evidence].filter(row => Number.isFinite(Number(row.orb))).sort((a,b) => Number(a.orb)-Number(b.orb)).slice(0,limit)
}
function dedupeTimingWindows(windows: ReunionSynthesis['timing']['windows']) {
  const seen = new Set<string>()
  return windows.map(window => ({ ...window, meaning:readerText(window.meaning, '이 시기의 실제 연락·만남 변화를 확인해.') })).filter(window => {
    const fingerprint = window.meaning.replace(/\d{4}-\d{2}-\d{2}/g,'#').replace(/[\s·,.!?~→-]+/g,'').toLowerCase()
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

export function ReunionHierarchyPanel({ hierarchyData, evidence, reunionV2, directionRows, sustainabilityText }: {
  hierarchyData: ReunionHierarchy
  evidence: Aspect[]
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const rows = stageRows(hierarchyData)
  const neutralDirectionRows = directionRows.map(row => ({ ...row, text:directionCopy(row) }))
  const contactSignal = contactSignalBand(hierarchyData, directionRows)
  const contact = contactOutlook(hierarchyData, contactSignal, directionRows)
  const initiative = initiativeOutlook(hierarchyData, directionRows)
  const change = changeOutlook(hierarchyData)
  const why = readerText(
    reunionV2?.why_reconnect ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}` : '',
    '과거 관계가 다시 떠오르는 배경과 실제 연락은 다른 단계야. 생각이 많아져도 행동이 생기는지는 따로 확인해.',
  )
  const timing = readerText(reunionV2?.timing?.conclusion, timingFallback(hierarchyData.top_periods))
  const rebuild = readerText(reunionV2?.rebuild?.conclusion, `연락 뒤에는 실제 만남, 이전 문제를 다르게 다루는 대화, 지속 행동이 붙는지를 봐. ${sustainabilityText}`)
  const repeat = readerText(reunionV2?.repeat_risks?.conclusion, '만남을 계속 미루거나 관계 이야기를 피하고 예전과 같은 지점에서 대화가 끊기면, 연락이 다시 닿아도 관계 회복까지 이어지기 어려워.')
  const summary = phaseVerdict(hierarchyData)
  const timingWindows = reunionV2?.timing?.windows?.length ? dedupeTimingWindows(reunionV2.timing.windows) : []
  const conditions = distinctNarrativeParts((reunionV2?.rebuild?.conditions ?? []).map(item => readerText(item)), 3)
  const patterns = distinctNarrativeParts((reunionV2?.repeat_risks?.patterns ?? []).map(item => readerText(item)), 2)
  const evidenceRows = topEvidence(evidence)
  const timeline = hierarchyData.top_periods.map(row => ({
    date: row.start === row.end ? row.start : `${row.start}~${row.end}`,
    kind: row.stage === 'relationship_rebuilding' ? 'rebuilding' as const : row.stage === 'contact_recontact' ? 'incoming' as const : 'reconnection' as const,
    label: stageDisplayLabel(row.stage,row.label),
    status: '주목',
  }))

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">
    <header className="reunion-result-meta" data-reading-export-tone="date">
      <small>기준일</small><strong>{hierarchyData.as_of_date}</strong>
    </header>
    <h3>결론부터 보면</h3>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 해설을 보류했어.</p> : <>
      <section className="reunion-story reunion-consultation-lead">
        <div className="reunion-story-section reunion-story-current">
          <h4>지금 두 사람의 흐름</h4>
          <p className="reading-conclusion">{summary}</p>
        </div>

        <div className="reunion-story-section reunion-story-contact" data-reading-export-tone={contactSignal === '낮음' ? 'caution' : 'love'}>
          <h4>연락 흐름</h4>
          <p><b>현재 강도: {contactSignal}</b></p>
          <p>{contact}</p>
        </div>

        <div className="reunion-story-section reunion-story-initiative" data-reading-export-tone="love">
          <h4>누가 먼저 움직일 가능성이 더 큰가</h4>
          <p><b>상대적 방향: {initiative.label}</b></p>
          <p>{initiative.text}</p>
        </div>

        <div className="reunion-story-section reunion-story-timing" data-reading-export-tone="date">
          <h4>기억할 시기</h4>
          <p>{timing}</p>
          {!!timeline.length && <ReadingTimeline events={timeline}/>} 
          {!!timingWindows.length && <div className="reunion-consultation-windows">{timingWindows.map((window,index)=><article className="relationship-pattern reunion-v2-window" key={`${window.period}:${index}`}><b>{window.period}</b><p>{window.meaning}</p></article>)}</div>}
        </div>

        <div className="reunion-story-section reunion-story-why">
          <h4>과거 관계를 다시 떠올리기 쉬운 배경</h4>
          <p>{why}</p>
        </div>

        <div className="reunion-story-section reunion-story-change">
          <h4>연락 뒤 실제 변화가 있는지</h4>
          <p><b>행동 변화 신호: {change.label}</b></p>
          <p>{change.text}</p>
        </div>

        <div className="reunion-story-section reunion-story-rebuild">
          <h4>연락 뒤 무엇을 확인할까</h4>
          <p>{rebuild}</p>
          {!!conditions.length && <ul>{conditions.map((item,index)=><li key={index}>{item}</li>)}</ul>}
          <div className="reunion-behavior-guide">
            <p><b>안부·추억 이야기만 반복</b> → 반응을 확인하는 단계에 머물 수 있어.</p>
            <p><b>구체적인 만남을 잡음</b> → 말이 실제 행동으로 넘어가는지 볼 수 있어.</p>
            <p><b>예전 문제와 앞으로의 관계를 피하지 않고 말함</b> → 관계 회복 의사를 따로 확인할 근거가 생겨.</p>
            <p><b>말은 다정한데 행동이 이어지지 않음</b> → 말의 온도보다 지속 행동을 우선해서 봐.</p>
          </div>
        </div>

        <div className="reunion-story-section reunion-story-repeat" data-reading-export-tone="caution">
          <h4>다시 만나면 조심할 반복 패턴</h4>
          <p>{repeat}</p>
          {!!patterns.length && <ul>{patterns.map((item,index)=><li key={index}>{item}</li>)}</ul>}
        </div>
      </section>

      <p className="reading-safety-note reunion-single-disclaimer">강약은 조회 기간 안의 상대적 활성도야. 실제 연락·만남·재회 확률이나 상대의 속마음을 뜻하지 않아.</p>

      <details className="reading-more reunion-contact-is-not-reunion" data-reading-export-ignore="true">
        <summary>계산된 단계와 시기 자세히 보기</summary>
        <p>다시 의식함 → 연락 흐름 → 실제 만남 → 관계 회복은 서로 다른 단계야. 앞 단계가 강해도 다음 단계가 자동으로 생기지는 않아.</p>
        <p>{stageSummary(rows)}</p>
        {hierarchyData.current_windows.map(row => <article className="relationship-pattern" key={`current:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>기준일이 이 시기 안에 있어.</p></article>)}
        {hierarchyData.top_periods.map(row => <article className="relationship-pattern" key={`future:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>앞으로 실제 행동과 함께 확인할 시기야.</p></article>)}
      </details>

      <details className="reading-more reunion-direction-layer" data-reading-export-ignore="true">
        <summary>상대 → 나 / 나 → 상대 보조지표 보기</summary>
        <ReadingDirections rows={neutralDirectionRows}/>
        <p>이 값은 관계 자극의 방향이야. 실제 속마음이나 선연락 행동을 관측한 값은 아니야.</p>
      </details>

      <details className="reading-more reunion-retrospective" data-reading-export-ignore="true">
        <summary>지난 시기 · 사후 확인용</summary>
        <p>실제 기록과 비교하는 개인 사후 확인용이야. 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
        {hierarchyData.past_windows.map(row => <article className="relationship-pattern" key={`past:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>이미 지난 시기야. 현재나 미래의 예고로 다시 쓰지 않아.</p></article>)}
        {!hierarchyData.past_windows.length && <p>조회 범위 안에서 따로 비교할 지난 시기가 없어.</p>}
      </details>

      <details className="reading-more reunion-calculation-basis" data-reading-export-ignore="true">
        <summary>계산 근거 보기</summary>
        <p>{hierarchyData.score_meaning}</p>
        <div className="reunion-stage-activation-list">{Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stageKey}><b>보조지표 활성도 · {stageDisplayLabel(stageKey,stage.label)}</b> {stage.activation == null ? '—' : Math.round(stage.activation)}</p>)}</div>
        {!!evidenceRows.length && <div className="reunion-local-evidence-grid">{evidenceRows.map((row,index)=><article className="relationship-pattern reunion-local-evidence" key={`${row.a}:${row.aspect}:${row.b}:${index}`}><strong>{evidenceLabel(row)}</strong><p>{Array.isArray(row.relationship_domains) && row.relationship_domains.length ? `관계 해석 영역: ${row.relationship_domains.join(' · ')}` : '관계 해석에 사용된 계산 근거야.'}</p></article>)}</div>}
        {hierarchyData.stability_structure && <p>고정 관계 구조 · 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개.</p>}
        {reunionV2?.precision_note && <Copy value={reunionV2.precision_note}/>} 
        {hierarchyData.limitations.map(item => <p key={item}>{item}</p>)}
      </details>
    </>}
  </section>
}
