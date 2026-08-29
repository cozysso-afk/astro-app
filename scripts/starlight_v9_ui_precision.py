from pathlib import Path

ROOT = Path('.')

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'marker not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

app = 'web/src/AppNext.tsx'
css = 'web/src/visual-overhaul-v6.css'

# 1) Relationship mode UX: 'single' is a reunion mode, not a visible "솔로" compatibility state.
replace_once(app,
"const relationshipModes: Array<[RelationshipStatus, string]> = [\n  ['single', '솔로'], ['dating', '연애중'], ['long_term', '장기커플'],\n  ['cohabiting', '동거'], ['engaged', '약혼'], ['married', '기혼'],\n]",
"const relationshipModes: Array<[RelationshipStatus, string]> = [\n  ['dating', '연애중'], ['long_term', '장기커플'], ['cohabiting', '동거'], ['engaged', '약혼'], ['married', '기혼'],\n]")

# 2) Explicit period labels.
replace_once(app,
"function periodEnd(start: string, period: PeriodKey) {\n  if (period === 'today') return start\n  if (period === 'week') return addDays(start, 6)\n  if (period === 'month') return addDays(start, 30)\n  return addDays(start, 364)\n}",
"function periodEnd(start: string, period: PeriodKey) {\n  if (period === 'today') return start\n  if (period === 'week') return addDays(start, 6)\n  if (period === 'month') return addDays(start, 30)\n  return addDays(start, 364)\n}\nfunction periodRangeLabel(period: PeriodKey) {\n  if (period === 'today') return '1일'\n  if (period === 'week') return '7일'\n  if (period === 'month') return '31일'\n  return '1년 · 365일'\n}")

# 3) Guaranteed bilingual/glossed user-facing text, including legacy Gemini output.
glossary = r'''
const hanjaReading: Record<string, string> = {
  '甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계',
  '子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해',
  '沖':'충','冲':'충','合':'합','刑':'형','破':'파','害':'해',
}
function annotateUserFacingText(value: string) {
  let text = String(value ?? '')
  const replacements: Array<[RegExp, string]> = [
    [/\bMercury\b(?!\s*\()/g, 'Mercury(수성)'], [/\bVenus\b(?!\s*\()/g, 'Venus(금성)'],
    [/\bMars\b(?!\s*\()/g, 'Mars(화성)'], [/\bJupiter\b(?!\s*\()/g, 'Jupiter(목성)'],
    [/\bSaturn\b(?!\s*\()/g, 'Saturn(토성)'], [/\bUranus\b(?!\s*\()/g, 'Uranus(천왕성)'],
    [/\bNeptune\b(?!\s*\()/g, 'Neptune(해왕성)'], [/\bPluto\b(?!\s*\()/g, 'Pluto(명왕성)'],
    [/\bSun\b(?!\s*\()/g, 'Sun(태양)'], [/\bMoon\b(?!\s*\()/g, 'Moon(달)'],
    [/\bASC\b(?!\s*\()/g, 'ASC(상승점)'], [/\bDSC\b(?!\s*\()/g, 'DSC(하강점)'],
    [/\bMC\b(?!\s*\()/g, 'MC(중천점)'], [/\bIC\b(?!\s*\()/g, 'IC(천저점)'],
    [/\bretrograde\b(?!\s*\()/gi, 'retrograde(역행)'], [/\bsquare\b(?!\s*\()/gi, 'square(사각)'],
    [/\btrine\b(?!\s*\()/gi, 'trine(삼각)'], [/\bsextile\b(?!\s*\()/gi, 'sextile(육합)'],
    [/\bconjunction\b(?!\s*\()/gi, 'conjunction(합)'], [/\bopposition\b(?!\s*\()/gi, 'opposition(대립)'],
    [/\bquincunx\b(?!\s*\()/gi, 'quincunx(퀸컨스·150도각)'],
    [/\bWestern\b(?!\s*\()/g, 'Western(서양점성술)'], [/\bThai\b(?!\s*\()/g, 'Thai(태국점성술)'],
    [/\bGemini\b(?!\s*\()/g, 'Gemini(제미나이)'],
  ]
  replacements.forEach(([pattern, label]) => { text = text.replace(pattern, label) })
  text = text.replace(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?!\()/g, (m,a,b) => `${m}(${hanjaReading[a]}${hanjaReading[b]})`)
  text = text.replace(/([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])([沖冲合刑破害])(?!\()/g, (m,a,b,c) => `${m}(${hanjaReading[a]}${hanjaReading[b]}${hanjaReading[c]})`)
  return text
}
function annotatePayload<T>(value: T): T {
  if (typeof value === 'string') return annotateUserFacingText(value) as T
  if (Array.isArray(value)) return value.map((x) => annotatePayload(x)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k,v]) => [k, annotatePayload(v)])) as T
  }
  return value
}
'''
replace_once(app, "\nfunction humanizeEvidence(value: string) {", glossary + "\nfunction humanizeEvidence(value: string) {")
replace_once(app, "            setAiInterpretation(payload)", "            setAiInterpretation(annotatePayload(payload))")
replace_once(app, "      setRelationshipAi(payload)", "      setRelationshipAi(annotatePayload(payload))")

