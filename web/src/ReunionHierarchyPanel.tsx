import type { RelationshipAiResponse } from './appTypes'
import { ReadingDirections, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy } from './lib/reunionHierarchy'

const STAGE_COPY: Record<string, string> = {
  emotional_reactivation: '감정과 기억이 다시 올라오는 단계야. 아직 실제 연락이 생겼다는 뜻은 아니야.',
  contact_recontact: '메시지·답장·안부처럼 실제 상호작용이 다시 시작되는 단계야. 연락이 닿아도 재회를 뜻하지는 않아.',
  in_person_meeting: '대화가 현실 약속이나 직접 만남으로 이어지는 단계야. 온라인 반응과 실제 만남은 따로 봐.',
  relationship_rebuilding: '다시 만난 뒤 관계를 어떤 조건으로 이어갈지 정하는 단계야. 예전 패턴이 실제로 달라지는지가 핵심이야.',
}

const STAGE_ORDER = [
  ['emotional_reactivation', '감정 재활성화'],
  ['contact_recontact', '연락·재접촉'],
  ['in_person_meeting', '실제 만남'],
  ['relationship_rebuilding', '관계 재구축'],
] as const

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>

function stageCopy(stage: string, label = '') {
  if (STAGE_COPY[stage]) return STAGE_COPY[stage]
  if (label.includes('감정')) return STAGE_COPY.emotional_reactivation
  if (label.includes('연락') || label.includes('접촉')) return STAGE_COPY.contact_recontact
  if (label.includes('만남')) return STAGE_COPY.in_person_meeting
  return STAGE_COPY.relationship_rebuilding
}

function Copy({ value }: { value?: string | null }) {
  const text = String(value ?? '').trim()
  return text ? <p>{text}</p> : null
}

