from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / 'web/src/AppNext.tsx'
main_path = ROOT / 'web/src/main.tsx'
css_path = ROOT / 'web/src/fortune-ux-v13.css'
edge_path = ROOT / 'supabase/functions/relationship-interpret-v9-preview/index.ts'

app = app_path.read_text()

# 1) Integrated fortune returns to an annual-only product. Precision keeps short-range controls.
old_dates = """  const integratedStartDate = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
  const integratedSelectionEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
"""
new_dates = """  const annualFortuneYear = integratedCalendarYear ?? queryYear
  const integratedStartDate = selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : queryDate
  const integratedSelectionEnd = selectedTool === 'integrated' ? `${annualFortuneYear}-12-31` : periodEnd(queryDate, period)
"""
if old_dates not in app:
    raise SystemExit('integrated date contract not found')
app = app.replace(old_dates, new_dates, 1)

period_pattern = re.compile(r"\s*\{\(selectedTool==='integrated'\|\|selectedTool==='precision'\) && <section className=\"section-block\">.*?</section>\}\n(?=\s*<section className=\"section-block tools-section\">)", re.S)
period_replacement = """
          {selectedTool==='integrated' && <section className=\"section-block annual-fortune-range\"><div className=\"section-heading-row\"><div className=\"section-label\">연간 통합운세</div><span className=\"annual-range-badge\">1월 1일 → 12월 31일</span></div><div className=\"calendar-year-selector annual-year-selector\"><div><strong>{annualFortuneYear}년 전체 흐름</strong><span>연애 · 재회 · 연락 · 금전 · 학업 · 직장 · 컨디션</span></div><select aria-label=\"연간 통합운세 연도 선택\" value={annualFortuneYear} onChange={(e)=>setIntegratedCalendarYear(Number(e.target.value))}>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div></section>}
          {selectedTool==='precision' && <section className=\"section-block precision-period-range\"><div className=\"section-label\">정밀분석 기간 선택</div><div className=\"period-grid\">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type=\"button\" onClick={()=>setPeriod(key)}><Icon size={17}/><span>{label}</span></button>)}</div></section>}
"""
app, count = period_pattern.subn(period_replacement, app, count=1)
if count != 1:
    raise SystemExit(f'period selector replacement count={count}')

app = app.replace('<span className="eyebrow">통합 흐름 계산</span><h2>통합운세</h2><p>Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국점성술) Mahathaksa(마하탁사)·Taksajorn(탁사쫀) 기간층을 각각 계산해 한 화면에서 비교해.</p>', '<span className="eyebrow">연간 통합 흐름</span><h2>연간 통합운세</h2><p>한 해의 연애·재회·연락·금전·학업·직장·컨디션 흐름을 Western(서양점성술)·사주·Thai(태국점성술)로 따로 계산하고 월별·핵심 날짜까지 비교해.</p>', 1)
app = app.replace('<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {integratedStartDate} ~ {integratedSelectionEnd} · {integratedCalendarYear?`${integratedCalendarYear}년 전체`:periodRangeLabel(period)}</span></div>', '<div className="calculation-range annual-calculation-range"><CalendarDays size={17}/><span>연간 분석 {integratedStartDate} ~ {integratedSelectionEnd} · {annualFortuneYear}년 전체</span></div>', 1)
app = app.replace("'통합운세 실제 계산'", "'연간 통합운세 계산'", 1)

# Add annual-only highlights to the single integrated result, before SAJU.
saju_marker = '''              <section className="result-card">\n                <div className="result-card-title"><span>SAJU</span><strong>사주 원국 · 진태양시</strong></div>'''
if saju_marker not in app:
    raise SystemExit('SAJU insertion marker missing')
