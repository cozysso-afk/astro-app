import type { ReunionObservationContext, ReunionObservedEventKind, ReunionObservedState } from '../appTypes'
import {browserLocalDateIso} from './readingDateSemantics.ts'
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

const stateTitles: Record<ReunionObservedState, string> = {
  '':'현재 관계 상태 미입력',
  disconnected:'지금은 연락이 끊긴 상태예요',
  recontacted:'다시 연락이 닿았어요',
  messaging:'지금은 서로 연락을 주고받고 있어요',
  met:'두 사람이 실제로 다시 만났어요',
  intimate_undefined:'가까워졌고, 교제 여부는 아직 미정이에요',
  reunited:'관계를 다시 이어가기로 합의했어요',
}

export const eventLabels:Record<ReunionObservedEventKind,string> = {recontact:'다시 연락한 날',meeting:'직접 만난 날',rebuilding:'관계에 합의한 날'}
export const initiatorLabels = {counterpart:'상대가 먼저',user:'내가 먼저',mutual:'서로 비슷한 시점',unknown:'확인 어려움'} as const

export function recordedReunionEvents(events:ReunionObservationContext['events'], today=browserLocalDateIso()) {
  return events.filter(event=>event && typeof event.date==='string' && Object.hasOwn(eventLabels,event.kind) && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
    && event.date<=today && new Date(event.date+'T00:00:00Z').toJSON()?.slice(0,10)===event.date)
    .sort((a,b)=>a.date.localeCompare(b.date))
}

export function readReunionObservation(value: unknown): ReunionObservationContext {
  const record = (value && typeof value === 'object' ? value : {}) as Partial<ReunionObservationContext>
  const state = REUNION_STATE_OPTIONS.find(option=>option.value===record.state)?.value ?? ''
  const initiator = record.initiator && Object.hasOwn(initiatorLabels,record.initiator) ? record.initiator : ''
  const events = Array.isArray(record.events) ? recordedReunionEvents(record.events).map(({kind,date})=>({kind,date})) : []
  return {state,initiator,events}
}

export function observationReading(context: ReunionObservationContext) {
  return {
    title:stateTitles[context.state] ?? stateTitles[''],
    next:nextUnconfirmedStage(context.state),
    events:recordedReunionEvents(context.events),
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
  return recordedReunionEvents(context.events).map(event => {
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

