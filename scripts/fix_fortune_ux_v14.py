from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / "web/src/AppNext.tsx"
main_path = ROOT / "web/src/main.tsx"
css_path = ROOT / "web/src/fortune-ux-v14.css"
edge_path = ROOT / "supabase/functions/relationship-interpret-v9-preview/index.ts"

app = app_path.read_text()

period_contract = '''  const integratedStartDate = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
  const integratedSelectionEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
'''
period_selector_token = '''{(selectedTool==='integrated'||selectedTool==='precision') && <section className="section-block"><div className="section-label">통합운세 기간 선택</div><div className="period-grid">{periods.map'''
if period_contract not in app:
    raise SystemExit("period contract missing before patch")
if period_selector_token not in app:
    raise SystemExit("period selector missing before patch")
for token in ["key: 'today'", "key: 'week'", "key: 'month'", "key: 'year'"]:
    if token not in app:
        raise SystemExit(f"period option missing before patch: {token}")

old_intro = '<span className="eyebrow">통합 흐름 계산</span><h2>통합운세</h2><p>Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국점성술) Mahathaksa(마하탁사)·Taksajorn(탁사쫀) 기간층을 각각 계산해 한 화면에서 비교해.</p>'
new_intro = '<span className="eyebrow">통합 흐름 계산</span><h2>통합운세</h2><p>선택한 일일·주간·월간·연간 범위에서 금전·학업·시험·직장·연애·연락·재회·컨디션 흐름을 Western(서양점성술)·사주·Thai(태국점성술)로 각각 계산하고 한 화면에서 비교해.</p>'
if old_intro in app:
    app = app.replace(old_intro, new_intro, 1)
elif new_intro not in app:
    raise SystemExit("integrated intro marker missing")

saju_marker = '''              <section className="result-card">
                <div className="result-card-title"><span>SAJU</span><strong>사주 원국 · 진태양시</strong></div>'''
if saju_marker not in app:
    raise SystemExit("SAJU insertion marker missing")

extras = '''              {orderedRelationshipSignals.length > 0 && <section className="result-card integrated-relationship-flow"><div className="result-card-title"><span>RELATIONSHIP</span><strong>연애 · 연락 · 재접점 흐름</strong></div><div className="integrated-topic-grid signal-grid">{orderedRelationshipSignals.map(({topic,stat})=><div className="integrated-topic signal-topic" key={`integrated-signal-${topic}`}><span>{topic === '수신신호' ? '수신 · 상대 → 나' : topic === '발신적합' ? '발신 · 나 → 상대' : '과거 인연 · 재접점'}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}</div><p className="result-note">수신·발신·재접점은 서로 섞지 않아. 점수는 사건 확률이 아니라 선택 기간의 상대적 활성도야.</p></section>}

              {integratedResult.western.market?.has_open_session && <section className="result-card market-flow-card"><div className="result-card-title"><span>MONEY · MARKET</span><strong>금전 · 주식 · 투자 흐름</strong></div><div className="integrated-topic-grid">{['투자심리','수익실현','신규진입','투자주의'].map((topic)=>{const stat=integratedResult.western.overall[topic]; if(!stat) return null; return <div className="integrated-topic market-topic" key={`integrated-market-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>})}</div><p className="result-note">투자주의는 높을수록 좋은 점수가 아니라 위험 경계가 강하다는 뜻이야.</p></section>}

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card integrated-date-highlights"><div className="result-card-title"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>{bestIntegratedDays.map((point)=><div className="tight-row" key={`integrated-best-${point.date}-${point.topic}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}{cautionIntegratedDays.map((point)=><div className="tight-row" key={`integrated-caution-${point.date}-${point.topic}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}<p className="result-note">선택 기간 안의 상대 활성도 비교야. 특정 사건 발생 확률은 아니야.</p></section>}

              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence"><summary>시간대별 계산 근거 펼치기</summary><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`integrated-day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`integrated-${day.date}-${topic}`}><strong className="time-topic-name">{topic}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`integrated-${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></details> : null}

'''
if "integrated-relationship-flow" not in app:
    app = app.replace(saju_marker, extras + saju_marker, 1)

strong_flow = '''                {topIntegratedTopics.length>0 && <div className="best-window"><span>가장 강한 흐름</span><strong>{topIntegratedTopics.slice(0,3).map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}'''
caution_flow = '''                {cautionIntegratedTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}'''
if caution_flow not in app:
    if strong_flow not in app:
        raise SystemExit("strong flow marker missing")
    app = app.replace(strong_flow, strong_flow + "\n" + caution_flow, 1)

dup_start_marker = '''          {selectedTool==='integrated' && <section className="tool-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">천체 흐름 리포트</span>'''
dup_start = app.find(dup_start_marker)
if dup_start >= 0:
    home_end_marker = """
        </>}

        {mainView === 'profile'"""
    dup_end = app.find(home_end_marker, dup_start)
    if dup_end < 0:
        raise SystemExit("home fragment end missing after duplicate report")
    app = app[:dup_start] + app[dup_end:]

