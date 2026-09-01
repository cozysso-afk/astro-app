import { Cloud, History, Orbit, Settings, Sparkles, User } from 'lucide-react'

import type { ApiStatus } from './appTypes'
import type { PushSnapshot } from './lib/push'

type UiSettings = { glow: boolean; motion: boolean }

type SettingsViewProps = {
  uiSettings: UiSettings
  aiModel: string
  aiConfigured: boolean | null
  pushState: PushSnapshot | null
  pushBusy: boolean
  apiStatus: ApiStatus
  apiVersion: string
  archiveLoading: boolean
  archiveError: string
  archiveStatus: string
  archiveCount: number
  hasProfile: boolean
  onUiSettingsChange: (settings: UiSettings) => void
  onAiModelChange: (model: string) => void
  onTogglePush: () => void
  onOpenHistory: () => void
  onOpenProfile: () => void
}

export function SettingsView({
  uiSettings,
  aiModel,
  aiConfigured,
  pushState,
  pushBusy,
  apiStatus,
  apiVersion,
  archiveLoading,
  archiveError,
  archiveStatus,
  archiveCount,
  hasProfile,
  onUiSettingsChange,
  onAiModelChange,
  onTogglePush,
  onOpenHistory,
  onOpenProfile,
}: SettingsViewProps) {
  return <section className="form-card settings-view">
    <div className="form-card-heading"><div className="report-icon"><Settings size={21}/></div><div><span className="eyebrow">SETTINGS</span><h2>설정</h2><p>별빛 화면 효과와 앱 상태를 여기서 조절해.</p></div></div>

    <div className="settings-list">
      <label className="settings-toggle-row">
        <span className="settings-row-icon lilac"><Sparkles size={19}/></span>
        <span className="settings-row-copy"><strong>별빛 · 오로라 효과</strong><small>파스텔 빛 번짐, 글로우, 천체 장식의 강도를 켜고 꺼.</small></span>
        <span className="toggle-switch"><input type="checkbox" checked={uiSettings.glow} onChange={(event)=>onUiSettingsChange({...uiSettings,glow:event.target.checked})}/><span className="toggle-track"><span/></span></span>
      </label>
      <label className="settings-toggle-row">
        <span className="settings-row-icon blue"><Orbit size={19}/></span>
        <span className="settings-row-copy"><strong>잔잔한 애니메이션</strong><small>별 반짝임과 광택 이동 효과를 사용해.</small></span>
        <span className="toggle-switch"><input type="checkbox" checked={uiSettings.motion} onChange={(event)=>onUiSettingsChange({...uiSettings,motion:event.target.checked})}/><span className="toggle-track"><span/></span></span>
      </label>
    </div>

    <div className="subsection-title">AI 해석</div>
    <div className="ai-settings-card">
      <label><span><strong>AI 해석 모델</strong><small>실계산 뒤에 붙는 자연어 해설 모델</small></span><select value={aiModel} onChange={(event)=>onAiModelChange(event.target.value)}><option value="gemini-3.7-flash">Gemini 3.7 Flash · 정밀 우선</option><option value="gemini-3.6-flash">Gemini 3.6 Flash · 빠른 해설</option></select></label>
      <div className={`ai-api-state ${aiConfigured===true?'online':aiConfigured===false?'offline':'checking'}`}><Sparkles size={16}/><span><strong>Gemini API</strong><small>{aiConfigured===true?'Supabase Edge Function 연결됨 · Gemini 해설':aiConfigured===false?'미연결 · Supabase에 GEMINI_API_KEY 설정 필요':'연결 상태 확인 중'}</small></span></div>
    </div>

    <div className="subsection-title">알림</div>
    <div className="push-settings-card">
      <div className={`push-state-row ${pushState?.status || 'checking'}`}><span className="push-state-icon">🔔</span><span><strong>운세 푸시 알림</strong><small>{pushState?.message || 'OneSignal 알림 구독 상태 확인 중'}</small></span></div>
      <button type="button" onClick={onTogglePush} disabled={pushBusy || pushState?.status==='unsupported'}>{pushBusy?'처리 중…':pushState?.status==='ready'?'알림 끄기':'알림 켜기'}</button>
      {pushState?.status==='needs_install' && <p>iPhone에서는 Safari에서 홈 화면에 추가한 뒤, 홈화면의 ‘별빛의 운명’을 열고 여기서 알림 켜기를 눌러야 해.</p>}
      {pushState?.status==='error' && <p>OneSignal 사이트 주소가 현재 Vercel 도메인과 맞는지 대시보드에서 확인해줘.</p>}
    </div>

    <div className="subsection-title">앱 상태</div>
    <div className="settings-status-grid">
      <div><span>계산 서버</span><strong>{apiStatus==='online'?'연결됨':apiStatus==='warming'?'확인 중':'대기 중'}</strong><small>{apiVersion || 'API 상태 확인'}</small></div>
      <div><span>AI 해설</span><strong>{aiConfigured===true?'연결됨':aiConfigured===false?'미연결':'확인 중'}</strong><small>{aiModel}</small></div>
      <div><span>알림</span><strong>{pushState?.status==='ready'?'켜짐':pushState?.status==='needs_install'?'홈화면 설치 필요':pushState?.status==='unsupported'?'지원 안 됨':pushState?.status==='error'?'확인 오류':'꺼짐/확인 중'}</strong><small>{pushState?.message || '설정 탭에서 확인'}</small></div>
      <div><span>클라우드 기록</span><strong>{archiveLoading?'확인 중':archiveError?'확인 오류':`${archiveCount}개`}</strong><small>{archiveError || archiveStatus || '기록 상태 확인 전'}</small></div>
      <div><span>출생 프로필</span><strong>{hasProfile?'저장됨':'미저장'}</strong><small>{hasProfile?'이 브라우저 기기 보관':'내정보에서 먼저 저장'}</small></div>
    </div>

    <div className="privacy-note settings-note"><Cloud size={16}/><span>클라우드 기록은 현재 익명 로그인 세션 기준이야. Safari와 홈화면 웹앱이 서로 다른 익명 세션을 만들면 기록이 따로 보일 수 있어. 장기적으로 기기 간 동일 기록이 필요하면 Apple/Google 로그인이 필요해.</span></div>
    <div className="settings-actions"><button type="button" onClick={onOpenHistory}><History size={16}/>기록함 열기</button><button type="button" onClick={onOpenProfile}><User size={16}/>출생 프로필 열기</button></div>
  </section>
}