annual_extras = '''              {orderedRelationshipSignals.length > 0 && <section className="result-card annual-signal-card"><div className="result-card-title"><span>RELATIONSHIP</span><strong>연애 · 연락 · 재접점 연간 신호</strong></div><div className="integrated-topic-grid signal-grid">{orderedRelationshipSignals.map(({topic,stat})=><div className="integrated-topic signal-topic" key={`signal-${topic}`}><span>{topic === '수신신호' ? '수신 · 상대 → 나' : topic === '발신적합' ? '발신 · 나 → 상대' : '과거 인연 · 재접점'}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}</div><p className="result-note">수신·발신·재접점은 서로 섞지 않아. 점수는 사건 확률이 아니라 선택한 연도의 상대적 활성도야.</p></section>}

              {integratedResult.western.market?.has_open_session && <section className="result-card market-flow-card"><div className="result-card-title"><span>MONEY · MARKET</span><strong>금전 · 주식 · 투자 연간 흐름</strong></div><div className="integrated-topic-grid">{['투자심리','수익실현','신규진입','투자주의'].map((topic)=>{const stat=integratedResult.western.overall[topic]; if(!stat) return null; return <div className="integrated-topic market-topic" key={`market-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>})}</div><p className="result-note">투자주의는 높을수록 좋은 점수가 아니라 위험 경계가 강하다는 뜻이야.</p></section>}

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card annual-date-highlights"><div className="result-card-title"><span>YEAR HIGHLIGHTS</span><strong>연간 좋은 날짜 · 주의 날짜</strong></div>{bestIntegratedDays.map((point)=><div className="tight-row" key={`best-${point.date}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}{cautionIntegratedDays.map((point)=><div className="tight-row" key={`caution-${point.date}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}<p className="result-note">연간 비교용 상대 활성도야. 특정 사건이 반드시 발생한다는 확률값은 아니야.</p></section>}

'''
app = app.replace(saju_marker, annual_extras + saju_marker, 1)

# Keep relative caution context in the main Western card.
strong_flow = '''                {topIntegratedTopics.length>0 && <div className="best-window"><span>가장 강한 흐름</span><strong>{topIntegratedTopics.slice(0,3).map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}'''
if strong_flow not in app:
    raise SystemExit('strong flow marker missing')
app = app.replace(strong_flow, strong_flow + '''\n                {cautionIntegratedTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}''', 1)

# Remove the second rendering of the same integrated result ("천체 흐름 리포트").
dup_start_marker = '          {selectedTool===\'integrated\' && <section className="tool-panel">\n            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">천체 흐름 리포트</span>'
dup_start = app.find(dup_start_marker)
if dup_start < 0:
    raise SystemExit('duplicate report block start missing')
dup_end = app.find("          {selectedTool === 'location' && <section", dup_start)
if dup_end < 0:
    raise SystemExit('duplicate report block end missing')
app = app[:dup_start] + app[dup_end:]

# Better relationship Edge Function error extraction in the client.
old_invoke = '''      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) throw error
      const payload = data as RelationshipAiResponse'''
new_invoke = '''      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) {
        let detail = ''
        const context = (error as { context?: Response }).context
        if (context) { try { const body = await context.clone().json() as { error?: string }; detail = body?.error ?? '' } catch { /* keep SDK message */ } }
        throw new Error(detail || error.message)
      }
      const payload = data as RelationshipAiResponse'''
if old_invoke not in app:
    raise SystemExit('relationship invoke marker missing')
app = app.replace(old_invoke, new_invoke, 1)

app_path.write_text(app)

