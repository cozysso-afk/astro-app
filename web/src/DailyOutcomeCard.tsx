export type OutcomeEvent = '' | 'none' | 'received' | 'sent' | 'both'
export type OutcomeTimeBucket = '' | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'
export type OutcomeChannel = '' | 'message' | 'dm' | 'call' | 'in_person' | 'other'

export type DailyOutcomeRecord = {
  date: string
  event: OutcomeEvent
  past_connection: boolean
  event_time_bucket: OutcomeTimeBucket
  channel: OutcomeChannel
  note: string
  saved_at: string
  scores: Record<string, number | null>
}

export type OutcomeCalibration = {
  n: number
  contactN: number
  noneN: number
  incomingContact: number | null
  incomingNone: number | null
  reconnectionContact: number | null
  reconnectionNone: number | null
}

type DailyOutcomeCardProps = {
  draft: DailyOutcomeRecord
  saved: boolean
  calibration: OutcomeCalibration
  onChange: (draft: DailyOutcomeRecord) => void
  onSave: () => void
}

export function DailyOutcomeCard({ draft, saved, calibration, onChange, onSave }: DailyOutcomeCardProps) {
  const calibrationSummary = calibration.n < 5
    ? ` · 비교 시작까지 ${5 - calibration.n}일 더 필요`
    : calibration.contactN && calibration.noneN
      ? ` · 연락 받은 날 수신 평균 ${calibration.incomingContact?.toFixed(1) ?? '—'} / 연락 없는 날 ${calibration.incomingNone?.toFixed(1) ?? '—'} · 재접점 ${calibration.reconnectionContact?.toFixed(1) ?? '—'} / ${calibration.reconnectionNone?.toFixed(1) ?? '—'}`
      : ' · 연락 있음/없음 양쪽 표본이 더 필요'

  return <details className="result-card outcome-card">
    <summary>실제 결과 기록 · 개인보정</summary>
    <div className="outcome-form">
      <p className="outcome-note">연락이 온 날뿐 아니라 연락이 없던 날도 같이 기록해야 비교가 덜 치우쳐. 현재 점수를 즉시 바꾸는 용도가 아니라, 네 기록이 쌓일수록 수신·재접점 지표가 실제 경험과 얼마나 맞는지 개인별로 검증하는 데이터야.</p>
      <div className="outcome-grid">
        <label><span>이 날 실제 연락 결과</span><select value={draft.event} onChange={(event)=>onChange({...draft,event:event.target.value as OutcomeEvent})}><option value="">기록 안 함</option><option value="none">연락 없음</option><option value="received">연락 받음</option><option value="sent">내가 먼저 보냄</option><option value="both">서로 주고받음</option></select></label>
        <label><span>연락 시각대</span><select value={draft.event_time_bucket} onChange={(event)=>onChange({...draft,event_time_bucket:event.target.value as OutcomeTimeBucket})}><option value="">시간 기록 안 함</option><option value="dawn">새벽 00~06</option><option value="morning">오전 06~12</option><option value="afternoon">오후 12~18</option><option value="evening">저녁 18~22</option><option value="night">밤 22~24</option></select></label>
        <label><span>연락 경로</span><select value={draft.channel} onChange={(event)=>onChange({...draft,channel:event.target.value as OutcomeChannel})}><option value="">경로 기록 안 함</option><option value="message">문자·메신저</option><option value="dm">DM·SNS</option><option value="call">전화</option><option value="in_person">직접 만남</option><option value="other">기타</option></select></label>
        <label><span>짧은 메모</span><input type="text" maxLength={200} value={draft.note} onChange={(event)=>onChange({...draft,note:event.target.value})} placeholder="예: 저녁에 먼저 전화 옴"/></label>
        <label className="outcome-check"><input type="checkbox" checked={draft.past_connection} onChange={(event)=>onChange({...draft,past_connection:event.target.checked})}/><span>과거 인연 관련 연락</span></label>
      </div>
      <button className="outcome-save" type="button" onClick={onSave}>실제 결과 저장</button>
      {saved ? <div className="outcome-saved">저장 완료 · 이후 개인보정 비교에 포함할게.</div> : null}
      <p className="outcome-note">개인보정 기록 {calibration.n}일{calibrationSummary}</p>
    </div>
  </details>
}