old_invoke = '''      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) throw error
      const payload = data as RelationshipAiResponse'''
new_invoke = '''      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) {
        let detail = ''
        const context = (error as { context?: Response }).context
        if (context) {
          try {
            const body = await context.clone().json() as { error?: string }
            detail = body?.error ?? ''
          } catch { /* fall back to SDK message */ }
        }
        throw new Error(detail || error.message)
      }
      const payload = data as RelationshipAiResponse'''
if old_invoke in app:
    app = app.replace(old_invoke, new_invoke, 1)
elif new_invoke not in app:
    raise SystemExit("relationship invoke marker missing")

if period_contract not in app or period_selector_token not in app:
    raise SystemExit("period contract changed unexpectedly")
for token in ["key: 'today'", "key: 'week'", "key: 'month'", "key: 'year'"]:
    if token not in app:
        raise SystemExit(f"period option changed unexpectedly: {token}")
if "천체 흐름 리포트" in app:
    raise SystemExit("duplicate integrated report still present")
app_path.write_text(app)

css = r'''/* v14 · integrated result de-duplication + iOS date + luminous scores */
.birth-date-field input[type="date"],
.birth-time-field input[type="time"],
.date-control input[type="date"]{width:100%!important;min-width:0!important;text-align:center!important;font-variant-numeric:tabular-nums lining-nums!important;font-feature-settings:"tnum" 1,"lnum" 1!important}
.birth-date-field input[type="date"]::-webkit-date-and-time-value,
.birth-time-field input[type="time"]::-webkit-date-and-time-value,
.date-control input[type="date"]::-webkit-date-and-time-value{display:block!important;width:100%!important;margin:0!important;padding:0!important;text-align:center!important}
.birth-date-field input[type="date"]::-webkit-datetime-edit,
.birth-time-field input[type="time"]::-webkit-datetime-edit,
.date-control input[type="date"]::-webkit-datetime-edit{display:flex!important;width:100%!important;min-width:0!important;justify-content:center!important;align-items:center!important;padding:0!important}
.birth-date-field input[type="date"]::-webkit-datetime-edit-fields-wrapper,
.birth-time-field input[type="time"]::-webkit-datetime-edit-fields-wrapper,
.date-control input[type="date"]::-webkit-datetime-edit-fields-wrapper{display:flex!important;width:100%!important;justify-content:center!important;align-items:center!important}
.birth-date-field input[type="date"]::-webkit-calendar-picker-indicator,
.birth-time-field input[type="time"]::-webkit-calendar-picker-indicator{margin-left:3px!important;opacity:.48!important}
.field-grid{grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr)!important;gap:13px 10px!important}
.birth-date-field input,.birth-time-field input{font-size:.9rem!important;font-weight:760!important;letter-spacing:.01em!important}
.integrated-topic{position:relative!important;isolation:isolate!important;overflow:hidden!important;min-height:106px!important;align-content:center!important;padding:15px 10px 14px!important;border:1px solid rgba(255,255,255,.78)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(121,93,147,.035),0 13px 30px rgba(88,68,112,.08),0 2px 8px rgba(83,65,99,.035)!important;backdrop-filter:blur(16px) saturate(132%)!important;-webkit-backdrop-filter:blur(16px) saturate(132%)!important}
.integrated-topic::before{content:"";position:absolute;z-index:-1;inset:-34% 34% 40% -22%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.96),rgba(255,255,255,0) 69%);pointer-events:none}
.integrated-topic::after{content:"✦";position:absolute;right:10px;top:7px;color:rgba(255,255,255,.9);font-size:.76rem;text-shadow:0 0 10px rgba(255,255,255,.95);pointer-events:none}
.integrated-topic>span{position:relative;z-index:1;color:#62536c!important;font-size:.79rem!important;font-weight:820!important;letter-spacing:-.015em!important}
.integrated-topic>strong{position:relative;z-index:1;font-family:"Bodoni 72",Didot,"Iowan Old Style",Georgia,serif!important;font-variant-numeric:tabular-nums lining-nums!important;font-feature-settings:"tnum" 1,"lnum" 1!important;font-size:2.03rem!important;line-height:1.02!important;font-weight:600!important;letter-spacing:.018em!important;color:#654778!important;text-shadow:0 1px 0 rgba(255,255,255,.98),0 5px 17px rgba(105,73,133,.13)!important}
.integrated-topic>small{position:relative;z-index:1;color:#83748b!important;font-size:.7rem!important;font-weight:720!important}
.integrated-topic:nth-child(6n+1){background:linear-gradient(145deg,rgba(255,242,230,.84),rgba(255,250,243,.70),rgba(242,236,255,.72))!important}
.integrated-topic:nth-child(6n+2){background:linear-gradient(145deg,rgba(239,232,255,.86),rgba(252,247,255,.72),rgba(231,248,246,.72))!important}
.integrated-topic:nth-child(6n+3){background:linear-gradient(145deg,rgba(226,248,242,.84),rgba(247,252,249,.74),rgba(236,240,255,.70))!important}
.integrated-topic:nth-child(6n+4){background:linear-gradient(145deg,rgba(230,242,255,.86),rgba(250,251,255,.73),rgba(248,234,255,.69))!important}
.integrated-topic:nth-child(6n+5){background:linear-gradient(145deg,rgba(255,232,243,.85),rgba(255,249,252,.73),rgba(239,238,255,.70))!important}
.integrated-topic:nth-child(6n){background:linear-gradient(145deg,rgba(251,244,216,.86),rgba(255,252,241,.74),rgba(231,248,243,.70))!important}
.integrated-time-evidence{padding:0!important;overflow:hidden}.integrated-time-evidence>summary{cursor:pointer;list-style:none;padding:15px 16px;font-family:"AppleMyungjo","Noto Serif KR",serif;font-size:.88rem;font-weight:750;color:#594c63}.integrated-time-evidence>summary::-webkit-details-marker{display:none}.integrated-time-evidence>summary::before{content:"＋";margin-right:8px;color:#806b92}.integrated-time-evidence[open]>summary::before{content:"－"}.integrated-time-evidence>.time-detail-list{padding:0 13px 14px}
@media(max-width:430px){.integrated-topic{min-height:104px!important}.integrated-topic>strong{font-size:1.96rem!important}.birth-date-field input,.birth-time-field input{height:52px!important}}
'''
css_path.write_text(css)

