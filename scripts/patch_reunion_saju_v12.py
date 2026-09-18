from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]}')
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    text2, n = re.subn(pattern, replacement, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'regex match count {n} in {path}: {pattern[:160]}')
    write(path, text2)

# 1) Day/week cache identity: normalize aliases and infer from actual date span.
p='supabase/functions/fortune-interpret-v23-preview/cacheIdentityV23.ts'
text=read(p)
text=text.replace("export const DAY_WEEK_NARRATIVE_CACHE_VERSION = 'dw-period-distinct-v2'", "export const DAY_WEEK_NARRATIVE_CACHE_VERSION = 'dw-period-distinct-v3'")
regex = r"function periodKind\(source: any\): string \{\n  return String\(source\?\.period_kind \?\? source\?\.period\?\.kind \?\? source\?\.kind \?\? ''\)\.trim\(\)\.toLowerCase\(\)\n\}"
replacement = '''function periodKind(source: any): string {
  const raw = String(source?.period_kind ?? source?.period?.kind ?? source?.kind ?? '').trim().toLowerCase()
  const aliases: Record<string,string> = { today:'day', daily:'day', day:'day', weekly:'week', week:'week', monthly:'month', month:'month', yearly:'annual', year:'annual', annual:'annual' }
  if (aliases[raw]) return aliases[raw]
  const start = String(source?.period?.start ?? '')
  const end = String(source?.period?.end ?? '')
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
    const days = Math.floor((b-a)/86400000)+1
    if (days <= 1) return 'day'
    if (days <= 9) return 'week'
    if (days <= 45) return 'month'
    return 'annual'
  }
  return raw
}'''
text2,n=re.subn(regex,replacement,text,count=1)
if n!=1: raise SystemExit('cacheIdentity periodKind patch failed')
write(p,text2)

# Browser cache mirrors the same alias/span logic and bumps only day/week prose identity.
p='web/src/lib/readingCache.ts'
text=read(p)
text=text.replace("const FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v2'", "const FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v3'")
anchor="const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.6-reunion-compact-evidence'\n"
helper="""const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.7-reunion-specific'\n\nfunction normalizedFortunePeriodKind(request: Record<string, unknown>, calculation: Record<string, unknown>, period: Record<string, unknown>): string {\n  const raw = String(calculation.period_kind ?? request.period_kind ?? period.kind ?? '').trim().toLowerCase()\n  const aliases: Record<string,string> = { today:'day', daily:'day', day:'day', weekly:'week', week:'week', monthly:'month', month:'month', yearly:'annual', year:'annual', annual:'annual' }\n  if (aliases[raw]) return aliases[raw]\n  const start = String(period.start ?? '')\n  const end = String(period.end ?? '')\n  const a = Date.parse(`${start}T00:00:00Z`)\n  const b = Date.parse(`${end}T00:00:00Z`)\n  if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {\n    const days = Math.floor((b-a)/86400000)+1\n    if (days <= 1) return 'day'\n    if (days <= 9) return 'week'\n    if (days <= 45) return 'month'\n    return 'annual'\n  }\n  return raw\n}\n"""
if anchor not in text: raise SystemExit('readingCache relationship contract anchor missing')
text=text.replace(anchor,helper,1)
text=text.replace("  const periodKind = String(calculation.period_kind ?? request.period_kind ?? period.kind ?? '').trim().toLowerCase()", "  const periodKind = normalizedFortunePeriodKind(request, calculation, period)",1)
write(p,text)