# 4) Remove the redundant compatibility/reunion purpose row. A single mode row starts with '재회'.
old_modes = """            {selectedTool==='compatibility' && <div className=\"relationship-purpose-row\"><button type=\"button\" className={relationshipPurpose==='compatibility'?'is-active':''} onClick={()=>{setRelationshipPurpose('compatibility');setReunionTiming(null);setRelationshipAi(null)}}>궁합 구조</button><button type=\"button\" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setReunionTiming(null);setRelationshipAi(null)}}>재회운 · 연락 시기</button></div>}
            {selectedTool==='compatibility'&&relationshipPurpose==='compatibility' && <div className=\"relationship-mode-row\">{relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>}"""
new_modes = """            {selectedTool==='compatibility' && <>
              <div className=\"relationship-mode-row relationship-main-mode-row\">
                <button type=\"button\" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setPeriod('year');setReunionTiming(null);setRelationshipAi(null)}}>재회</button>
                {relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipPurpose==='compatibility'&&relationshipMode===value?'is-active':''} onClick={()=>{setRelationshipPurpose('compatibility');setRelationshipMode(value);setReunionTiming(null);setRelationshipAi(null)}}>{label}</button>)}
              </div>
              <div className=\"relationship-range-block\">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong><span>{queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
                <div className=\"relationship-range-buttons\">{periods.map((item)=><button key={item.key} type=\"button\" className={period===item.key?'is-active':''} onClick={()=>setPeriod(item.key)}>{item.key==='today'?'1일':item.key==='week'?'7일':item.key==='month'?'31일':'1년'}</button>)}</div>
              </div>
            </>}"""
replace_once(app, old_modes, new_modes)

