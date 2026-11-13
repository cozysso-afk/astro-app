import type { Aspect, ReunionObservationContext } from './appTypes'
import { ReadingTimeline, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy } from './lib/reunionHierarchy'
import { compareObservedEvents, initiatorLabels, observationReading } from './lib/reunionObservation'
import { aspectText } from './lib/resultFormatters'
import { buildReunionReadingV4 } from './lib/reunionReadingV4'

const STAGE_LABEL: Record<string,string> = {
  emotional_reactivation: '서로를 다시 의식하는 배경',
  contact_recontact: '연락·대화 재개',
  in_person_meeting: '실제 만남',
  relationship_rebuilding: '관계 재구축',
}

function rowScore(row?: DirectionRow) {
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
}

const evidenceDirections: Record<string,string> = {
  counterpart_to_user:'상대의 진행 차트 → 내 출생 차트',
  user_to_counterpart:'내 진행 차트 → 상대의 출생 차트',
  shared:'두 사람의 진행 차트',
  relationship_itself:'관계 자체의 진행 컴포짓',
  other:'기타 관계 접점',
}
const phaseLabels: Record<string,string> = {
  applying:'월별 표본에서 오브가 좁아지는 흐름',
  separating:'월별 표본에서 오브가 넓어지는 흐름',
  indeterminate:'오브의 변화 방향 미확인',
  exact:'표본에서 정확한 각도에 근접',
}

export function ReunionProgressionEvidence({evidence,showHouses}:{evidence:Aspect[];showHouses:boolean}) {
  const groups = new Map<string,Aspect[]>()
  for (const row of evidence) {
    if (!row || !Number.isFinite(row.orb) || row.orb < 0) continue
    const direction = row.direction && Object.hasOwn(evidenceDirections,row.direction) ? row.direction : 'other'
    const group=groups.get(direction) ?? []
    group.push(row)
    groups.set(direction,group)
  }
  if (!groups.size) return null
  return <section aria-label="진행 차트 근거"><h4>진행 차트에서 가까운 각</h4>
    <p>방향별로 오브가 작은 접점을 두 개까지 보여요. 날짜는 차트를 비교한 날이에요.</p>
    {Object.entries(evidenceDirections).map(([key,label])=>{
      const group=groups.get(key)
      if (!group) return null
      return <section key={key} data-progression-direction={key}><h5>{label}</h5>
        {group.sort((a,b)=>a.orb-b.orb).slice(0,2).map((row,index)=>{
          const house=showHouses ? row.target_house : undefined
          const details=[
            row.reference_date && `표본일 ${row.reference_date}`,
            phaseLabels[row.phase ?? ''],
            house?.whole_house && `홀사인 ${house.whole_house}하우스`,
            house?.quadrant_house && `사분면 ${house.quadrant_house}하우스`,
          ].filter(Boolean)
          return <p key={index}>{aspectText(row)} · 오브 {row.orb<0.01?'<0.01°':row.orb.toFixed(2)+'°'}
            {details.length>0 && <small> · {details.join(' · ')}</small>}
          </p>
        })}
      </section>
    })}
  </section>
}

export function RecordedFirstContact({initiator}:{initiator?:ReunionObservationContext['initiator']}) {
  return <p className="reunion-v5-note"><b>실제 첫 연락</b> · {initiator && initiatorLabels[initiator] || '미기록'}</p>
}