# 2) Saju topic availability: capability vs current-period evidence are different things.
p='web/src/SystemReadingViews.tsx'
text=read(p)
old="  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? view.lenses.some(l=>SAJU_LIFE_KEYS[t].includes(l.key)) : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))"
new="  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? SAJU_LIFE_KEYS[t].length>0 : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))"
if old not in text: raise SystemExit('saju availability line missing')
text=text.replace(old,new,1)
old="title={!available(t)?'이 체계에서 연결된 근거가 부족해':undefined}"
new="title={!available(t)?(system==='saju'&&SAJU_LIFE_KEYS[t].length===0?'현재 사주 계산 계약에는 이 분야를 직접 읽을 안전한 근거가 없어':'이 체계에서 연결된 근거가 부족해'):undefined}"
if old not in text: raise SystemExit('topic title line missing')
text=text.replace(old,new,1)
old="{!selectedLenses.length&&<p>연결된 십성이 없어 이 분야의 설명을 만들지 않았어.</p>}"
new="{!selectedLenses.length&&<p className=\"saju-topic-note\">이번 기간에는 {topic}에 직접 연결되는 십성 운 구간이 두드러지지 않아. 탭을 막지는 않고, 직접 근거가 적다는 상태로 보여줘. 전체 탭에서 이 기간의 주된 십성을 같이 확인해.</p>}"
if old not in text: raise SystemExit('saju empty message missing')
text=text.replace(old,new,1)
# Period-aware deterministic summaries so independent system tabs do not just swap the period noun.
insert_after="""function westernWhen(dayCount:number) {\n  if (dayCount <= 1) return '오늘'\n  if (dayCount <= 9) return '이번 주'\n  if (dayCount <= 45) return '이번 달'\n  return '올해'\n}\n"""
period_helpers="""function westernWhen(dayCount:number) {\n  if (dayCount <= 1) return '오늘'\n  if (dayCount <= 9) return '이번 주'\n  if (dayCount <= 45) return '이번 달'\n  return '올해'\n}\nfunction periodReadingFrame(when:string) {\n  if (when==='오늘') return '오늘 바로 처리할 선택과 반응을 기준으로 보면'\n  if (when==='이번 주') return '이번 주는 하루 한 번의 사건보다 며칠 동안 반복되는 역할과 반응을 기준으로 보면'\n  if (when==='이번 달') return '이번 달은 월초·중순·말까지 이어지는 책임과 생활 패턴을 기준으로 보면'\n  return '올해는 단기 사건보다 오래 이어지는 역할·책임과 생활 기반의 재배치를 기준으로 보면'\n}\nfunction thaiPeriodOverview(when:string) {\n  if (when==='오늘') return '오늘은 부탁과 책임이 들어오는 순간, 쉬어야 할 때, 내가 직접 결정할 범위, 돈·시간을 바로 쓰는 선택을 서로 섞지 말고 확인해봐.'\n  if (when==='이번 주') return '이번 주는 며칠 동안 반복되는 부탁·책임의 패턴과 수면·회복 리듬의 흔들림, 일에서 결정권이 어디에 놓이는지, 생활비·시간 배분이 어떻게 누적되는지를 나눠서 봐.'\n  if (when==='이번 달') return '이번 달은 한 번의 좋고 나쁨보다 관계의 부탁·책임이 반복되는 방식, 회복 리듬이 유지되는지, 일의 결정 범위와 돈·시간 배분이 월중에 어떻게 굳어지는지를 따로 점검해봐.'\n  return '올해는 단기 사건보다 사람 관계의 책임 구조, 회복을 유지하는 생활 리듬, 일에서 맡게 되는 결정 범위, 돈·시간 같은 생활 기반이 장기적으로 어떻게 재배치되는지를 각각 따로 봐.'\n}\n"""
if insert_after not in text: raise SystemExit('westernWhen helper missing')
text=text.replace(insert_after,period_helpers,1)
old="  return `${koreanParticle(when,'은는')} ${lead}${secondary ? ` 여기에 ${secondary}도 같이 확인해.` : ''}`"
new="  return `${periodReadingFrame(when)}, ${lead}${secondary ? ` 여기에 ${secondary}도 같이 확인해.` : ''}`"
if old not in text: raise SystemExit('sajuHeadline return missing')
text=text.replace(old,new,1)
old="  const thaiReaderSummary = topic==='전체'\n    ? '이번 기간에는 사람 관계에서 부탁과 책임의 균형, 수면·회복 같은 생활 리듬, 일에서 내가 결정할 범위, 돈·시간 같은 생활 기반을 각각 따로 점검해봐.'"
new="  const thaiReaderSummary = topic==='전체'\n    ? thaiPeriodOverview(westernWhen(c.period.day_count))"
if old not in text: raise SystemExit('thai summary missing')
text=text.replace(old,new,1)
write(p,text)

