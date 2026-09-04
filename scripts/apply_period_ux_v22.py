from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    p.write_text(text.replace(old, new, 1))


# 1) Calendar-native period boundaries: week=Mon-Sun, month=calendar month, year=calendar year.
replace_once(
    "web/src/AppNext.tsx",
    """function periodEnd(start: string, period: PeriodKey) {
  if (period === 'today') return start
  if (period === 'week') return addDays(start, 6)
  if (period === 'month') return addDays(start, 30)
  return addDays(start, 364)
}
function periodRangeLabel(period: PeriodKey) {""",
    """function startOfWeekMonday(value: string) {
  const date = new Date(`${value}T12:00:00`)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return toDateInputValue(date)
}
function periodStart(value: string, period: PeriodKey) {
  if (period === 'week') return startOfWeekMonday(value)
  if (period === 'month') return `${value.slice(0,7)}-01`
  if (period === 'year') return `${value.slice(0,4)}-01-01`
  return value
}
function periodEnd(value: string, period: PeriodKey) {
  const start = periodStart(value, period)
  if (period === 'today') return start
  if (period === 'week') return addDays(start, 6)
  if (period === 'month') {
    const [year, month] = start.split('-').map(Number)
    return toDateInputValue(new Date(year, month, 0, 12, 0, 0))
  }
  return `${start.slice(0,4)}-12-31`
}
function periodRangeLabel(period: PeriodKey) {""",
    "period boundary helpers",
)

replace_once(
    "web/src/AppNext.tsx",
    """  const annualFortuneYear = integratedCalendarYear ?? queryYear
  const integratedStartDate = selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : queryDate
  const integratedSelectionEnd = selectedTool === 'integrated' ? `${annualFortuneYear}-12-31` : periodEnd(queryDate, period)""",
    """  const annualFortuneYear = integratedCalendarYear ?? queryYear
  const periodSelectionStart = periodStart(queryDate, period)
  const integratedStartDate = selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : periodSelectionStart
  const integratedSelectionEnd = selectedTool === 'integrated' ? `${annualFortuneYear}-12-31` : periodEnd(queryDate, period)""",
    "period selection start",
)

replace_once(
    "web/src/AppNext.tsx",
    '<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>',
    '<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {periodSelectionStart} ~ {integratedSelectionEnd} · {periodRangeLabel(period)}</span></div>',
    "precision range",
)
replace_once(
    "web/src/AppNext.tsx",
    """            startDate={queryDate}
            endDate={integratedSelectionEnd}""",
    """            startDate={periodSelectionStart}
            endDate={integratedSelectionEnd}""",
    "period panel range",
)

# 2) Explicitly distinguish married compatibility from marriage-fortune married mode.
replace_once(
    "web/src/AppNext.tsx",
    """              <div className="relationship-range-block">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong>""",
    """              {relationshipPurpose==='compatibility'&&relationshipMode==='married'&&<div className="status-banner compatibility-married-note"><Heart size={16}/><span><b>기혼 · 일반 궁합</b>은 부부라는 현재 상태를 반영해 두 사람의 기본 궁합과 선택 기간의 흐름을 보는 모드야. <b>결혼운 → 기혼</b>은 결속·생활 역할·공유재정/친밀감·반복 갈등·회복 주기를 결혼생활 중심으로 더 깊게 보는 별도 분석이야.</span></div>}
              <div className="relationship-range-block">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong>""",
    "married compatibility note",
)

