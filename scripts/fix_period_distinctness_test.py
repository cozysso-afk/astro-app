from pathlib import Path

p = Path('supabase/functions/fortune-interpret-v23-preview/promptV23.test.mjs')
text = p.read_text(encoding='utf-8')
import_line = "import { buildV23CorePrompt } from './promptV23.ts'"
planner_import = "import { buildPeriodNarrativeInstruction, selectNarrativePhenomena } from './periodNarrativeV23.ts'"
if planner_import not in text:
    if import_line not in text:
        raise SystemExit('promptV23 test import not found')
    text = text.replace(import_line, import_line + '\n' + planner_import, 1)
old = r'''test('day prioritizes a one-day trigger while week prioritizes a multi-day pattern', () => {
  const base = payload('week')
  base.evidence_ledger = [
    {
      id: 'W:daily:직업:1', system: 'western', topic: '직업', scope: 'daily_actual', date: '2026-09-14',
      direction: 'caution', text: 'Mars square Saturn',
      observation: { transit: 'Mars', target: 'Saturn', aspect: 'square' },
    },
    ...['2026-09-14','2026-09-16','2026-09-18'].map((date,index)=>({
      id: `W:daily:대인관계:${index+2}`, system: 'western', topic: '대인관계', scope: 'daily_actual', date,
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
})'''
new = r'''test('day prioritizes a one-day trigger while week prioritizes a multi-day pattern', () => {
  const base = payload('week')
  base.evidence_ledger = [
    {
      id: 'W:daily:직업:1', system: 'western', topic: '직업', scope: 'daily_actual', date: '2026-09-14',
      direction: 'caution', text: 'Mars square Saturn',
      observation: { transit: 'Mars', target: 'Saturn', aspect: 'square' },
    },
    ...['2026-09-14','2026-09-16','2026-09-18'].map((date,index)=>({
      id: `W:daily:대인관계:${index+2}`, system: 'western', topic: '대인관계', scope: 'daily_actual', date,
      direction: 'supportive', text: 'Jupiter trine Sun',
      observation: { transit: 'Jupiter', target: 'Sun', aspect: 'trine' },
    })),
  ]
  const dayPayload = {...base,period_kind:'day'}
  const weekPayload = {...base,period_kind:'week'}
  const dayPhenomena = selectNarrativePhenomena(dayPayload)
  const weekPhenomena = selectNarrativePhenomena(weekPayload)
  assert.match(dayPhenomena[0].label, /Mars square Saturn/)
  assert.match(weekPhenomena[0].label, /Jupiter trine Sun/)
  assert.match(buildPeriodNarrativeInstruction(dayPayload), /오늘만의 촉발/)
  assert.match(buildPeriodNarrativeInstruction(weekPayload), /초반→중반→후반/)
})'''
if old not in text:
    raise SystemExit('old distinctness test block not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