# 3) Relationship AI: reunion-specific compact packet/output instead of paying for generic compatibility prose.
p='supabase/functions/relationship-interpret-v9-preview/index.ts'
text=read(p)
text=text.replace('VERSION="relationship-v11.6-reunion-compact-evidence"','VERSION="relationship-v11.7-reunion-specific"',1)
old='function stat(s:any){if(!s||typeof s!=="object")return null;return {average:Number(s.average??0),band:String(s.band??""),spread:Number(s.spread??0),best_days:Array.isArray(s.best_days)?s.best_days.slice(0,10):[],caution_days:Array.isArray(s.caution_days)?s.caution_days.slice(0,8):[]};}'
new='function stat(s:any,maxPoints=3){if(!s||typeof s!=="object")return null;const n=Math.max(1,Math.min(4,maxPoints));return {average:Number(s.average??0),band:String(s.band??""),spread:Number(s.spread??0),best_days:Array.isArray(s.best_days)?s.best_days.slice(0,n):[],caution_days:Array.isArray(s.caution_days)?s.caution_days.slice(0,n):[]};}\nfunction sensitivityPacket(s:any){if(!s||typeof s!=="object")return null;const one=(x:any)=>!x||typeof x!=="object"?null:{available:Boolean(x.available),reason:x.reason??null,time_reliability:x.time_reliability??null,sample_count:Number(x.sample_count??0),step_minutes:Number(x.step_minutes??0),window_minutes:Number(x.window_minutes??0),angle_variation_deg:x.angle_variation_deg??null,robust_contact_count:Array.isArray(x.robust_contacts)?x.robust_contacts.length:0,sensitive_contact_count:Array.isArray(x.sensitive_contacts)?x.sensitive_contacts.length:0,fragile_contact_count:Array.isArray(x.fragile_contacts)?x.fragile_contacts.length:0,warnings:Array.isArray(x.warnings)?x.warnings.slice(0,3):[],event_probability:x.event_probability??"not_calculated"};return {policy:s.policy??null,user:one(s.user),counterpart:one(s.counterpart)};}'
if old not in text: raise SystemExit('relationship stat helper missing')
text=text.replace(old,new,1)
text=text.replace('sensitivity_scan:r?.sensitivity_scan??null','sensitivity_scan:sensitivityPacket(r?.sensitivity_scan)',1)
# Reunion schema only asks for reunion fields instead of also paying for generic compatibility essays.
pattern=r'function schemaFor\(purpose:Purpose\)\{const properties:any=\{\.\.\.COMMON_SCHEMA\};const required=\["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"\];if\(purpose==="reunion"\)\{properties\.reunion_reading=REUNION_SCHEMA;required\.push\("reunion_reading"\);\}if\(purpose\.startsWith\("marriage_"\)\)\{properties\.marriage_reading=MARRIAGE_SCHEMA;required\.push\("marriage_reading"\);\}return \{type:"OBJECT",properties,required\};\}'
replacement='''function schemaFor(purpose:Purpose){
 if(purpose==="reunion")return {type:"OBJECT",properties:{headline:S,overview:S,timing:S,reunion_context:S,practical_advice:{type:"ARRAY",items:S},top_aspects:{type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}},limits:S,reunion_reading:REUNION_SCHEMA},required:["headline","overview","timing","reunion_context","practical_advice","top_aspects","limits","reunion_reading"]};
 const properties:any={...COMMON_SCHEMA};const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];
 if(purpose.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}
 return {type:"OBJECT",properties,required};
}'''
text2,n=re.subn(pattern,replacement,text,count=1)
if n!=1: raise SystemExit(f'schemaFor patch count {n}')
text=text2
old='purpose==="reunion"?"재회운이다. 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 각각 따로 결론내고, 각 축의 수신·발신·동시 재접점 방향도 분리하라. Secondary Progression을 Daily Transit보다 상위 시기근거로 두고 하나의 재회 점수는 만들지 마라."'
new='purpose==="reunion"?"재회운이다. 첫 결론에서 반드시 ① 상대→나(수신) ② 나→상대(발신) 중 어느 상대활성도가 더 강한지 또는 비슷한지 ③ 재접점이 강해지는 계산 날짜/구간 ④ 연락 재개와 실제 관계 재구축이 같은지 다른지를 순서대로 답하라. 점수는 실제 연락 확률이 아니므로 확률·보장 표현은 금지하고, directional과 reunion_dimensions의 계산값을 근거로 상대활성도 비교라고 명시하라. 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 각각 따로 결론내고, Secondary Progression을 Daily Transit보다 상위 시기근거로 둬라. 근거 없는 일반 상담문구를 반복하지 말고 각 문단에 실제 방향·날짜·애스펙트 중 최소 하나를 연결하라."'
if old not in text: raise SystemExit('reunion mode instruction missing')
text=text.replace(old,new,1)
old='function relationshipEstimatedJobKrw(inputTokens:number){const intro=Date.now()<=GEMINI_INTRO_END,inputRate=intro ? .75 : 1.5,outputRate=intro ? 3.75 : 7.5,thoughtReserve=3000;const one=(output:number)=>((inputTokens/1_000_000)*inputRate+((output+thoughtReserve)/1_000_000)*outputRate)*GEMINI_USD_KRW_ESTIMATE;return one(16000)+one(12000);}\nfunction promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens);return {bytes,max_bytes:MAX_PROMPT_BYTES,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=MAX_PROMPT_BYTES&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}'
new='function relationshipOutputTokens(purpose:Purpose,compactMode:boolean){if(purpose==="reunion")return compactMode?6500:8500;return compactMode?12000:16000;}\nfunction relationshipEstimatedJobKrw(inputTokens:number,purpose:Purpose){const intro=Date.now()<=GEMINI_INTRO_END,inputRate=intro ? .75 : 1.5,outputRate=intro ? 3.75 : 7.5,thoughtReserve=3000;const one=(output:number)=>((inputTokens/1_000_000)*inputRate+((output+thoughtReserve)/1_000_000)*outputRate)*GEMINI_USD_KRW_ESTIMATE;return one(relationshipOutputTokens(purpose,false))+one(relationshipOutputTokens(purpose,true));}\nfunction promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose);return {bytes,max_bytes:MAX_PROMPT_BYTES,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=MAX_PROMPT_BYTES&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}'
if old not in text: raise SystemExit('relationship budget helper missing')
text=text.replace(old,new,1)
text=text.replace('maxOutputTokens:compactMode?12000:16000','maxOutputTokens:relationshipOutputTokens(purpose,compactMode)',1)
write(p,text)

