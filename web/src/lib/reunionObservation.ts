import type { ReunionObservationContext, ReunionObservedEventKind, ReunionObservedState } from '../appTypes'
import type { ReunionHierarchy, ReunionPeriod } from './reunionHierarchy'

export const REUNION_STAGE_ORDER = ['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding'] as const
export type ReunionStage = typeof REUNION_STAGE_ORDER[number]

export const REUNION_STATE_OPTIONS: Array<{value:ReunionObservedState;label:string}> = [
  { value:'', label:'현재 상태 입력 안 함' },
  { value:'disconnected', label:'완전 단절 또는 차단' },
  { value:'recontacted', label:'상대 또는 본인의 재접촉 발생' },
  { value:'messaging', label:'현재 서로 연락하는 중' },
  { value:'met', label:'실제로 다시 만남' },
  { value:'intimate_undefined', label:'친밀하지만 교제는 미정' },
  { value:'reunited', label:'관계 재정립 또는 재결합 합의' },
]

const OBSERVED_STAGE: Record<Exclude<ReunionObservedState,''>, ReunionStage | null> = {
  disconnected:null,
  recontacted:'contact_recontact',
  messaging:'contact_recontact',
  met:'in_person_meeting',
  intimate_undefined:'in_person_meeting',
  reunited:'relationship_rebuilding',
}

const EVENT_STAGE: Record<ReunionObservedEventKind, ReunionStage> = {
  recontact:'contact_recontact', meeting:'in_person_meeting', rebuilding:'relationship_rebuilding',
}

export function observedStage(state: ReunionObservedState): ReunionStage | null {
  return state ? OBSERVED_STAGE[state] : null
}

export function nextUnconfirmedStage(state: ReunionObservedState): ReunionStage | null {
  if (!state || state === 'disconnected') return 'contact_recontact'
  const stage = observedStage(state)
  if (!stage) return 'contact_recontact'
  const index = REUNION_STAGE_ORDER.indexOf(stage)
  return REUNION_STAGE_ORDER[index + 1] ?? null
}

