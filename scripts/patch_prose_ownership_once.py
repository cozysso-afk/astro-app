from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'target not found in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')

# 1) Move topic prose ownership to authored Gemini clusters before the stabilizer.
index = 'supabase/functions/fortune-interpret-v23-preview/index.ts'
replace_once(index,
    'import { polishV23EditorialDepth } from "./editorialPolishV23.ts";',
    'import { mergeAuthoredTopicAnalysis, polishV23EditorialDepth } from "./editorialPolishV23.ts";')
replace_once(index,
    'const VERSION="supabase-ai-v23.4-editorial-trace-v1";',
    'const VERSION="supabase-ai-v23.5-prose-ownership-v1";')
replace_once(index,
    '  const withTopics={...core,topic_analysis:buildDeterministicTopicAnalysis(payload)};',
    '  const withTopics={...core,topic_analysis:mergeAuthoredTopicAnalysis(core,buildDeterministicTopicAnalysis(payload),payload)};')

polish = 'supabase/functions/fortune-interpret-v23-preview/editorialPolishV23.ts'
p = Path(polish)
s = p.read_text(encoding='utf-8')
needle = '''function appendChangeNaturally(avoidValue:string,changeValue:string){\n  const avoid=text(avoidValue),change=text(changeValue)\n  if(!change)return avoid\n  const avoidKey=compactKey(avoid),changeKey=compactKey(change)\n  if(changeKey.length>=12&&avoidKey.includes(changeKey.slice(0,Math.min(changeKey.length,28))))return avoid\n  return clip([avoid,`다만 ${change}`].filter(Boolean).join(' '),360)\n}\n\n'''
insert = needle + '''export function mergeAuthoredTopicAnalysis(data:any,deterministic:any,payload:any){\n  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]\n  const map=new Map<string,any>(rows.map((row:any)=>[String(row?.id??''),row]))\n  const source=Array.isArray(deterministic)?deterministic:Object.entries(deterministic??{}).map(([topic,row]:any)=>({topic,...row}))\n  return Object.fromEntries(source.map((item:any)=>{\n    const topic=text(item?.topic)\n    const base={...item}\n    delete base.topic\n    const section=sectionFor(data,topic)\n    if(!section||!['direct','conditional'].includes(String(section?.applicability??'')))return [topic,base]\n    const linked=refs(section?.evidence_refs).filter(ref=>map.has(ref))\n    if(!linked.length)return [topic,base]\n    const conclusion=text(section?.conclusion),scene=text(section?.real_scene),action=text(section?.action),change=text(section?.change_condition)\n    return [topic,{\n      ...base,\n      ...(conclusion.length>=12?{verdict:clip(conclusion,240)}:{}),\n      ...(scene.length>=12?{reason:clip(scene,680)}:{}),\n      ...(action.length>=10?{action:clip(action,260)}:{}),\n      ...(change.length>=10?{avoid:clip(change,320)}:{}),\n      evidence_refs:uniq([...refs(base?.evidence_refs).filter(ref=>map.has(ref)),...linked]).slice(0,8),\n    }]\n  }))\n}\n\n'''
if needle not in s:
    raise SystemExit('editorial polish insertion point not found')
s = s.replace(needle, insert, 1)
old_reason = '''    const existingReason=text(item?.reason)\n    if(scene.length>=18){\n      const reasonBase=action.length>=10?stripGenericReasonTail(existingReason):existingReason\n      const sceneSentence=`현실에서는 ${scene}`\n      item.reason=clip([reasonBase,sceneSentence].filter(Boolean).join(' '),680)\n    }'''
new_reason = '''    const existingReason=text(item?.reason)\n    if(scene.length>=18){\n      const existingKey=compactKey(existingReason),sceneKey=compactKey(scene)\n      if(!sceneKey||!existingKey.includes(sceneKey.slice(0,Math.min(sceneKey.length,40)))){\n        const reasonBase=action.length>=10?stripGenericReasonTail(existingReason):existingReason\n        const sceneSentence=`현실에서는 ${scene}`\n        item.reason=clip([reasonBase,sceneSentence].filter(Boolean).join(' '),680)\n      }\n    }'''
if old_reason not in s:
    raise SystemExit('editorial reason target not found')
