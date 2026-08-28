from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text()

old = """  const [archiveStatus, setArchiveStatus] = useState('')
  const [actionNotice, setActionNotice] = useState('')"""
new = """  const [archiveStatus, setArchiveStatus] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [celestialMotion, setCelestialMotion] = useState(() => typeof window === 'undefined' || window.localStorage.getItem('starlight-destiny.celestial-motion.v1') !== 'off')
  const [celestialGlow, setCelestialGlow] = useState(() => typeof window === 'undefined' || window.localStorage.getItem('starlight-destiny.celestial-glow.v1') !== 'off')"""
assert old in s, 'state anchor missing'
s = s.replace(old, new, 1)

old = """  useEffect(() => {
    if (mainView === 'history') void refreshArchive()
  }, [mainView])"""
new = """  useEffect(() => {
    if (mainView === 'history' || mainView === 'settings') void refreshArchive()
  }, [mainView])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('celestial-motion-off', !celestialMotion)
    window.localStorage.setItem('starlight-destiny.celestial-motion.v1', celestialMotion ? 'on' : 'off')
  }, [celestialMotion])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('celestial-glow-off', !celestialGlow)
    window.localStorage.setItem('starlight-destiny.celestial-glow.v1', celestialGlow ? 'on' : 'off')
  }, [celestialGlow])"""
assert old in s, 'mainView effect anchor missing'
s = s.replace(old, new, 1)

old = """  async function refreshArchive() {
    setArchiveLoading(true)
    try {
      const data = await listArchive()
      setArchiveItems(data.items)
      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : 'Supabase 클라우드 기록 연결됨')
      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : '이 기기 기록 사용 중')
    } finally {
      setArchiveLoading(false)
    }
  }"""
new = """  async function refreshArchive() {
    setArchiveLoading(true)
    setArchiveError('')
    try {
      const data = await listArchive()
      setArchiveItems(data.items)
      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : `Supabase 클라우드 기록 연결됨 · ${data.items.length}개`)
      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : `이 기기 기록 사용 중 · ${data.items.length}개`)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : '기록을 불러오는 중 오류가 발생했어.')
      setArchiveStatus('기록 연결 상태를 확인하지 못했어')
    } finally {
      setArchiveLoading(false)
    }
  }"""
assert old in s, 'refreshArchive anchor missing'
s = s.replace(old, new, 1)

old = """          <div className=\"archive-sync-row\"><span><Cloud size={15}/>{archiveStatus || '기록 연결 상태 확인 중'}</span><button type=\"button\" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>
          {archiveLoading && archiveItems.length===0 && <div className=\"status-banner subtle\"><LoaderCircle className=\"spin\" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
          {!archiveLoading && archiveItems.length===0 && <div className=\"archive-empty\"><History size={22}/><strong>아직 저장된 기록이 없어</strong><span>계산 결과에서 “기록 저장”을 누르면 여기에 쌓여.</span></div>}"""
new = """          <div className=\"archive-sync-row\"><span><Cloud size={15}/>{archiveStatus || '기록 연결 상태 확인 중'}</span><button type=\"button\" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>
          {archiveError && <div className=\"status-banner error\"><AlertTriangle size={16}/><span>{archiveError}</span></div>}
          {archiveLoading && archiveItems.length===0 && <div className=\"status-banner subtle\"><LoaderCircle className=\"spin\" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
          {!archiveLoading && !archiveError && archiveItems.length===0 && <div className=\"archive-empty archive-empty-actions\"><History size={22}/><strong>저장된 기록 0개</strong><span>클라우드 연결은 정상이고, 아직 저장된 분석 결과가 없어.</span><button type=\"button\" onClick={()=>switchMainView('home')}><Sparkles size={15}/>홈에서 계산하고 저장하기</button></div>}"""
assert old in s, 'archive empty anchor missing'
s = s.replace(old, new, 1)