# 3) Dynamic home picker. Integrated fortune keeps its own existing calendar-year selector.
Path("web/src/HomeControls.tsx").write_text(r'''import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Gem, Heart, MapPin, Moon, Orbit, Search, Sparkles, Sun } from 'lucide-react'

import type { ApiStatus, BirthProfile, PeriodKey, ToolKey } from './appTypes'

export const fortunePeriods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

export const analysisTools = [
  { key: 'integrated' as const, label: '통합운세', desc: '연도를 골라 서양·사주·태국 한 해 흐름을 분리 비교', icon: Sparkles, tone: 'gold' },
  { key: 'compatibility' as const, label: '궁합운', desc: '두 사람의 기본 관계 구조와 선택 기간의 시기 흐름', icon: Heart, tone: 'rose' },
  { key: 'marriage' as const, label: '결혼운', desc: '개인 결혼운 · 특정 상대 결혼궁합 · 기혼 부부운을 분리 분석', icon: Gem, tone: 'champagne' },
  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

type HomeControlsProps = {
  birthProfile: BirthProfile
  hasProfile: boolean
  queryDate: string
  period: PeriodKey
  selectedTool: ToolKey | null
  apiStatus: ApiStatus
  apiLabel: string
  onOpenProfile: () => void
  onQueryDateChange: (date: string) => void
  onPeriodSelect: (period: PeriodKey, clearTool: boolean) => void
  onToolSelect: (tool: ToolKey) => void
}

function toDateValue(date: Date) {
  const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
function localDate(value: string) { return new Date(`${value}T12:00:00`) }
function mondayOf(value: string) {
  const date = localDate(value); date.setDate(date.getDate()-((date.getDay()+6)%7)); return toDateValue(date)
}
function shiftPeriod(value: string, period: PeriodKey, amount: number) {
  const date = localDate(value)
  if (period === 'today') date.setDate(date.getDate()+amount)
  else if (period === 'week') date.setDate(date.getDate()+amount*7)
  else if (period === 'month') { date.setDate(1); date.setMonth(date.getMonth()+amount) }
  else { date.setMonth(0,1); date.setFullYear(date.getFullYear()+amount) }
  return toDateValue(date)
}
function displayRange(value: string, period: PeriodKey) {
  if (period === 'today') return value
  if (period === 'week') {
    const start = mondayOf(value); const end = shiftPeriod(start,'today',6)
    return `${start} → ${end} · 월~일`
  }
  if (period === 'month') {
    const [y,m] = value.split('-').map(Number); const last = toDateValue(new Date(y,m,0,12))
    return `${y}년 ${m}월 · ${y}-${String(m).padStart(2,'0')}-01 → ${last}`
  }
  return `${value.slice(0,4)}년 · 1월 1일 → 12월 31일`
}

export function HomeControls({ birthProfile, hasProfile, queryDate, period, selectedTool, apiStatus, apiLabel, onOpenProfile, onQueryDateChange, onPeriodSelect, onToolSelect }: HomeControlsProps) {
  const periodDriven = selectedTool === null || selectedTool === 'precision'
  const dateControlVisible = selectedTool !== 'integrated' && selectedTool !== 'location'
  const effectivePeriod: PeriodKey = periodDriven ? period : 'today'
  const now = toDateValue(new Date())
  const resetLabel = effectivePeriod === 'today' ? '오늘' : effectivePeriod === 'week' ? '이번 주' : effectivePeriod === 'month' ? '이번 달' : '올해'
  const year = Number(queryDate.slice(0,4)) || new Date().getFullYear()
  const yearOptions = Array.from({length:16},(_,i)=>year-5+i)
  const pickerLabel = periodDriven ? (effectivePeriod === 'today' ? '운세 날짜' : effectivePeriod === 'week' ? '주간 선택 · 월요일~일요일' : effectivePeriod === 'month' ? '월간 선택 · 달력 월' : '연간 선택 · 달력 연도') : '관계 분석 기준 날짜'
  const resetDate = effectivePeriod === 'month' ? `${now.slice(0,7)}-01` : effectivePeriod === 'year' ? `${now.slice(0,4)}-01-01` : now
  return <>
    <button className="profile-card" type="button" onClick={onOpenProfile}>
      <div className="profile-copy"><span className="eyebrow">MY BIRTH PROFILE</span><strong>{hasProfile ? `${birthProfile.name || '나'}의 출생 프로필` : '나의 출생 프로필'}</strong><span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span></div><ChevronDown size={20}/>
    </button>

    {dateControlVisible && <section className="date-card period-date-picker">
      <div className="period-picker-heading"><label htmlFor="query-date">{pickerLabel}</label>{periodDriven&&effectivePeriod!=='today'&&<span>직접 선택 가능</span>}</div>
      <div className="period-picker-row">
        <button className="period-step-button" type="button" aria-label="이전 기간" onClick={()=>onQueryDateChange(shiftPeriod(queryDate,effectivePeriod,-1))}><ChevronLeft size={18}/></button>
        <div className="date-control period-date-control"><CalendarDays size={19}/>{effectivePeriod==='month'?<input id="query-date" type="month" value={queryDate.slice(0,7)} onChange={(e)=>e.target.value&&onQueryDateChange(`${e.target.value}-01`)}/>:effectivePeriod==='year'?<select id="query-date" value={String(year)} onChange={(e)=>onQueryDateChange(`${e.target.value}-01-01`)}>{yearOptions.map((item)=><option value={item} key={item}>{item}년</option>)}</select>:<input id="query-date" type="date" value={queryDate} onChange={(e)=>onQueryDateChange(e.target.value)}/>}</div>
        <button className="period-step-button" type="button" aria-label="다음 기간" onClick={()=>onQueryDateChange(shiftPeriod(queryDate,effectivePeriod,1))}><ChevronRight size={18}/></button>
      </div>
      <div className="period-picker-caption"><strong>{displayRange(queryDate,effectivePeriod)}</strong><button type="button" onClick={()=>onQueryDateChange(resetDate)}>{resetLabel}</button></div>
    </section>}

    <section className="section-block period-fortune-section">
      <div className="section-label">기간 운세</div>
      <div className="period-grid" role="tablist" aria-label="기간 운세">{fortunePeriods.map(({key,label,icon:Icon})=>{const active=selectedTool===null&&period===key;return <button aria-selected={active} className={`period-button ${active?'is-active':''}`} key={key} role="tab" type="button" onClick={()=>onPeriodSelect(key,true)}><Icon size={17}/><span>{label}</span></button>})}</div>
    </section>

    {selectedTool === 'precision' && <section className="section-block precision-period-range"><div className="section-label">정밀분석 기간 선택</div><div className="period-grid" role="tablist" aria-label="정밀분석 기간">{fortunePeriods.map(({key,label,icon:Icon})=><button aria-selected={period===key} className={`period-button ${period===key?'is-active':''}`} key={key} role="tab" type="button" onClick={()=>onPeriodSelect(key,false)}><Icon size={17}/><span>{label}</span></button>)}</div></section>}

    <section className="section-block tools-section"><div className="section-heading-row"><div className="section-label">분석 도구</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div><div className="tool-grid">{analysisTools.map(({key,label,desc,icon:Icon,tone})=><button aria-pressed={selectedTool===key} className={`tool-card ${selectedTool===key?'is-selected':''}`} key={key} type="button" onClick={()=>onToolSelect(key)}><span className={`tool-icon tone-${tone}`}><Icon size={24}/></span><strong>{label}</strong><span>{desc}</span></button>)}</div></section>
  </>
}
''')