s = s.replace(old_reason, new_reason, 1)
p.write_text(s, encoding='utf-8')

# 2) Stabilizer: preserve authored prose and use deterministic strings only as missing-field fallbacks.
cost = 'supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts'
p = Path(cost)
s = p.read_text(encoding='utf-8')
repls = [
('''    out.summary=ensureMinText(out?.summary,45,`${ev||`${topic} 계산근거가 이 시기에 모여 있어.`} 사건 확정이 아니라 상대활성도 변화로 보고 실제 일정과 반응을 함께 확인해.`);\n    out.action=ensureMinText(out?.action,18,verb.action);out.avoid=ensureMinText(out?.avoid,18,verb.avoid);return out;''',
 '''    out.summary=String(out?.summary??"").trim()||`${ev||`${topic} 계산근거가 이 시기에 모여 있어.`} 사건 확정이 아니라 상대활성도 변화로 보고 실제 일정과 반응을 함께 확인해.`;\n    out.action=String(out?.action??"").trim()||verb.action;out.avoid=String(out?.avoid??"").trim()||verb.avoid;return out;'''),
('''out.evidence_refs=linked.slice(0,5);out.action=ensureMinText(out?.action,12,verb.action);out.timing=String(out?.timing??"").trim()||(target?(iso(target.start)===iso(target.end)?iso(target.start):`${iso(target.start)} ~ ${iso(target.end)}`):String(payload?.period?.start??""));out.reason=ensureMinText(out?.reason,24,target?.summary??`${topic} 계산근거와 직접 연결한 행동 가이드야.`);out.watch=ensureMinText(out?.watch,14,"실제 답변·일정·수치처럼 확인 가능한 변화를 먼저 확인해.");out.avoid=ensureMinText(out?.avoid,14,verb.avoid);return out;''',
 '''out.evidence_refs=linked.slice(0,5);out.action=String(out?.action??"").trim()||verb.action;out.timing=String(out?.timing??"").trim()||(target?(iso(target.start)===iso(target.end)?iso(target.start):`${iso(target.start)} ~ ${iso(target.end)}`):String(payload?.period?.start??""));out.reason=String(out?.reason??"").trim()||(target?.summary??`${topic} 계산근거와 직접 연결한 행동 가이드야.`);out.watch=String(out?.watch??"").trim()||"실제 답변·일정·수치처럼 확인 가능한 변화를 먼저 확인해.";out.avoid=String(out?.avoid??"").trim()||verb.avoid;return out;'''),
('''data.overall.evidence_refs=overallEvidence.slice(0,8);const minSummary=kind==="annual"?240:kind==="month"?170:110;const groundedAppend=coreTopics.slice(0,3).map((x:any)=>[String(x.verdict??""),String(x.action??""),x.timing?`확인할 시기는 ${String(x.timing)}이야.`:""].filter(Boolean).join(" ")).filter(Boolean).join(" ");data.overall.summary=ensureMinText(data.overall.summary,minSummary,`${groundedAppend} 이 점수들은 사건 확률이 아니라 ${singleDay?"이날의":"기간 내"} 상대활성도이므로 실제 일정·반응·수치와 대조해서 판단해.`);''',
 '''data.overall.evidence_refs=overallEvidence.slice(0,8);const groundedAppend=coreTopics.slice(0,3).map((x:any)=>[String(x.verdict??""),String(x.action??""),x.timing?`확인할 시기는 ${String(x.timing)}이야.`:""].filter(Boolean).join(" ")).filter(Boolean).join(" ");data.overall.summary=String(data.overall.summary??"").trim()||`${groundedAppend} 이 점수들은 사건 확률이 아니라 ${singleDay?"이날의":"기간 내"} 상대활성도이므로 실제 일정·반응·수치와 대조해서 판단해.`;'''),
]
for old,new in repls:
    if old not in s:
        raise SystemExit(f'cost guard prose target missing: {old[:100]!r}')
    s=s.replace(old,new,1)

