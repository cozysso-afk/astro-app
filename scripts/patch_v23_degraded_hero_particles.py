from pathlib import Path

# 1) Add a display-only eligibility helper. Strict quality validation remains unchanged.
p = Path('web/src/lib/interpretationTopics.ts')
text = p.read_text(encoding='utf-8')
needle = '''export function interpretationQualityPassed(validation?: {score?:number; stages?:Array<{passed?:boolean}>} | null): boolean {\n  if (!validation || validation.stages?.some(stage => stage.passed !== true)) return false\n  return validation.score === 100 || Boolean(validation.stages?.length && validation.stages.every(stage => stage.passed === true))\n}\n'''
replacement = needle + '''\n/**\n * A V23 timing-repaired reading may safely expose its generated narrative even\n * when stage 5 (depth/practicality) is the only failed stage. This does not\n * relax backend acceptance or evidence rules; it only prevents the frontend\n * from replacing an already accepted V23 narrative with generic score copy.\n */\nexport function interpretationHeroEligible(\n  validation?: {score?:number; stages?:Array<{stage?:number; passed?:boolean}>} | null,\n  usage?: {degraded_quality?:boolean; local_quality_fallback?:boolean; quality_warning?:string|null; cost_guard_version?:string} | null,\n): boolean {\n  if (interpretationQualityPassed(validation)) return !usage?.degraded_quality\n  if (!usage?.degraded_quality || usage?.local_quality_fallback) return false\n  if (!String(usage?.cost_guard_version ?? '').startsWith('supabase-ai-v23')) return false\n  if (!/직접 근거가 없는 날짜·구간만 로컬에서 제거/.test(String(usage?.quality_warning ?? ''))) return false\n  const stages = validation?.stages ?? []\n  if (stages.length < 5) return false\n  let sawDepthStage = false\n  for (const stage of stages) {\n    if (stage.stage === 5) { sawDepthStage = true; if (stage.passed !== false) return false; continue }\n    if (stage.stage != null && stage.stage >= 1 && stage.stage <= 4 && stage.passed !== true) return false\n  }\n  return sawDepthStage\n}\n'''
if needle not in text:
    raise SystemExit('interpretationTopics quality block not found')
p.write_text(text.replace(needle, replacement, 1), encoding='utf-8')

# 2) Use the display-only helper for the integrated hero.
p = Path('web/src/PeriodAiInterpretationPanel.tsx')
text = p.read_text(encoding='utf-8')
old_import = "import { normalizeTopicEntries, interpretationQualityPassed } from './lib/interpretationTopics'"
new_import = "import { normalizeTopicEntries, interpretationHeroEligible, interpretationQualityPassed } from './lib/interpretationTopics'"
if old_import not in text:
    raise SystemExit('PeriodAi import not found')
text = text.replace(old_import, new_import, 1)
old_line = "  const verifiedNarrative = !westernOnly && result.model !== 'deterministic-provisional-v2' && !result.usage?.local_quality_fallback && !result.usage?.degraded_quality && interpretationQualityPassed(narrativeValidation)"
new_line = "  const verifiedNarrative = !westernOnly && result.model !== 'deterministic-provisional-v2' && !result.usage?.local_quality_fallback && interpretationHeroEligible(narrativeValidation, result.usage)"
if old_line not in text:
    raise SystemExit('verifiedNarrative line not found')
text = text.replace(old_line, new_line, 1)
p.write_text(text, encoding='utf-8')

# 3) Fix Korean particles in independent Western headings (e.g. 올해는, 금전 관리가).
p = Path('web/src/SystemReadingViews.tsx')
text = p.read_text(encoding='utf-8')
old = '''function westernWhen(dayCount:number) {\n  if (dayCount <= 1) return '오늘'\n  if (dayCount <= 9) return '이번 주'\n  if (dayCount <= 45) return '이번 달'\n  return '올해'\n}\nfunction westernHeadline(rows:Array<[string,FortuneStat]>, when:string) {\n'''
new = '''function westernWhen(dayCount:number) {\n  if (dayCount <= 1) return '오늘'\n  if (dayCount <= 9) return '이번 주'\n  if (dayCount <= 45) return '이번 달'\n  return '올해'\n}\nfunction koreanParticle(text:string, pair:'은는'|'이가') {\n  const clean = String(text ?? '').trim()\n  const last = clean.charAt(clean.length - 1)\n  const code = last.charCodeAt(0)\n  const hasFinal = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0\n  return `${clean}${pair === '은는' ? (hasFinal ? '은' : '는') : (hasFinal ? '이' : '가')}`\n}\nfunction westernHeadline(rows:Array<[string,FortuneStat]>, when:string) {\n'''
if old not in text:
    raise SystemExit('westernWhen block not found')
