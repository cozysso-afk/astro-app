from pathlib import Path

p = Path('supabase/functions/fortune-interpret-v23-preview/periodNarrativeV23.ts')
text = p.read_text(encoding='utf-8')
old = """    if (cluster.distinct_dates === 1) score -= 12\n    if (cluster.role === 'trigger' && cluster.distinct_dates <= 1) score -= 10\n"""
new = """    // Keep a one-day trigger available as a weekly turning point, but below\n    // genuinely multi-day movement. This preserves direct evidence without\n    // letting one day become the whole weekly narrative.\n    if (cluster.distinct_dates === 1) score -= 4\n    if (cluster.role === 'trigger' && cluster.distinct_dates <= 1) score -= 4\n"""
if old not in text:
    raise SystemExit('weekly trigger penalty block not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
