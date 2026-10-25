import type { ReunionObservationContext } from '../appTypes'
import type { DirectionRow } from '../ReadingSignals'
import type { ReunionHierarchy, ReunionPeriod } from './reunionHierarchy'
import type { ReaderManuscriptV4, ReadingTone } from './readingModelV4'

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
  manuscript: ReaderManuscriptV4
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

function axis(axes: ReunionAxisV4[], key: ReunionAxisKey) {
  return axes.find(row => row.key === key)!
}

function available(row: ReunionAxisV4) {
  return row.state === 'observed' || row.state === 'current_signal' || row.state === 'future_candidate'
}

function manuscriptFor(axes: ReunionAxisV4[], context: ReunionObservationContext): ReaderManuscriptV4 {
  const recontact = axis(axes, 'recontact')
  const continuity = axis(axes, 'continuity')
  const meeting = axis(axes, 'meeting')
  const agreement = axis(axes, 'agreement')
  let title = available(meeting)
    ? '만남으로 이어질 여지는 있지만 재회 여부는 아직 열려 있어요'
    : available(recontact)
      ? '재접촉 여지는 있지만 아직 재회 단계는 아니에요'
      : '이번 기간에는 재회를 움직일 신호가 약해요'
  let answer = available(meeting)
    ? '연락 뒤 실제 만남으로 이어질 시기는 남아 있어요. 다만 현재 연락·만남 상태를 입력하지 않아, 관계가 현실에서 어디까지 왔는지는 따로 판단하지 않았어요.'
    : available(recontact)
      ? '다시 연락이 닿을 여지는 보이지만, 실제 만남과 관계 회복까지 이어졌다고 볼 근거는 없어요. 현재 상태를 입력하면 다음 단계부터 더 정확히 볼 수 있어요.'
      : '다시 생각나는 마음과 실제 관계 회복은 달라요. 이번 기간에는 연락·만남·관계 회복으로 이어지는 흐름이 뚜렷하지 않아요.'
  let tone: ReadingTone = 'insufficient'
  let reasons = available(meeting)
    ? ['연락 다음 단계인 만남 시기가 남아 있어요.', '현재의 실제 연락·만남 여부는 입력되지 않았어요.']
    : available(recontact)
      ? ['연락을 다시 여는 시기는 남아 있어요.', '만남 이후 단계는 아직 뚜렷하지 않아요.']
      : ['연락과 만남을 앞으로 밀어 주는 시기가 뚜렷하지 않아요.']
  let limit = '현실의 연락·만남 상태가 없으면 재회가 진행 중인지까지는 정할 수 없어요.'
  let checkpoint = '새 연락이 실제로 닿는지, 닿았다면 대화가 며칠 이어지는지 보세요.'
  let risesWhen = ['직접 연락이 닿고 질문과 답이 이어질 때']
  let fallsWhen = ['새 접촉 없이 과거 생각만 반복될 때']

  if (context.state === 'disconnected') {
    title = available(recontact) ? '재접촉 신호는 있지만 현실에서는 아직 단절 상태예요' : '현재는 재회보다 단절 상태가 더 분명해요'
    answer = available(recontact)
      ? '연락을 다시 열 수 있는 시기는 잡혀 있지만, 차단 해제나 직접 접촉은 아직 확인되지 않았어요. 지금 결과는 재회 진행이 아니라 재접촉을 살펴볼 구간에 가깝습니다.'
      : '현재 확인된 사실은 단절이고, 이번 조회에서도 연락을 다시 여는 단계가 두드러지지 않았어요. 재회가 진행 중이라고 볼 근거는 아직 없습니다.'
    tone = 'caution'
    reasons = available(recontact)
      ? ['현재 확인된 현실은 단절 상태예요.', '연락을 다시 열 수 있는 시기는 남아 있어요.']
      : ['현재 단절 상태이고 연락을 다시 여는 시기도 뚜렷하지 않아요.']
    limit = '마음이 다시 움직이는 것과 실제 연락이 닿는 것은 다른 단계예요.'
    checkpoint = '차단 해제나 직접 연락처럼 현실에서 확인되는 변화가 먼저 필요해요.'
  } else if (context.state === 'recontacted' || context.state === 'messaging') {
    title = available(meeting) ? '연락은 다시 닿았고, 다음 분기점은 실제 만남이에요' : '연락은 다시 닿았지만, 관계는 재접촉 단계에 머물러 있어요'
    answer = available(meeting)
      ? '재접촉 단계는 지났고 실제 만남과 연결된 주목 시기도 남아 있어요. 다만 구체적인 약속과 관계 이야기가 확인되기 전에는 아직 관계가 다시 시작됐다고 보기 어려워요.'
      : '이번 기간에는 실제 만남으로 이어질 움직임이 뚜렷하지 않아요. 지금은 재회 여부보다 대화가 지속되고 약속이 구체화되는지를 먼저 보는 편이 맞아요.'
    tone = available(meeting) ? 'mixed' : 'caution'
    reasons = available(meeting)
      ? ['실제 연락은 이미 닿았어요.', '실제 만남과 연결된 주목 시기가 남아 있어요.']
      : ['실제 연락은 이미 닿았지만, 만남과 연결된 시기는 뚜렷하지 않아요.']
    limit = continuity.state === 'observed' ? '대화가 이어져도 실제 약속이 잡혀야 다음 단계로 볼 수 있어요.' : '한 번의 연락만으로 관계 회복까지 판단할 수는 없어요.'
    checkpoint = '답장 속도보다 대화가 이어지고 날짜와 장소가 있는 만남 제안이 생기는지 보세요.'
    risesWhen = ['질문과 답이 며칠 이어질 때', '날짜와 장소가 포함된 만남 제안이 생길 때']
    fallsWhen = ['안부나 추억 이야기만 반복될 때', '만남 이야기가 계속 흐려질 때']
  } else if (context.state === 'met' || context.state === 'intimate_undefined') {
    title = available(agreement) ? '다시 만났고, 이제 관계를 어떻게 이어갈지 정할 차례예요' : '다시 만났지만, 아직 관계를 다시 시작한 것은 아니에요'
    answer = available(agreement)
      ? '만남은 확인됐고 관계를 다시 정리해 볼 시기도 남아 있어요. 친밀감보다 서로 원하는 관계와 다음 약속을 말로 맞추는지가 중요해요.'
      : '만남 뒤 관계를 다시 정하고 이어 가는 움직임이 뚜렷하지 않아요. 다음 약속과 관계 이야기가 이어지지 않으면 이번 만남은 재접촉의 연장으로 보는 편이 맞아요.'
    tone = available(agreement) ? 'mixed' : 'caution'
    reasons = available(agreement)
      ? ['실제 만남은 이미 있었어요.', '관계를 다시 정리해 볼 시기가 남아 있어요.']
      : ['실제 만남은 있었지만, 관계를 다시 정할 시기는 뚜렷하지 않아요.']
    limit = '만났다는 사실과 다시 교제하기로 합의한 것은 다른 단계예요.'
    checkpoint = '다음 만남이 이어지고 서로 원하는 관계를 직접 말하는지 확인해 보세요.'
    risesWhen = ['다음 약속이 자연스럽게 이어질 때', '관계 기대를 피하지 않고 말로 맞출 때']
    fallsWhen = ['친밀한 만남 뒤 연락이 다시 끊길 때', '관계 이야기를 계속 피할 때']
  } else if (context.state === 'reunited') {
    title = '다시 만나기로 한 사실은 이미 확인됐어요'
    answer = '이제 질문은 재회 여부가 아니라, 이번 관계가 이전과 다르게 이어질 수 있느냐예요. 약속을 지키고 갈등 뒤 대화를 복구하는 행동이 반복되는지를 보세요.'
    tone = 'mixed'
    reasons = ['두 사람이 관계를 다시 시작하기로 한 사실은 확인됐어요.', '이제 결과를 바꾸는 것은 합의 뒤의 반복 행동이에요.']
    limit = '관계 합의가 곧 장기적인 안정성을 보장하지는 않아요.'
    checkpoint = '불편한 문제를 피하지 않고 합의한 연락·만남 방식을 실제로 지키는지 보세요.'
    risesWhen = ['갈등 뒤에도 대화를 다시 이어갈 때', '합의한 약속이 반복해서 지켜질 때']
    fallsWhen = ['이전 갈등을 같은 방식으로 회피할 때', '관계 합의 뒤 행동이 다시 끊길 때']
  }

  return {
    topic: '재회',
    verdict: { title, answer, tone },
    reasons: reasons.slice(0, 1).map((text, index) => ({ id:`reunion-reason-${index + 1}`, kind: context.state ? 'observed' : 'calculated', text, evidenceRefs:[] })),
    limitingFactor: { id:'reunion-limit', kind:'interpretive', text: limit, evidenceRefs:[] },
    nextCheckpoint: { id:'reunion-next', kind:'advisory', text: checkpoint, evidenceRefs:[] },
    risesWhen,
    fallsWhen,
    scopeNote: '수신·발신 값은 연락 방향을 비교한 참고값이며, 실제 첫 연락자는 별도 기록으로 확인해요.',
  }
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
    manuscript: manuscriptFor(axes, observation),
    axes,
    directions: directions(directionRows),
    observedInitiator: observedInitiator(observation),
    futureWindows,
  }
}

