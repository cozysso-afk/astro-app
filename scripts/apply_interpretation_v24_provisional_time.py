from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    if new in text:
        return False
    if old not in text:
        raise SystemExit(f'{label}: expected source not found')
    path.write_text(text.replace(old, new, 1))
    return True

# Preserve reliability metadata on aspects so presentation can explain, not erase,
# entered estimated-time evidence.
app_types = ROOT / 'web/src/appTypes.ts'
replace_once(
    app_types,
    """export type Aspect = {\n  a: string\n  aspect: string\n  b: string\n  orb: number\n  tone: 'supportive' | 'challenging' | 'mixed'\n  layer?: string\n}\n""",
    """export type Aspect = {\n  a: string\n  aspect: string\n  b: string\n  orb: number\n  tone: 'supportive' | 'challenging' | 'mixed'\n  layer?: string\n  orb_grade?: string | null\n  time_sensitivity?: string | null\n  evidence_confidence?: string | null\n  birth_time_dependency?: boolean | null\n  layer_priority?: number | null\n  event_probability?: string | null\n}\n""",
    'Aspect reliability metadata',
)

summary = ROOT / 'web/src/lib/relationshipUserSummary.ts'
replace_once(
    summary,
    "const PLANETS: Record<string, string> = { Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성', Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성', 'True Node': '교점', 'North Node': '교점' }",
    "const PLANETS: Record<string, string> = { Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성', Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성', 'True Node': '교점', 'North Node': '교점', ASC: '상승점', DSC: '하강점', MC: '중천', IC: '천저', Vertex: '버텍스' }",
    'angle point display labels',
)

text = summary.read_text()
if 'angleTimeAvailable?: boolean' not in text:
    text = text.replace(
        "export function rankRelationshipAspects(aspects: Aspect[], partnerExact: boolean, sensitive: ReadonlySet<string> = SENSITIVE) {",
        "export function rankRelationshipAspects(aspects: Aspect[], partnerExact: boolean, sensitive: ReadonlySet<string> = SENSITIVE, angleTimeAvailable = partnerExact) {",
        1,
    )
    text = text.replace(
        "if (!partnerExact && [aspect.a, aspect.b].some(p => SENSITIVE.has(p) || sensitive.has(p))) return false",
        "if (!angleTimeAvailable && [aspect.a, aspect.b].some(p => SENSITIVE.has(p) || sensitive.has(p))) return false",
        1,
    )
    text = text.replace(
        "export function buildRelationshipUserSummary(input: { aspects: Aspect[]; partnerExact: boolean; sensitive?: ReadonlySet<string>; timing?: ReunionTimingContext | null; mode: RelationshipAnalysisMode }) {\n  const ranked = rankRelationshipAspects(input.aspects, input.partnerExact, input.sensitive)\n  const individualPatterns = ranked.filter(a => !(OUTER.has(a.a) && OUTER.has(a.b))).map(pattern).map(p => {",
        "export function buildRelationshipUserSummary(input: { aspects: Aspect[]; partnerExact: boolean; angleTimeAvailable?: boolean; sensitive?: ReadonlySet<string>; timing?: ReunionTimingContext | null; mode: RelationshipAnalysisMode }) {\n  const angleTimeAvailable = input.angleTimeAvailable ?? input.partnerExact\n  const ranked = rankRelationshipAspects(input.aspects, input.partnerExact, input.sensitive, angleTimeAvailable)\n  const individualPatterns = ranked.filter(a => !(OUTER.has(a.a) && OUTER.has(a.b))).map(a => {\n    const p = pattern(a)\n    const provisionalSensitive = !input.partnerExact && angleTimeAvailable && [a.a, a.b].some(point => SENSITIVE.has(point) || input.sensitive?.has(point))\n    return provisionalSensitive ? { ...p, reason: `${p.reason} 입력한 추정 생시 기준으로 보이는 시간 민감 근거라 실제 생시가 달라지면 하우스·각도나 오브가 움직일 수 있어.` } : p\n  }).map(p => {",
        1,
    )
    if 'const angleTimeAvailable = input.angleTimeAvailable' not in text:
        raise SystemExit('relationship summary signature patch failed')

if 'const timePrecisionNote =' not in text:
    old = """  const practical = marriage
    ? negativeStructure ? '한 사람이 집안일과 책임을 떠안지 않도록 분담 범위와 쉴 시간을 구체적으로 정해봐.' : '함께 쓰는 돈과 혼자 보내는 시간, 집안일을 어떻게 나눌지 이야기해봐.'
    : friction.some(p => p.role === 'communication') ? '말이 엇갈릴 때 바로 결론 내리지 말고, 각자 받아들인 뜻을 한 번씩 말해봐.' : '편안한 연락 빈도와 함께 보내고 싶은 시간을 서로 맞춰봐.'
  return { mode: input.mode,"""
    new = """  const practical = marriage
    ? negativeStructure ? '한 사람이 집안일과 책임을 떠안지 않도록 분담 범위와 쉴 시간을 구체적으로 정해봐.' : '함께 쓰는 돈과 혼자 보내는 시간, 집안일을 어떻게 나눌지 이야기해봐.'
    : friction.some(p => p.role === 'communication') ? '말이 엇갈릴 때 바로 결론 내리지 말고, 각자 받아들인 뜻을 한 번씩 말해봐.' : '편안한 연락 빈도와 함께 보내고 싶은 시간을 서로 맞춰봐.'
  const timePrecisionNote = !input.partnerExact && angleTimeAvailable
    ? '입력한 추정 생시를 기준으로 하우스와 각도까지 읽었어. 주변 생시에서 달라질 수 있는 시간 민감 근거는 확정값이 아니라 참고 범위로 봐줘.'
    : ''
  return { mode: input.mode,"""
    if old not in text:
        raise SystemExit('practical block not found')
    text = text.replace(old, new, 1)
    text = text.replace(
        "friction, patterns: patterns.filter(p => !friction.some(f => f.key === p.key)), ranked }",
        "friction, patterns: patterns.filter(p => !friction.some(f => f.key === p.key)), ranked, timePrecisionNote }",
        1,
    )