replace_once(app,
"<div className=\"tool-panel-heading\"><span className={`tool-icon ${selectedTool==='compatibility'?'tone-rose':'tone-champagne'}`}>{selectedTool==='compatibility'?<Heart size={22}/>:<Gem size={22}/>}</span><div><span className=\"eyebrow\">LIVE RELATIONSHIP ENGINE</span><h2>{selectedToolInfo.label}</h2><p>{selectedTool==='marriage'?'결혼 여부를 단정하지 않고 두 사람의 장기 결속·협력·긴장 활성도를 계산해.':'정적 궁합과 월별 진행 접점을 분리해서 보여줘.'}</p></div></div>",
"<div className=\"tool-panel-heading\"><span className={`tool-icon ${selectedTool==='compatibility'?'tone-rose':'tone-champagne'}`}>{selectedTool==='compatibility'?<Heart size={22}/>:<Gem size={22}/>}</span><div><span className=\"eyebrow\">관계 정밀 계산</span><h2>{selectedToolInfo.label}</h2><p>{selectedTool==='marriage'?'결혼 여부를 단정하지 않고 두 사람의 장기 결속·협력·긴장 흐름을 계산해.':relationshipPurpose==='reunion'?'과거 인연의 재접점·수신·발신 흐름과 강한 시기를 따로 봐.':'두 사람의 기본 관계 구조와 선택 기간의 시기 흐름을 분리해서 봐.'}</p></div></div>")
replace_once(app,
"{selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<div className=\"status-banner reunion-intro\"><Heart size={16}/><span>과거 인연 기준으로 수신(상대→나) · 발신(나→상대) · 재접점 흐름과 강한 시기를 따로 계산해.</span></div>}",
"{selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<div className=\"status-banner reunion-intro\"><Heart size={16}/><span>재회를 누르면 기본 분석기간은 1년(365일)이야. 현재 범위는 {queryDate}~{periodEnd(queryDate,period)}이고, 위 버튼에서 1일·7일·31일·1년으로 바꿀 수 있어. 수신(상대→나) · 발신(나→상대) · 재접점은 서로 섞지 않아.</span></div>}")
replace_once(app,
"<div className=\"calculation-range\"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>",
"<div className=\"calculation-range\"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>")

# 5) Hide developer billing/engine information behind disclosure and use Korean-first labels.
replace_once(app, '<span className="eyebrow">GEMINI INTERPRETATION</span>', '<span className="eyebrow">Gemini(제미나이) 통합 해설</span>')
replace_once(app, '<span className="eyebrow">AI INTERPRETATION</span>', '<span className="eyebrow">AI(인공지능) 해설</span>')
replace_once(app,
"{result.usage?.total_tokens ? <div className=\"ai-usage-card\"><strong>이번 해설 API 사용량</strong><span>입력 {(result.usage.prompt_tokens ?? 0).toLocaleString()} · 본문출력 {(result.usage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(result.usage.thought_tokens ?? 0).toLocaleString()} tokens</span><b>예상비용 ${Number(result.usage.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(result.usage.estimated_krw ?? 0).toLocaleString()}원</b><small>최초 생성 예상치 · 저장된 기록 재열람은 Gemini 재호출이 없으면 0원</small></div> : null}",
"{result.usage?.total_tokens ? <details className=\"ai-meta-details\"><summary>해설 생성 정보</summary><div className=\"ai-usage-card\"><strong>API(응용 프로그램 인터페이스) 사용량</strong><span>입력 {(result.usage.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(result.usage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(result.usage.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>예상비용 ${Number(result.usage.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(result.usage.estimated_krw ?? 0).toLocaleString()}원</b><small>최초 생성 예상치 · 저장 기록 재열람은 재호출이 없으면 0원</small></div></details> : null}")
replace_once(app, '<span className="eyebrow">GEMINI RELATIONSHIP INTERPRETATION</span>', '<span className="eyebrow">Gemini(제미나이) 관계 해설</span>')
replace_once(app,
"{ai.usage?.total_tokens?<div className=\"relationship-ai-usage\"><span>입력 {(ai.usage.prompt_tokens??0).toLocaleString()} · 출력 {(ai.usage.candidate_tokens??0).toLocaleString()} · 사고 {(ai.usage.thought_tokens??0).toLocaleString()} tokens</span><b>예상비용 ${Number(ai.usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(ai.usage.estimated_krw??0).toLocaleString()}원</b></div>:null}",
"{ai.usage?.total_tokens?<details className=\"ai-meta-details relationship-meta-details\"><summary>해설 생성 정보</summary><div className=\"relationship-ai-usage\"><span>입력 {(ai.usage.prompt_tokens??0).toLocaleString()} · 출력 {(ai.usage.candidate_tokens??0).toLocaleString()} · 사고 {(ai.usage.thought_tokens??0).toLocaleString()} token(토큰)</span><b>예상비용 ${Number(ai.usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(ai.usage.estimated_krw??0).toLocaleString()}원</b></div></details>:null}")
replace_once(app, "{aiLoading?'Gemini 관계 해석 중…':'Gemini 관계 정밀해석'}", "{aiLoading?'Gemini(제미나이) 관계 해석 중…':'Gemini(제미나이) 관계 정밀해석'}")

