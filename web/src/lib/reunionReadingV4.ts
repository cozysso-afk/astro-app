import type { ReunionObservationContext } from '../appTypes'
import type { DirectionRow } from '../ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './reunionHierarchy'

export type ReunionAxisKey = 'awareness' | 'recontact' | 'continuity' | 'meeting' | 'agreement' | 'sustainability'
export type ReunionAxisState = 'observed' | 'current_signal' | 'future_candidate' | 'no_candidate' | 'blocked' | 'not_calculated'

export type ReunionAxisV4 = {
  key: ReunionAxisKey
  label: string
  state: ReunionAxisState
  status: string
  source: 'observation' | 'calculation' | 'interpretation'
}

export type ReunionDirectionV4 = {
  key: 'counterpart_to_user_activation' | 'user_to_counterpart_activation'
  label: string
  metric: string
  meaning: string
}

export type ReunionReadingV4 = {
  axes: ReunionAxisV4[]
  directions: ReunionDirectionV4[]
  observedInitiator?: string
  futureWindows: Array<{ date: string; label: string; stage: string }>
}

const STAGE_FOR_AXIS: Partial<Record<ReunionAxisKey, string>> = {
  awareness: 'emotional_reactivation',
  recontact: 'contact_recontact',
  meeting: 'in_person_meeting',
  agreement: 'relationship_rebuilding',
}

const AXIS_LABEL: Record<ReunionAxisKey, string> = {
  awareness: '과거 관계가 다시 떠오름',
  recontact: '연락이 닿음',
  continuity: '대화가 이어짐',
  meeting: '실제 만남',
  agreement: '다시 만나기로 정함',
  sustainability: '관계 유지',
}

const AXIS_ORDER: ReunionAxisKey[] = ['awareness','recontact','continuity','meeting','agreement','sustainability']

function stageInfo(hierarchy: ReunionHierarchy, stage: string) {
  const row = hierarchy.stages?.[stage]
  const current = hierarchy.current_windows.some(window => window.stage === stage)
  const future = hierarchy.top_periods.some(window => window.stage === stage)
  const count = typeof row?.candidate_count === 'number' && Number.isFinite(row.candidate_count) ? row.candidate_count : null
  return { row, current, future, count, hasSignal: current || future || Boolean(count && count > 0) }
}

function observedAxes(context: ReunionObservationContext) {
  const states = new Set<ReunionAxisKey>()
  if (['recontacted','messaging','met','intimate_undefined','reunited'].includes(context.state)) {
    states.add('awareness')
    states.add('recontact')
  }
  if (context.state === 'messaging') states.add('continuity')
  if (['met','intimate_undefined','reunited'].includes(context.state)) states.add('meeting')
  if (context.state === 'reunited') states.add('agreement')
  return states
}

function rawAxisState(key: ReunionAxisKey, hierarchy: ReunionHierarchy, observed: Set<ReunionAxisKey>): ReunionAxisState {
  if (observed.has(key)) return 'observed'
  if (key === 'continuity') return 'not_calculated'
  if (key === 'sustainability') return 'not_calculated'
  const stage = STAGE_FOR_AXIS[key]
  if (!stage) return 'not_calculated'
  const info = stageInfo(hierarchy, stage)
  if (info.current) return 'current_signal'
  if (info.future || (info.count != null && info.count > 0)) return 'future_candidate'
  if (info.count === 0) return 'no_candidate'
  return 'not_calculated'
}

function stateStatus(key: ReunionAxisKey, state: ReunionAxisState) {
  if (state === 'observed') return '확인됨'
  if (state === 'current_signal') return '지금 주목'
  if (state === 'future_candidate') return '주목 시기 있음'
  if (state === 'no_candidate') return '뚜렷한 시기 없음'
  if (state === 'blocked') return '앞 단계 미확인'
  if (key === 'continuity') return '대화 기록으로 확인'
  if (key === 'sustainability') return '지속 행동으로 확인'
  return '판정 자료 없음'
}

function availableState(state: ReunionAxisState) {
  return state === 'observed' || state === 'current_signal' || state === 'future_candidate'
}

