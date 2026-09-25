import type { Aspect, RelationshipAiResponse } from './appTypes'
import { ReadingDirections, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './lib/reunionHierarchy'

const STAGE_ORDER = [
  ['emotional_reactivation', '다시 의식하는 흐름'],
  ['contact_recontact', '실제 연락·재접촉'],
  ['in_person_meeting', '실제 만남'],
  ['relationship_rebuilding', '관계 재구축'],
] as const

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>

const PLANET_LABEL: Record<string,string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', Node:'교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const ASPECT_LABEL: Record<string,string> = {
  conjunction:'합', opposition:'대립', square:'사각', trine:'삼각', sextile:'육합', quincunx:'150도 조정각',
}

function Copy({ value }: { value?: string | null }) {
  const text = String(value ?? '').trim()
  return text ? <p>{text}</p> : null
}

function firstSentence(value?: string | null) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.split(/(?<=[.!?])\s+/)[0] ?? text
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
    if (row.current) return `${row.label}: 지금 확인 구간`
    if (row.future.length) return `${row.label}: 앞으로 후보 ${row.future.length}개`
    return `${row.label}: 현재 공개 후보 없음`
  }).join(' · ')
}

function phaseVerdict(hierarchyData: ReunionHierarchy) {
  const current = new Set(hierarchyData.current_windows.map((row)=>row.stage))
  const has = (stage:string)=>current.has(stage)
  if (has('relationship_rebuilding')) return '지금은 연락 여부보다, 이미 다시 이어진 관계가 이전과 다른 방식으로 유지될 수 있는지를 보는 구간이야.'
  if (has('in_person_meeting')) return '지금은 단순한 연락보다 실제 약속이나 만남으로 이어지는지를 확인할 수 있는 구간이야. 다만 만났다는 사실만으로 재회를 뜻하지는 않아.'
  if (has('contact_recontact')) return '지금 계산에는 연락·재접촉 단계의 후보가 잡혀 있어. 하지만 이 값만으로 “상대에게서 연락이 올 가능성이 높다”고 말할 수는 없어. 실제 선연락 방향 근거와 만남·재구축 근거는 따로 확인해야 해.'
  if (has('emotional_reactivation')) return '지금은 서로를 다시 떠올리거나 과거 관계를 의식하기 쉬운 흐름이 먼저야. 실제 연락·만남·재회는 아직 별도의 행동 근거가 필요해.'
  return '지금 기준일에는 관계가 실제로 움직인다고 볼 만큼 강한 현재 구간이 잡히지 않았어. 감정이 없다는 뜻이 아니라, 지금 날짜에서 공개할 행동 단계 근거가 부족하다는 뜻이야.'
}

function contactOutlook(hierarchyData: ReunionHierarchy, initiative?: ReunionSynthesis['initiative'] | null) {
  const currentContact = hierarchyData.current_windows.some((row)=>row.stage==='contact_recontact')
  const futureContact = hierarchyData.top_periods.filter((row)=>row.stage==='contact_recontact')
  const meeting = hierarchyData.current_windows.some((row)=>row.stage==='in_person_meeting') || hierarchyData.top_periods.some((row)=>row.stage==='in_person_meeting')
  const rebuilding = hierarchyData.current_windows.some((row)=>row.stage==='relationship_rebuilding') || hierarchyData.top_periods.some((row)=>row.stage==='relationship_rebuilding')
  const direction = initiative ? `${initiative.conclusion} ${initiative.interpretation}`.trim() : '현재 계산만으로는 누가 먼저 연락할지 판정할 수 없어.'
  if (currentContact) return `${direction} 연락과 관련된 후보 구간은 현재에 걸려 있지만, 그 자체가 실제 메시지 도착 확률은 아니야.${!meeting && !rebuilding ? ' 현재 계산에서는 그 뒤의 실제 만남이나 관계 재구축 후보까지 이어지지 않았어.' : ''}`
  if (futureContact.length) return `${direction} 지금 당장 연락 가능성이 높다고 볼 근거는 부족하고, 다음 연락·재접촉 후보는 ${futureContact[0].start}~${futureContact[0].end}야. 이 날짜도 사건 확정일이 아니라 연락 단계가 상대적으로 두드러지는 후보 구간이야.`
  return `${direction} 현재와 앞으로의 공개 후보 안에서 연락·재접촉 단계가 따로 잡히지 않았기 때문에, 지금 결과를 “연락이 올 흐름”이라고 읽으면 과장이야.`
}