summary.write_text(text)

panel = ROOT / 'web/src/RelationshipInterpretationPanel.tsx'
text = panel.read_text()
if 'angleTimeAvailable' not in text.split('}) {', 1)[0]:
    old = "export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, returnSupport, hierarchy, technicalDetails }: {\n  sajuContext?: Record<string, unknown>;\n  aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;"
    new = "export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, angleTimeAvailable, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, returnSupport, hierarchy, technicalDetails }: {\n  sajuContext?: Record<string, unknown>;\n  aspects: Aspect[]; partnerExact: boolean; angleTimeAvailable?: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;"
    if old not in text:
        raise SystemExit('panel props source not found')
    text = text.replace(old, new, 1)
    old_call = "const view = buildRelationshipUserSummary({ aspects, partnerExact, mode: analysisMode, sensitive: timeSensitivePoints, timing: reunion ? timing : null })"
    new_call = "const view = buildRelationshipUserSummary({ aspects, partnerExact, angleTimeAvailable, mode: analysisMode, sensitive: timeSensitivePoints, timing: reunion ? timing : null })"
    if old_call not in text:
        raise SystemExit('panel summary call not found')
    text = text.replace(old_call, new_call, 1)
if '{view.timePrecisionNote&&' not in text:
    hero = "</p></header>\n    <div className=\"reading-export-toolbar\""
    hero_new = "</p>{view.timePrecisionNote&&<p className=\"reading-precision-note\">{view.timePrecisionNote}</p>}</header>\n    <div className=\"reading-export-toolbar\""
    if hero not in text:
        raise SystemExit('panel hero insertion point not found')
    text = text.replace(hero, hero_new, 1)
panel.write_text(text)

app = ROOT / 'web/src/AppNext.tsx'
text = app.read_text()
needle = "<RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi}"
if 'angleTimeAvailable=' not in text:
    replacement = "<RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} angleTimeAvailable={Boolean(relationshipResult.result.natal_synastry?.user_time_available && relationshipResult.result.natal_synastry?.partner_time_available)} ai={relationshipAi}"
    if needle not in text:
        raise SystemExit('AppNext relationship panel call not found')
    app.write_text(text.replace(needle, replacement, 1))

# Replace the old exact-or-nothing UI contract with the actual product contract:
# entered estimated time is readable; completely unknown time is still excluded.
test_path = ROOT / 'web/src/lib/readingExperience.test.mjs'
test = test_path.read_text()
old_test = """test('entered provisional time keeps Moon but excludes exact-only angle aspects from compact fallback', () => {\n  const unsafe=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]\n  const view=buildRelationshipUserSummary({aspects:unsafe,partnerExact:false,mode:'reunion'})\n  assert.ok(view.ranked.some(a=>a.a==='Moon'))\n  assert.ok(view.ranked.every(a=>a.a!=='ASC'))\n  assert.equal(view.incoming.band,'정보 부족')\n  assert.equal(view.outgoing.band,'정보 부족')\n  assert.equal(view.windows.length,0)\n})"""
new_test = """test('entered provisional time keeps angle evidence with an explicit sensitivity caveat', () => {\n  const provisional=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed',time_sensitivity:'fragile',evidence_confidence:'low'}]\n  const view=buildRelationshipUserSummary({aspects:provisional,partnerExact:false,angleTimeAvailable:true,mode:'reunion'})\n  assert.ok(view.ranked.some(a=>a.a==='Moon'))\n  assert.ok(view.ranked.some(a=>a.a==='ASC'))\n  assert.match(view.timePrecisionNote,/입력한 추정 생시/)\n  assert.match(view.timePrecisionNote,/하우스와 각도까지 읽었어/)\n  assert.equal(view.incoming.band,'정보 부족')\n  assert.equal(view.outgoing.band,'정보 부족')\n  assert.equal(view.windows.length,0)\n})\n\ntest('completely unknown time still excludes angle-dependent compact evidence', () => {\n  const unknown=[...aspects,{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]\n  const view=buildRelationshipUserSummary({aspects:unknown,partnerExact:false,angleTimeAvailable:false,mode:'reunion'})\n  assert.ok(view.ranked.every(a=>a.a!=='ASC'))\n  assert.equal(view.timePrecisionNote,'')\n})"""
if new_test not in test:
    if old_test not in test:
        raise SystemExit('old provisional-time test not found')
    test_path.write_text(test.replace(old_test, new_test, 1))

print('provisional-time interpretation patch applied')