export function ReunionHierarchyPanel({ hierarchyData, historyHierarchyData, historyCalculated=false, observation={state:'',initiator:'',events:[]}, evidence, showEvidenceHouses=false, directionRows, showObservation=true }: {
  hierarchyData: ReunionHierarchy
  historyHierarchyData?: ReunionHierarchy | null
  historyCalculated?: boolean
  observation?: ReunionObservationContext
  evidence: Aspect[]
  showEvidenceHouses?: boolean
  directionRows: DirectionRow[]
  showObservation?: boolean
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const readingV4 = buildReunionReadingV4({
    hierarchy: hierarchyData,
    observation,
    directionRows,
  })
  const stageRows = [
    {key:'emotional_reactivation',label:'다시 의식하기'},
    {key:'contact_recontact',label:'연락·대화'},
    {key:'in_person_meeting',label:'실제 만남'},
    {key:'relationship_rebuilding',label:'관계 재구축'},
  ]
  const historyRows = historyHierarchyData?.past_windows ?? []
  const comparisons = compareObservedEvents(observation, historyHierarchyData ?? null, historyCalculated)
  const currentAxisKey = [...readingV4.axes].reverse().find(row => row.state === 'observed')?.key
  return <section className="reading-section reunion-hierarchy reunion-ui-v5">
    {!valid ? <p role="alert">계산 확인이 필요해요. 다시 계산한 뒤 결과를 확인해 주세요.</p> : <>
      {showObservation && <section className="reunion-v5-answer">
        <div className="reunion-v4-answer-meta"><span>입력한 관계 기록</span><time>기준일 {hierarchyData.as_of_date}</time></div>
        <h3>{observationReading(observation).title}</h3>
      </section>}
      <section className="reunion-v5-section reunion-v4-stage-section">
        <h4>관계가 어디까지 왔는지</h4>
        <ol className="reunion-v4-stage-rail" aria-label="재회 6단계 진행표">
          {readingV4.axes.map(row => <li key={row.key} data-stage-state={row.state} aria-current={row.key === currentAxisKey ? 'step' : undefined}>
            <span>{row.label}</span><strong>{row.status}</strong>
          </li>)}
        </ol>
      </section>
      {readingV4.futureWindows.length > 0 ? <section className="reunion-v5-section reunion-v4-future-windows">
        <h4>다음 단계의 계산상 참고 시기</h4>
        <ReadingTimeline events={readingV4.futureWindows.map(row=>({date:row.date,kind:row.stage==='relationship_rebuilding'?'rebuilding':row.stage==='contact_recontact'?'incoming':'reconnection',label:row.label,status:'주목'}))} context={{now:new Date(hierarchyData.as_of_date+'T12:00:00+09:00')}}/>
      </section> : null}
      <section className="reunion-v5-section reunion-v4-directions-section">
        <h4>연락 방향 참고값</h4>
        <div className="reunion-v5-directions">
          {readingV4.directions.map(row=><article key={row.key}><div className="reunion-v4-direction-head"><b>{row.label}</b><strong>{row.metric}{row.score != null ? ` · ${row.score}점` : ''}</strong></div><p>{row.meaning}</p></article>)}
        </div>
        <RecordedFirstContact initiator={observation.initiator}/>
        <p className="reunion-v5-direction-summary">수신·발신 값은 연락 방향을 비교한 참고값이며, 실제 첫 연락자는 별도 기록으로 확인해요.</p>
      </section>
      <section className="reunion-v4-disclosures" aria-label="재회 상세 자료">
      <details className="reunion-v5-details"><summary>지난 시기와 실제 기록 비교</summary>
        <p>이미 지난 날짜의 비교 자료예요. 예측 적중률을 뜻하지 않아요.</p>
        {!historyCalculated ? <p>과거 분석을 실행하면 기록과 비교할 수 있어요.</p> : null}
        {historyCalculated && historyRows.length === 0 ? <p>선택한 과거 기간을 계산했지만 비교할 시기 신호를 찾지 못했어요.</p> : null}
        {historyRows.map((row,index)=><p key={index}><time>{row.start} ~ {row.end}</time> · {Object.hasOwn(STAGE_LABEL,row.stage) ? STAGE_LABEL[row.stage] : '관계 단계 미확인'}</p>)}
        {comparisons.map(row=><p key={row.kind+row.date}>{row.label} · {row.date}: {row.detail}</p>)}
      </details>
      <details className="reunion-v5-details"><summary>계산 근거와 점수 보기</summary>
        <p>점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요.</p>
        {stageRows.map(row=><p key={row.key}>{row.label}: {hierarchyData.stages[row.key]?.activation == null ? '점수 없음' : Math.round(hierarchyData.stages[row.key].activation!)}</p>)}
        {directionRows.filter(row=>row.kind!=='reconnection').map(row=><p key={row.kind}>{row.kind==='incoming'?'상대 차트':'내 차트'} 활성도: {rowScore(row) ?? '정보 없음'}</p>)}
        <p>차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요.</p>
        <ReunionProgressionEvidence evidence={evidence} showHouses={showEvidenceHouses}/>
      </details>
      </section>
    </>}
  </section>
}