# 2) iOS date/time alignment + luminous annual score cards.
css = r'''/* v13 · annual fortune IA + iOS input/readability polish */

/* iOS date/time: actual value centered, not merely the input box. */
.birth-date-field input[type="date"],
.birth-time-field input[type="time"]{
  width:100%!important;
  min-width:0!important;
  text-align:center!important;
  padding-inline:12px!important;
  font-variant-numeric:tabular-nums lining-nums!important;
  letter-spacing:.015em!important;
}
.birth-date-field input[type="date"]::-webkit-date-and-time-value,
.birth-time-field input[type="time"]::-webkit-date-and-time-value{
  display:block!important;
  width:100%!important;
  margin:0!important;
  padding:0!important;
  text-align:center!important;
}
.birth-date-field input[type="date"]::-webkit-datetime-edit,
.birth-time-field input[type="time"]::-webkit-datetime-edit{
  display:flex!important;
  width:100%!important;
  justify-content:center!important;
  align-items:center!important;
  padding:0!important;
}
.birth-date-field input[type="date"]::-webkit-datetime-edit-fields-wrapper,
.birth-time-field input[type="time"]::-webkit-datetime-edit-fields-wrapper{
  display:flex!important;
  justify-content:center!important;
  align-items:center!important;
  width:100%!important;
}
.birth-date-field input[type="date"]::-webkit-calendar-picker-indicator,
.birth-time-field input[type="time"]::-webkit-calendar-picker-indicator{
  margin-left:4px!important;
  opacity:.46!important;
}

/* Keep date readable while giving time enough room on iPhone. */
.field-grid{grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr)!important;gap:13px 10px!important}
.birth-date-field input{font-size:.9rem!important;font-weight:750!important}
.birth-time-field input{font-size:.9rem!important;font-weight:750!important}

.annual-fortune-range{background:linear-gradient(145deg,rgba(252,247,255,.82),rgba(241,250,248,.8))!important}
.annual-range-badge{font-size:.68rem;font-weight:850;color:#765f8b;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(126,101,153,.12)}
.annual-year-selector{margin-top:8px!important}
.annual-calculation-range{background:linear-gradient(120deg,rgba(250,240,255,.8),rgba(235,250,247,.78))!important}

/* Score cards: luminous glass instead of flat pastel blocks. */
.integrated-topic{
  position:relative!important;
  isolation:isolate!important;
  overflow:hidden!important;
  min-height:106px!important;
  align-content:center!important;
  padding:15px 10px 14px!important;
  border:1px solid rgba(255,255,255,.72)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 10px 28px rgba(92,71,121,.075),0 2px 7px rgba(87,68,104,.035)!important;
  backdrop-filter:blur(16px) saturate(128%)!important;
  -webkit-backdrop-filter:blur(16px) saturate(128%)!important;
}
.integrated-topic::before{
  content:"";
  position:absolute;
  z-index:-1;
  inset:-28% 38% 42% -18%;
  border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.92),rgba(255,255,255,0) 68%);
  pointer-events:none;
}
.integrated-topic::after{
  content:"✦";
  position:absolute;
  right:10px;
  top:7px;
  color:rgba(255,255,255,.88);
  font-size:.76rem;
  text-shadow:0 0 10px rgba(255,255,255,.9);
  pointer-events:none;
}
.integrated-topic>span{
  position:relative;
  z-index:1;
  font-size:.79rem!important;
  font-weight:820!important;
  letter-spacing:-.015em!important;
  color:#62536c!important;
}
.integrated-topic>strong{
  position:relative;
  z-index:1;
  font-family:"Bodoni 72",Didot,"Iowan Old Style",Georgia,serif!important;
  font-variant-numeric:tabular-nums lining-nums!important;
  font-feature-settings:"tnum" 1,"lnum" 1!important;
  font-size:2.05rem!important;
  line-height:1.02!important;
  font-weight:600!important;
  letter-spacing:.018em!important;
  color:#654778!important;
  text-shadow:0 1px 0 rgba(255,255,255,.96),0 4px 16px rgba(112,76,143,.12)!important;
}
.integrated-topic>small{
  position:relative;
  z-index:1;
  font-size:.7rem!important;
  font-weight:700!important;
  color:#83748b!important;
}
.integrated-topic:nth-child(6n+1){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(255,239,224,.9),rgba(255,249,239,.74))!important}
.integrated-topic:nth-child(6n+2){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(239,230,255,.92),rgba(250,245,255,.76))!important}
.integrated-topic:nth-child(6n+3){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(224,248,241,.92),rgba(245,253,250,.76))!important}
.integrated-topic:nth-child(6n+4){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(226,240,255,.94),rgba(247,251,255,.78))!important}
.integrated-topic:nth-child(6n+5){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(255,226,239,.9),rgba(255,247,251,.76))!important}
.integrated-topic:nth-child(6n){background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.94),transparent 36%),linear-gradient(145deg,rgba(249,241,207,.92),rgba(255,253,240,.78))!important}
.signal-topic>strong{color:#6c4d83!important}
.market-topic>strong{color:#70523d!important}
.caution-window{background:linear-gradient(145deg,rgba(255,244,240,.82),rgba(249,242,255,.8))!important}

@media(max-width:430px){
  .integrated-topic{min-height:104px!important;border-radius:20px!important}
  .integrated-topic>strong{font-size:1.95rem!important}
}
@media(max-width:355px){
  .field-grid{grid-template-columns:1fr!important}
  .birth-date-field,.birth-time-field{grid-column:1!important}
}
'''
css_path.write_text(css)

