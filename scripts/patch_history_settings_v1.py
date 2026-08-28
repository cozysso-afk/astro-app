from pathlib import Path
import re

app_path = Path('web/src/AppNext.tsx')
main_path = Path('web/src/main.tsx')
settings_css_path = Path('web/src/settings.css')

s = app_path.read_text(encoding='utf-8')

s = s.replace(
    "const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'\n",
    "const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'\nconst UI_SETTINGS_STORAGE_KEY = 'starlight-destiny.ui-settings.v1'\n",
    1,
)

helper_anchor = "function loadStoredProfile(): BirthProfile {\n"
if "function loadUiSettings()" not in s:
    helper = """function loadUiSettings() {\n  if (typeof window === 'undefined') return { glow: true, motion: true }\n  try {\n    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY)\n    if (!raw) return { glow: true, motion: true }\n    const parsed = JSON.parse(raw) as Partial<{ glow: boolean; motion: boolean }>\n    return { glow: parsed.glow !== false, motion: parsed.motion !== false }\n  } catch {\n    return { glow: true, motion: true }\n  }\n}\n\n"""
    s = s.replace(helper_anchor, helper + helper_anchor, 1)

state_anchor = "  const [archiveStatus, setArchiveStatus] = useState('')\n  const [actionNotice, setActionNotice] = useState('')\n"
state_repl = "  const [archiveStatus, setArchiveStatus] = useState('')\n  const [archiveError, setArchiveError] = useState('')\n  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())\n  const [actionNotice, setActionNotice] = useState('')\n"
if state_anchor not in s:
    raise SystemExit('state anchor not found')
s = s.replace(state_anchor, state_repl, 1)

old_effect = """  useEffect(() => {\n    if (mainView === 'history') void refreshArchive()\n  }, [mainView])\n"""
new_effect = """  useEffect(() => {\n    if (mainView === 'history' || mainView === 'settings') void refreshArchive()\n  }, [mainView])\n\n  useEffect(() => {\n    window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings))\n    document.documentElement.dataset.celestialGlow = uiSettings.glow ? 'on' : 'off'\n    document.documentElement.dataset.celestialMotion = uiSettings.motion ? 'on' : 'off'\n  }, [uiSettings])\n"""
if old_effect not in s:
    raise SystemExit('view effect anchor not found')
s = s.replace(old_effect, new_effect, 1)

old_refresh = """  async function refreshArchive() {\n    setArchiveLoading(true)\n    try {\n      const data = await listArchive()\n      setArchiveItems(data.items)\n      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : 'Supabase 클라우드 기록 연결됨')\n      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : '이 기기 기록 사용 중')\n    } finally {\n      setArchiveLoading(false)\n    }\n  }\n"""
new_refresh = """  async function refreshArchive() {\n    setArchiveLoading(true)\n    setArchiveError('')\n    try {\n      const data = await listArchive()\n      setArchiveItems(data.items)\n      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : `Supabase 클라우드 기록 연결됨 · ${data.items.length}개`)\n      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : `이 기기 기록 사용 중 · ${data.items.length}개`)\n    } catch (error) {\n      const message = error instanceof Error ? error.message : '기록을 불러오지 못했어.'\n      setArchiveError(message)\n      setArchiveStatus('기록 불러오기 오류')\n    } finally {\n      setArchiveLoading(false)\n    }\n  }\n"""
if old_refresh not in s:
    raise SystemExit('refreshArchive anchor not found')
s = s.replace(old_refresh, new_refresh, 1)

s = s.replace(
    '    <div className="app-shell">',
    "    <div className={`app-shell ${uiSettings.glow ? 'celestial-glow-on' : 'celestial-glow-off'} ${uiSettings.motion ? 'celestial-motion-on' : 'celestial-motion-off'}`}>",
    1,
)

