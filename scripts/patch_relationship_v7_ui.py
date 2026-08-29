from pathlib import Path
import re

p = Path('web/src/AppNext.tsx')
s = p.read_text()

old = """    chemistry: string
    communication: string
    stability: string
    tensions: string
    timing: string
    reunion_context: string
"""
new = """    chemistry: string
    emotional_dynamic?: string
    communication: string
    conflict_pattern?: string
    power_boundaries?: string
    long_term?: string
    stability?: string
    tensions?: string
    timing: string
    reunion_context: string
    felt_scenarios?: string[]
"""
if old not in s:
    raise SystemExit('RelationshipAiResponse schema anchor not found')
s = s.replace(old, new, 1)

anchor = "const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']\n"
if anchor not in s:
    raise SystemExit('relationship signal anchor not found')
s = s.replace(anchor, anchor + "const relationshipTimeSensitivePoints = new Set(['Moon','ASC','DSC','MC','IC'])\n", 1)

old_panel = """  const supportive = aspects.filter((a)=>a.tone==='supportive').length
  const challenging = aspects.filter((a)=>a.tone==='challenging').length
  const mixed = aspects.filter((a)=>a.tone==='mixed').length
  const isReunion = analysisMode === 'reunion'
  const isMarriage = analysisMode.startsWith('marriage_')
  const tight = [...aspects].sort((a,b)=>a.orb-b.orb).slice(0,4)
  const communication = aspects.filter((a)=>a.a==='Mercury'||a.b==='Mercury')
  const chemistry = aspects.filter((a)=>['Venus','Mars','Pluto'].includes(a.a)||['Venus','Mars','Pluto'].includes(a.b))
  const structure = aspects.filter((a)=>['Saturn','Jupiter','True Node'].includes(a.a)||['Saturn','Jupiter','True Node'].includes(a.b))
"""
new_panel = """  const interpretableAspects = partnerExact ? aspects : aspects.filter((a)=>!relationshipTimeSensitivePoints.has(a.a) && !relationshipTimeSensitivePoints.has(a.b))
  const supportive = interpretableAspects.filter((a)=>a.tone==='supportive').length
  const challenging = interpretableAspects.filter((a)=>a.tone==='challenging').length
  const mixed = interpretableAspects.filter((a)=>a.tone==='mixed').length
  const isReunion = analysisMode === 'reunion'
  const isMarriage = analysisMode.startsWith('marriage_')
  const tight = [...interpretableAspects].sort((a,b)=>a.orb-b.orb).slice(0,4)
  const communication = interpretableAspects.filter((a)=>a.a==='Mercury'||a.b==='Mercury')
  const chemistry = interpretableAspects.filter((a)=>['Venus','Mars','Pluto'].includes(a.a)||['Venus','Mars','Pluto'].includes(a.b))
  const structure = interpretableAspects.filter((a)=>['Saturn','Jupiter','True Node'].includes(a.a)||['Saturn','Jupiter','True Node'].includes(a.b))
"""
if old_panel not in s:
    raise SystemExit('RelationshipInterpretationPanel calculations anchor not found')
s = s.replace(old_panel, new_panel, 1)
s = s.replace('시너스트리에서 {aspects.length}개 접점이 잡혔고', '시너스트리에서 {interpretableAspects.length}개 해석 가능한 접점이 잡혔고', 1)

if 'relationship-interpret-v6-preview' not in s:
    raise SystemExit('v6 function invocation not found')
s = s.replace('relationship-interpret-v6-preview', 'relationship-interpret-v7-preview', 1)

pattern = re.compile(r'<div className="relationship-ai-grid">.*?</div>\{ai\.data\.reunion_reading\?\.bottom_line&&', re.S)
replacement = '''<div className="relationship-ai-grid"><article><strong>끌림 · 호감</strong><p>{ai.data.chemistry}</p></article>{ai.data.emotional_dynamic&&<article><strong>정서적 친화 · 거리감</strong><p>{ai.data.emotional_dynamic}</p></article>}<article><strong>대화 · 오해</strong><p>{ai.data.communication}</p></article>{ai.data.conflict_pattern&&<article><strong>갈등이 붙는 지점</strong><p>{ai.data.conflict_pattern}</p></article>}{ai.data.power_boundaries&&<article><strong>힘의 균형 · 경계</strong><p>{ai.data.power_boundaries}</p></article>}{ai.data.long_term&&<article><strong>장기 지속성</strong><p>{ai.data.long_term}</p></article>}{!ai.data.long_term&&ai.data.stability&&<article><strong>장기 지속성</strong><p>{ai.data.stability}</p></article>}<article><strong>시기 · 정밀도</strong><p>{ai.data.timing}</p></article>{isReunion&&ai.data.reunion_context&&<article><strong>재회 맥락</strong><p>{ai.data.reunion_context}</p></article>}</div>{!!ai.data.felt_scenarios?.length&&<div className="relationship-ai-scenarios"><strong>실제로는 이렇게 체감되기 쉬워</strong>{ai.data.felt_scenarios.map((x,i)=><p key={`${i}-${x}`}><span>{i+1}</span>{x}</p>)}</div>}{ai.data.reunion_reading?.bottom_line&&'''
s2, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'relationship AI grid replacement count={count}')
p.write_text(s2)

css = Path('web/src/visual-overhaul-v6.css')
c = css.read_text()
marker = '/* v7 · evidence-first interpretation rhythm */'
if marker not in c:
    c += '''\n\n/* v7 · evidence-first interpretation rhythm */
.relationship-ai-scenarios{margin-top:13px;padding:15px;border:1px solid rgba(137,119,159,.10);border-radius:18px;background:linear-gradient(145deg,rgba(250,246,255,.83),rgba(241,249,253,.78))}
.relationship-ai-scenarios>strong{display:block;margin-bottom:9px;font-family:var(--v6-serif);font-size:1rem;color:#493e50}
.relationship-ai-scenarios p{display:grid;grid-template-columns:25px 1fr;gap:9px;align-items:start;margin:0;padding:9px 0;border-bottom:1px solid rgba(128,112,148,.08);font-size:.9rem;line-height:1.72;color:#615868}
.relationship-ai-scenarios p:last-child{border-bottom:0;padding-bottom:0}.relationship-ai-scenarios p span{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:rgba(225,216,244,.7);font-size:.68rem;font-weight:800;color:#75648b}
.relationship-ai-grid article strong{display:block;margin-bottom:2px}.relationship-ai-grid article p{max-width:42rem}
@media(max-width:430px){.relationship-ai-scenarios{padding:14px}.relationship-ai-scenarios p{font-size:.88rem}}
'''
css.write_text(c)
