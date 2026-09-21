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
new_test = """test('entered provisional time keeps angle evidence with an explicit sensitivity caveat', () => {\n  const provisional=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed',time_sensitivity:'fragile',evidence_confidence:'low'}]\n  const view=buildRelationshipUserSummary({aspects:provisional,partnerExact:false,angleTimeAvailable:true,mode:'reunion'})\n  assert.ok(view.ranked.some(a=>a.a==='Moon'))\n  assert.ok(view.ranked.some(a=>a.a==='ASC'))\n  assert.match(view.patterns.map(p=>p.reason).join(' '),/입력한 추정 생시 기준/)\n  assert.equal(view.incoming.band,'정보 부족')\n  assert.equal(view.outgoing.band,'정보 부족')\n  assert.equal(view.windows.length,0)\n})\n\ntest('completely unknown time still excludes angle-dependent compact evidence', () => {\n  const unknown=[...aspects,{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]\n  const view=buildRelationshipUserSummary({aspects:unknown,partnerExact:false,angleTimeAvailable:false,mode:'reunion'})\n  assert.ok(view.ranked.every(a=>a.a!=='ASC'))\n})"""
if new_test not in test:
    if old_test not in test:
        raise SystemExit('old provisional-time test not found')
    test_path.write_text(test.replace(old_test, new_test, 1))

print('provisional-time interpretation patch applied')
