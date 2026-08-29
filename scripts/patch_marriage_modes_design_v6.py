from pathlib import Path

app = Path('web/src/AppNext.tsx')
s = app.read_text(encoding='utf-8')

# Types
s = s.replace("type RelationshipPurpose = 'compatibility' | 'reunion'\n", "type RelationshipPurpose = 'compatibility' | 'reunion'\ntype MarriageMode = 'unmarried' | 'married'\ntype RelationshipAnalysisMode = RelationshipPurpose | 'marriage_unmarried' | 'marriage_married'\n", 1)

if 'marriage_reading?: {' not in s:
    anchor = "    practical_advice: string[]\n"
    block = """    marriage_reading?: {\n      mode: string\n      bottom_line: string\n      bond: string\n      emotional_home: string\n      daily_life: string\n      conflict_repair: string\n      commitment_or_current_cycle: string\n      timing: string\n      caution: string\n      precision_note: string\n    }\n"""
    assert anchor in s
    s = s.replace(anchor, block + anchor, 1)

# Relationship panel gets explicit analysis mode.
old_sig = "function RelationshipInterpretationPanel({ aspects, partnerExact, ai, aiLoading, aiError, onAi }: { aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string; onAi: () => void }) {"
new_sig = "function RelationshipInterpretationPanel({ aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode }: { aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string; onAi: () => void; analysisMode: RelationshipAnalysisMode }) {"
assert old_sig in s
s = s.replace(old_sig, new_sig, 1)

mode_anchor = "  const mixed = aspects.filter((a)=>a.tone==='mixed').length\n"
if "const isMarriage = analysisMode.startsWith('marriage_')" not in s:
    assert mode_anchor in s
    s = s.replace(mode_anchor, mode_anchor + "  const isReunion = analysisMode === 'reunion'\n  const isMarriage = analysisMode.startsWith('marriage_')\n", 1)

# Context card wording should match mode.
s = s.replace("<article><strong>재회 맥락</strong><p>{ai.data.reunion_context}</p></article>", "{!isMarriage&&<article><strong>{isReunion?'재회 맥락':'관계 전개 맥락'}</strong><p>{ai.data.reunion_context}</p></article>}", 1)

if 'marriage-ai-deep' not in s:
    anchor = "}{!!ai.data.practical_advice?.length&&<div className=\"relationship-ai-advice\">"
    marriage = """}{isMarriage&&ai.data.marriage_reading?.bottom_line&&<div className=\"marriage-ai-deep\"><strong>{analysisMode==='marriage_unmarried'?'미혼 결혼운 · 정밀 해석':'기혼 결혼운 · 정밀 해석'}</strong><p className=\"marriage-ai-bottom\">{ai.data.marriage_reading.bottom_line}</p><div className=\"marriage-ai-grid\"><article><b>장기 결속력</b><p>{ai.data.marriage_reading.bond}</p></article><article><b>정서적 집</b><p>{ai.data.marriage_reading.emotional_home}</p></article><article><b>생활 · 돈 · 역할</b><p>{ai.data.marriage_reading.daily_life}</p></article><article><b>갈등과 회복</b><p>{ai.data.marriage_reading.conflict_repair}</p></article><article><b>{analysisMode==='marriage_unmarried'?'결혼 결정 흐름':'현재 결혼생활 주기'}</b><p>{ai.data.marriage_reading.commitment_or_current_cycle}</p></article><article><b>시기 흐름</b><p>{ai.data.marriage_reading.timing}</p></article><article><b>장기 주의점</b><p>{ai.data.marriage_reading.caution}</p></article><article><b>정밀도</b><p>{ai.data.marriage_reading.precision_note}</p></article></div></div>}{!!ai.data.practical_advice?.length&&<div className=\"relationship-ai-advice\">"""
    assert anchor in s
    s = s.replace(anchor, marriage, 1)

# Prompt copy includes explicit analysis mode.
prompt_anchor = "    `관계 상태: ${String(request.relationship_status ?? '')}`,\n"
if "분석 모드:" not in s:
    assert prompt_anchor in s
    s = s.replace(prompt_anchor, prompt_anchor + "    `분석 모드: ${String(request.analysis_mode ?? kind)}`,\n", 1)

# State
state_anchor = "  const [relationshipPurpose, setRelationshipPurpose] = useState<RelationshipPurpose>('compatibility')\n"
if "const [marriageMode," not in s:
    assert state_anchor in s
    s = s.replace(state_anchor, state_anchor + "  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n", 1)