# 4) Reunion UI: show directional calculation before prose, improve fallback layout, and prevent horizontal drag.
p='web/src/RelationshipInterpretationPanel.tsx'
text=read(p)
anchor="  const reunion = analysisMode === 'reunion'\n"
insert="""  const reunion = analysisMode === 'reunion'\n  const reunionInitiativeSummary = (() => {\n    if (!reunion || !timing) return ''\n    const incoming = Number(timing.incoming?.average)\n    const outgoing = Number(timing.outgoing?.average)\n    if (!Number.isFinite(incoming) || !Number.isFinite(outgoing)) return '누가 먼저 움직일 흐름은 현재 계산만으로 비교하기 어려워.'\n    const gap = incoming - outgoing\n    const lead = gap >= 5 ? '상대 → 나 축이 더 강하게 잡혀' : gap <= -5 ? '나 → 상대 축이 더 강하게 잡혀' : '상대 → 나와 나 → 상대의 차이가 크지 않아'\n    return `누가 먼저 움직일지의 상대활성도를 비교하면 ${lead}. 상대 → 나 ${incoming.toFixed(0)}, 나 → 상대 ${outgoing.toFixed(0)}이고 실제 연락 확률이나 확정 예측은 아니야.`\n  })()\n"""
if anchor not in text: raise SystemExit('panel reunion anchor missing')
text=text.replace(anchor,insert,1)
old="    conclusion: `이번 흐름은 다시 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비가 같은지 따로 보는 게 핵심이야. ${view.sustainabilityText}`,”
# tolerate normal ASCII quote only; do direct known text
old="    conclusion: `이번 흐름은 다시 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비가 같은지 따로 보는 게 핵심이야. ${view.sustainabilityText}`,”
# no-op typo protection
if old in text: text=text.replace(old,old,1)
old2="    conclusion: `이번 흐름은 다시 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비가 같은지 따로 보는 게 핵심이야. ${view.sustainabilityText}`,"
new2="    conclusion: `${reunionInitiativeSummary} 재접점은 ${view.reconnection.band}으로 잡혀 있어. 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비는 따로 봐야 해. ${view.sustainabilityText}`,"
if old2 not in text: raise SystemExit('fallback reunion conclusion missing')
text=text.replace(old2,new2,1)
# Add the deterministic directional snapshot inside successful AI reunion output.
old="{analysisMode==='reunion' ? <><ReadingExplanation kind=\"reason\">{[ai.data.reunion_reading?.incoming_contact,ai.data.reunion_reading?.outgoing_contact].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind=\"timing\">{[ai.data.reunion_reading?.reconnection_windows,ai.data.reunion_reading?.low_windows].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind=\"caution\">{[ai.data.reunion_reading?.relationship_filter,ai.data.reunion_reading?.precision_note].filter(Boolean).join(' ')}</ReadingExplanation></>"
new="{analysisMode==='reunion' ? <><section className=\"reunion-ai-snapshot\"><h4>연락·재접촉 상대활성도</h4><p className=\"reunion-initiative-summary\">{reunionInitiativeSummary}</p><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/><small>위 값은 계산 기간 안의 상대활성도 비교이며 실제 연락 확률은 아니야.</small></section><ReadingExplanation kind=\"reason\">{[ai.data.reunion_reading?.incoming_contact,ai.data.reunion_reading?.outgoing_contact].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind=\"timing\">{[ai.data.reunion_reading?.reconnection_windows,ai.data.reunion_reading?.low_windows].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind=\"caution\">{[ai.data.reunion_reading?.relationship_filter,ai.data.reunion_reading?.precision_note].filter(Boolean).join(' ')}</ReadingExplanation></>"
if old not in text: raise SystemExit('AI reunion branch missing')
text=text.replace(old,new,1)
old="      <section className=\"reading-section\"><h3>{view.stabilityTitle}<ReadingBadge kind=\"rebuilding\"/><span className=\"reading-state\">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>\n      <section className=\"reading-section\"><h3>반복될 가능성이 높은 문제</h3>{view.friction.length ? compactPatterns(view.friction) : <p>반복 갈등을 뚜렷하게 짚을 접점이 부족해. 문제가 없다는 뜻은 아니야.</p>}</section>"
new="      <section className=\"reading-section relationship-fallback-card\"><div className=\"relationship-section-heading\"><h3>{view.stabilityTitle}</h3><span className=\"relationship-section-meta\"><ReadingBadge kind=\"rebuilding\"/><span className=\"reading-state\">{view.sustainability}</span></span></div><p className=\"relationship-section-copy\">{view.sustainabilityText}</p></section>\n      <section className=\"reading-section relationship-fallback-card\"><h3>반복될 가능성이 높은 문제</h3>{view.friction.length ? compactPatterns(view.friction) : <p className=\"relationship-section-copy\">반복 갈등을 뚜렷하게 짚을 접점이 부족해. 문제가 없다는 뜻은 아니야.</p>}</section>"
if old not in text: raise SystemExit('fallback sections missing')
text=text.replace(old,new,1)
write(p,text)