# Relationship/contact/investment prose are also provider-authored. Keep them when present.
for field in ['context','flow','focus_timing','watch','avoid']:
    marker=f'    rr.{field}='
    start=s.find(marker)
    if start<0: raise SystemExit(f'rr.{field} assignment not found')
    end=s.find(';',start)
    original=s[start+len(marker):end]
    replacement=f'    rr.{field}=String(rr?.{field}??"").trim()||{original}'
    s=s[:start]+replacement+s[end:]

old_contact='''    data.contact_flow={\n      incoming:axisText(axes[0],"이 축은 상대가 실제로 보이는 반응을 확인하는 용도라서 답변·먼저 온 연락·구체적 만남 제안과 함께 봐."),\n      outgoing:axisText(axes[1],"이 축은 내가 먼저 연락하거나 제안할 때의 상대적 적합도를 보는 값이지, 상대가 받아준다는 뜻은 아니야."),\n      reconnection:axisText(axes[2],"이 축은 과거 인연의 재접점 활성도를 보는 값이지, 재회나 관계 재성립을 확정하지 않아."),\n    };'''
new_contact='''    const authoredContact=data?.contact_flow&&typeof data.contact_flow==="object"?data.contact_flow:{};\n    data.contact_flow={\n      incoming:String(authoredContact?.incoming??"").trim()||axisText(axes[0],"이 축은 상대가 실제로 보이는 반응을 확인하는 용도라서 답변·먼저 온 연락·구체적 만남 제안과 함께 봐."),\n      outgoing:String(authoredContact?.outgoing??"").trim()||axisText(axes[1],"이 축은 내가 먼저 연락하거나 제안할 때의 상대적 적합도를 보는 값이지, 상대가 받아준다는 뜻은 아니야."),\n      reconnection:String(authoredContact?.reconnection??"").trim()||axisText(axes[2],"이 축은 과거 인연의 재접점 활성도를 보는 값이지, 재회나 관계 재성립을 확정하지 않아."),\n    };'''
if old_contact not in s: raise SystemExit('contact flow overwrite target not found')
s=s.replace(old_contact,new_contact,1)

for field in ['psychology','realization','entry','risk']:
    marker=f'    ir.{field}='
    start=s.find(marker)
    if start<0: raise SystemExit(f'ir.{field} assignment not found')
    end=s.find(';',start)
    original=s[start+len(marker):end]
    replacement=f'    ir.{field}=String(ir?.{field}??"").trim()||{original}'
    s=s[:start]+replacement+s[end:]

p.write_text(s,encoding='utf-8')

# 3) Frontend: do not discard a whole authored topic merely because one technical term appears.
front='web/src/lib/fortuneEditorialV3.ts'
p=Path(front);s=p.read_text(encoding='utf-8')
replace='''  if (TECHNICAL_RE.test(text)) return false\n  if (/계산\\s*(?:엔진|로직|threshold|오브)|(?:상대|절대)\\s*확률/i.test(text)) return false'''
with_='''  // Technical evidence belongs in the explanation layer, but its presence must not\n  // discard the entire authored conclusion/scene/action block. Meta/system copy is still rejected.\n  if (/계산\\s*(?:엔진|로직|threshold|오브)|(?:상대|절대)\\s*확률/i.test(text)) return false'''
if replace not in s: raise SystemExit('readerFacing technical filter target not found')
s=s.replace(replace,with_,1)
p.write_text(s,encoding='utf-8')

