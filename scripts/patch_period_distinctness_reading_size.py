from pathlib import Path

# 1) Make day/week narrative planning materially different, not just differently worded.
p = Path('supabase/functions/fortune-interpret-v23-preview/periodNarrativeV23.ts')
text = p.read_text(encoding='utf-8')
text = text.replace("export const PERIOD_NARRATIVE_VERSION = 'fortune-period-narrative-v23.0'", "export const PERIOD_NARRATIVE_VERSION = 'fortune-period-narrative-v23.1-distinct-period-shapes'", 1)
text = text.replace("  forbidden: string[]\n  granularity: string\n}>", "  forbidden: string[]\n  distinctive_requirements: string[]\n  granularity: string\n}>", 1)
repls = {
"    forbidden: ['주간·월간·연간 일반론', '기간 평균을 본문 중심으로 반복', '오늘 근거 없이 장기 추세를 확대'],\n    granularity: 'hours-and-one-day',": "    forbidden: ['주간·월간·연간 일반론', '기간 평균을 본문 중심으로 반복', '오늘 근거 없이 장기 추세를 확대'],\n    distinctive_requirements: [\n      '헤드라인과 첫 문단은 오늘만의 촉발 또는 당일 직접 근거를 중심으로 쓴다.',\n      '초반·중반·후반 같은 주간 구조를 만들지 않는다.',\n      '행동은 오늘 바로 확인하거나 조정할 수 있는 한 가지 구체 행동으로 끝낸다.',\n    ],\n    granularity: 'hours-and-one-day',",
"    forbidden: ['날짜별 독립 운세 나열', '월간·연간 구조적 결론', '같은 행동문구 반복'],\n    granularity: 'early-mid-late-week',": "    forbidden: ['날짜별 독립 운세 나열', '월간·연간 구조적 결론', '같은 행동문구 반복'],\n    distinctive_requirements: [\n      '헤드라인은 특정 하루의 촉발보다 7일간의 이동·누적·전환을 요약한다.',\n      '가능하면 서로 다른 날짜 2개 이상을 연결해 초반→중반→후반의 변화를 설명한다.',\n      '오늘 운세처럼 즉시 행동 한 줄로 끝내지 말고 이번 주에 유지하거나 조정할 패턴을 제시한다.',\n    ],\n    granularity: 'early-mid-late-week',",
"    forbidden: ['일일 시간창을 중심축으로 사용', '한 날짜만으로 월 전체를 대표', '주간 문구를 기간만 늘려 재사용'],\n    granularity: 'early-mid-late-month',": "    forbidden: ['일일 시간창을 중심축으로 사용', '한 날짜만으로 월 전체를 대표', '주간 문구를 기간만 늘려 재사용'],\n    distinctive_requirements: [\n      '반복되는 패턴과 월중 방향 전환을 중심으로 쓰고 단일 하루의 분위기를 월 전체 결론으로 확대하지 않는다.',\n      '월초·중순·월말 가운데 실제 근거가 있는 구간만 연결한다.',\n    ],\n    granularity: 'early-mid-late-month',",
"    forbidden: ['좋은 날짜 TOP 목록을 본문 중심으로 사용', '일일 행동문구를 연간 조언으로 확대', '짧은 접촉을 연중 지속으로 추정'],\n    granularity: 'quarters-and-months',": "    forbidden: ['좋은 날짜 TOP 목록을 본문 중심으로 사용', '일일 행동문구를 연간 조언으로 확대', '짧은 접촉을 연중 지속으로 추정'],\n    distinctive_requirements: [\n      '장기 배경과 분기별 전환을 먼저 설명하고 특정 하루는 보조 근거로만 쓴다.',\n      '연간 조언은 한 해 동안 반복해서 확인할 기준으로 작성한다.',\n    ],\n    granularity: 'quarters-and-months',",
}
for before, after in repls.items():
    if before not in text:
        raise SystemExit(f'period contract block not found: {before[:80]}')
    text = text.replace(before, after, 1)
old_score = """  if (kind === 'day') {\n    if (cluster.role === 'trigger') score += 16\n    if (cluster.distinct_dates > 2) score -= 5\n  } else if (kind === 'week') {\n    if (cluster.distinct_dates >= 2 && cluster.distinct_dates <= 7) score += 10\n    if (cluster.role === 'tension') score += 4\n"""
new_score = """  if (kind === 'day') {\n    // A day reading should be dominated by one-day triggers, not the same\n    // multi-day background that will also lead the weekly reading.\n    if (cluster.role === 'trigger') score += 28\n    if (cluster.distinct_dates === 1) score += 18\n    if (cluster.role === 'background') score -= 18\n    if (cluster.distinct_dates >= 3) score -= 22\n  } else if (kind === 'week') {\n    // A week reading should prefer movement across several dates. A single-day\n    // trigger can still appear as a turning point, but it must not own the week.\n    if (cluster.distinct_dates >= 2 && cluster.distinct_dates <= 7) score += 18\n    if (cluster.role === 'background') score += 4\n    if (cluster.role === 'tension') score += 6\n    if (cluster.distinct_dates === 1) score -= 12\n    if (cluster.role === 'trigger' && cluster.distinct_dates <= 1) score -= 10\n"""
if old_score not in text:
    raise SystemExit('period-specific score block not found')