# 4) Period AI panel always exposes manual generation + prompt-copy when calculation exists but no AI state.
p = Path("web/src/PeriodAiInterpretationPanel.tsx")
text = p.read_text()
marker = "  if (loading && !result) return "
if marker not in text:
    raise SystemExit("missing AI idle marker")
idle = """  if (!loading && !error && (!result || !result.data)) return <section className=\"period-ai-card period-ai-ready\"><div className=\"period-ai-head\"><span className=\"period-ai-orb\"><Sparkles size={18}/></span><div><span className=\"period-ai-kicker\">AI(인공지능) 기간 해설</span><h3>자연어 해설 준비됨</h3></div></div><p className=\"period-ai-summary\">계산은 끝났어. 자동 해설이 시작되지 않았거나 저장본이 없으면 여기서 직접 생성할 수 있고, Gemini를 쓰지 않고 프롬프트만 복사할 수도 있어.</p><div className=\"period-ai-v21-controls period-ai-ready-controls\"><button className=\"period-ai-generate\" type=\"button\" onClick={onRetry}><Sparkles size={15}/>해설 생성</button><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>프롬프트 복사</button></div></section>\n"""
p.write_text(text.replace(marker, idle + marker, 1))

replace_once(
    "web/src/PeriodFortunePanel.tsx",
    "버튼을 누르면 계산 후 Gemini 자연어 해설도 자동 생성해. 최초 생성은 API 사용량이 발생할 수 있고, 같은 계산의 저장본 재조회는 다시 호출하지 않아.",
    "버튼을 누르면 기간 계산을 시작해. 자연어 해설은 자동 생성 경로를 먼저 시도하고, 해설 카드에서 직접 생성하거나 Gemini 호출 없이 프롬프트만 복사할 수도 있어. 같은 계산의 저장본 재조회는 다시 호출하지 않아.",
    "period panel copy",
)