function buildAxes(hierarchy: ReunionHierarchy, context: ReunionObservationContext) {
  const observed = observedAxes(context)
  const raw = new Map(AXIS_ORDER.map(key => [key, rawAxisState(key, hierarchy, observed)]))
  return AXIS_ORDER.map<ReunionAxisV4>(key => {
    let state = raw.get(key)!
    if (key === 'meeting' && !observed.has(key) && !availableState(raw.get('recontact')!)) state = 'blocked'
    if (key === 'agreement' && !observed.has(key) && !observed.has('meeting')) state = 'blocked'
    if (key === 'sustainability' && !observed.has('agreement')) state = 'blocked'
    return {
      key,
      label: AXIS_LABEL[key],
      state,
      status: stateStatus(key, state),
      source: observed.has(key) ? 'observation' : key === 'continuity' || key === 'sustainability' ? 'interpretation' : 'calculation',
    }
  })
}

function scoreOf(rows: DirectionRow[], kind: 'incoming' | 'outgoing') {
  const row = rows.find(item => item.kind === kind)
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
}

function bandOf(rows: DirectionRow[], kind: 'incoming' | 'outgoing') {
  return rows.find(item => item.kind === kind)?.band || '정보 부족'
}

function directions(rows: DirectionRow[]): ReunionDirectionV4[] {
  const incoming = scoreOf(rows, 'incoming')
  const outgoing = scoreOf(rows, 'outgoing')
  return [
    {
      key:'counterpart_to_user_activation',
      label:'수신 · 상대 → 나',
      metric: incoming == null ? '정보 부족' : bandOf(rows, 'incoming'),
      meaning:'상대 쪽 흐름이 내 관계와 맞물리는 정도예요.',
    },
    {
      key:'user_to_counterpart_activation',
      label:'발신 · 나 → 상대',
      metric: outgoing == null ? '정보 부족' : bandOf(rows, 'outgoing'),
      meaning:'내 쪽 흐름이 상대와의 관계를 의식하기 쉬운 정도예요.',
    },
  ]
}

function observedInitiator(context: ReunionObservationContext) {
  if (context.initiator === 'counterpart') return '상대가 먼저'
  if (context.initiator === 'user') return '내가 먼저'
  if (context.initiator === 'mutual') return '서로 비슷한 시점'
  if (context.initiator === 'unknown') return '확인 어려움'
  return undefined
}

function windowLabel(row: ReunionPeriod) {
  if (row.stage === 'contact_recontact') return '연락·대화 재개'
  if (row.stage === 'in_person_meeting') return '실제 만남'
  if (row.stage === 'relationship_rebuilding') return '관계 합의·재구축'
  return '다시 의식하는 배경'
}

export function buildReunionReadingV4({ hierarchy, observation, directionRows, hasSustainabilityEvidence = false }: {
  hierarchy: ReunionHierarchy
  observation: ReunionObservationContext
  directionRows: DirectionRow[]
  hasSustainabilityEvidence?: boolean
}): ReunionReadingV4 {
  void hasSustainabilityEvidence
  const axes = buildAxes(hierarchy, observation)
  const targetAxis: ReunionAxisKey | undefined = observation.state === 'disconnected'
    ? 'recontact'
    : observation.state === 'recontacted' || observation.state === 'messaging'
      ? 'meeting'
      : observation.state === 'met' || observation.state === 'intimate_undefined'
        ? 'agreement'
        : observation.state === 'reunited'
          ? undefined
          : axes.find(row => row.state !== 'observed' && row.state !== 'blocked' && STAGE_FOR_AXIS[row.key])?.key
  const futureWindows = hierarchy.top_periods
    .filter(row => row.end >= hierarchy.as_of_date)
    .filter(row => targetAxis && STAGE_FOR_AXIS[targetAxis] === row.stage)
    .slice(0, 2)
    .map(row => ({ date: row.start === row.end ? row.start : `${row.start}~${row.end}`, label: windowLabel(row), stage: row.stage }))
  return {
    axes,
    directions: directions(directionRows),
    observedInitiator: observedInitiator(observation),
    futureWindows,
  }
}

