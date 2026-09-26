import type { Aspect, RelationshipAiResponse } from './appTypes'
import { ReadingDirections, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './lib/reunionHierarchy'

const STAGE_ORDER = [
  ['emotional_reactivation', '다시 의식하는 흐름'],
  ['contact_recontact', '연락 흐름 신호'],
  ['in_person_meeting', '실제 만남'],
  ['relationship_rebuilding', '관계 회복'],
] as const

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>

const PLANET_LABEL: Record<string,string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', Node:'교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const ASPECT_LABEL: Record<string,string> = {
  conjunction:'합', opposition:'대립', square:'사각', trine:'삼각', sextile:'육합', quincunx:'150도 조정각',
}

const MAIN_TECHNICAL_RE = /(?:\bsecondary\b|\b(?:emotional_reactivation|contact_recontact|in_person_meeting|relationship_rebuilding|initiative_gate)\b|오브|\d+(?:\.\d+)?\s*°|트랜짓|컴포지트|시너스트리|육십분위|대립각|사각(?:각)?(?!지대)|삼각(?:각)?(?!관계)|육파|활성도\s*\d|상대측\s*활성|내측\s*활성|재접점\s*활성|보조지표|진행\s+(?:태양|달|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|진북교점|용수자리))/i
const READER_SCENE_START_RE = /(?:예전|과거|근황|궁금|신경|호의|정서|감정|미련|연락|메시지|답장|대화|약속|만남|다시|서로|행동|갈등|책임|합의|유지|회복|재회|관계가|관계를|관계에서|관계는)/g

function Copy({ value }: { value?: string | null }) {
  const text = String(value ?? '').trim()
  return text ? <p>{text}</p> : null
}

function splitSentences(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text) return []
  return text.replace(/([.!?])\s+/g, '$1\n').split('\n').map((row)=>row.trim()).filter(Boolean)
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
    .replace(/\bcontact_recontact\b/g, '연락 흐름 신호')
    .replace(/\bin_person_meeting\b/g, '실제 만남')
    .replace(/\brelationship_rebuilding\b/g, '관계 회복')
    .replace(/\binitiative_gate\b/g, '선연락 방향 근거')
    .replace(/용수자리/g, '진북교점')
    .replace(/감정 활성(?:화)?/g, '다시 의식하는 흐름')
    .replace(/다시 의식하는 흐름 단계/g, '다시 의식하는 흐름')
    .replace(/연락·재접촉 단계/g, '연락 흐름을 살펴보는 시기')
    .replace(/연락·재접촉 창/g, '연락 흐름을 살펴볼 시기')
    .replace(/연락·재접촉/g, '연락 흐름')
    .replace(/재접촉/g, '연락·대화 재개')
    .replace(/관계 재구축 단계/g, '관계를 다시 이어 가는 흐름')
    .replace(/현재 열림/g, '현재 관련 신호가 있음')
    .replace(/현재 조회 시점 기준으로\s*/g, '지금 ')
    .replace(/가장 먼저 활성화되는 단계는/g, '가장 먼저 눈여겨볼 흐름은')
    .replace(/가장 먼저 도달하는\s*연락 흐름\s*(?:국소\s*)?피크(?:\s*구간)?/g, '가장 먼저 눈여겨볼 연락 흐름 시기')
    .replace(/상위 관문/g, '다음 단계')
    .replace(/미충족 상태(?:야|다)?/g, '아직 뚜렷한 근거가 없어')
    .replace(/국소\s*피크(?:\s*구간)?/g, '두드러지는 시기')
    .replace(/피크\s*구간/g, '두드러지는 시기')
    .replace(/유효 후보/g, '살펴볼 시기')
    .replace(/강한 후보들이 형성되어 있(?:어|다)/g, '눈여겨볼 시기가 잡혀 있어')
    .replace(/후보들이 형성되어 있(?:어|다)/g, '살펴볼 시기가 잡혀 있어')
    .replace(/후보가 형성되어 있(?:어|다)/g, '살펴볼 시기가 잡혀 있어')
    .replace(/실제 대면 만남/g, '실제 만남')
    .replace(/관계 재정의/g, '관계 회복')
    .replace(/오프라인 대면/g, '실제 만남')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function readerText(value?: string | null, fallback='') {
  const normalized = normalizeReaderLanguage(value)
  if (!normalized) return fallback
  const plain = splitSentences(normalized).map(plainReaderSentence).filter(Boolean)
  return plain.length ? plain.join(' ') : fallback
}

function stageDisplayLabel(stage: string, fallback='관계 흐름') {
  const found = STAGE_ORDER.find(([key])=>key===stage)
  return found?.[1] ?? normalizeReaderLanguage(fallback)
}

function stageRows(hierarchyData: ReunionHierarchy) {
  return STAGE_ORDER.map(([stage,label])=>({
    stage,
    label,
    current: hierarchyData.current_windows.some((row)=>row.stage===stage),
    future: hierarchyData.top_periods.filter((row)=>row.stage===stage),
  }))
}

function stageSummary(rows: ReturnType<typeof stageRows>) {
  return rows.map((row)=>{
    if (row.current) return `${row.label}: 기준일이 관련 시기 안에 있음`
    if (row.future.length) return `${row.label}: 앞으로 살펴볼 시기 ${row.future.length}개`
    return `${row.label}: 현재 조회 범위에서는 뚜렷한 시기 없음`
  }).join(' · ')
}

function phaseVerdict(hierarchyData: ReunionHierarchy) {
  const current = new Set(hierarchyData.current_windows.map((row)=>row.stage))
  const future = new Set(hierarchyData.top_periods.map((row)=>row.stage))
  const has = (stage:string)=>current.has(stage)
  const hasAny = (stage:string)=>current.has(stage) || future.has(stage)
  if (has('relationship_rebuilding')) return '지금은 연락이 다시 닿느냐보다, 다시 이어진 관계를 예전과 다른 방식으로 유지할 수 있는지가 더 중요해. 실제로 관계 이야기를 피하지 않고, 이전에 끊겼던 문제를 다르게 다루는 행동이 이어지는지를 봐야 해. 다시 만났다는 사실만으로 관계가 안정됐다고 보기는 어려워.'
  if (has('in_person_meeting')) return '지금은 단순히 연락이 오가느냐보다 실제 약속이나 만남으로 이어지는지가 더 중요해. 만남이 잡히면 감정이 현실 행동으로 넘어온 신호로 볼 수 있지만, 그것만으로 다시 연인이 된다고 보기는 어려워. 만난 뒤 관계 이야기를 피하지 않는지가 다음 판단 기준이야.'
  if (has('contact_recontact')) return `지금은 연락이나 대화 재개와 관련된 시기 신호가 일부 잡혀 있어. 이 신호는 실제 연락 확률 판정이 아니야.${!hasAny('in_person_meeting') && !hasAny('relationship_rebuilding') ? ' 현재 조회 범위에서는 실제 만남이나 관계 회복으로 이어질 시기도 뚜렷하지 않아.' : ' 연락이 생기더라도 실제 만남과 관계 회복은 따로 확인해야 해.'} 그래서 이번 결과는 재회가 가까워졌다고 단정하기보다, 실제 연락이 생기는지와 그 뒤 행동이 이어지는지를 보는 쪽에 가까워.`
  if (has('emotional_reactivation')) return `지금은 예전 관계를 다시 떠올리거나 상대의 근황이 궁금해지기 쉬운 흐름이 먼저 보여. 생각이나 감정이 올라오는 것과 실제 연락이 생기는 것은 같은 일이 아니야.${!hasAny('contact_recontact') ? ' 현재 조회 범위에서는 연락 흐름을 따로 강조할 만한 시기도 뚜렷하지 않아.' : ' 앞으로 연락 여부를 눈여겨볼 시기 신호는 따로 잡혀 있어.'}`
  return '지금은 실제 연락이나 만남이 가까워졌다고 말할 만큼 뚜렷한 흐름이 잡히지 않았어. 감정이 없다는 뜻이 아니라, 현재 날짜에서 행동으로 이어질 근거가 부족하다는 뜻이야. 새로운 연락이나 구체적인 만남이 생기기 전에는 재회를 앞당겨 해석하지 않는 게 맞아.'
}

function contactOutlook(hierarchyData: ReunionHierarchy) {
  const currentContact = hierarchyData.current_windows.some((row)=>row.stage==='contact_recontact')
  const futureContact = hierarchyData.top_periods.filter((row)=>row.stage==='contact_recontact')
  const meeting = hierarchyData.current_windows.some((row)=>row.stage==='in_person_meeting') || hierarchyData.top_periods.some((row)=>row.stage==='in_person_meeting')
  const rebuilding = hierarchyData.current_windows.some((row)=>row.stage==='relationship_rebuilding') || hierarchyData.top_periods.some((row)=>row.stage==='relationship_rebuilding')
  const probabilityNote = '이 계산은 실제 연락 확률을 높음·낮음으로 산출하지 않아.'
  if (currentContact) return `${probabilityNote} 다만 현재에는 연락이나 대화 재개 여부를 눈여겨볼 시기 신호가 잡혀 있어. 즉 연락과 관련된 자극이 두드러지는 때라는 뜻이지, 메시지가 실제로 온다고 확정하는 뜻은 아니야.${!meeting && !rebuilding ? ' 특히 연락 뒤 실제 만남이나 관계 회복으로 이어질 시기는 아직 뚜렷하지 않아.' : ''}`
  if (futureContact.length) return `${probabilityNote} 다만 ${futureContact[0].start}~${futureContact[0].end}은 연락이나 대화 재개 여부를 다른 시기보다 더 눈여겨볼 수 있는 구간이야. 그때 실제 연락이 생기는지와 단순히 다시 생각나는지는 따로 확인해야 해.`
  return `${probabilityNote} 현재 조회 범위에서는 연락이나 대화 재개를 따로 강조할 시기 신호도 잡히지 않았어. 이는 연락 확률을 낮게 계산했다는 뜻이 아니라, 이 엔진의 시기 기준에서 별도 신호를 잡지 못했다는 뜻이야.`
}

function finalTakeaway(hierarchyData: ReunionHierarchy) {
  const current = new Set(hierarchyData.current_windows.map((row)=>row.stage))
  if (current.has('relationship_rebuilding')) return '지금은 다시 연락하느냐보다 관계를 실제로 다시 운영할 준비가 있는지가 핵심이야. 예전 문제를 다르게 다루는 행동이 이어져야 재회가 유지될 수 있어.'
  if (current.has('in_person_meeting')) return '지금은 연락보다 실제 만남과 그 이후의 행동이 더 중요한 시기야. 만난 뒤 관계 이야기를 피하지 않는지가 재회 여부를 가를 가능성이 커.'
  if (current.has('contact_recontact')) return '지금은 연락 여부를 눈여겨볼 시기 신호가 있지만, 이 신호 자체는 연락 확률도 재회 확률도 아니야. 실제 연락이 생기면 말의 온도보다 만남과 지속 행동이 붙는지를 봐.'
  if (current.has('emotional_reactivation')) return '지금은 서로를 다시 의식하는 흐름이 실제 행동보다 앞서 있어. 연락이 생기기 전까지는 마음의 움직임과 현실의 재회를 같은 것으로 보지 않는 게 맞아.'
  return '지금은 관계가 실제로 다시 움직인다고 말하기보다 서로의 행동을 확인해야 하는 쪽에 가까워. 새로운 연락이나 만남이 생기기 전에는 재회를 앞당겨 해석하지 않는 게 맞아.'
}

function timingFallback(rows: ReunionPeriod[]) {
  if (!rows.length) return '현재 이후에 따로 강조할 만한 시기가 잡히지 않았어. 없는 날짜를 억지로 만들어내지 않을게.'
  const grouped = new Map<string, ReunionPeriod[]>()
  for (const row of rows) grouped.set(row.stage, [...(grouped.get(row.stage) ?? []), row])
  return [...grouped.entries()].map(([stage, group])=>{
    const dates = group.map((row)=>`${row.start}~${row.end}`).join(', ')
    if (stage === 'emotional_reactivation') return `${dates}에는 예전 관계가 다시 신경 쓰이거나 감정이 올라오는 흐름을 살펴볼 수 있어. 같은 종류의 신호라 날짜마다 서로 다른 사건을 뜻하는 것은 아니야.`
    if (stage === 'contact_recontact') return `${dates}에는 연락이나 대화 재개 여부를 다른 때보다 더 눈여겨볼 수 있어. 이 시기 신호는 실제 메시지 도착 확률을 뜻하지 않아.`
    if (stage === 'in_person_meeting') return `${dates}에는 연락이 실제 약속이나 만남으로 넘어가는지를 살펴볼 수 있어.`
    if (stage === 'relationship_rebuilding') return `${dates}에는 다시 만난 뒤 관계를 실제로 이어 갈 행동과 합의가 붙는지를 살펴볼 수 있어.`
    return `${dates}에는 관계 흐름의 변화를 다른 때보다 더 눈여겨볼 수 있어.`
  }).join(' ')
}

function directionCopy(row: DirectionRow) {
  const band = row.band ?? '정보 부족'
  if (row.kind === 'incoming') return `상대 → 나 관계 자극은 ${band}. 상대가 실제로 먼저 연락한다는 판정은 아니야.`
  if (row.kind === 'outgoing') return `나 → 상대 관계 자극은 ${band}. 내가 먼저 연락해야 한다는 지시는 아니야.`
  return `과거 인연 관련 보조신호는 ${band}. 실제 연락이나 재회 성사 여부와는 분리해서 봐.`
}

function evidenceLabel(row: Aspect) {
  const a = PLANET_LABEL[row.a] ?? row.a
  const b = PLANET_LABEL[row.b] ?? row.b
  const aspect = ASPECT_LABEL[row.aspect] ?? row.aspect
  const orb = Number.isFinite(Number(row.orb)) ? `${Number(row.orb).toFixed(2)}°` : '—'
  return `${a} ${aspect} ${b} · 오브 ${orb}`
}

function topEvidence(evidence: Aspect[], limit=8) {
  return [...evidence]
    .filter((row)=>Number.isFinite(Number(row.orb)))
    .sort((a,b)=>Number(a.orb)-Number(b.orb))
    .slice(0,limit)
}

function dedupeTimingWindows(windows: ReunionSynthesis['timing']['windows']) {
  const seen = new Set<string>()
  return windows.map((window)=>({
    ...window,
    meaning: readerText(window.meaning, '이 시기에는 관계 흐름의 변화를 눈여겨볼 수 있어.'),
  })).filter((window)=>{
    const fingerprint = window.meaning
      .replace(/\d{4}-\d{2}-\d{2}/g, '#')
      .replace(/[\s·,.!?~→-]+/g, '')
      .toLowerCase()
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

export function ReunionHierarchyPanel({
  hierarchyData,
  evidence,
  reunionV2,
  directionRows,
  sustainabilityText,
}: {
  hierarchyData: ReunionHierarchy
  evidence: Aspect[]
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const rows = stageRows(hierarchyData)
  const neutralDirectionRows = directionRows.map((row)=>({...row,text:directionCopy(row)}))
  const contact = contactOutlook(hierarchyData)
  const initiative = readerText(
    reunionV2?.initiative ? `${reunionV2.initiative.conclusion} ${reunionV2.initiative.interpretation}` : '',
    '누가 먼저 연락할지는 현재 계산만으로 정하기 어려워. 먼저 연락하는 사람이 누구인지보다 연락 뒤 대화가 이어지고 실제 만남으로 넘어가는지를 보는 편이 더 정확해.',
  )
  const why = readerText(
    reunionV2?.why_reconnect ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}` : '',
    '이 관계가 다시 신경 쓰이는 것과 실제 연락이 생기는 것은 같은 일이 아니야. 예전 기억이나 감정이 올라오더라도 행동으로 이어지는지는 따로 봐야 해.',
  )
  const timing = readerText(reunionV2?.timing?.conclusion, timingFallback(hierarchyData.top_periods))
  const rebuild = readerText(
    reunionV2?.rebuild?.conclusion,
    `연락이 다시 닿는 것과 재회는 달라. 실제 만남이 잡히고, 이전에 끊겼던 문제를 다르게 다루는 대화가 이어져야 관계 회복 쪽으로 볼 수 있어. ${sustainabilityText}`,
  )
  const repeat = readerText(
    reunionV2?.repeat_risks?.conclusion,
    '연락은 이어지는데 만남을 계속 미루거나, 관계 이야기를 피하고, 예전과 같은 지점에서 대화가 끊기면 이번 흐름도 미련 확인이나 일시적인 연락 재개에서 멈출 수 있어.',
  )
  const summary = phaseVerdict(hierarchyData)
  const timingWindows = reunionV2?.timing?.windows?.length ? dedupeTimingWindows(reunionV2.timing.windows) : []
  const conditions = (reunionV2?.rebuild?.conditions ?? []).map((item)=>readerText(item)).filter(Boolean)
  const patterns = (reunionV2?.repeat_risks?.patterns ?? []).map((item)=>readerText(item)).filter(Boolean)
  const evidenceRows = topEvidence(evidence)

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">
    <h3>결론부터 보면</h3>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 해설을 보류했어.</p> : <>
      <section className="reunion-story reunion-consultation-lead">
        <div className="reunion-story-section reunion-story-current">
          <h4>지금 두 사람의 흐름</h4>
          <p className="reading-conclusion">{summary}</p>
        </div>

        <div className="reunion-story-section reunion-story-contact">
          <h4>실제 연락 가능성은?</h4>
          <p>{contact}</p>
        </div>

        <div className="reunion-story-section reunion-story-initiative">
          <h4>누가 먼저 움직일지는?</h4>
          <p>{initiative}</p>
        </div>

        <div className="reunion-story-section reunion-story-why">
          <h4>왜 아직 서로를 신경 쓰기 쉬운가</h4>
          <p>{why}</p>
        </div>

        <div className="reunion-story-section reunion-story-timing">
          <h4>언제가 중요한가</h4>
          <p>{timing}</p>
          {!!timingWindows.length && <div className="reunion-consultation-windows">{timingWindows.map((window,index)=><article className="relationship-pattern reunion-v2-window" key={`${window.period}:${index}`}><b>{window.period}</b><p>{window.meaning}</p></article>)}</div>}
        </div>

        <div className="reunion-story-section reunion-story-rebuild">
          <h4>연락이 오면 무엇으로 진심을 구분하나</h4>
          <p>{rebuild}</p>
          {!!conditions.length && <ul>{conditions.map((item,index)=><li key={index}>{item}</li>)}</ul>}
          <div className="reunion-behavior-guide">
            <p><b>안부·추억 이야기만 반복</b> → 아직은 미련 확인이나 반응 탐색에 가까울 수 있어.</p>
            <p><b>구체적인 만남을 잡음</b> → 생각이나 감정이 실제 행동으로 넘어가는 신호로 볼 수 있어.</p>
            <p><b>예전 문제와 앞으로의 관계를 피하지 않고 말함</b> → 그때부터 실제 재회 의사가 있는지 따로 볼 수 있어.</p>
            <p><b>말은 다정한데 행동이 이어지지 않음</b> → 말의 온도보다 지속 행동을 더 중요하게 봐야 해.</p>
          </div>
        </div>

        <div className="reunion-story-section reunion-story-repeat">
          <h4>다시 만나도 반복되기 쉬운 문제</h4>
          <p>{repeat}</p>
          {!!patterns.length && <ul>{patterns.map((item,index)=><li key={index}>{item}</li>)}</ul>}
        </div>
      </section>

      <section className="reunion-final-takeaway">
        <h4>이번 리딩의 결론</h4>
        <p>{finalTakeaway(hierarchyData)}</p>
      </section>

      <details className="reading-more reunion-contact-is-not-reunion">
        <summary>계산된 흐름과 시기 자세히 보기</summary>
        <p>다시 의식함 → 연락 흐름 신호 → 실제 만남 → 관계 회복은 서로 다른 관문이야. 연락 흐름 신호는 실제 연락 확률이 아니고, 앞쪽 신호가 강하다고 뒤의 일이 자동으로 생기는 것도 아니야.</p>
        <p>{stageSummary(rows)}</p>
        {hierarchyData.current_windows.map((row)=><article className="relationship-pattern" key={`current:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>기준일이 이 시기 안에 있어. 사건 확정이나 확률 판정이 아니라 해당 흐름을 다른 시기보다 더 살펴볼 수 있다는 뜻이야.</p></article>)}
        {hierarchyData.top_periods.map((row)=><article className="relationship-pattern" key={`future:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>앞으로 살펴볼 시기야. 실제 사건은 연락·만남 같은 행동이 붙는지 확인해야 해.</p></article>)}
      </details>

      <details className="reading-more reunion-direction-layer">
        <summary>상대 → 나 / 나 → 상대 보조지표 보기</summary>
        <ReadingDirections rows={neutralDirectionRows}/>
        <p>이 값은 관계 자극의 방향이지 실제 속마음이나 선연락 행동을 관측한 값이 아니야.</p>
      </details>

      <details className="reading-more reunion-retrospective">
        <summary>지난 시기 · 사후 확인용</summary>
        <p>기준일 이전에 비슷한 흐름이 두드러졌던 구간이야. 실제 기록과 비교하는 개인 사후 확인용이며, 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
        {hierarchyData.past_windows.map((row)=><article className="relationship-pattern" key={`past:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {stageDisplayLabel(row.stage,row.label)}</b><p>이미 지난 시기야. 현재나 미래의 예고로 다시 쓰지 않아.</p></article>)}
        {!hierarchyData.past_windows.length && <p>조회 범위 안에서 따로 비교할 지난 시기가 없어.</p>}
      </details>

      <details className="reading-more reunion-calculation-basis">
        <summary>계산 근거 보기</summary>
        <p>{hierarchyData.score_meaning}</p>
        <h5>보조지표 활성도</h5>
        <div className="reunion-stage-activation-list">{Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stageKey}><b>{stageDisplayLabel(stageKey,stage.label)}</b> {stage.activation == null ? '—' : Math.round(stage.activation)}</p>)}</div>
        <p>숫자는 사건 확률이나 현재 감정 세기가 아니라, 조회 범위에서 각 기준을 통과한 시기들의 상대 비교값이야.</p>
        {!!evidenceRows.length && <div className="reunion-local-evidence-grid">{evidenceRows.map((row,index)=><article className="relationship-pattern reunion-local-evidence" key={`${row.a}:${row.aspect}:${row.b}:${index}`}><strong>{evidenceLabel(row)}</strong><p>{Array.isArray(row.relationship_domains) && row.relationship_domains.length ? `관계 해석 영역: ${row.relationship_domains.join(' · ')}` : '관계 해석에 사용된 계산 근거야.'}</p></article>)}</div>}
        {hierarchyData.stability_structure && <p>고정 관계 구조 · 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
        {reunionV2?.precision_note && <Copy value={reunionV2.precision_note}/>} 
        {hierarchyData.limitations.map((item)=><p key={item}>{item}</p>)}
      </details>
    </>}
  </section>
}