pattern = re.compile(r"        \{mainView === 'history' && <section className=\"form-card archive-view\">.*?</section>\}\n        \{mainView === 'settings' && <section className=\"report-card\">.*?</section>\}", re.S)
replacement = """        {mainView === 'history' && <section className=\"form-card archive-view\">\n          <div className=\"form-card-heading\"><div className=\"report-icon\"><History size={21}/></div><div><span className=\"eyebrow\">ARCHIVE</span><h2>분석 기록</h2><p>통합운세·정밀분석·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p></div></div>\n          <div className=\"archive-sync-row\"><span><Cloud size={15}/>{archiveLoading ? '기록 연결 상태 확인 중' : archiveStatus || '기록 연결 상태 확인 전'}</span><button type=\"button\" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>\n          {archiveError && <div className=\"status-banner error\"><AlertTriangle size={16}/><span>{archiveError}</span></div>}\n          {archiveLoading && archiveItems.length===0 && <div className=\"status-banner subtle\"><LoaderCircle className=\"spin\" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}\n          {!archiveLoading && !archiveError && archiveItems.length===0 && <div className=\"archive-empty\"><History size={22}/><strong>저장된 기록 0개</strong><span>클라우드 연결은 정상이고, 현재 세션에 저장된 분석 결과가 아직 없어. 계산 결과에서 “기록 저장”을 누르면 여기에 쌓여.</span><button className=\"archive-empty-action\" type=\"button\" onClick={()=>switchMainView('home')}><Home size={15}/>홈에서 계산하고 기록 저장하기</button></div>}\n          <div className=\"archive-list\">{archiveItems.map((item)=><article className=\"archive-card\" key={item.id}>\n            <div className=\"archive-card-top\"><div><span className={`archive-kind kind-${item.kind}`}>{item.kind==='integrated'?'통합운세':item.kind==='precision'?'정밀분석':item.kind==='marriage'?'결혼운':'궁합운'}</span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.periodStart}~{item.periodEnd}</small></div><span className={`sync-chip ${item.syncState}`}><Cloud size={12}/>{item.syncState==='cloud'?'클라우드':'이 기기'}</span></div>\n            <div className=\"archive-actions\">\n              <button type=\"button\" onClick={()=>restoreArchive(item)}><Search size={14}/>다시 열기</button>\n              <button type=\"button\" onClick={()=>copyArchiveResult(item)}><Copy size={14}/>전체복사</button>\n              <button className=\"danger\" type=\"button\" onClick={()=>removeArchive(item)}><Trash2 size={14}/>삭제</button>\n            </div>\n          </article>)}</div>\n        </section>}\n\n        {mainView === 'settings' && <section className=\"form-card settings-view\">\n          <div className=\"form-card-heading\"><div className=\"report-icon\"><Settings size={21}/></div><div><span className=\"eyebrow\">SETTINGS</span><h2>설정</h2><p>별빛 화면 효과와 앱 상태를 여기서 조절해.</p></div></div>\n\n          <div className=\"settings-list\">\n            <label className=\"settings-toggle-row\">\n              <span className=\"settings-row-icon lilac\"><Sparkles size={19}/></span>\n              <span className=\"settings-row-copy\"><strong>별빛 · 오로라 효과</strong><small>파스텔 빛 번짐, 글로우, 천체 장식의 강도를 켜고 꺼.</small></span>\n              <span className=\"toggle-switch\"><input type=\"checkbox\" checked={uiSettings.glow} onChange={(e)=>setUiSettings({...uiSettings, glow:e.target.checked})}/><span className=\"toggle-track\"><span/></span></span>\n            </label>\n            <label className=\"settings-toggle-row\">\n              <span className=\"settings-row-icon blue\"><Orbit size={19}/></span>\n              <span className=\"settings-row-copy\"><strong>잔잔한 애니메이션</strong><small>별 반짝임과 광택 이동 효과를 사용해.</small></span>\n              <span className=\"toggle-switch\"><input type=\"checkbox\" checked={uiSettings.motion} onChange={(e)=>setUiSettings({...uiSettings, motion:e.target.checked})}/><span className=\"toggle-track\"><span/></span></span>\n            </label>\n          </div>\n\n          <div className=\"subsection-title\">앱 상태</div>\n          <div className=\"settings-status-grid\">\n            <div><span>계산 서버</span><strong>{apiStatus==='online'?'연결됨':apiStatus==='warming'?'확인 중':'대기 중'}</strong><small>{apiVersion || 'API 상태 확인'}</small></div>\n            <div><span>클라우드 기록</span><strong>{archiveLoading?'확인 중':archiveError?'확인 오류':archiveItems.length+'개'}</strong><small>{archiveError || archiveStatus || '기록 상태 확인 전'}</small></div>\n            <div><span>출생 프로필</span><strong>{hasProfile?'저장됨':'미저장'}</strong><small>{hasProfile?'이 브라우저 기기 보관':'내정보에서 먼저 저장'}</small></div>\n          </div>\n\n          <div className=\"privacy-note settings-note\"><Cloud size={16}/><span>클라우드 기록은 현재 익명 로그인 세션 기준이야. Safari와 홈화면 웹앱이 서로 다른 익명 세션을 만들면 기록이 따로 보일 수 있어. 장기적으로 기기 간 동일 기록이 필요하면 Apple/Google 로그인이 필요해.</span></div>\n          <div className=\"settings-actions\"><button type=\"button\" onClick={()=>switchMainView('history')}><History size={16}/>기록함 열기</button><button type=\"button\" onClick={()=>switchMainView('profile')}><User size={16}/>출생 프로필 열기</button></div>\n        </section>}"""

s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'history/settings block replacement failed: {count}')

app_path.write_text(s, encoding='utf-8')

main = main_path.read_text(encoding='utf-8')
if "import './settings.css'" not in main:
    main = main.replace("import './celestial-pastel.css'\n", "import './celestial-pastel.css'\nimport './settings.css'\n", 1)