# Styling: lock relationship reading to vertical gestures and give reunion prose a stable card rhythm.
p='web/src/reading-experience.css'
text=read(p)
append='''\n\n/* V12 reunion reading: keep specific-reading prose inside the viewport and make hierarchy explicit. */\n.relationship-experience {\n  width: 100%;\n  max-width: 100%;\n  min-width: 0;\n  overflow-x: clip;\n  overscroll-behavior-x: none;\n  touch-action: pan-y;\n  box-sizing: border-box;\n}\n.relationship-experience *,\n.relationship-experience *::before,\n.relationship-experience *::after { box-sizing: border-box; min-width: 0; }\n.relationship-experience .reading-section,\n.relationship-experience .reading-explanation,\n.relationship-experience .contact-row,\n.relationship-experience .relationship-pattern { max-width: 100%; overflow-wrap: anywhere; }\n.reunion-ai-snapshot {\n  margin: 16px 0 18px;\n  padding: 16px;\n  border: 1px solid var(--reading-border);\n  border-radius: 18px;\n  background: linear-gradient(145deg, rgba(234,243,237,.9), rgba(238,232,247,.72));\n  overflow: hidden;\n}\n.reunion-ai-snapshot h4 { margin: 0 0 8px; font-size: 16px; color: var(--reading-indigo); }\n.reunion-ai-snapshot .reunion-initiative-summary { margin: 0 0 12px; font-size: 15.5px; line-height: 1.78; word-break: keep-all; }\n.reunion-ai-snapshot small { display: block; margin-top: 10px; color: var(--reading-secondary); font-size: 12px; line-height: 1.6; }\n.relationship-fallback-card {\n  padding: 16px !important;\n  border: 1px solid var(--reading-border);\n  border-radius: 18px;\n  background: rgba(255,253,250,.72);\n  overflow: hidden;\n}\n.relationship-section-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }\n.relationship-section-heading h3 { margin: 0 !important; flex: 1 1 180px; }\n.relationship-section-meta { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }\n.relationship-section-copy,\n.relationship-fallback-card > p { margin-top: 10px !important; font-size: 15.5px; line-height: 1.82; word-break: keep-all; }\n'''
if '/* V12 reunion reading:' not in text: text += append
write(p,text)