text = text.replace(old_score, new_score, 1)
old_ctx = """    required_sequence: contract.sequence,\n    evidence_priority: contract.evidence_priority,\n    forbidden_patterns: contract.forbidden,\n    phenomena: selectNarrativePhenomena(payload),\n"""
new_ctx = """    required_sequence: contract.sequence,\n    evidence_priority: contract.evidence_priority,\n    forbidden_patterns: contract.forbidden,\n    distinctive_requirements: contract.distinctive_requirements,\n    phenomena: selectNarrativePhenomena(payload),\n"""
if old_ctx not in text:
    raise SystemExit('period narrative context block not found')
text = text.replace(old_ctx, new_ctx, 1)
old_instruction = """[근거 우선순위]\\n${ctx.evidence_priority.map(x => `- ${x}`).join('\\n')}\\n\\n[금지]\\n${ctx.forbidden_patterns.map(x => `- ${x}`).join('\\n')}\\n\\n[핵심 현상 묶음]"""
new_instruction = """[근거 우선순위]\\n${ctx.evidence_priority.map(x => `- ${x}`).join('\\n')}\\n\\n[기간 차별화 필수]\\n${ctx.distinctive_requirements.map(x => `- ${x}`).join('\\n')}\\n\\n[금지]\\n${ctx.forbidden_patterns.map(x => `- ${x}`).join('\\n')}\\n\\n[핵심 현상 묶음]"""
if old_instruction not in text:
    raise SystemExit('period instruction insertion point not found')
text = text.replace(old_instruction, new_instruction, 1)
p.write_text(text, encoding='utf-8')

# 2) Give the rendered reading a period class so mobile typography can be scoped.
p = Path('web/src/PeriodFortuneResults.tsx')
text = p.read_text(encoding='utf-8')
old = '  return <div className="fortune-experience">'
new = '  return <div className={`fortune-experience period-${period}`}> '
if old not in text:
    raise SystemExit('fortune-experience wrapper not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 3) Increase only month/year long-form mobile prose. Keep day/week and score cards unchanged.
p = Path('web/src/reading-font-fix-v54.css')
text = p.read_text(encoding='utf-8')
append = r'''

/* V59 · month/year long-form reading legibility
 * Longer monthly and annual prose was still inheriting 13–14px body sizes.
 * Scope the larger type to the integrated month/year reading only.
 */
@media (max-width: 600px) {
  html body #root .app-shell .fortune-experience.period-month .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .period-ai-head .reading-hero-subtitle,
  html body #root .app-shell .fortune-experience.period-year .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .period-ai-head .reading-hero-subtitle {
    font-size: 16px !important;
    line-height: 1.84 !important;
  }

  html body #root .app-shell .fortune-experience.period-month .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .period-ai-user-focus .period-ai-topic p,
  html body #root .app-shell .fortune-experience.period-year .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .period-ai-user-focus .period-ai-topic p,
  html body #root .app-shell .fortune-experience.period-month .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .reading-explanation > p,
  html body #root .app-shell .fortune-experience.period-year .system-reading.system-integrated
  .period-ai-card.period-ai-v18 .reading-explanation > p {
    font-size: 15.5px !important;
    line-height: 1.82 !important;
  }
}
'''
if 'V59 · month/year long-form reading legibility' in text:
    raise SystemExit('V59 typography patch already present')
p.write_text(text.rstrip() + append, encoding='utf-8')

# 4) Regression: day and week must prioritize different phenomenon shapes.
p = Path('supabase/functions/fortune-interpret-v23-preview/promptV23.test.mjs')
text = p.read_text(encoding='utf-8')
append = r'''

test('day prioritizes a one-day trigger while week prioritizes a multi-day pattern', () => {
  const base = payload('week')
  base.evidence_ledger = [
    {
      id: 'W:day:1', system: 'western', topic: '직업', scope: 'daily_actual', date: '2026-09-14',
      direction: 'caution', text: 'Mars square Saturn',
      observation: { transit: 'Mars', target: 'Saturn', aspect: 'square' },
    },
    ...['2026-09-14','2026-09-16','2026-09-18'].map((date,index)=>({
      id: `W:week:${index+1}`, system: 'western', topic: '대인관계', scope: 'daily_actual', date,
      direction: 'supportive', text: 'Jupiter trine Sun',
      observation: { transit: 'Jupiter', target: 'Sun', aspect: 'trine' },
    })),
  ]
  const day = buildV23CorePrompt({...base,period_kind:'day'})
  const week = buildV23CorePrompt({...base,period_kind:'week'})
  assert.match(day.packet.period_narrative.phenomena[0].label, /Mars square Saturn/)
  assert.match(week.packet.period_narrative.phenomena[0].label, /Jupiter trine Sun/)
  assert.match(day.text, /오늘만의 촉발/)
  assert.match(week.text, /초반→중반→후반/)
})
'''
if 'day prioritizes a one-day trigger while week prioritizes a multi-day pattern' in text:
    raise SystemExit('V23 distinctness test already present')
p.write_text(text.rstrip() + append, encoding='utf-8')

# 5) Regression for scoped month/year typography and period class.
p = Path('web/src/lib/periodLongformLegibility.test.mjs')
p.write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const results = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')

test('fortune reading surface exposes its selected period as a class', () => {
  assert.match(results, /fortune-experience period-\$\{period\}/)
})

test('mobile month and year long-form prose is larger without changing day/week', () => {
  assert.match(css, /fortune-experience\.period-month[\s\S]*reading-hero-subtitle[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /fortune-experience\.period-year[\s\S]*reading-hero-subtitle[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /fortune-experience\.period-month[\s\S]*reading-explanation > p[\s\S]*font-size:\s*15\.5px\s*!important/)
  assert.doesNotMatch(css, /fortune-experience\.period-(?:today|week)[\s\S]*font-size:\s*16px\s*!important/)
})
''', encoding='utf-8')