function timingFallback(rows: ReunionPeriod[]) {
  if (!rows.length) return '현재 이후 공개할 만한 후보 시기가 없어. 없는 날짜를 억지로 만들어내지 않을게.'
  return rows.map((row)=>`${row.start}~${row.end}: ${row.label} 단계가 상대적으로 두드러지는 후보야.`).join(' ')
}

function directionCopy(row: DirectionRow) {
  const band = row.band ?? '정보 부족'
  if (row.kind === 'incoming') return `상대 → 나 관계 자극은 ${band}. 상대가 실제로 먼저 연락한다는 판정은 아니야.`
  if (row.kind === 'outgoing') return `나 → 상대 관계 자극은 ${band}. 내가 먼저 연락해야 한다는 지시는 아니야.`
  return `과거 인연 재접점 활성은 ${band}. 실제 재회 성사 여부와는 분리해서 봐.`
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
  const verdict = phaseVerdict(hierarchyData)
  const contact = contactOutlook(hierarchyData,reunionV2?.initiative)
  const why = reunionV2?.why_reconnect
    ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}`.trim()
    : '이 관계가 다시 신경 쓰이는 이유와 실제 연락이 생기는 이유는 같은 것으로 처리하지 않아. 감정이 남는 구조와 행동으로 옮기는 구조를 따로 봐.'
  const timing = reunionV2?.timing?.conclusion || timingFallback(hierarchyData.top_periods)
  const rebuild = reunionV2?.rebuild?.conclusion || `연락이 다시 닿는 것과 재회는 달라. 실제 만남이 잡히고, 이전에 끊겼던 문제를 다르게 다루는 합의가 이어져야 관계 재구축 단계로 읽을 수 있어. ${sustainabilityText}`
  const repeat = reunionV2?.repeat_risks?.conclusion || '연락은 이어지는데 만남을 계속 미루거나, 관계 이야기를 피하고, 예전과 같은 지점에서 대화가 끊기면 이번 흐름도 미련 확인이나 일시적 재접촉에서 멈출 수 있어.'
  const summary = firstSentence(reunionV2?.summary) || verdict
  const evidenceRows = topEvidence(evidence)

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">
    <h3>결론부터 보면</h3>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 해설을 보류했어.</p> : <>
      <section className="reunion-story reunion-consultation-lead">
        <div className="reunion-story-section reunion-story-current">
          <h4>지금 관계는 어디까지 와 있나</h4>
          <p className="reading-conclusion">{summary}</p>
          <p>{verdict}</p>
        </div>

        <div className="reunion-story-section reunion-story-contact">
          <h4>그래서 연락이 올 가능성은?</h4>
          <p>{contact}</p>
        </div>

        <div className="reunion-story-section reunion-story-why">
          <h4>왜 아직 서로를 신경 쓰기 쉬운가</h4>
          <p>{why}</p>
        </div>

        <div className="reunion-story-section reunion-story-timing">
          <h4>언제가 중요한가</h4>
          <p>{timing}</p>
          {!!reunionV2?.timing?.windows?.length && <div className="reunion-consultation-windows">{reunionV2.timing.windows.map((window,index)=><article className="relationship-pattern reunion-v2-window" key={`${window.period}:${index}`}><b>{window.period}</b><p>{window.meaning}</p></article>)}</div>}
        </div>

        <div className="reunion-story-section reunion-story-rebuild">
          <h4>연락이 오면 무엇을 봐야 하나</h4>
          <p>{rebuild}</p>
          {!!reunionV2?.rebuild?.conditions?.length && <ul>{reunionV2.rebuild.conditions.map((item,index)=><li key={index}>{item}</li>)}</ul>}
          <div className="reunion-behavior-guide">
            <p><b>안부·추억 이야기만 반복</b> → 아직은 미련 확인이나 반응 탐색에 가까울 수 있어.</p>
            <p><b>구체적인 만남을 잡음</b> → 감정이나 생각이 실제 행동 단계로 넘어가는 신호로 볼 수 있어.</p>
            <p><b>예전 문제와 앞으로의 관계를 피하지 않고 말함</b> → 그때부터 재회 의사와 관계 재구축 가능성을 따로 볼 수 있어.</p>
            <p><b>말은 다정한데 행동이 이어지지 않음</b> → 말의 온도보다 지속 행동을 더 중요하게 봐야 해.</p>
          </div>
        </div>

        <div className="reunion-story-section reunion-story-repeat">
          <h4>다시 멀어질 수 있는 패턴</h4>
          <p>{repeat}</p>
          {!!reunionV2?.repeat_risks?.patterns?.length && <ul>{reunionV2.repeat_risks.patterns.map((item,index)=><li key={index}>{item}</li>)}</ul>}
        </div>
      </section>

      <section className="reunion-final-takeaway">
        <h4>한 줄로 정리하면</h4>
        <p>{summary}</p>
      </section>

      <details className="reading-more reunion-contact-is-not-reunion">
        <summary>단계와 후보 시기 자세히 보기</summary>
        <p>다시 의식함 → 실제 연락·재접촉 → 실제 만남 → 관계 재구축은 서로 다른 관문이야. 앞 단계가 강하다고 다음 단계가 자동으로 성립하지 않아.</p>
        <p>{stageSummary(rows)}</p>
        {hierarchyData.current_windows.map((row)=><article className="relationship-pattern" key={`current:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {row.label}</b><p>기준일이 이 후보 구간 안에 있어. 사건 확정이 아니라 해당 단계가 상대적으로 두드러진다는 뜻이야.</p></article>)}
        {hierarchyData.top_periods.map((row)=><article className="relationship-pattern" key={`future:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {row.label}</b><p>앞으로의 후보 구간이야. 실제 사건은 별도 행동 신호가 붙는지 확인해야 해.</p></article>)}
      </details>

      <details className="reading-more reunion-direction-layer">
        <summary>상대 → 나 / 나 → 상대 보조지표 보기</summary>
        <ReadingDirections rows={neutralDirectionRows}/>
        <p>이 값은 관계 자극의 방향이지 실제 속마음이나 선연락 행동을 관측한 값이 아니야.</p>
      </details>

      <details className="reading-more reunion-retrospective">
        <summary>지난 활성기 · 사후 확인용</summary>
        <p>기준일 이전에 같은 관문을 통과했던 구간이야. 실제 기록과 비교하는 개인 사후 확인용이며, 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
        {hierarchyData.past_windows.map((row)=><article className="relationship-pattern" key={`past:${row.start}:${row.stage}`}><b>{row.start} ~ {row.end} · {row.label}</b><p>이미 지난 후보 구간이야. 현재나 미래의 예고로 다시 쓰지 않아.</p></article>)}
        {!hierarchyData.past_windows.length && <p>조회 범위 안에서 따로 비교할 지난 활성기가 없어.</p>}
      </details>

      <details className="reading-more reunion-calculation-basis">
        <summary>계산 근거 보기</summary>
        <p>{hierarchyData.score_meaning}</p>
        <h5>보조지표 활성도</h5>
        <div className="reunion-stage-activation-list">{hierarchyData.stages.map((stage)=><p key={stage.stage}><b>{stage.label}</b> {Math.round(stage.activation)}</p>)}</div>
        <p>숫자는 사건 확률이나 현재 감정 세기가 아니라, 조회 범위에서 각 단계 기준을 통과한 후보의 상대 비교값이야.</p>
        {!!evidenceRows.length && <div className="reunion-local-evidence-grid">{evidenceRows.map((row,index)=><article className="relationship-pattern reunion-local-evidence" key={`${row.a}:${row.aspect}:${row.b}:${index}`}><strong>{evidenceLabel(row)}</strong><p>{Array.isArray(row.relationship_domains) && row.relationship_domains.length ? `관계 해석 영역: ${row.relationship_domains.join(' · ')}` : '관계 해석에 사용된 계산 근거야.'}</p></article>)}</div>}
        {hierarchyData.stability_structure && <p>고정 관계 구조 · 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
        {reunionV2?.precision_note && <Copy value={reunionV2.precision_note}/>} 
        {hierarchyData.limitations.map((item)=><p key={item}>{item}</p>)}
      </details>
    </>}
  </section>
}