# 5) Final CSS layer loaded last, so legacy tiny font declarations cannot win.
Path("web/src/ux-readability-v22.css").write_text(r'''/* v22 · mobile readability, calendar period picker, stronger but calm motion */
:root{--ux-body:.94rem;--ux-small:.82rem;--ux-meta:.76rem;--ux-title:1.02rem;--ux-section:1.12rem}
.app-shell::before{display:none!important}

.period-date-picker{display:grid;gap:10px}.period-picker-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.period-picker-heading label{font-size:.88rem;font-weight:850;color:#65586b}.period-picker-heading>span{font-size:.74rem;font-weight:800;color:#917e99}.period-picker-row{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;gap:8px;align-items:center}.period-step-button{width:38px;height:40px;display:grid;place-items:center;border:1px solid rgba(143,126,157,.17);border-radius:12px;background:rgba(255,255,255,.72);color:#725f7c;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)}.period-date-control{min-width:0}.period-date-control input,.period-date-control select{width:100%;min-width:0;border:0;background:transparent;color:#4f4455;font:inherit;font-size:.92rem;font-weight:760}.period-picker-caption{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:11px;background:rgba(246,243,250,.72)}.period-picker-caption strong{font-size:.78rem;line-height:1.45;color:#77697e}.period-picker-caption button{flex:0 0 auto;border:0;background:transparent;color:#765f82;font-size:.77rem;font-weight:900;padding:4px 2px}

.tool-panel,.result-card,.period-ai-card,.relationship-reading-card,.relationship-ai-card{font-size:var(--ux-body)}
.tool-panel-heading h2{font-size:1.52rem!important;line-height:1.22!important}.tool-panel-heading p,.coordinate-note span,.result-note{font-size:.9rem!important;line-height:1.62!important}.eyebrow,.result-card-title>span,.period-ai-kicker{font-size:.76rem!important;letter-spacing:.055em!important}.result-card-title>strong,.period-ai-section-title>strong{font-size:1rem!important;line-height:1.42!important}.result-headline strong{font-size:1rem!important}.result-headline span{font-size:.84rem!important;line-height:1.5!important}.integrated-topic>span{font-size:.88rem!important}.integrated-topic>small{font-size:.82rem!important}.integrated-topic>strong{line-height:1!important}

.period-ai-head h3{font-size:1.08rem!important;line-height:1.42!important}.period-ai-summary{font-size:.9rem!important;line-height:1.62!important}.period-ai-overall-brief>span,.period-ai-section-title>span{font-size:.76rem!important}.period-ai-overall-brief>p>b{font-size:.8rem!important}.period-ai-overall-brief>p>strong{font-size:.9rem!important;line-height:1.58!important}.period-ai-quick-date>b{font-size:.86rem!important}.period-ai-quick-date>div>strong{font-size:.88rem!important}.period-ai-quick-date>div>small{font-size:.76rem!important}.period-ai-quick-date>span,.period-ai-window-head>span,.period-ai-window-topics>span{font-size:.73rem!important}.period-ai-actions article>div>strong{font-size:.94rem!important}.period-ai-action-time{font-size:.79rem!important}.period-ai-actions article>div>p,.period-ai-window>p,.period-ai-window-line,.period-ai-action-more>p:not(.period-ai-condition),.period-ai-relationship-more>p{font-size:.88rem!important;line-height:1.62!important}.period-ai-window-head>div>b{font-size:.88rem!important}.period-ai-window-head>div>strong{font-size:.91rem!important}.period-ai-action-more>summary,.period-ai-relationship-more>summary,.period-ai-meta>summary{font-size:.79rem!important}.period-ai-validation,.period-ai-validation strong{font-size:.76rem!important}.period-ai-details>summary,.period-ai-topic-disclosure>summary{font-size:.86rem!important}.period-ai-section>strong{font-size:.91rem!important}.period-ai-section>p,.period-ai-topic>p,.period-ai-cross-list>article>p{font-size:.87rem!important;line-height:1.62!important}.period-ai-topic>strong,.period-ai-topic>b{font-size:.9rem!important}.period-ai-cross-list>article>strong{font-size:.88rem!important}.period-date-source>summary>span{font-size:.7rem!important}.period-date-source>summary>strong{font-size:.91rem!important}.period-date-source>summary>small{font-size:.76rem!important}

.period-ai-v21-controls button,.relationship-ai-toolbar button,.result-actions button{font-size:.82rem!important;font-weight:800!important;line-height:1.25!important;padding:8px 10px!important;min-height:38px}.period-ai-v21-controls svg,.result-actions svg{width:15px;height:15px}.period-ai-ready{gap:10px!important}.period-ai-ready-controls{margin-top:2px!important}.period-ai-ready-controls .period-ai-generate{background:linear-gradient(135deg,rgba(238,229,249,.95),rgba(230,247,244,.9));border-color:rgba(120,94,145,.22)}

.relationship-reading-card h3,.relationship-ai-card h3{font-size:1.12rem!important;line-height:1.45!important}.relationship-overview,.relationship-reading-grid p,.relationship-key-aspects p,.relationship-ai-overview,.relationship-ai-grid p,.reunion-ai-grid p,.marriage-ai-grid p{font-size:.91rem!important;line-height:1.65!important}.relationship-reading-grid strong,.relationship-key-aspects>strong,.relationship-ai-grid strong,.reunion-ai-grid b,.marriage-ai-grid b{font-size:.93rem!important}.relationship-ai-toolbar small,.relationship-range-note{font-size:.78rem!important;line-height:1.5!important}.compatibility-married-note span{font-size:.86rem!important;line-height:1.6!important}

@keyframes uxCardRise{0%{opacity:0;transform:translateY(14px) scale(.985)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes uxActiveGlow{0%,100%{box-shadow:0 12px 26px rgba(126,78,40,.18),0 0 0 1px rgba(255,239,205,.18) inset}50%{box-shadow:0 15px 32px rgba(126,78,40,.27),0 0 25px rgba(220,173,101,.22),0 0 0 1px rgba(255,239,205,.24) inset}}
@keyframes uxDetailOpen{0%{opacity:0;transform:translateY(-7px)}100%{opacity:1;transform:none}}
.celestial-motion-on .tool-panel,.celestial-motion-on .period-ai-card,.celestial-motion-on .results-wrap>.result-card,.celestial-motion-on .relationship-reading-card{animation:uxCardRise .42s cubic-bezier(.2,.78,.26,1) both}.celestial-motion-on .period-button.is-active{animation:uxActiveGlow 2.8s ease-in-out infinite}.celestial-motion-on details[open]>*:not(summary){animation:uxDetailOpen .24s ease-out both}.period-button,.tool-card,.primary-button,.period-step-button,.period-ai-v21-controls button{transition:transform .16s ease,box-shadow .2s ease,filter .2s ease}.period-button:active,.tool-card:active,.primary-button:active,.period-step-button:active,.period-ai-v21-controls button:active{transform:scale(.965)}

@media(max-width:430px){.period-picker-row{grid-template-columns:36px minmax(0,1fr) 36px}.period-step-button{width:36px}.tool-panel-heading p{font-size:.88rem!important}.period-ai-card{padding:15px 14px!important}.period-ai-overall-brief>p{grid-template-columns:1fr!important}.period-ai-v21-controls button{font-size:.8rem!important}}
@media(prefers-reduced-motion:reduce){.celestial-motion-on .tool-panel,.celestial-motion-on .period-ai-card,.celestial-motion-on .results-wrap>.result-card,.celestial-motion-on .relationship-reading-card,.celestial-motion-on .period-button.is-active,.celestial-motion-on details[open]>*:not(summary){animation:none!important}.period-button,.tool-card,.primary-button,.period-step-button,.period-ai-v21-controls button{transition:none!important}}
''')