# 6) CSS: force a genuinely different Korean editorial face on iPhone, compact prose, and clarify range controls.
p = ROOT / css
text = p.read_text(encoding='utf-8')
text = text.replace('--v6-serif:"Noto Serif KR","Apple SD Gothic Neo",serif', '--v6-serif:"AppleMyungjo","Noto Serif KR","Nanum Myeongjo",serif')
text += r'''

/* v9 · explicit range + visible Korean typography contrast */
.hero-row h1,.tool-card strong,.tool-panel-heading h2,.form-card-heading h2,.result-card-title strong,
.ai-interpret-head h3,.relationship-reading-card h3,.relationship-ai-card h3,.ai-verdict,
.relationship-ai-grid strong,.relationship-reading-grid strong,.relationship-key-aspects>strong,
.reunion-ai-deep>strong,.marriage-ai-deep>strong{font-family:"AppleMyungjo","Noto Serif KR","Nanum Myeongjo",serif!important;font-weight:600!important;letter-spacing:-.055em!important}
.relationship-main-mode-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;margin-top:14px!important}
.relationship-main-mode-row button{min-height:40px!important;padding:7px 8px!important;border-radius:14px!important;font-size:.72rem!important}
.relationship-main-mode-row button:first-child{background:linear-gradient(145deg,rgba(252,235,244,.9),rgba(241,235,255,.85))!important}
.relationship-main-mode-row button.is-active{box-shadow:0 8px 18px rgba(105,78,128,.12)!important}
.relationship-range-block{margin-top:10px;padding:12px;border:1px solid rgba(137,119,159,.11);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.76),rgba(244,247,253,.72))}
.relationship-range-block>div:first-child{display:grid;gap:3px}.relationship-range-block strong{font-family:"AppleMyungjo","Noto Serif KR",serif;font-size:.88rem;color:#4a3e50}.relationship-range-block span{font-size:.67rem;color:#786e7e}
.relationship-range-buttons{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}.relationship-range-buttons button{min-height:32px;border:1px solid rgba(132,113,153,.12);border-radius:11px;background:rgba(255,255,255,.72);font-size:.65rem;color:#716577}.relationship-range-buttons button.is-active{background:linear-gradient(145deg,rgba(226,217,247,.95),rgba(235,246,251,.9));color:#4d4058;font-weight:800}
.ai-summary,.relationship-overview,.relationship-ai-overview{font-size:.89rem!important;line-height:1.76!important;letter-spacing:-.012em!important}
.ai-cluster-grid p,.relationship-reading-grid p,.relationship-ai-grid p,.reunion-ai-grid p,.marriage-ai-grid p{font-size:.86rem!important;line-height:1.72!important}
.relationship-key-aspects p{font-size:.82rem!important;line-height:1.68!important}
.ai-topic-list p{font-size:.85rem!important;line-height:1.7!important}.ai-verdict{font-size:.91rem!important;line-height:1.62!important}
.ai-meta-details{margin:10px 0 14px}.ai-meta-details>summary{cursor:pointer;font-size:.68rem;font-weight:800;color:#84798a}.ai-meta-details[open]>summary{margin-bottom:8px}.ai-meta-details .ai-usage-card,.relationship-meta-details .relationship-ai-usage{margin:0!important}
@media(max-width:430px){.relationship-main-mode-row{grid-template-columns:repeat(3,minmax(0,1fr))!important}.relationship-range-block{padding:11px}.ai-summary,.relationship-overview,.relationship-ai-overview{font-size:.87rem!important}}
'''
p.write_text(text, encoding='utf-8')

print('starlight v9 ui precision patch applied')