text = text.replace(old, new, 1)
repls = {
    "return `${when}은 비교할 수 있는 서양점성술 분야 점수가 없어.`": "return `${koreanParticle(when,'은는')} 비교할 수 있는 서양점성술 분야 점수가 없어.`",
    "return `${when}은 ${strongLabel} 쪽이 상대적으로 더 살아 있어. 반대로 ${weakLabel}은 힘이 덜 실리니, ${westernGuidance(weakest[0],weakest[1])}`": "return `${koreanParticle(when,'은는')} ${strongLabel} 쪽이 상대적으로 더 살아 있어. 반대로 ${koreanParticle(weakLabel,'은는')} 힘이 덜 실리니, ${westernGuidance(weakest[0],weakest[1])}`",
    "return `${when}은 ${strongLabel}이 가장 눈에 띄지만 분야 간 차이가 크진 않아. ${westernGuidance(strongest[0],strongest[1])}`": "return `${koreanParticle(when,'은는')} ${koreanParticle(strongLabel,'이가')} 가장 눈에 띄지만 분야 간 차이가 크진 않아. ${westernGuidance(strongest[0],strongest[1])}`",
    "if (strongest[0]===weakest[0]) return `${when}은 ${WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]} 흐름을 중심으로 보면 돼.`": "if (strongest[0]===weakest[0]) return `${koreanParticle(when,'은는')} ${WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]} 흐름을 중심으로 보면 돼.`",
    "return `${when}은 ${WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]}이 상대적으로 강하고, ${WESTERN_HEADLINE_LABEL[weakest[0]]??weakest[0]}은 약한 편이야.`": "return `${koreanParticle(when,'은는')} ${koreanParticle(WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0],'이가')} 상대적으로 강하고, ${koreanParticle(WESTERN_HEADLINE_LABEL[weakest[0]]??weakest[0],'은는')} 약한 편이야.`",
}
for before, after in repls.items():
    if before not in text:
        raise SystemExit(f'particle replacement not found: {before[:70]}')
    text = text.replace(before, after, 1)
p.write_text(text, encoding='utf-8')

# 4) Add regression coverage to an already-run web contract test.
p = Path('web/src/lib/interpretationUiContract.test.mjs')
text = p.read_text(encoding='utf-8')
import_needle = "import { normalizeTopicEntries } from './interpretationTopics.ts'"
import_repl = "import { interpretationHeroEligible, normalizeTopicEntries } from './interpretationTopics.ts'"
if import_needle not in text:
    raise SystemExit('UI test import not found')
text = text.replace(import_needle, import_repl, 1)
const_needle = "const period = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')"
const_repl = const_needle + "\nconst systemViews = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')"
if const_needle not in text:
    raise SystemExit('UI test period const not found')
text = text.replace(const_needle, const_repl, 1)
append = r'''

test('V23 timing-repaired narrative can remain visible without relaxing strict quality pass', () => {
  const validation = {score:80,stages:[1,2,3,4,5].map(stage=>({stage,passed:stage!==5}))}
  const repaired = {
    degraded_quality:true,
    local_quality_fallback:false,
    cost_guard_version:'supabase-ai-v23.0-phenomenon-first',
    quality_warning:'직접 근거가 없는 날짜·구간만 로컬에서 제거했고 구조·근거·의미 방향·일관성은 통과했어. 같은 결과를 고치려고 Gemini를 한 번 더 호출하지 않아.',
  }
  assert.equal(interpretationHeroEligible(validation,repaired),true)
  assert.equal(interpretationHeroEligible(validation,{...repaired,cost_guard_version:'supabase-ai-v21.4-e2e-evidence'}),false)
  assert.equal(interpretationHeroEligible(validation,{...repaired,quality_warning:'일반 degraded 결과'}),false)
  assert.equal(interpretationHeroEligible({score:80,stages:[1,2,3,4,5].map(stage=>({stage,passed:stage!==2&&stage!==5}))},repaired),false)
  assert.equal(interpretationHeroEligible({score:100,stages:[1,2,3,4,5].map(stage=>({stage,passed:true}))},{degraded_quality:false}),true)
})

test('independent Western period copy uses Korean particle selection instead of hard-coded 올해은', () => {
  assert.match(systemViews, /function koreanParticle/)
  assert.doesNotMatch(systemViews, /`\$\{when\}은/)
  assert.match(systemViews, /koreanParticle\(when,'은는'\)/)
})
'''
if "V23 timing-repaired narrative can remain visible" in text:
    raise SystemExit('tests already patched')
p.write_text(text + append, encoding='utf-8')
