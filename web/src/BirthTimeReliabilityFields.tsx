import { useEffect } from 'react'
import type { BirthProfile, TimeConfidence, TimeSource } from './appTypes'
import { rememberBirthTimeReliability } from './lib/precisionTransport'

type ReliabilityValue = BirthProfile

type Props = {
  value: ReliabilityValue
  onChange: (patch: Partial<Pick<BirthProfile, 'timeSource' | 'timeConfidence' | 'rectifiedWindowStart' | 'rectifiedWindowEnd'>>) => void
  disabled?: boolean
  compact?: boolean
}

const exactSources = new Set<TimeSource>(['official_record', 'rectified'])

export const timeSourceLabels: Array<[TimeSource, string]> = [
  ['official_record', '공식 출생기록 / 출생증명'],
  ['family_memory', '가족의 기억'],
  ['user_estimate', '사용자 추정'],
  ['arbitrary_input', '계산을 위한 임시 입력'],
  ['rectified', '사건 검증으로 보정한 시각'],
  ['unknown', '출처 모름'],
]

export const timeConfidenceLabels: Array<[TimeConfidence, string]> = [
  ['exact', 'Exact · 정확 검증'],
  ['high', 'High · 높은 신뢰'],
  ['medium', 'Medium · 중간'],
  ['low', 'Low · 낮음'],
  ['unknown', 'Unknown · 확인 안 됨'],
]

export function BirthTimeReliabilityFields({ value, onChange, disabled = false, compact = false }: Props) {
  const exactAllowed = exactSources.has(value.timeSource)
  useEffect(() => { rememberBirthTimeReliability(value) }, [value])
  const emit = (patch: Partial<Pick<BirthProfile, 'timeSource' | 'timeConfidence' | 'rectifiedWindowStart' | 'rectifiedWindowEnd'>>) => {
    rememberBirthTimeReliability({ ...value, ...patch })
    onChange(patch)
  }
  return <>
    <label className={`field ${compact ? '' : 'field-wide'}`}>
      <span>출생시간 출처</span>
      <select
        value={value.timeSource}
        disabled={disabled}
        onChange={(event) => {
          const source = event.target.value as TimeSource
          emit({
            timeSource: source,
            ...(value.timeConfidence === 'exact' && !exactSources.has(source) ? { timeConfidence: 'unknown' as TimeConfidence } : {}),
          })
        }}
      >
        {timeSourceLabels.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <label className={`field ${compact ? '' : 'field-wide'}`}>
      <span>출생시간 신뢰도</span>
      <select value={value.timeConfidence} disabled={disabled} onChange={(event)=>emit({timeConfidence:event.target.value as TimeConfidence})}>
        {timeConfidenceLabels.map(([key,label]) => <option key={key} value={key} disabled={key === 'exact' && !exactAllowed}>{label}</option>)}
      </select>
    </label>
    {value.timeSource === 'rectified' && <>
      <label className="field"><span>보정 범위 시작</span><input type="time" value={value.rectifiedWindowStart} disabled={disabled} onChange={(event)=>emit({rectifiedWindowStart:event.target.value})}/></label>
      <label className="field"><span>보정 범위 끝</span><input type="time" value={value.rectifiedWindowEnd} disabled={disabled} onChange={(event)=>emit({rectifiedWindowEnd:event.target.value})}/></label>
    </>}
    {!disabled && <div className="privacy-note field-wide birth-time-reliability-note"><span>시각을 입력했다는 사실만으로 exact(정확 생시)로 보지 않아. 공식기록 또는 검증된 보정시각 + Exact일 때만 ASC(상승점)·하우스 등 생시 민감층을 exact로 사용해.</span></div>}
  </>
}