# Request maps marriage modes without changing backend enum contract.
old_status = "      start_date: queryDate, end_date: periodEnd(queryDate, period), relationship_status: relationshipPurpose === 'reunion' ? 'single' : relationshipMode,\n"
new_status = "      start_date: queryDate, end_date: periodEnd(queryDate, period),\n      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),\n      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,\n"
assert old_status in s
s = s.replace(old_status, new_status, 1)

# AI mode + v6 interpreter.
run_anchor = "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n"
new_run = "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n    const analysisMode: RelationshipAnalysisMode = selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose\n"
assert run_anchor in s
s = s.replace(run_anchor, new_run, 1)
s = s.replace("    if (relationshipPurpose === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }", "    if (analysisMode === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }", 1)
s = s.replace("supabase.functions.invoke('relationship-interpret-v5-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: relationshipPurpose, model: aiModel } })", "supabase.functions.invoke('relationship-interpret-v6-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })", 1)

# Archive restore remembers marriage sub-mode.
restore_anchor = "      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')\n"
if "request.analysis_mode === 'marriage_married'" not in s:
    assert restore_anchor in s
    s = s.replace(restore_anchor, restore_anchor + "      if (request.analysis_mode === 'marriage_married') setMarriageMode('married')\n      else if (request.analysis_mode === 'marriage_unmarried') setMarriageMode('unmarried')\n", 1)

# Marriage UI = only unmarried/married; ordinary compatibility keeps detailed current relationship states.
old_modes = "            {(selectedTool==='marriage'||relationshipPurpose==='compatibility') && <div className=\"relationship-mode-row\">{relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>}\n"
new_modes = """            {selectedTool==='compatibility'&&relationshipPurpose==='compatibility' && <div className=\"relationship-mode-row\">{relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>}\n            {selectedTool==='marriage' && <div className=\"relationship-purpose-row marriage-purpose-row\"><button type=\"button\" className={marriageMode==='unmarried'?'is-active':''} onClick={()=>{setMarriageMode('unmarried');setRelationshipAi(null)}}><strong>미혼</strong><span>결혼 전 · 장기 결속과 결혼생활 적합 구조</span></button><button type=\"button\" className={marriageMode==='married'?'is-active':''} onClick={()=>{setMarriageMode('married');setRelationshipAi(null)}}><strong>기혼</strong><span>결혼 후 · 현재 결속과 갈등·회복 주기</span></button></div>}\n            {selectedTool==='marriage'&&<div className=\"status-banner marriage-intro\"><Gem size={16}/><span>{marriageMode==='unmarried'?'결혼 여부 예언이 아니라, 이 관계가 결혼생활로 이어질 때의 생활궁합·책임·갈등·지속성을 깊게 봐.':'이미 결혼한 관계 기준으로 현재 결속·정서적 거리·역할분담·갈등과 회복 흐름을 봐.'}</span></div>}\n"""
assert old_modes in s
s = s.replace(old_modes, new_modes, 1)

# Button copy.
old_btn = "<span>{relationshipLoading?(relationshipPurpose==='reunion'?'재회운 계산 중…':'정밀 계산 중…'):(relationshipPurpose==='reunion'?'재회운 정밀 계산':'실제 계산 실행')}</span>"
new_btn = "<span>{relationshipLoading?(selectedTool==='marriage'?'결혼운 계산 중…':relationshipPurpose==='reunion'?'재회운 계산 중…':'궁합 계산 중…'):(selectedTool==='marriage'?(marriageMode==='unmarried'?'미혼 결혼운 정밀 계산':'기혼 결혼운 정밀 계산'):relationshipPurpose==='reunion'?'재회운 정밀 계산':'궁합 정밀 계산')}</span>"
assert old_btn in s
s = s.replace(old_btn, new_btn, 1)

# Panel receives mode.
old_panel = "<RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} />"
new_panel = "<RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} analysisMode={selectedTool==='marriage'?`marriage_${marriageMode}`:relationshipPurpose} />"
assert old_panel in s
s = s.replace(old_panel, new_panel, 1)

app.write_text(s, encoding='utf-8')