export function ReunionHierarchyPanel({
  hierarchyData,
  reunionV2,
  directionRows,
  sustainabilityText,
}: {
  hierarchyData: ReunionHierarchy
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const current = hierarchyData.current_windows
  const future = hierarchyData.top_periods
  const past = hierarchyData.past_windows

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">
    <h3>지금 두 사람은 어디에 있나</h3>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 판정을 보류했어.</p> : <>
      <section className="reunion-ai-block reunion-current-state">
        {reunionV2?.summary ? <Copy value={reunionV2.summary}/> : current.length ?
          <p>기준일 {hierarchyData.as_of_date}에는 {current.map((row)=>row.label).join(' · ')} 단계의 공개 활성창이 걸려 있어. 이것은 사건 확정이 아니라 현재 계층 관문을 통과한 흐름이 있다는 뜻이야.</p> :
          <p>기준일 {hierarchyData.as_of_date}을 포함하는 공개 활성창은 없어. 현재 감정이나 관심이 없다는 뜻이 아니라, 계산상 현재 단계 후보가 관문을 통과하지 않았다는 뜻이야.</p>}
        {current.map((row)=><article className="relationship-pattern reunion-current-window" key={`current:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label}</b>
          <p>{stageCopy(row.stage, row.label)}</p>
          <small>기준일 포함 · 사건 확정 아님 · 보조지표 활성도 {row.final}</small>
        </article>)}
      </section>

      <section className="reunion-ai-block reunion-direction-layer">
        <h4>서로에게 걸리는 방향</h4>
        <ReadingDirections rows={directionRows}/>
        {reunionV2?.initiative && <>
          <Copy value={reunionV2.initiative.conclusion}/>
          <Copy value={reunionV2.initiative.interpretation}/>
        </>}
        <p className="reunion-score-meaning">여기서 ‘상대 → 나’와 ‘나 → 상대’는 계산된 활성 방향이야. 실제 속마음이나 실제 선연락 행동을 관측한 값은 아니야.</p>
        <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 독립된 행동 방향 근거가 충분하지 않으면 판정하지 않아.</p>
      </section>

      <section className="reunion-ai-block reunion-relationship-state">
        <h4>관계 자체의 현재 단계</h4>
        {reunionV2?.timing?.conclusion ? <Copy value={reunionV2.timing.conclusion}/> : <p>{sustainabilityText}</p>}
        <p className="reunion-score-meaning">개인의 숨은 마음을 단정하는 칸이 아니라, 진행 컴포짓을 포함한 관계층과 단계별 관문이 지금 어떻게 맞물리는지 보는 칸이야.</p>
      </section>

      <section className="reunion-ai-block reunion-retrospective">
        <h4>지난 활성기 · 사후 확인용</h4>
        <p className="reunion-score-meaning">기준일 이전에 같은 관문을 통과했던 구간이야. 실제 메시지·만남·관계 변화 기록과 비교하는 개인 사후 확인용이며, 과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
        {past.map((row)=><article className="relationship-pattern reunion-past-window" key={`past:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label}</b>
          <p>{stageCopy(row.stage, row.label)}</p>
          <small>대표 날짜 {row.date} · 이미 지난 구간 · 보조지표 활성도 {row.final}</small>
        </article>)}
        {!past.length && <p>조회 범위 안에서 따로 비교할 지난 활성기가 없어.</p>}
      </section>

      <section className="reunion-ai-block reunion-future-flow">
        <h4>앞으로의 후보 시기</h4>
        {hierarchyData.nearest_window && <p><b>가장 가까운 후보</b> · {hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</p>}
        {future.map((row)=><article className="relationship-pattern reunion-future-window" key={`future:${row.start}:${row.stage}`}>
          <b>{row.start} ~ {row.end} · {row.label} 후보 창</b>
          <p>{stageCopy(row.stage, row.label)}</p>
          <small>대표 날짜 {row.date} · 사건 확정일 아님 · 보조지표 활성도 {row.final}</small>
          <details><summary>왜 후보가 됐는지</summary><p>장기 배경과 중기 흐름이 먼저 겹친 뒤, 이 단계에 맞는 사건 촉발 신호까지 함께 통과했어.</p><small>장기 {row.components.long_term} · 중기 {row.components.mid_term} · 사건 촉발 {row.components.event_trigger} · 체계 교차 {row.components.cross_system} · 최종 {row.components.final}</small></details>
        </article>)}
        {!future.length && <p>오늘 이후 공개할 후보 시기가 없어.</p>}
      </section>

      <section className="reunion-ai-block reunion-contact-is-not-reunion">
        <h4>연락 ≠ 재회</h4>
        <p>연락·재접촉은 메시지나 답장처럼 상호작용이 다시 시작되는 단계야. 그 뒤 대화가 이어지고, 실제 만남이 생기고, 관계 조건이 달라지는지는 각각 별도 관문으로 봐.</p>
        <div className="reunion-stage-status">
          {STAGE_ORDER.map(([key,label])=>{
            const stage = hierarchyData.stages[key]
            return <p key={key}><b>{label}</b> · {stageCopy(key,label)} <small>{stage?.candidate_count ? `미래 후보 ${stage.candidate_count}개` : '공개할 미래 후보 없음'}</small></p>
          })}
        </div>
      </section>

      <section className="reunion-ai-block reunion-rebuild-conditions">
        <h4>관계를 다시 이어가려면</h4>
        {reunionV2?.rebuild?.conclusion ? <Copy value={reunionV2.rebuild.conclusion}/> : <p>{sustainabilityText}</p>}
        {!!reunionV2?.rebuild?.conditions?.length && <ul>{reunionV2.rebuild.conditions.slice(0,4).map((condition,index)=><li key={index}>{condition}</li>)}</ul>}
        <p className="reunion-score-meaning">재접촉이 있었다는 사실보다, 같은 갈등 패턴이 실제 행동에서 달라지는지를 더 중요하게 봐.</p>
      </section>

      {(reunionV2?.repeat_risks?.conclusion || reunionV2?.repeat_risks?.patterns?.length) && <details className="reading-more reunion-repeat-risks">
        <summary>다시 멀어질 수 있는 지점</summary>
        <Copy value={reunionV2.repeat_risks.conclusion}/>
        {!!reunionV2.repeat_risks.patterns.length && <ul>{reunionV2.repeat_risks.patterns.slice(0,3).map((pattern,index)=><li key={index}>{pattern}</li>)}</ul>}
      </details>}

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
