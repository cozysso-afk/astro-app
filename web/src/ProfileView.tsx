import { CheckCircle2, MapPin, Save, User } from 'lucide-react'

import type { BirthProfile, Gender } from './appTypes'
import { KoreaBirthplaceSelector } from './koreaBirthplaces'
import { BirthTimeReliabilityFields } from './BirthTimeReliabilityFields'

type ProfileViewProps = {
  birthProfile: BirthProfile
  profileSaved: boolean
  onChange: (profile: BirthProfile) => void
  onSave: () => void
}

export function ProfileView({ birthProfile, profileSaved, onChange, onSave }: ProfileViewProps) {
  return <section className="form-card profile-form-card">
    <div className="form-card-heading"><div className="report-icon"><User size={21}/></div><div><span className="eyebrow">MY BIRTH PROFILE</span><h2>내 출생 프로필</h2><p>정밀 계산에만 사용하고 이 브라우저 기기에 로컬 저장해.</p></div></div>
    <div className="privacy-note"><CheckCircle2 size={16}/><span>출생 프로필 자체는 이 브라우저에 저장해. 분석 기록에서 “기록 저장”을 누르면 계산 입력과 결과가 본인 전용 클라우드 기록에도 동기화될 수 있어.</span></div>
    <div className="field-grid">
      <label className="field field-wide"><span>이름 / 닉네임</span><input value={birthProfile.name} onChange={(event)=>onChange({...birthProfile,name:event.target.value})} placeholder="선택 입력"/></label>
      <label className="field birth-date-field"><span>생년월일</span><input type="date" value={birthProfile.birthDate} onChange={(event)=>onChange({...birthProfile,birthDate:event.target.value})}/></label>
      <label className="field birth-time-field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(event)=>onChange({...birthProfile,birthTime:event.target.value})}/></label>
      <BirthTimeReliabilityFields value={birthProfile} onChange={(patch)=>onChange({...birthProfile,...patch})}/>
      <label className="field field-wide"><span>성별 · 사주 대운 계산 기준</span><select value={birthProfile.gender} onChange={(event)=>onChange({...birthProfile,gender:event.target.value as Gender})}><option value="female">여성</option><option value="male">남성</option></select></label>
      <KoreaBirthplaceSelector value={birthProfile} onChange={(location)=>onChange({...birthProfile,...location})}/>
      <details className="advanced-panel field-wide"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className="advanced-grid">
        <label className="field"><span>위도</span><input inputMode="decimal" value={birthProfile.latitude} onChange={(event)=>onChange({...birthProfile,latitude:event.target.value,placeKey:''})}/></label>
        <label className="field"><span>경도</span><input inputMode="decimal" value={birthProfile.longitude} onChange={(event)=>onChange({...birthProfile,longitude:event.target.value,placeKey:''})}/></label>
        <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={birthProfile.utcOffset} onChange={(event)=>onChange({...birthProfile,utcOffset:event.target.value})}/></label>
      </div></details>
    </div>
    <div className="coordinate-note"><MapPin size={16}/><span>2026년 7월 1일 현행 전국 행정체계를 기준으로 선택해. 좌표는 자동 적용되고 직접 입력은 선택사항이야.</span></div>
    <button className="primary-button" type="button" onClick={onSave}><Save size={18}/><span>{profileSaved?'이 기기에 저장 완료':'이 기기에 프로필 저장'}</span></button>
  </section>
}
