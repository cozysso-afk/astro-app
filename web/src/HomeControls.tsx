import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Gem, Heart, MapPin, Moon, Orbit, Search, Sparkles, Sun } from 'lucide-react'

import type { ApiStatus, BirthProfile, PeriodKey, ToolKey } from './appTypes'

export const fortunePeriods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

export const analysisTools = [
  { key: 'integrated' as const, label: '통합운세', desc: '서양·사주·태국점성술로 읽는 한 해', icon: Sparkles, tone: 'gold' },
  { key: 'compatibility' as const, label: '궁합운', desc: '궁합과 재회 · 두 사람의 관계 흐름', icon: Heart, tone: 'rose' },
  { key: 'marriage' as const, label: '결혼운', desc: '개인 결혼운부터 현재 부부 관계까지', icon: Gem, tone: 'champagne' },
  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

type HomeControlsProps = {
  fieldHub?: ReactNode
  workspace?: 'period' | 'field' | 'saju' | 'thai' | 'western'
  onWorkspace?: (value: 'period' | 'field' | 'saju' | 'thai' | 'western') => void
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

export function HomeControls({ fieldHub, workspace='period', onWorkspace, birthProfile, hasProfile, queryDate, period, selectedTool, apiStatus, apiLabel, onOpenProfile, onQueryDateChange, onPeriodSelect, onToolSelect }: HomeControlsProps) {
  const periodDriven = selectedTool === null || selectedTool === 'precision'
  const dateControlVisible = selectedTool !== 'integrated' && selectedTool !== 'location'
  const effectivePeriod: PeriodKey = periodDriven ? period : 'today'
  const now = toDateValue(new Date())
  const resetLabel = effectivePeriod === 'today' ? '오늘' : effectivePeriod === 'week' ? '이번 주' : effectivePeriod === 'month' ? '이번 달' : '올해'
  const year = Number(queryDate.slice(0,4)) || new Date().getFullYear()
  const yearOptions = Array.from({length:16},(_,i)=>year-5+i)
  const pickerLabel = periodDriven ? (effectivePeriod === 'today' ? '운세 날짜' : effectivePeriod === 'week' ? '주간 선택 · 월요일~일요일' : effectivePeriod === 'month' ? '월간 선택 · 달력 월' : '연간 선택 · 달력 연도') : '관계 분석 기준 날짜'
  const resetDate = effectivePeriod === 'month' ? `${now.slice(0,7)}-01` : effectivePeriod === 'year' ? `${now.slice(0,4)}-01-01` : now
  return <div className="moonlit-home-controls">
    {workspace!=='period'&&<button type="button" className="workspace-back" onClick={()=>onWorkspace?.('period')}>← 전체 기간운세로 돌아가기</button>}
    {workspace==='field'&&fieldHub}
    {workspace==='period'&&<button className="profile-card" type="button" onClick={onOpenProfile}>
      <div className="profile-copy"><span className="eyebrow">나의 별빛 기록</span><strong>{hasProfile ? `${birthProfile.name || '나'}의 출생 프로필` : '나의 출생 프로필'}</strong><span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span></div><ChevronDown size={20}/>
    </button>}

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
      <div className="section-label">{workspace==='period'?'전체 기간운세':workspace==='field'?'이 분야의 기간':'선택 체계의 기간'}</div>
      <div className="period-grid" role="tablist" aria-label="기간 운세">{fortunePeriods.map(({key,label,icon:Icon})=>{const active=selectedTool===null&&period===key;return <button aria-selected={active} className={`period-button ${active?'is-active':''}`} key={key} role="tab" type="button" onClick={()=>onPeriodSelect(key,workspace==='period')}><Icon size={17}/><span>{label}</span></button>})}</div>
    </section>

    {selectedTool === 'precision' && <section className="section-block precision-period-range"><div className="section-label">정밀분석 기간 선택</div><div className="period-grid" role="tablist" aria-label="정밀분석 기간">{fortunePeriods.map(({key,label,icon:Icon})=><button aria-selected={period===key} className={`period-button ${period===key?'is-active':''}`} key={key} role="tab" type="button" onClick={()=>onPeriodSelect(key,false)}><Icon size={17}/><span>{label}</span></button>)}</div></section>}

    {workspace==='period'&&<section className="reading-entry-grid" aria-label="독립 운세 선택"><button type="button" onClick={()=>onWorkspace?.('field')}><Heart size={21}/><span><strong>분야별 운세</strong><small>연애·금전·학업 등 10개 분야</small></span><ChevronRight size={16}/></button><button type="button" onClick={()=>onWorkspace?.('western')}><Orbit size={21}/><span><strong>서양점성술</strong><small>행성·분야별 흐름</small></span><ChevronRight size={16}/></button><button type="button" onClick={()=>onWorkspace?.('saju')}><Gem size={21}/><span><strong>사주</strong><small>대운·세운·월운</small></span><ChevronRight size={16}/></button><button type="button" onClick={()=>onWorkspace?.('thai')}><Sparkles size={21}/><span><strong>태국점성술</strong><small>생활 영역·기간 배치</small></span><ChevronRight size={16}/></button></section>}
    {workspace==='period'&&<details className="section-block tools-section home-specialist-tools" open={selectedTool!==null?true:undefined}><summary>궁합·결혼·고급 분석 <ChevronDown size={16}/></summary>
      <div className="section-heading-row"><div className="section-label">별빛으로 살펴보기</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div>
      <div className="home-tool-groups">{[
        {label:'세 체계의 흐름',keys:['integrated']},
        {label:'관계',keys:['compatibility','marriage']},
      ].map(group=><div className="home-tool-group" key={group.label}><h3>{group.label}</h3><div className="home-tool-grid">{analysisTools.filter(t=>group.keys.includes(t.key)).map(({key,label,desc,icon:Icon,tone})=><button aria-pressed={selectedTool===key} className={`home-tool-card ${selectedTool===key?'is-selected':''}`} key={key} type="button" onClick={()=>onToolSelect(key)}><span className={`home-tool-symbol tone-${tone}`}><Icon size={23} strokeWidth={1.7} aria-hidden="true"/></span><span className="home-tool-copy"><strong>{label}</strong><small>{desc}</small></span><ChevronRight size={16} aria-hidden="true"/></button>)}</div></div>)}
      <details className="home-advanced" open={selectedTool==='location'||selectedTool==='precision'?true:undefined}><summary>고급 분석 <ChevronDown size={16} aria-hidden="true"/></summary><div className="home-tool-grid">{analysisTools.filter(t=>['location','precision'].includes(t.key)).map(({key,label,desc,icon:Icon,tone})=><button aria-pressed={selectedTool===key} className={`home-tool-card ${selectedTool===key?'is-selected':''}`} key={key} type="button" onClick={()=>onToolSelect(key)}><span className={`home-tool-symbol tone-${tone}`}><Icon size={23} strokeWidth={1.7} aria-hidden="true"/></span><span className="home-tool-copy"><strong>{label}</strong><small>{desc}</small></span><ChevronRight size={16} aria-hidden="true"/></button>)}</div></details>
      </div>
    </details>}
  </div>
}