replace_once(
    "web/src/main.tsx",
    "import './period-ai-v18.css'\n",
    "import './period-ai-v18.css'\nimport './ux-readability-v22.css'\n",
    "final UX css import",
)

Path("web/src/lib/periodSelectionContract.test.mjs").write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../HomeControls.tsx',import.meta.url),'utf8')
const ai=readFileSync(new URL('../PeriodAiInterpretationPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../ux-readability-v22.css',import.meta.url),'utf8')
test('calendar periods use Monday-Sunday, calendar month and calendar year',()=>{assert.match(app,/function startOfWeekMonday/);assert.match(app,/const periodSelectionStart = periodStart\(queryDate, period\)/);assert.match(app,/startDate=\{periodSelectionStart\}/);assert.match(app,/return `\$\{start\.slice\(0,4\)\}-12-31`/)})
test('week month year have direct pickers',()=>{assert.match(home,/월요일~일요일/);assert.match(home,/type="month"/);assert.match(home,/연간 선택 · 달력 연도/);assert.match(home,/이전 기간/);assert.match(home,/다음 기간/)})
test('period AI always exposes generation and prompt copy in idle state',()=>{assert.match(ai,/자연어 해설 준비됨/);assert.match(ai,/>해설 생성</);assert.match(ai,/>프롬프트 복사</)})
test('fixed star dots are removed and typography is normalized',()=>{assert.match(css,/\.app-shell::before\{display:none!important\}/);assert.match(css,/period-ai-v21-controls button/);assert.match(css,/uxCardRise/)})
test('married compatibility is explicitly distinct from married marriage fortune',()=>{assert.match(app,/기혼 · 일반 궁합/);assert.match(app,/결혼운 → 기혼/)})
''')
