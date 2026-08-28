from pathlib import Path

app_path = Path('web/src/AppNext.tsx')
settings_path = Path('web/src/settings.css')
sender_path = Path('scripts/send_onesignal_horoscope_push.py')

s = app_path.read_text(encoding='utf-8')

if "from './lib/push'" not in s:
    anchor = "import { deleteArchive, listArchive, saveArchive, type ArchiveItem } from './lib/archive'\n"
    assert anchor in s, 'push import anchor missing'
    s = s.replace(anchor, anchor + "import { disablePush, enablePush, getPushState, type PushSnapshot } from './lib/push'\n", 1)

if 'function initialPeriodFromUrl()' not in s:
    anchor = 'function toDateInputValue(date: Date) {\n'
    assert anchor in s, 'initial url anchor missing'
    helper = '''function initialPeriodFromUrl(): PeriodKey {
  if (typeof window === 'undefined') return 'today'
  const kind = new URLSearchParams(window.location.search).get('kind')
  if (kind === 'weekly') return 'week'
  if (kind === 'monthly') return 'month'
  if (kind === 'annual') return 'year'
  return 'today'
}

function initialDateFromUrl() {
  if (typeof window === 'undefined') return toDateInputValue(new Date())
  const params = new URLSearchParams(window.location.search)
  const date = params.get('date')
  if (date && /^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return date
  const year = params.get('year')
  const month = params.get('month')
  if (year && month && /^\\d{4}$/.test(year) && /^\\d{1,2}$/.test(month)) {
    return `${year}-${String(Number(month)).padStart(2,'0')}-01`
  }
  return toDateInputValue(new Date())
}

'''
    s = s.replace(anchor, helper + anchor, 1)

s = s.replace("  const [period, setPeriod] = useState<PeriodKey>('today')\n", "  const [period, setPeriod] = useState<PeriodKey>(() => initialPeriodFromUrl())\n", 1)
s = s.replace("  const [queryDate, setQueryDate] = useState(() => toDateInputValue(new Date()))\n", "  const [queryDate, setQueryDate] = useState(() => initialDateFromUrl())\n", 1)

if 'const [pushState, setPushState]' not in s:
    anchor = "  const [apiVersion, setApiVersion] = useState('')\n"
    assert anchor in s, 'push state anchor missing'
    s = s.replace(anchor, anchor + "  const [pushState, setPushState] = useState<PushSnapshot | null>(null)\n  const [pushBusy, setPushBusy] = useState(false)\n", 1)

if 'const refreshPushState = async' not in s:
    anchor = '  const saveBirthProfile = () => {\n'
    assert anchor in s, 'push handler anchor missing'
    block = '''  const refreshPushState = async () => {
    const state = await getPushState()
    setPushState(state)
  }

  const togglePush = async () => {
    setPushBusy(true)
    try {
      const state = pushState?.status === 'ready' ? await disablePush() : await enablePush()
      setPushState(state)
    } finally {
      setPushBusy(false)
    }
  }

'''
    s = s.replace(anchor, block + anchor, 1)

if "if (mainView === 'settings') void refreshPushState()" not in s:
    anchor = "  useEffect(() => {\n    if (mainView === 'history' || mainView === 'settings') void refreshArchive()\n  }, [mainView])\n"
    assert anchor in s, 'push settings effect anchor missing'
    s = s.replace(anchor, anchor + "\n  useEffect(() => {\n    if (mainView === 'settings') void refreshPushState()\n  }, [mainView])\n", 1)

if '운세 푸시 알림' not in s:
    anchor = '          <div className="subsection-title">앱 상태</div>\n'
    assert anchor in s, 'push settings render anchor missing'
    block = '''          <div className="subsection-title">알림</div>
          <div className="push-settings-card">
            <div className={`push-state-row ${pushState?.status || 'checking'}`}><span className="push-state-icon">🔔</span><span><strong>운세 푸시 알림</strong><small>{pushState?.message || 'OneSignal 알림 구독 상태 확인 중'}</small></span></div>
            <button type="button" onClick={()=>void togglePush()} disabled={pushBusy || pushState?.status==='unsupported'}>{pushBusy?'처리 중…':pushState?.status==='ready'?'알림 끄기':'알림 켜기'}</button>
            {pushState?.status==='needs_install' && <p>iPhone에서는 Safari에서 홈 화면에 추가한 뒤, 홈화면의 ‘별빛의 운명’을 열고 여기서 알림 켜기를 눌러야 해.</p>}
            {pushState?.status==='error' && <p>OneSignal 사이트 주소가 현재 Vercel 도메인과 맞는지 대시보드에서 확인해줘.</p>}
          </div>

'''
    s = s.replace(anchor, block + anchor, 1)

if '<div><span>알림</span>' not in s:
    anchor = "            <div><span>AI 해설</span><strong>{aiConfigured===true?'연결됨':aiConfigured===false?'미연결':'확인 중'}</strong><small>{aiModel}</small></div>\n"
    assert anchor in s, 'push status grid anchor missing'
    s = s.replace(anchor, anchor + "            <div><span>알림</span><strong>{pushState?.status==='ready'?'켜짐':pushState?.status==='needs_install'?'홈화면 설치 필요':pushState?.status==='unsupported'?'지원 안 됨':pushState?.status==='error'?'확인 오류':'꺼짐/확인 중'}</strong><small>{pushState?.message || '설정 탭에서 확인'}</small></div>\n", 1)

app_path.write_text(s, encoding='utf-8')

css = settings_path.read_text(encoding='utf-8')
marker = '/* Vercel OneSignal push settings v1 */'
if marker not in css:
    css += r'''

/* Vercel OneSignal push settings v1 */
.push-settings-card { display:grid; gap:10px; }
.push-state-row {
  display:flex; align-items:flex-start; gap:11px; padding:13px 14px; border-radius:18px;
  border:1px solid rgba(183,190,207,.28); background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(242,246,252,.88));
}
.push-state-icon { flex:0 0 auto; font-size:19px; line-height:1.2; }
.push-state-row > span:last-child { min-width:0; display:grid; gap:3px; }
.push-state-row strong { color:#4e4455; font-size:.7rem; }
.push-state-row small { color:#817988; font-size:.57rem; line-height:1.45; }
.push-state-row.ready { background:linear-gradient(145deg,rgba(249,255,252,.96),rgba(223,245,236,.86)); }
.push-state-row.error { background:linear-gradient(145deg,rgba(255,250,252,.96),rgba(248,226,234,.84)); }
.push-settings-card > button {
  min-height:44px; border-radius:15px; border:1px solid rgba(174,181,201,.34);
  color:#5e5369; font-weight:800; background:linear-gradient(135deg,rgba(241,224,248,.96),rgba(218,236,250,.94),rgba(218,244,235,.92));
  box-shadow:0 8px 20px rgba(91,84,111,.07),0 1px 0 rgba(255,255,255,.95) inset;
}
.push-settings-card > button:disabled { opacity:.52; }
.push-settings-card > p { margin:0; color:#8a7f8d; font-size:.58rem; line-height:1.55; }
'''
    settings_path.write_text(css, encoding='utf-8')

sender = sender_path.read_text(encoding='utf-8')
sender = sender.replace('LAUNCHER_URL = "https://cozysso-afk.github.io/astro-app/"', 'LAUNCHER_URL = "https://astro-app-web-ten.vercel.app/"', 1)
sender_path.write_text(sender, encoding='utf-8')

print('Vercel push migration patch applied')