export function observationReading(context: ReunionObservationContext) {
  const next = nextUnconfirmedStage(context.state)
  const frequency = context.contactFrequency === 'daily' ? '매일' : context.contactFrequency === 'frequent' ? '자주' : context.contactFrequency === 'occasional' ? '간헐적으로' : context.contactFrequency === 'single' ? '한 차례' : ''
  const dateRange = context.contactStartDate && context.contactEndDate
    ? `${context.contactStartDate}부터 ${context.contactEndDate}까지`
    : context.contactStartDate ? `${context.contactStartDate}부터` : context.contactEndDate ? `${context.contactEndDate}까지` : ''
  const continuity = [dateRange, frequency, (dateRange || frequency) ? '연락한 사실이 확인됐어.' : ''].filter(Boolean).join(' ')
  const lastSide = context.lastMessageBy === 'counterpart' ? '마지막 메시지는 상대가 보냈어.' : context.lastMessageBy === 'user' ? '마지막 메시지는 내가 보냈어.' : ''
  const stopSide = context.pausedBy === 'counterpart' ? '현재 대화는 상대의 미응답 뒤 멈췄어.' : context.pausedBy === 'user' ? '현재 대화는 내가 답하지 않은 뒤 멈췄어.' : context.pausedBy === 'mutual' ? '현재 대화는 서로 자연스럽게 멈춘 것으로 기록됐어.' : ''
  const status = context.contactStatus === 'ongoing' ? '현재도 연락 중이야.' : context.contactStatus === 'paused' ? '현재는 대화가 멈춘 상태야.' : context.contactStatus === 'ended' ? '현재 연락은 종료된 상태로 기록됐어.' : ''
  const contactHistory = [continuity,lastSide,stopSide,status].filter(Boolean).join(' ')
  if (!context.state) return {
    title:'현재 관계 상태 미입력',
    text:'실제 연락·만남 여부를 입력하지 않았으므로 계산된 구간만 보여 주고 현실의 관계 단계를 추정하지 않아.',
    next,
  }
  if (context.state === 'disconnected') return {
    title:'관측 사실 · 현재 단절 또는 차단',
    text:'단절 상태는 사용자가 알려 준 현실 정보야. 계산 점수는 그대로 두고, 아직 확인되지 않은 재접촉 단계의 근거만 다음 질문으로 봐.',
    next,
  }
  if (context.state === 'recontacted') return {
    title:'관측 사실 · 재접촉은 이미 발생',
    text:`연락 발생 여부는 이미 확인됐으므로 “연락이 올지”를 중심 결론으로 반복하지 않아. ${contactHistory} 이제 대화가 다시 이어지는지와 실제 만남 단계의 근거를 분리해 봐.`.replace(/\s+/g,' ').trim(),
    next,
  }
  if (context.state === 'messaging') return {
    title:'관측 사실 · 현재 서로 연락 중',
    text:`연락은 이미 확인된 사실이야. ${contactHistory} 계산값을 과거 연락의 발생 확률로 바꾸지 않고, 앞으로의 대화 지속과 실제 만남으로 이어지는 별도 근거를 우선해 봐.`.replace(/\s+/g,' ').trim(),
    next,
  }
  if (context.state === 'met') return {
    title:'관측 사실 · 실제 만남 발생',
    text:`만남이 있었다는 사실을 계산이 부정하지 않아. ${contactHistory} 다음 질문은 연락·만남 발생 여부가 아니라 대화 재개, 다음 만남, 관계를 다시 정의하고 지속할 근거가 따로 있는지야.`.replace(/\s+/g,' ').trim(),
    next,
  }
  if (context.state === 'intimate_undefined') return {
    title:'관측 사실 · 친밀하지만 관계는 미정',
    text:`재접촉과 만남은 이미 확인된 단계야. ${contactHistory} 친밀감만으로 재결합을 확정하지 않고, 관계 정의·다음 만남·지속 행동을 뒷받침하는 재구축 근거를 봐.`.replace(/\s+/g,' ').trim(),
    next,
  }
  return {
    title:'관측 사실 · 관계 재정립 또는 재결합 합의',
    text:`관계 합의는 사용자가 확인한 사실이므로 계산 결과로 되돌려 부정하지 않아. ${contactHistory} 이후에는 관계를 유지하는 행동과 반복 문제를 다루는 구조를 참고해.`.replace(/\s+/g,' ').trim(),
    next:null,
  }
}

function containsDate(row: ReunionPeriod, date: string) {
  return row.start <= date && date <= row.end
}

export type ReunionEventComparison = {
  kind: ReunionObservedEventKind
  date: string
  status: 'match' | 'mismatch' | 'no_evidence' | 'uncalculated'
  label: string
  detail: string
  matched?: ReunionPeriod
}

export function compareObservedEvents(context: ReunionObservationContext, history: ReunionHierarchy | null, calculated: boolean): ReunionEventComparison[] {
  return context.events.filter(event=>/^\d{4}-\d{2}-\d{2}$/.test(event.date)).map(event => {
    const stage = EVENT_STAGE[event.kind]
    const label = event.kind === 'recontact' ? '재접촉 기록' : event.kind === 'meeting' ? '실제 만남 기록' : '관계 재구축 기록'
    if (!calculated || !history) return { kind:event.kind,date:event.date,status:'uncalculated',label,detail:'선택한 과거 기간을 아직 계산하지 않아 대조할 수 없어.' }
    const inRange = history.selection_policy?.requested_range
    if (inRange && (event.date < inRange.start || event.date > inRange.end)) return { kind:event.kind,date:event.date,status:'uncalculated',label,detail:'기록 날짜가 계산한 과거 기간 밖이야.' }
    const sameStage = history.past_windows.filter(row=>row.stage===stage)
    const matched = sameStage.find(row=>containsDate(row,event.date))
    if (matched) return { kind:event.kind,date:event.date,status:'match',label,detail:'같은 단계의 계산 구간 안에 실제 기록 날짜가 있어.',matched }
    if (sameStage.length) return { kind:event.kind,date:event.date,status:'mismatch',label,detail:'같은 단계의 계산 신호는 있었지만 실제 기록 날짜와는 겹치지 않았어.' }
    return { kind:event.kind,date:event.date,status:'no_evidence',label,detail:'계산한 기간에서 이 단계의 공개 근거를 찾지 못했어.' }
  })
}

