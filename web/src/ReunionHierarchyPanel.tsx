import type { Aspect, RelationshipAiResponse } from './appTypes'
import { ReadingDirections, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './lib/reunionHierarchy'

const STAGE_ORDER = [
  ['emotional_reactivation', '감정 재활성화'],
  ['contact_recontact', '연락·재접촉'],
  ['in_person_meeting', '실제 만남'],
  ['relationship_rebuilding', '관계 재구축'],
] as const

const STAGE_SCENE: Record<string, { meaning:string; next:string }> = {
  emotional_reactivation: {
    meaning: '예전 기억이나 감정이 다시 의식되는 층이야.',
    next: '실제 메시지·답장 같은 상호작용이 생기는지는 다음 관문에서 따로 확인해.',
  },
  contact_recontact: {
    meaning: '메시지·답장·안부처럼 실제 상호작용이 다시 생길 수 있는 층이야.',
    next: '연락이 이어지는지, 구체적인 약속으로 넘어가는지가 다음 확인점이야.',
  },
  in_person_meeting: {
    meaning: '온라인 반응을 넘어 실제 약속이나 만남으로 이어질 수 있는 층이야.',
    next: '만남 자체보다 그 뒤에 관계 조건을 다시 합의하는지가 중요해.',
  },
  relationship_rebuilding: {
    meaning: '다시 만난 뒤 관계를 어떤 조건으로 이어갈지 조정하는 층이야.',
    next: '예전 갈등을 같은 방식으로 반복하지 않는 실제 행동이 있어야 재구축으로 읽을 수 있어.',
  },
}

const COMPONENT_LABELS: Array<[keyof ReunionPeriod['components'], string]> = [
  ['event_trigger','빠른 사건 촉발'],
  ['mid_term','중기 흐름'],
  ['long_term','장기 배경'],
  ['cross_system','체계 교차'],
]

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>
type WindowPhase = 'current' | 'past' | 'future'

function Copy({ value }: { value?: string | null }) {
  const text = String(value ?? '').trim()
  return text ? <p>{text}</p> : null
}

function stageScene(stage: string, label = '') {
  if (STAGE_SCENE[stage]) return STAGE_SCENE[stage]
  if (label.includes('감정')) return STAGE_SCENE.emotional_reactivation
  if (label.includes('연락') || label.includes('접촉')) return STAGE_SCENE.contact_recontact
  if (label.includes('만남')) return STAGE_SCENE.in_person_meeting
  return STAGE_SCENE.relationship_rebuilding
}

function componentStory(row: ReunionPeriod) {
  const ranked = COMPONENT_LABELS
    .map(([key,label])=>({key,label,value:Number(row.components?.[key] ?? 0)}))
    .filter((item)=>Number.isFinite(item.value))
    .sort((a,b)=>b.value-a.value)
  const lead = ranked[0]
  const second = ranked[1]
  if (!lead || lead.value <= 0) return '세부 근거 강도는 공개 가능한 범위에서 따로 두드러지는 축이 없어.'
  if (second && second.value > 0 && Math.abs(lead.value-second.value) <= 8) return `${lead.label}과 ${second.label}이 비슷하게 겹친 후보야.`
  return `${lead.label} 근거가 이 창에서 가장 두드러져.`
}

function stageWindowCopy(row: ReunionPeriod, phase: WindowPhase) {
  const scene = stageScene(row.stage,row.label)
  const phaseCopy = phase === 'current'
    ? `지금 기준일이 ${row.start}~${row.end} 창 안에 있어.`
    : phase === 'past'
      ? `${row.start}~${row.end}에 같은 단계가 한 번 두드러졌어.`
      : `${row.start}~${row.end}가 앞으로의 후보 창으로 남아 있어.`
  return `${phaseCopy} ${scene.meaning} ${componentStory(row)} ${scene.next}`
}

const PLANET_LABEL: Record<string,string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', Node:'교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const ASPECT_LABEL: Record<string,string> = {
  conjunction:'합', opposition:'대립', square:'사각', trine:'삼각', sextile:'육합', quincunx:'150도 조정각',
}
const DOMAIN_COPY: Array<[string,string]> = [
  ['communication','생각·말·연락 주제가 서로 맞물리는 근거야.'],
  ['affection_attraction','호감·애정 표현·관계 매력이 다시 의식되기 쉬운 근거야.'],
  ['emotional','감정 반응과 정서적 연결이 서로를 건드리는 근거야.'],
  ['action_meeting','행동이나 실제 접점으로 옮기는 힘을 건드리는 근거야.'],
  ['stability_commitment','관계를 현실적으로 유지하거나 정리하는 조건을 건드리는 근거야.'],
  ['instability_uncertainty','확신과 표현의 일관성이 흔들릴 수 있는 근거야.'],
  ['intensity_transformation','관계를 가볍게 넘기기보다 강하게 의식하고 재정의하게 만드는 근거야.'],
  ['visibility_status','관계의 상태나 바깥으로 드러나는 방식과 연결되는 근거야.'],
]

function aspectLabel(row: Aspect) {
  const a = PLANET_LABEL[row.a] ?? row.a
  const b = PLANET_LABEL[row.b] ?? row.b
  const aspect = ASPECT_LABEL[row.aspect] ?? row.aspect
  const orb = Number.isFinite(Number(row.orb)) ? Number(row.orb).toFixed(2) : '—'
  return `${a} ${aspect} ${b} · 오브 ${orb}°`
}

function evidencePhase(row: Aspect) {
  if (row.phase === 'exact') return row.exact_at ? `근접 정점 · 정확일 ${row.exact_at}` : '근접 정점'
  if (row.phase === 'applying') return '적용 중 · 오브가 더 좁아지는 흐름'
  if (row.phase === 'separating') return '분리 중 · 가장 가까운 구간을 지난 흐름'
  return '시간 방향 미확정'
}

function evidenceMeaning(row: Aspect) {
  const domains = Array.isArray(row.relationship_domains) ? row.relationship_domains : []
  const base = DOMAIN_COPY.find(([key])=>domains.includes(key))?.[1]
    ?? ((row.a === 'Mercury' || row.b === 'Mercury') ? '대화·생각·표현 방식이 강하게 맞물리는 근거야.'
      : (row.a === 'Venus' || row.b === 'Venus') ? '호감과 관계 매력, 애정 표현 방식을 건드리는 근거야.'
      : (row.a === 'Moon' || row.b === 'Moon') ? '감정 반응과 정서적 공감대를 건드리는 근거야.'
      : (row.a === 'Mars' || row.b === 'Mars') ? '행동 욕구와 실제 움직임을 건드리는 근거야.'
      : '현재 관계의 반응과 방향을 건드리는 계산 근거야.')
  if (row.tone === 'challenging') return `${base} 다만 충돌·오해·제약 쪽으로도 나타날 수 있어서 다른 근거와 함께 봐야 해.`
  if (row.tone === 'supportive') return `${base} 흐름을 부드럽게 이어주는 쪽이지만, 이것만으로 실제 연락이나 재회를 확정하지는 않아.`
  return `${base} 지지와 긴장이 함께 섞일 수 있어서 한 방향으로 단정하지 않아.`
}

function houseLabel(row: Aspect, direction: string) {
  const house = row.target_house
  if (!house) return ''
  const whole = Number(house.whole_house)
  const quad = Number(house.quadrant_house)
  const owner = direction === 'counterpart_to_user' ? '내' : direction === 'user_to_counterpart' ? '상대' : '대상'
  if (Number.isFinite(whole) && Number.isFinite(quad) && whole === quad) return `${owner} ${whole}하우스 중첩`
  const parts: string[] = []
  if (Number.isFinite(whole)) parts.push(`홀사인 ${whole}하우스`)
  if (Number.isFinite(quad)) parts.push(`${house.quadrant_system || '사분면'} ${quad}하우스`)
  return parts.length ? `${owner} · ${parts.join(' / ')}` : ''
}

function evidenceDistance(row: Aspect, asOf: string) {
  const date = String(row.reference_date ?? '')
  const t = Date.parse(date || '9999-12-31')
  const base = Date.parse(asOf || '9999-12-31')
  return Number.isFinite(t) && Number.isFinite(base) ? Math.abs(t-base) : Number.MAX_SAFE_INTEGER
}

function selectEvidence(evidence: Aspect[], direction: string, asOf: string, limit = 3) {
  const picked = new Map<string,Aspect>()
  for (const row of evidence.filter((item)=>item.direction === direction)) {
    const key = `${row.a}|${row.aspect}|${row.b}`
    const current = picked.get(key)
    if (!current || evidenceDistance(row,asOf) < evidenceDistance(current,asOf) ||
      (evidenceDistance(row,asOf) === evidenceDistance(current,asOf) && Number(row.orb) < Number(current.orb))) picked.set(key,row)
  }
  const phaseRank = (phase?: string) => phase === 'exact' ? 0 : phase === 'applying' ? 1 : phase === 'separating' ? 2 : 3
  return [...picked.values()].sort((a,b)=>evidenceDistance(a,asOf)-evidenceDistance(b,asOf) || phaseRank(a.phase)-phaseRank(b.phase) || Number(a.orb)-Number(b.orb)).slice(0,limit)
}

function EvidenceRows({ evidence, direction, asOf, title }: { evidence: Aspect[]; direction:string; asOf:string; title:string }) {
  const rows = selectEvidence(evidence,direction,asOf)
  if (!rows.length) return null
  return <div className="reunion-local-evidence-group"><b>{title}</b>{rows.map((row,index)=><article className="relationship-pattern reunion-local-evidence" key={`${direction}:${row.a}:${row.aspect}:${row.b}:${index}`}>
    <strong>{aspectLabel(row)}</strong>
    <p>{evidenceMeaning(row)}</p>
    <small>{[evidencePhase(row), houseLabel(row,direction), row.reference_date ? `계산 기준 ${row.reference_date}` : ''].filter(Boolean).join(' · ')}</small>
  </article>)}</div>
}

function directionCopy(row: DirectionRow) {
  const band = row.band ?? '정보 부족'
  if (row.kind === 'incoming') return `상대 → 나 방향의 관계 자극은 ${band}으로 계산됐어. 상대가 실제로 먼저 연락한다는 판정은 아니야.`
  if (row.kind === 'outgoing') return `나 → 상대 방향의 관계 자극은 ${band}으로 계산됐어. 내가 먼저 연락해야 한다는 지시는 아니야.`
  return `과거 인연 재접점 활성은 ${band}으로 계산됐어. 실제 재회 성사 여부와는 분리해서 봐.`
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
  const current = hierarchyData.current_windows
  const future = hierarchyData.top_periods
  const past = hierarchyData.past_windows
  const stageRows = STAGE_ORDER.map(([stage,label]) => {
    const currentRow = current.find((row)=>row.stage===stage)
    const futureRows = future.filter((row)=>row.stage===stage)
    return { stage, label, current:Boolean(currentRow), currentRow, futureRows }
  })
  const nearestFuture = [...future].sort((a,b)=>a.date.localeCompare(b.date))[0]
  const neutralDirectionRows = directionRows.map((row)=>({...row,text:directionCopy(row)}))
  const incoming = neutralDirectionRows.find((row)=>row.kind==='incoming')
  const outgoing = neutralDirectionRows.find((row)=>row.kind==='outgoing')
  const stageLine = stageRows.map((row)=>`${row.label} ${row.current?'현재 열림':row.futureRows.length?`후보 ${row.futureRows.length}개`:'후보 없음'}`).join(' · ')
  const movementOrder = '감정 재활성화 → 실제 연락·재접촉 → 실제 만남 → 관계 재구축'
  const currentStory = current.length
    ? `지금 기준일에는 ${current.map((row)=>row.label).join(' · ')} 단계가 현재 창에 걸려 있어. ${stageLine}. 현재 열린 단계보다 뒤의 일을 한꺼번에 재회로 묶어 읽지 않아.`
    : `지금 기준일을 포함하는 공개 활성창은 없어. ${stageLine}. 감정이 없다는 뜻이 아니라, 현재 날짜에서 공개할 만큼 강한 단계 후보가 없다는 뜻이야.`
  const whyStory = reunionV2?.why_reconnect
    ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}`
    : '과거 인연이 다시 의식되는 층과 실제 접촉으로 넘어가는 층을 분리해서 보고 있어. 생각이 나는 것과 연락이 실제로 오가는 것은 같은 신호로 처리하지 않아.'
  const initiativeStory = reunionV2?.initiative
    ? `${reunionV2.initiative.conclusion} ${reunionV2.initiative.interpretation}`
    : `상대 → 나는 ${incoming?.band ?? '정보 부족'}, 나 → 상대는 ${outgoing?.band ?? '정보 부족'}이야. 둘 다 관계 자극의 방향을 보는 보조값이고, 독립된 행동 근거가 없으면 누가 먼저 연락한다고 판정하지 않아.`
  const timingStory = reunionV2?.timing?.conclusion
    ? reunionV2.timing.conclusion
    : nearestFuture
      ? `가장 가까운 공개 후보는 ${nearestFuture.start}~${nearestFuture.end}의 ${nearestFuture.label} 단계야. ${componentStory(nearestFuture)} 사건 확정일이 아니라 그 단계의 관문을 통과한 후보 구간이야.`
      : '현재 이후 공개할 단계 후보가 없어. 후보가 없는 단계를 억지로 날짜로 만들어내지 않아.'
  const rebuildStory = reunionV2?.rebuild?.conclusion
    ? `${reunionV2.rebuild.conclusion}${reunionV2.rebuild.conditions?.length ? ` ${reunionV2.rebuild.conditions.join(' ')}` : ''}`
    : `연락이 다시 닿는 것과 관계를 다시 이어가는 것은 다른 단계야. 실제 약속과 만남, 이전 문제를 다르게 다루는 합의가 이어지는지를 확인해야 해. ${sustainabilityText}`
  const repeatStory = reunionV2?.repeat_risks?.conclusion
    ? `${reunionV2.repeat_risks.conclusion}${reunionV2.repeat_risks.patterns?.length ? ` ${reunionV2.repeat_risks.patterns.join(' ')}` : ''}`
    : '다시 연락이 닿아도 대화가 같은 지점에서 끊기거나 약속이 흐려지면 연락 단계에서 다시 멈출 수 있어. 재접촉보다 연락 뒤 행동이 달라지는지를 더 중요하게 봐.'
  const convergenceStory = reunionV2?.convergence?.length
    ? reunionV2.convergence.slice(0,3).map((row)=>`${row.theme}${row.period ? `(${row.period})` : ''}: ${row.meaning}`).join(' ')
    : '서로 다른 계산층이 같은 단계와 시기를 함께 가리킬 때만 수렴 근거로 올려. 한 체계의 강한 신호 하나만으로 다음 단계로 올리지 않아.'

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">
    <h3>지금 두 사람은 어디에 있나</h3>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 판정을 보류했어.</p> : <>
      <div className="reunion-story">
        <section className="reunion-story-section reunion-story-current"><h4>지금 살아 있는 흐름</h4><p>{currentStory}</p></section>
        <section className="reunion-story-section reunion-story-why"><h4>왜 다시 신경 쓰이거나 연결될 수 있나</h4><p>{whyStory}</p></section>
        <section className="reunion-story-section reunion-story-initiative"><h4>서로에게 걸리는 방향</h4><p>{initiativeStory}</p></section>
        <section className="reunion-story-section reunion-story-timing"><h4>가장 가까운 후보 시기</h4><p>{timingStory}</p></section>
        <section className="reunion-story-section reunion-story-rebuild"><h4>연락 뒤 재회까지 남은 조건</h4><p>{rebuildStory}</p></section>
        <section className="reunion-story-section reunion-story-repeat"><h4>다시 멀어질 수 있는 지점</h4><p>{repeatStory}</p></section>
      </div>
      <div className="reunion-stage-sequence">{movementOrder}</div>

      <section className="reunion-ai-block reunion-current-state">
        <h4>관계 자체의 현재 단계</h4>
        {reunionV2?.summary ? <Copy value={reunionV2.summary}/> : <p>{currentStory}</p>}
        {current.map((row)=><article className="relationship-pattern reunion-current-window" key={`current:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label}</b>
          <p>{stageWindowCopy(row,'current')}</p>
          <small>기준일 포함 · 사건 확정 아님 · 보조지표 활성도 {row.final}</small>
        </article>)}
      </section>

      <section className="reunion-ai-block reunion-direction-layer">
        <h4>서로에게 걸리는 방향</h4>
        <ReadingDirections rows={neutralDirectionRows}/>
        <p className="reunion-score-meaning">‘상대 → 나’와 ‘나 → 상대’는 계산된 관계 자극 방향이야. 실제 속마음이나 실제 선연락 행동을 관측한 값은 아니야.</p>
        <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 독립된 행동 방향 근거가 충분하지 않으면 판정하지 않아.</p>
        <details className="reading-more reunion-technical-evidence">
          <summary>진행차트 근거 보기</summary>
          <div className="reunion-local-evidence-grid">
            <EvidenceRows evidence={evidence} direction="counterpart_to_user" asOf={hierarchyData.as_of_date} title="상대의 현재 진행 → 나"/>
            <EvidenceRows evidence={evidence} direction="user_to_counterpart" asOf={hierarchyData.as_of_date} title="나의 현재 진행 → 상대"/>
            <EvidenceRows evidence={evidence} direction="shared" asOf={hierarchyData.as_of_date} title="현재의 나 ↔ 현재의 상대 · 진행↔진행"/>
          </div>
        </details>
      </section>

      <section className="reunion-ai-block reunion-future-flow">
        <h4>앞으로의 후보 시기</h4>
        {hierarchyData.nearest_window && <p><b>가장 가까운 후보</b> · {hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</p>}
        {future.map((row)=><article className="relationship-pattern reunion-future-window" key={`future:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label} 후보 창</b>
          <p>{stageWindowCopy(row,'future')}</p>
          <small>대표 날짜 {row.date} · 사건 확정일 아님 · 보조지표 활성도 {row.final}</small>
          <details><summary>왜 이 후보가 남았는지</summary><p>{componentStory(row)} 장기 배경과 중기 흐름, 사건 촉발 신호가 이 단계 기준을 함께 통과했어.</p><small>장기 {row.components.long_term} · 중기 {row.components.mid_term} · 사건 촉발 {row.components.event_trigger} · 체계 교차 {row.components.cross_system} · 최종 {row.components.final}</small></details>
        </article>)}
        {!future.length && <p>오늘 이후 공개할 후보 시기가 없어.</p>}
      </section>

      <section className="reunion-ai-block reunion-rebuild-conditions">
        <h4>관계를 다시 이어가려면</h4>
        <p>{rebuildStory}</p>
        <p className="reunion-score-meaning">재접촉이 있었다는 사실보다, 같은 갈등 패턴이 실제 행동에서 달라지는지를 더 중요하게 봐.</p>
      </section>

      <details className="reading-more reunion-contact-is-not-reunion">
        <summary>연락 ≠ 재회 · 단계 기준 보기</summary>
        <p>연락·재접촉은 상호작용이 다시 시작되는 단계일 뿐이야. 대화 지속, 실제 만남, 관계 조건 재합의는 각각 별도 관문이야.</p>
        <div className="reunion-stage-status">
          {STAGE_ORDER.map(([key,label])=>{
            const stage = hierarchyData.stages[key]
            const scene = stageScene(key,label)
            return <p key={key}><b>{label}</b> · {scene.meaning} <small>{stage?.candidate_count ? `미래 후보 ${stage.candidate_count}개` : '공개할 미래 후보 없음'}</small></p>
          })}
        </div>
      </details>

      <details className="reading-more reunion-retrospective">
        <summary>지난 활성기 · 사후 확인용</summary>
        <p className="reunion-score-meaning">기준일 이전에 같은 관문을 통과했던 구간이야. 실제 기록과 비교하는 개인 사후 확인용이며, 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
        {past.map((row)=><article className="relationship-pattern reunion-past-window" key={`past:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label}</b>
          <p>{stageWindowCopy(row,'past')}</p>
          <small>대표 날짜 {row.date} · 이미 지난 구간 · 보조지표 활성도 {row.final}</small>
        </article>)}
        {!past.length && <p>조회 범위 안에서 따로 비교할 지난 활성기가 없어.</p>}
      </details>

      <details className="reading-more reunion-convergence">
        <summary>여러 근거가 같이 가리키는 부분</summary>
        <p>{convergenceStory}</p>
      </details>

      <details className="reading-more reunion-calculation-basis">
        <summary>계산 근거 보기</summary>
        <p>{hierarchyData.score_meaning}</p>
        <div className="reunion-return-context-grid">
          {STAGE_ORDER.map(([key,label])=>{
            const stage = hierarchyData.stages[key]
            const available = !!stage && stage.candidate_count > 0 && typeof stage.activation === 'number'
            return <article className="reunion-return-context-card" key={`metric:${key}`}><b>{label}</b><strong>{available ? `${Math.round(stage.activation as number)}/100` : '—'}</strong><small>{available ? `미래 후보 ${stage.candidate_count}개` : '공개할 미래 후보 없음'}</small></article>
          })}
        </div>
        <p>숫자는 사건 확률이나 현재 감정 세기가 아니라, 조회 범위에서 관문을 통과한 후보의 상대 활성도야.</p>
        {hierarchyData.stability_structure && <p>고정 관계 구조 · 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
        <p>Secondary Progression · Progressed Synastry · Progressed Composite · Solar Arc · Transit · Return · 사주 절입을 각 역할에 맞게 분리해서 읽어.</p>
        {hierarchyData.limitations.map((item)=><p key={item}>{item}</p>)}
        {(hierarchyData.validation?.checks ?? []).filter((item)=>item.status !== 'PASS').map((item)=><p key={item.name}>{item.name}: {item.status} — {item.detail}</p>)}
      </details>
    </>}
  </section>
}
