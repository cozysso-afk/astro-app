from pathlib import Path

p=Path('web/src/AppNext.tsx')
text=p.read_text(encoding='utf-8')

def rep(old,new,count=1):
    global text
    if old not in text:
        raise SystemExit('missing marker: '+old[:180])
    text=text.replace(old,new,count)

# State: relative period and exact calendar-year period are independent.
rep("  const [period, setPeriod] = useState<PeriodKey>(() => initialPeriodFromUrl())\n  const [queryDate, setQueryDate] = useState(() => initialDateFromUrl())",
"  const [period, setPeriod] = useState<PeriodKey>(() => initialPeriodFromUrl())\n  const [integratedCalendarYear, setIntegratedCalendarYear] = useState<number | null>(null)\n  const [queryDate, setQueryDate] = useState(() => initialDateFromUrl())")
rep("  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n  const [relationshipDays, setRelationshipDays] = useState(365)",
"  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n  const [relationshipDays, setRelationshipDays] = useState(365)\n  const [relationshipCalendarYear, setRelationshipCalendarYear] = useState<number | null>(null)")

# Derived dates.
old="""  const activeDayun = currentDayun(integratedResult)
  const clampedRelationshipDays = Math.max(7, Math.min(365, Number(relationshipDays) || 365))
  const relationshipEndDate = addDays(queryDate, clampedRelationshipDays - 1)
  const relationshipPeriodKey: PeriodKey = clampedRelationshipDays >= 365 ? 'year' : clampedRelationshipDays >= 28 ? 'month' : 'week'
  const integratedSelectionEnd = periodEnd(queryDate, period)"""
new="""  const activeDayun = currentDayun(integratedResult)
  const queryYear = Number(queryDate.slice(0,4)) || new Date().getFullYear()
  const calendarYearOptions = Array.from({length:6},(_,index)=>queryYear - 1 + index)
  const integratedStartDate = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
  const integratedSelectionEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
  const clampedRelationshipDays = Math.max(7, Math.min(365, Number(relationshipDays) || 365))
  const relationshipStartDate = relationshipCalendarYear ? `${relationshipCalendarYear}-01-01` : queryDate
  const relationshipEndDate = relationshipCalendarYear ? `${relationshipCalendarYear}-12-31` : addDays(queryDate, clampedRelationshipDays - 1)
  const relationshipDayCount = Math.round((new Date(`${relationshipEndDate}T12:00:00Z`).getTime()-new Date(`${relationshipStartDate}T12:00:00Z`).getTime())/86400000)+1
  const relationshipPeriodKey: PeriodKey = relationshipCalendarYear || clampedRelationshipDays >= 365 ? 'year' : clampedRelationshipDays >= 28 ? 'month' : 'week'"""
rep(old,new)

# Integrated selection matching must include start too.
rep("    integratedResult.period.start === queryDate &&\n    integratedResult.period.end === integratedSelectionEnd",
"    integratedResult.period.start === integratedStartDate &&\n    integratedResult.period.end === integratedSelectionEnd")

# Integrated calculation payload(s).
text=text.replace("      start_date: queryDate,\n      end_date: periodEnd(queryDate, period),", "      start_date: integratedStartDate,\n      end_date: integratedSelectionEnd,")

# Relationship / reunion payloads use the effective exact-year start/end.
text=text.replace("        start_date: queryDate,\n        end_date: end,", "        start_date: relationshipStartDate,\n        end_date: end,")
text=text.replace("      start_date: queryDate, end_date: relationshipEndDate,", "      start_date: relationshipStartDate, end_date: relationshipEndDate,")

# Relative period buttons clear exact calendar-year mode.
rep("onClick={()=>setPeriod(key)}", "onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}")

# Reset exact relationship-year mode when opening relationship tools / selecting relative days.
text=text.replace("if(key==='compatibility'||key==='marriage') setRelationshipDays(365);", "if(key==='compatibility'||key==='marriage'){setRelationshipDays(365);setRelationshipCalendarYear(null);}")
text=text.replace("setRelationshipDays(365);setReunionTiming(null)", "setRelationshipDays(365);setRelationshipCalendarYear(null);setReunionTiming(null)")
text=text.replace("onClick={()=>setRelationshipDays(days)}", "onClick={()=>{setRelationshipDays(days);setRelationshipCalendarYear(null)}}")
text=text.replace("onChange={(e)=>setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)))}", "onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}")