main = main_path.read_text()
import_line = "import './fortune-ux-v14.css'\n"
if import_line not in main:
    anchor = "import './fixpack-v12.css'\n"
    if anchor not in main:
        raise SystemExit("main css import anchor missing")
    main = main.replace(anchor, anchor + import_line, 1)
main_path.write_text(main)

edge = edge_path.read_text()
edge = edge.replace('VERSION="relationship-v10.1-grounded-depth"', 'VERSION="relationship-v10.2-purpose-schema"', 1)
schema_start = edge.find("const SCHEMA:any=")
validate_start = edge.find("\nfunction usage(", schema_start)
if schema_start < 0 or validate_start < 0:
    raise SystemExit("relationship schema block not found")
schema_block = r'''const COMMON_SCHEMA:any={headline:S,overview:S,chemistry:S,emotional_dynamic:S,communication:S,conflict_pattern:S,power_boundaries:S,long_term:S,timing:S,reunion_context:S,felt_scenarios:{type:"ARRAY",items:S},practical_advice:{type:"ARRAY",items:S},top_aspects:{type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}},limits:S};
const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};
const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};
function schemaFor(purpose:Purpose){const properties:any={...COMMON_SCHEMA};const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];if(purpose==="reunion"){properties.reunion_reading=REUNION_SCHEMA;required.push("reunion_reading");}if(purpose.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}return {type:"OBJECT",properties,required};}
'''
edge = edge[:schema_start] + schema_block + edge[validate_start:]
edge = edge.replace("responseSchema:SCHEMA", "responseSchema:schemaFor(purpose)", 1)
calc_pattern = re.compile(r'async function calculate\(payload:any,purpose:Purpose,preferred:string,key:string\)\{.*?\}\n\nDeno\.serve', re.S)
new_calc = r'''async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){const first:any=await generate(payload,purpose,preferred,key,false);if(first.ok)return first;const retryModel=preferred===DEFAULT_MODEL?FALLBACK_MODEL:preferred;const second:any=await generate(payload,purpose,retryModel,key,true);if(second.ok)return retryModel!==preferred?{...second,fallback_from:preferred}:second;return {ok:false,error:`관계 해설 생성 실패 · 1차 ${first.error ?? "알 수 없는 오류"} · 재시도 ${second.error ?? "알 수 없는 오류"}`,model:preferred,interpreter_version:VERSION};}

Deno.serve'''
edge, count = calc_pattern.subn(new_calc, edge, count=1)
if count != 1:
    raise SystemExit(f"relationship calculate replacement count={count}")
edge = edge.replace("return respond(result,result.ok?200:502);", "return respond(result,200);", 1)
if "result.ok?200:502" in edge:
    raise SystemExit("semantic 502 return still present")
if "responseSchema:schemaFor(purpose)" not in edge:
    raise SystemExit("purpose schema not wired")
if edge.count("await generate(") != 2:
    raise SystemExit(f"expected 2 generate attempts, got {edge.count('await generate(')}")
edge_path.write_text(edge)
print("PATCH_V14_OK")