# Comprehensive v6 visual layer.
css = Path('web/src/visual-overhaul-v6.css')
css.write_text(r'''@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap');

/* v6 · complete mobile hierarchy pass */
:root{--v6-ink:#352d3b;--v6-muted:#736b78;--v6-line:rgba(126,111,150,.14);--v6-glass:rgba(255,255,255,.72);--v6-serif:"Noto Serif KR","Apple SD Gothic Neo",serif}
html,body{font-size:16px}
body{font-family:"Noto Sans KR","Pretendard Variable","Apple SD Gothic Neo",sans-serif;color:var(--v6-ink);background:radial-gradient(circle at 4% 7%,rgba(229,212,250,.42),transparent 28%),radial-gradient(circle at 98% 22%,rgba(209,235,255,.42),transparent 31%),radial-gradient(circle at 10% 76%,rgba(210,244,232,.32),transparent 31%),linear-gradient(180deg,#fcf9fb 0%,#f8f7fb 48%,#fbfafc 100%)}
.page-content{width:min(100%,560px);padding:max(11px,env(safe-area-inset-top)) 13px calc(78px + env(safe-area-inset-bottom))}

/* hero becomes lighter and more jewel-like, not one large beige slab */
.hero-card{padding:20px 18px 18px!important;border-radius:26px!important;border:1px solid rgba(187,181,211,.25)!important;background:radial-gradient(circle at 90% 15%,rgba(218,232,255,.62),transparent 28%),radial-gradient(circle at 8% 100%,rgba(240,214,246,.58),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.92),rgba(247,244,253,.9))!important;box-shadow:0 16px 42px rgba(83,70,110,.09),inset 0 1px rgba(255,255,255,.95)!important}
.hero-row{gap:12px!important}.hero-sigil{width:44px!important;height:44px!important;flex-basis:44px!important;border-radius:16px!important;background:linear-gradient(145deg,#fff,#e7ddf8 52%,#dcecff)!important;color:#7e699d!important;box-shadow:0 9px 24px rgba(109,89,141,.13),0 0 24px rgba(224,211,249,.42)!important}
.hero-row h1{font-family:var(--v6-serif)!important;font-size:1.78rem!important;line-height:1.12!important;letter-spacing:-.055em!important;color:#342c3c!important}.hero-row p{margin-top:5px!important;font-size:.76rem!important;line-height:1.55!important;color:#716879!important}.hero-kicker{font-size:.56rem!important;color:#8b77a4!important;letter-spacing:.18em!important}

/* home controls compact + readable */
.profile-card{margin-top:11px!important;padding:13px 14px!important;border-radius:18px!important;background:rgba(255,255,255,.72)!important}.profile-copy strong{font-size:.96rem!important}.profile-copy>span:last-child{font-size:.72rem!important}.eyebrow{font-size:.58rem!important;letter-spacing:.15em!important}
.date-card{margin-top:9px!important;padding:11px 12px 12px!important;border-radius:18px!important;background:rgba(255,255,255,.69)!important}.date-card label{font-size:.69rem!important}.date-control{min-height:43px!important;border-radius:13px!important;background:rgba(255,255,255,.78)!important}.date-control input{font-size:.86rem!important}
.section-block{margin-top:14px!important}.section-label{font-size:.61rem!important;letter-spacing:.13em!important}.period-grid{gap:7px!important}.period-button{height:43px!important;border-radius:14px!important;font-size:.72rem!important}
.tools-section{margin-top:15px!important}.tool-grid{gap:9px!important}.tool-card{min-height:116px!important;padding:13px!important;border-radius:19px!important}.tool-icon{width:38px!important;height:38px!important;margin-bottom:10px!important;border-radius:13px!important}.tool-card strong{font-family:var(--v6-serif)!important;font-size:.98rem!important;letter-spacing:-.035em!important}.tool-card>span:last-child{margin-top:4px!important;font-size:.7rem!important;line-height:1.5!important}

/* tool panels: editorial spacing instead of nested boxes everywhere */
.tool-panel,.form-card{margin-top:14px!important;padding:16px 15px!important;border-radius:24px!important;border-color:var(--v6-line)!important;background:radial-gradient(circle at 96% 0%,rgba(220,235,255,.32),transparent 30%),radial-gradient(circle at 3% 100%,rgba(236,218,249,.3),transparent 34%),rgba(255,255,255,.74)!important;box-shadow:0 16px 44px rgba(80,67,105,.075),inset 0 1px rgba(255,255,255,.95)!important}.tool-panel-heading{gap:11px!important}.tool-panel-heading .tool-icon{flex-basis:39px!important;margin:0!important}.tool-panel-heading h2,.form-card-heading h2{font-family:var(--v6-serif)!important;font-size:1.24rem!important;line-height:1.3!important;letter-spacing:-.045em!important;color:#39303f!important}.tool-panel-heading p,.form-card-heading p{font-size:.74rem!important;line-height:1.62!important;color:#746c79!important}
.subsection-title{margin:16px 0 8px 2px!important;font-family:var(--v6-serif)!important;font-size:.82rem!important;color:#5f536a!important}.field-grid{gap:9px!important}.field{gap:5px!important}.field>span{font-size:.68rem!important;color:#706678!important}.field input,.field select{height:45px!important;border-radius:14px!important;border-color:rgba(129,113,150,.16)!important;background:rgba(255,255,255,.82)!important;font-size:.81rem!important}.check-field{padding:10px!important;border-radius:14px!important;background:rgba(247,243,252,.8)!important;font-size:.69rem!important;line-height:1.55!important}.coordinate-note,.calculation-range,.privacy-note,.status-banner{padding:10px 11px!important;border-radius:14px!important;font-size:.7rem!important;line-height:1.58!important}.primary-button{min-height:47px!important;border-radius:15px!important;font-size:.79rem!important}

/* mode controls are clear choices, not tiny chips */
.relationship-purpose-row{gap:8px!important;margin-top:14px!important}.relationship-purpose-row>button{min-height:44px!important;padding:9px 12px!important;border-radius:15px!important;font-size:.75rem!important}.marriage-purpose-row{display:grid!important;grid-template-columns:1fr 1fr!important}.marriage-purpose-row>button{display:grid!important;gap:3px!important;text-align:left!important;align-content:center!important}.marriage-purpose-row>button strong{font-family:var(--v6-serif)!important;font-size:.92rem!important}.marriage-purpose-row>button span{font-size:.64rem!important;line-height:1.45!important;font-weight:600!important;opacity:.78}.marriage-intro{background:linear-gradient(135deg,rgba(248,239,250,.88),rgba(239,246,253,.85))!important;color:#695d72!important}.relationship-mode-row{margin-top:12px!important;gap:5px!important}.relationship-mode-row button{min-height:32px!important;padding:0 10px!important;font-size:.65rem!important}

/* results: fewer giant slabs, stronger text rhythm */
.results-wrap{gap:12px!important}.result-headline{padding:12px 13px!important;border-radius:16px!important}.result-headline strong{font-size:.88rem!important}.result-headline span{font-size:.67rem!important}.result-actions{gap:6px!important}.result-actions button{min-height:37px!important;border-radius:12px!important;font-size:.66rem!important;padding:0 9px!important}.result-card{padding:17px 15px!important;border-radius:22px!important;background:rgba(255,255,255,.7)!important;border-color:rgba(136,119,158,.13)!important;box-shadow:0 13px 35px rgba(82,68,108,.055),inset 0 1px rgba(255,255,255,.93)!important}.result-card-title{margin-bottom:12px!important}.result-card-title span{font-size:.54rem!important;letter-spacing:.17em!important}.result-card-title strong{font-family:var(--v6-serif)!important;font-size:1.02rem!important;letter-spacing:-.035em!important}.result-note{font-size:.72rem!important;line-height:1.65!important;color:#756c7a!important}
.integrated-topic-grid{gap:8px!important}.integrated-topic{min-height:78px!important;padding:12px 10px!important;border-radius:17px!important}.integrated-topic>span{font-size:.72rem!important}.integrated-topic>strong{font-size:1.35rem!important}.integrated-topic>small{font-size:.62rem!important}

/* AI: longer copy is allowed, but never a wall of text */
.ai-interpret-card,.relationship-reading-card,.relationship-ai-card{padding:20px 17px!important;border-radius:25px!important}.ai-interpret-head h3,.relationship-reading-card h3,.relationship-ai-card h3{font-family:var(--v6-serif)!important;font-size:1.34rem!important;line-height:1.4!important;letter-spacing:-.045em!important}.ai-summary,.relationship-overview,.relationship-ai-overview{font-size:.96rem!important;line-height:1.9!important;letter-spacing:-.018em!important;color:#554d5b!important}.ai-cluster-grid,.relationship-reading-grid,.relationship-ai-grid,.reunion-ai-grid,.marriage-ai-grid{grid-template-columns:1fr!important;gap:10px!important}.ai-cluster-grid>div,.relationship-reading-grid article,.relationship-ai-grid article,.reunion-ai-grid article,.marriage-ai-grid article{padding:15px!important;border-radius:18px!important;background:rgba(255,255,255,.67)!important;border:1px solid rgba(137,119,159,.09)!important}.ai-cluster-grid strong,.relationship-reading-grid strong,.relationship-ai-grid strong,.reunion-ai-grid b,.marriage-ai-grid b{font-family:var(--v6-serif)!important;font-size:1rem!important;color:#493e50!important}.ai-cluster-grid p,.relationship-reading-grid p,.relationship-ai-grid p,.reunion-ai-grid p,.marriage-ai-grid p{font-size:.92rem!important;line-height:1.82!important;color:#625a67!important;margin-top:8px!important}.ai-highlight,.ai-priorities,.ai-system-note,.relationship-ai-advice{padding:15px!important;border-radius:18px!important}.ai-topic-list article{padding:15px!important;border-radius:18px!important}.ai-topic-list p{font-size:.91rem!important;line-height:1.82!important}.ai-verdict{font-family:var(--v6-serif)!important;font-size:.96rem!important;line-height:1.7!important}.ai-limits,.relationship-ai-limits{font-size:.75rem!important;line-height:1.7!important}
.reunion-ai-deep,.marriage-ai-deep{margin-top:16px!important;padding:16px!important;border-radius:21px!important;background:linear-gradient(145deg,rgba(250,240,252,.82),rgba(237,247,252,.78))!important;border:1px solid rgba(154,129,177,.12)!important}.reunion-ai-deep>strong,.marriage-ai-deep>strong{font-family:var(--v6-serif)!important;font-size:1.08rem!important}.reunion-ai-bottom,.marriage-ai-bottom{font-size:.95rem!important;line-height:1.88!important;color:#574d5d!important}
.relationship-key-aspects>div{padding:14px 2px!important;border-bottom:1px solid rgba(128,112,148,.09)!important;border-radius:0!important;background:transparent!important}.relationship-key-aspects>div:last-child{border-bottom:0!important}.relationship-key-aspects b{font-size:.91rem!important}.relationship-key-aspects p{font-size:.87rem!important;line-height:1.72!important}

/* timing + month cards compact */
.month-list{gap:9px!important}.month-card{padding:13px!important;border-radius:18px!important}.month-title strong{font-family:var(--v6-serif)!important}.month-metrics{gap:6px!important}.tight-row{min-height:50px!important;padding:9px 1px!important}.tight-row>span{font-size:.9rem!important;line-height:1.45!important}.tight-row>b{font-size:1rem!important;padding:6px 8px!important}.time-detail-list details{padding:14px!important;border-radius:19px!important}.time-topic{padding:13px!important;border-radius:16px!important}.time-evidence em{font-size:.83rem!important;line-height:1.6!important}

/* bottom nav should not swallow iPhone viewport */
.bottom-nav{width:min(calc(100% - 18px),542px)!important;left:50%!important;bottom:max(7px,env(safe-area-inset-bottom))!important;padding:5px 7px!important;border:1px solid rgba(160,151,180,.2)!important;border-radius:20px!important;background:rgba(250,249,253,.84)!important;box-shadow:0 10px 32px rgba(77,66,101,.13),inset 0 1px rgba(255,255,255,.96)!important}.nav-item{min-height:45px!important;gap:2px!important;border-radius:14px!important;font-size:.56rem!important}.nav-item svg{width:18px!important;height:18px!important}

@media(max-width:430px){.page-content{padding-left:12px!important;padding-right:12px!important}.hero-card{padding:18px 16px 17px!important}.hero-row h1{font-size:1.68rem!important}.tool-card{min-height:111px!important}.tool-panel,.form-card{padding:15px 14px!important}.field-grid{grid-template-columns:1fr 1fr!important}.result-card{padding:16px 14px!important}.relationship-reading-card,.relationship-ai-card,.ai-interpret-card{padding:18px 15px!important}.ai-summary,.relationship-overview,.relationship-ai-overview{font-size:.93rem!important}.bottom-nav{width:calc(100% - 16px)!important}}
''', encoding='utf-8')

main = Path('web/src/main.tsx')
m = main.read_text(encoding='utf-8')
if "import './visual-overhaul-v6.css'" not in m:
    m = m.replace("import './visual-overhaul-v5.css'\n", "import './visual-overhaul-v5.css'\nimport './visual-overhaul-v6.css'\n", 1)
main.write_text(m, encoding='utf-8')