# 4) Frontend: accept concise authored editorial (2-3 sentences) instead of requiring four.
narr='web/src/PeriodFortuneNarrativeV2.tsx'
p=Path(narr);s=p.read_text(encoding='utf-8')
old='''  if (sentences.length < 4) return null\n  return {\n    conclusion: sentences[0],\n    sceneAction: `${sentences[1]} ${sentences[2]}`.trim(),\n    change: sentences.slice(3).join(' ').trim(),\n  }'''
new='''  if (sentences.length < 2) return null\n  return {\n    conclusion: sentences[0],\n    sceneAction: sentences.length >= 3 ? `${sentences[1]} ${sentences[2]}`.trim() : sentences[1],\n    change: sentences.length >= 4 ? sentences.slice(3).join(' ').trim() : '',\n  }'''
if old not in s: raise SystemExit('focusEditorialParts target not found')
s=s.replace(old,new,1)
old_render='''            <p className="period-ai-topic-editorial-v4">{deepEditorial.sceneAction}</p>\n            <p className="period-ai-topic-change-v9"><em>판단 바뀌는 조건</em> {deepEditorial.change}</p>'''
new_render='''            <p className="period-ai-topic-editorial-v4">{deepEditorial.sceneAction}</p>\n            {deepEditorial.change && <p className="period-ai-topic-change-v9"><em>판단 바뀌는 조건</em> {deepEditorial.change}</p>}'''
if old_render not in s: raise SystemExit('deep editorial render target not found')
s=s.replace(old_render,new_render,1)
p.write_text(s,encoding='utf-8')

# Contract regression: prose ownership must remain explicit.
test=Path('supabase/functions/fortune-interpret-v23-preview/proseOwnershipV23.contract.test.mjs')
test.write_text('''import assert from 'node:assert/strict'\nimport fs from 'node:fs'\nimport test from 'node:test'\n\nconst index=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8')\nconst polish=fs.readFileSync(new URL('./editorialPolishV23.ts',import.meta.url),'utf8')\nconst stabilizer=fs.readFileSync(new URL('../fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')\nconst frontend=fs.readFileSync(new URL('../../../web/src/lib/fortuneEditorialV3.ts',import.meta.url),'utf8')\nconst narrative=fs.readFileSync(new URL('../../../web/src/PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')\n\ntest('normal V23 path gives authored clusters prose ownership',()=>{\n  assert.match(index,/topic_analysis:mergeAuthoredTopicAnalysis\\(core,buildDeterministicTopicAnalysis\\(payload\\),payload\\)/)\n  assert.match(polish,/export function mergeAuthoredTopicAnalysis/)\n  assert.match(polish,/conclusion\.length>=12\?\{verdict:/)\n  assert.match(polish,/scene\.length>=12\?\{reason:/)\n  assert.doesNotMatch(index,/topic_analysis:buildDeterministicTopicAnalysis\\(payload\\)}/)\n})\n\ntest('stabilizer uses deterministic prose only as a missing-field fallback',()=>{\n  assert.match(stabilizer,/out\.summary=String\\(out\?\.summary/)\n  assert.match(stabilizer,/data\.overall\.summary=String\\(data\.overall\.summary/)\n  assert.match(stabilizer,/rr\.context=String\\(rr\?\.context/)\n  assert.match(stabilizer,/authoredContact/)\n  assert.match(stabilizer,/ir\.psychology=String\\(ir\?\.psychology/)\n})\n\ntest('frontend preserves concise authored blocks instead of discarding them wholesale',()=>{\n  const readerFacing=frontend.slice(frontend.indexOf('function readerFacing'),frontend.indexOf('function relationshipPartUsable'))\n  assert.doesNotMatch(readerFacing,/TECHNICAL_RE\.test/)\n  assert.match(narrative,/if \(sentences\.length < 2\) return null/)\n  assert.doesNotMatch(narrative,/if \(sentences\.length < 4\) return null/)\n})\n''',encoding='utf-8')

print('prose ownership patch applied')