main = main_path.read_text()
import_line = "import './fortune-ux-v13.css'"
if import_line not in main:
    marker = "import './fixpack-v12.css'"
    if marker not in main:
        raise SystemExit('main css import marker missing')
    main = main.replace(marker, marker + "\n" + import_line, 1)
main_path.write_text(main)

# 3) Relationship AI: purpose-specific schema and two-attempt cap.
edge = edge_path.read_text()
edge = edge.replace('VERSION="relationship-v10.1-grounded-depth"', 'VERSION="relationship-v10.2-purpose-schema"', 1)

schema_pattern = re.compile(r'const SCHEMA:any=.*?;\n\nfunction usage', re.S)
schema_code = r'''const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};
const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};
const TOP_ASPECT_SCHEMA:any={type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}};
function schemaFor(p:Purpose){
 const properties:any={headline:S,overview:S,chemistry:S,emotional_dynamic:S,communication:S,conflict_pattern:S,power_boundaries:S,long_term:S,timing:S,reunion_context:S,felt_scenarios:{type:"ARRAY",items:S},practical_advice:{type:"ARRAY",items:S},top_aspects:TOP_ASPECT_SCHEMA,limits:S};
 const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];
 if(p==="reunion"){properties.reunion_reading=REUNION_SCHEMA;required.push("reunion_reading");}
 if(p.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}
 return {type:"OBJECT",properties,required};
}

function usage'''
edge, count = schema_pattern.subn(schema_code, edge, count=1)
if count != 1:
    raise SystemExit(f'edge schema replacement count={count}')

edge = edge.replace('responseSchema:SCHEMA,maxOutputTokens:compactMode?12000:16000', 'responseSchema:schemaFor(purpose),maxOutputTokens:compactMode?9000:12000', 1)
edge = edge.replace('if(p==="reunion"&&String(data.reunion_reading?.bottom_line??"").length<220)return false;', 'if(p==="reunion"){const rr=data.reunion_reading??{};if(String(rr.bottom_line??"").length<160)return false;if(String(rr.reconnection_windows??"").length<140)return false;}', 1)

calc_pattern = re.compile(r'async function calculate\(payload:any,purpose:Purpose,preferred:string,key:string\)\{.*?\}\n\nDeno\.serve', re.S)
calc_replacement = r'''async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){
 const first:any=await generate(payload,purpose,preferred,key,false);
 if(first.ok)return first;
 const retryModel=preferred!==FALLBACK_MODEL?FALLBACK_MODEL:preferred;
 const second:any=await generate(payload,purpose,retryModel,key,true);
 if(second.ok)return retryModel!==preferred?{...second,fallback_from:preferred}:second;
 return {ok:false,error:`관계 정밀해설 생성 검증에 실패했어. ${first.error||"1차 생성 실패"} · ${second.error||"재시도 실패"}`,model:preferred,interpreter_version:VERSION};
}

Deno.serve'''
edge, count = calc_pattern.subn(calc_replacement, edge, count=1)
if count != 1:
    raise SystemExit(f'edge calculate replacement count={count}')
edge = edge.replace('const result=await calculate(payload,purpose,preferred,key);return respond(result,result.ok?200:502);', 'const result=await calculate(payload,purpose,preferred,key);return respond(result,200);', 1)

edge_path.write_text(edge)

# Sanity gates before CI.
final_app = app_path.read_text()
assert '천체 흐름 리포트' not in final_app
assert '연간 통합운세' in final_app
assert '정밀분석 기간 선택' in final_app
assert '연애 · 연락 · 재접점 연간 신호' in final_app
assert '::-webkit-date-and-time-value' in css_path.read_text()
final_edge = edge_path.read_text()
assert 'relationship-v10.2-purpose-schema' in final_edge
assert 'responseSchema:schemaFor(purpose)' in final_edge
assert 'return respond(result,200)' in final_edge
print('PATCH_OK')