# Integrated UI: existing relative period + exact calendar year.
old="""          {(selectedTool==='integrated'||selectedTool==='precision') && <section className=\"section-block\"><div className=\"section-label\">통합운세 기간 선택</div><div className=\"period-grid\">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type=\"button\" onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}><Icon size={17}/><span>{label}</span></button>)}</div></section>}"""
new="""          {(selectedTool==='integrated'||selectedTool==='precision') && <section className=\"section-block\"><div className=\"section-label\">통합운세 기간 선택</div><div className=\"period-grid\">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${!integratedCalendarYear&&period===key?'is-active':''}`} type=\"button\" onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}><Icon size={17}/><span>{label}</span></button>)}</div><div className=\"calendar-year-selector\"><div><strong>연도 전체</strong><span>1월 1일 ~ 12월 31일</span></div><select aria-label=\"통합운세 달력 연도 선택\" value={integratedCalendarYear??''} onChange={(e)=>setIntegratedCalendarYear(e.target.value?Number(e.target.value):null)}><option value=\"\">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div></section>}"""
rep(old,new)

# Integrated displayed range.
rep("분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}", "분석기간 {integratedStartDate} ~ {integratedSelectionEnd} · {integratedCalendarYear?`${integratedCalendarYear}년 전체`:periodRangeLabel(period)}")

# Relationship displayed range snippets.
text=text.replace("{queryDate} ~ {relationshipEndDate} · {clampedRelationshipDays}일", "{relationshipStartDate} ~ {relationshipEndDate} · {relationshipCalendarYear?`${relationshipCalendarYear}년 전체`:`${clampedRelationshipDays}일`}")
text=text.replace("현재 범위는 {queryDate}~{relationshipEndDate}이고", "현재 범위는 {relationshipStartDate}~{relationshipEndDate}이고")

# Add exact year selector to both compatibility/reunion and marriage blocks after custom-days row.
marker="""                <div className=\"relationship-custom-days\"><span>직접 지정</span><label><input type=\"number\" min=\"7\" max=\"365\" step=\"1\" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div>"""
year_ui="""                <div className=\"relationship-custom-days\"><span>직접 지정</span><label><input type=\"number\" min=\"7\" max=\"365\" step=\"1\" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div>
                <div className=\"calendar-year-selector relationship-calendar-year\"><div><strong>연도 전체</strong><span>해당 연도 1/1~12/31</span></div><select aria-label=\"관계운 달력 연도 선택\" value={relationshipCalendarYear??''} onChange={(e)=>{setRelationshipCalendarYear(e.target.value?Number(e.target.value):null);setReunionTiming(null);setRelationshipAi(null)}}><option value=\"\">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div>"""
if text.count(marker) < 1: raise SystemExit('relationship custom day marker missing')
text=text.replace(marker,year_ui,1)
# Marriage is minified one-line; insert after its custom-days closing.
marriage_old="""<div className=\"relationship-custom-days\"><span>직접 지정</span><label><input type=\"number\" min=\"7\" max=\"365\" step=\"1\" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div><small className=\"relationship-range-note\">"""
marriage_new="""<div className=\"relationship-custom-days\"><span>직접 지정</span><label><input type=\"number\" min=\"7\" max=\"365\" step=\"1\" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div><div className=\"calendar-year-selector relationship-calendar-year\"><div><strong>연도 전체</strong><span>해당 연도 1/1~12/31</span></div><select aria-label=\"결혼운 달력 연도 선택\" value={relationshipCalendarYear??''} onChange={(e)=>{setRelationshipCalendarYear(e.target.value?Number(e.target.value):null);setRelationshipAi(null)}}><option value=\"\">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div><small className=\"relationship-range-note\">"""
rep(marriage_old,marriage_new)

# Relationship calculation range / request archive titles should reflect effective start.
text=text.replace("periodStart: relationshipResult.period.start,", "periodStart: relationshipResult.period.start,")

p.write_text(text,encoding='utf-8')

css=Path('web/src/mobile-spacing-v11.css')
c=css.read_text(encoding='utf-8') if css.exists() else ''
c += '''\n\n/* calendar-year selector */\n.calendar-year-selector{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px 13px;border:1px solid rgba(130,112,150,.12);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(244,240,252,.78))}.calendar-year-selector>div{display:grid;gap:2px;min-width:0}.calendar-year-selector strong{font-family:\"AppleMyungjo\",\"Noto Serif KR\",serif;font-size:.82rem;color:#524759}.calendar-year-selector span{font-size:.64rem;color:#83788a}.calendar-year-selector select{appearance:auto;min-width:112px;height:38px;padding:0 10px;border:1px solid rgba(130,112,150,.16);border-radius:12px;background:rgba(255,255,255,.92);font-size:.76rem;font-weight:700;color:#5c5064}.relationship-calendar-year{margin-top:9px}.relationship-range-buttons button.is-active{box-shadow:0 6px 16px rgba(101,78,124,.1)}@media(max-width:430px){.calendar-year-selector{padding:11px}.calendar-year-selector select{min-width:105px;font-size:.73rem}}\n'''
css.write_text(c,encoding='utf-8')
print('calendar-year selector patch applied')