# Update cache contract regression expectation.
p='web/src/lib/v23NarrativeTransport.test.mjs'
text=read(p).replace("FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v2'", "FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v3'")
write(p,text)

# Extend exact cache identity tests for aliases/date-span inference.
p='supabase/functions/fortune-interpret-v23-preview/cacheIdentityV23.test.mjs'
text=read(p)
extra='''\n\ntest('day/week cache identity recognizes UI aliases and infers actual date spans',()=>{\n  const version='supabase-ai-v23.0-phenomenon-first'\n  const legacy=`${version}:${hash.slice(0,32)}`\n  assert.notEqual(exactV23JobKind(version,{period_kind:'today'},hash),legacy)\n  assert.notEqual(exactV23JobKind(version,{period:{start:'2026-09-18',end:'2026-09-18'}},hash),legacy)\n  assert.notEqual(exactV23JobKind(version,{period:{start:'2026-09-14',end:'2026-09-20'}},hash),legacy)\n  assert.equal(exactV23JobKind(version,{period:{start:'2026-09-01',end:'2026-09-30'}},hash),legacy)\n})\n'''
if "recognizes UI aliases" not in text: text += extra
write(p,text)

# Focused static/regression contract for the three reported issues.
Path('web/src/lib/reunionSajuExperienceV12.test.mjs').write_text(r'''import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport test from 'node:test'\n\nconst panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')\nconst systems=readFileSync(new URL('../SystemReadingViews.tsx',import.meta.url),'utf8')\nconst css=readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8')\nconst rel=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')\n\ntest('Saju keeps supported topics selectable even when current period has no direct ten-god lens',()=>{\n  assert.match(systems,/system==='saju' \? SAJU_LIFE_KEYS\[t\]\.length>0/)\n  assert.match(systems,/직접 연결되는 십성 운 구간이 두드러지지 않아/)\n  assert.match(systems,/현재 사주 계산 계약에는 이 분야를 직접 읽을 안전한 근거가 없어/)\n})\n\ntest('reunion surface leads with direction, timing and initiative comparison',()=>{\n  assert.match(panel,/연락·재접촉 상대활성도/)\n  assert.match(panel,/누가 먼저 움직일지의 상대활성도/)\n  assert.match(panel,/상대 → 나/)\n  assert.match(panel,/나 → 상대/)\n  assert.match(panel,/과거 인연 재접점/)\n})\n\ntest('reunion mobile reading is locked to vertical gestures and uses bounded fallback cards',()=>{\n  assert.match(css,/\.relationship-experience \{[\s\S]*overflow-x: clip;[\s\S]*touch-action: pan-y;/)\n  assert.match(panel,/relationship-fallback-card/)\n  assert.match(panel,/relationship-section-heading/)\n})\n\ntest('reunion AI uses a reunion-specific cost and output contract instead of generic compatibility essays',()=>{\n  assert.match(rel,/relationship-v11\.7-reunion-specific/)\n  assert.match(rel,/purpose===\"reunion\"\)return compactMode\?6500:8500/)\n  assert.match(rel,/if\(purpose===\"reunion\"\)return \{type:\"OBJECT\",properties:/)\n  assert.match(rel,/sensitivity_scan:sensitivityPacket\(r\?\.sensitivity_scan\)/)\n  assert.match(rel,/근거 없는 일반 상담문구를 반복하지 말고/)\n})\n''',encoding='utf-8')