old = """        {mainView === 'settings' && <section className=\"report-card\"><div className=\"report-icon\"><Settings size={21}/></div><div className=\"report-copy\"><span className=\"eyebrow\">SETTINGS</span><strong>설정</strong><p>AI 해석 모델, 개인정보, 알림, 앱 설정을 이곳으로 분리해.</p></div></section>}"""
new = """        {mainView === 'settings' && <section className=\"form-card settings-view\">
          <div className=\"form-card-heading\"><div className=\"report-icon\"><Settings size={21}/></div><div><span className=\"eyebrow\">SETTINGS</span><h2>설정</h2><p>화면 효과와 앱 상태를 여기서 조절해.</p></div></div>
          <div className=\"settings-list\">
            <button className=\"settings-row\" type=\"button\" role=\"switch\" aria-checked={celestialMotion} onClick={()=>setCelestialMotion((value)=>!value)}>
              <span className=\"settings-row-copy\"><strong>별빛 애니메이션</strong><small>별 반짝임과 은은한 광택 움직임</small></span>
              <span className={`setting-switch ${celestialMotion?'is-on':''}`} aria-hidden=\"true\"><span/></span>
            </button>
            <button className=\"settings-row\" type=\"button\" role=\"switch\" aria-checked={celestialGlow} onClick={()=>setCelestialGlow((value)=>!value)}>
              <span className=\"settings-row-copy\"><strong>오로라 · 별빛 배경</strong><small>연보라·민트·연핑크·실버 광택 레이어</small></span>
              <span className={`setting-switch ${celestialGlow?'is-on':''}`} aria-hidden=\"true\"><span/></span>
            </button>
          </div>
          <div className=\"settings-status-grid\">
            <div><span>계산 서버</span><strong>{apiLabel}</strong></div>
            <div><span>분석 기록</span><strong>{archiveError ? '확인 오류' : (archiveStatus || '확인 중')}</strong></div>
            <div><span>출생 프로필</span><strong>이 브라우저에 로컬 저장</strong></div>
            <div><span>클라우드 기록</span><strong>Supabase · 사용자별 RLS 보호</strong></div>
          </div>
          <div className=\"privacy-note\"><CheckCircle2 size={16}/><span>출생 프로필 자체는 브라우저 로컬에 남고, 계산 결과는 “기록 저장”을 눌렀을 때만 클라우드 기록에 동기화돼.</span></div>
        </section>}"""
assert old in s, 'settings placeholder anchor missing'
s = s.replace(old, new, 1)

p.write_text(s)

css = Path('web/src/celestial-pastel.css')
c = css.read_text()
marker = '/* Archive/settings UX patch v1 */'
if marker not in c:
    c += r'''

/* Archive/settings UX patch v1 */
.app-shell::before,
.app-shell::after,
.hero-card::before,
.hero-card::after,
.profile-card::before,
.profile-card::after,
.date-card::before,
.date-card::after,
.report-card::before,
.report-card::after,
.tool-card::before,
.tool-card::after,
.tool-panel::before {
  pointer-events: none !important;
}

.bottom-nav {
  z-index: 80 !important;
  pointer-events: auto !important;
}
.nav-item {
  position: relative;
  z-index: 2;
  pointer-events: auto !important;
  touch-action: manipulation;
}

.archive-empty-actions button {
  margin-top: 14px;
  min-height: 44px;
  border: 1px solid rgba(177,187,202,.42);
  border-radius: 15px;
  padding: 10px 15px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #62566f;
  font-weight: 750;
  background: linear-gradient(135deg, rgba(248,223,233,.90), rgba(233,222,248,.92) 50%, rgba(220,243,234,.92));
  box-shadow: 0 8px 20px rgba(103,91,128,.10), 0 1px 0 rgba(255,255,255,.9) inset;
}

.settings-view { position: relative; overflow: hidden; }
.settings-list { display: grid; gap: 12px; margin-top: 18px; }
.settings-row {
  width: 100%; min-height: 72px; border: 1px solid rgba(177,187,202,.34); border-radius: 18px;
  padding: 14px 15px; display: flex; align-items: center; justify-content: space-between; gap: 14px;
  text-align: left; color: #4f485d; background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(242,239,251,.91));
  box-shadow: 0 10px 24px rgba(91,84,111,.07), 0 1px 0 rgba(255,255,255,.96) inset; touch-action: manipulation;
}
.settings-row-copy { min-width: 0; display: grid; gap: 4px; }
.settings-row-copy strong { font-size: 15px; }
.settings-row-copy small { color: #817786; line-height: 1.4; }
.setting-switch {
  width: 48px; height: 28px; flex: 0 0 auto; padding: 3px; border-radius: 999px;
  background: rgba(183,190,204,.42); box-shadow: 0 1px 2px rgba(70,65,84,.12) inset; transition: background 160ms ease;
}
.setting-switch > span {
  display: block; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,.98);
  box-shadow: 0 2px 7px rgba(72,66,85,.20); transition: transform 160ms ease;
}
.setting-switch.is-on { background: linear-gradient(135deg, #cdbbe8, #bcddee 52%, #b9dfd2); }
.setting-switch.is-on > span { transform: translateX(20px); }

.settings-status-grid { display: grid; gap: 10px; margin-top: 16px; }
.settings-status-grid > div {
  border: 1px solid rgba(183,190,205,.25); border-radius: 15px; padding: 12px 14px; display: grid; gap: 4px;
  background: linear-gradient(135deg, rgba(248,244,255,.86), rgba(241,250,249,.86));
}
.settings-status-grid span { color: #8a7f8e; font-size: 12px; }
.settings-status-grid strong { color: #51495a; font-size: 13px; line-height: 1.45; }

html.celestial-motion-off .hero-star,
html.celestial-motion-off .period-button::before { animation: none !important; }
html.celestial-glow-off .app-shell::before,
html.celestial-glow-off .app-shell::after,
html.celestial-glow-off .hero-orbit,
html.celestial-glow-off .hero-star { opacity: .08 !important; }
'''
css.write_text(c)

print('archive/settings patch applied')