main_path.write_text(main, encoding='utf-8')

settings_css_path.write_text(r'''/* Functional settings + archive UX + iPhone touch safety */
.settings-view { display: grid; gap: 18px; }
.settings-list { display: grid; gap: 10px; }
.settings-toggle-row {
  display: grid;
  grid-template-columns: 44px minmax(0,1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(178,187,203,.32);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(255,255,255,.93), rgba(241,242,251,.84));
  box-shadow: 0 10px 24px rgba(93,86,112,.06), 0 1px 0 rgba(255,255,255,.92) inset;
}
.settings-row-icon {
  width: 42px; height: 42px; border-radius: 14px;
  display: grid; place-items: center;
  border: 1px solid rgba(176,184,201,.32);
  box-shadow: 0 8px 18px rgba(96,88,118,.08), 0 1px 0 #fff inset;
}
.settings-row-icon.lilac { color:#846da3; background:linear-gradient(145deg,#fff,#e9def8 58%,#dcecff); }
.settings-row-icon.blue { color:#6687a7; background:linear-gradient(145deg,#fff,#dcecff 58%,#dcf3ea); }
.settings-row-copy { display:grid; gap:4px; min-width:0; }
.settings-row-copy strong { color:#3f3544; font-size:15px; }
.settings-row-copy small { color:#7c7480; line-height:1.45; font-size:12px; }
.toggle-switch { position:relative; display:inline-flex; }
.toggle-switch input { position:absolute; opacity:0; pointer-events:none; }
.toggle-track {
  width: 48px; height: 29px; border-radius: 999px; padding:3px;
  display:block; background:#d9dbe2; border:1px solid rgba(142,149,164,.28);
  transition:background .18s ease, box-shadow .18s ease;
}
.toggle-track > span {
  display:block; width:21px; height:21px; border-radius:50%; background:#fff;
  box-shadow:0 2px 7px rgba(60,55,72,.18); transition:transform .18s ease;
}
.toggle-switch input:checked + .toggle-track {
  background:linear-gradient(120deg,#d7c8ee,#bcdcf3 52%,#c9eadf);
  box-shadow:0 0 16px rgba(184,166,221,.22);
}
.toggle-switch input:checked + .toggle-track > span { transform:translateX(19px); }

.settings-status-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.settings-status-grid > div {
  min-width:0; padding:12px 10px; border-radius:17px;
  border:1px solid rgba(183,190,205,.26);
  background:linear-gradient(150deg,rgba(255,255,255,.91),rgba(241,247,249,.82));
  display:grid; gap:4px;
}
.settings-status-grid span { color:#887b89; font-size:11px; }
.settings-status-grid strong { color:#493f4c; font-size:14px; }
.settings-status-grid small { color:#8a838c; font-size:10px; line-height:1.35; word-break:break-word; }
.settings-note { margin:0; }
.settings-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.settings-actions button,
.archive-empty-action {
  min-height:44px; border-radius:15px; border:1px solid rgba(171,181,198,.34);
  background:linear-gradient(135deg,rgba(250,247,255,.96),rgba(228,238,251,.92),rgba(226,246,239,.90));
  color:#62566c; font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px;
  box-shadow:0 8px 18px rgba(90,84,110,.06),0 1px 0 #fff inset;
}
.archive-empty { gap:10px; }
.archive-empty span { max-width:420px; line-height:1.55; }
.archive-empty-action { margin-top:4px; padding:0 16px; }

/* Decorative layers must never steal taps on iPhone. */
.bottom-nav { z-index:100 !important; pointer-events:auto !important; }
.nav-item { position:relative; z-index:2; pointer-events:auto !important; touch-action:manipulation; }
.hero-card::before,.hero-card::after,.period-button::before,.tool-card::before,.tool-card::after,.profile-card::before,.profile-card::after,.date-card::before,.date-card::after,.report-card::before,.report-card::after,.tool-panel::before { pointer-events:none !important; }

html[data-celestial-glow='off'] .app-shell::before,
html[data-celestial-glow='off'] .app-shell::after { opacity:.10 !important; }
html[data-celestial-glow='off'] .hero-star { box-shadow:none !important; }
html[data-celestial-glow='off'] .hero-card,
html[data-celestial-glow='off'] .tool-card,
html[data-celestial-glow='off'] .tool-panel { box-shadow:0 10px 24px rgba(80,75,92,.05),0 1px 0 rgba(255,255,255,.9) inset !important; }

html[data-celestial-motion='off'] .hero-star,
html[data-celestial-motion='off'] .period-button::before,
html[data-celestial-motion='off'] .spin { animation:none !important; }

@media (max-width:520px) {
  .settings-status-grid { grid-template-columns:1fr; }
  .settings-actions { grid-template-columns:1fr; }
}
''', encoding='utf-8')

print('patched history/settings UX')
