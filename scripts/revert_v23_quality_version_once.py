from pathlib import Path
p = Path('supabase/functions/fortune-interpret-v6-preview/qualityV2.ts')
text = p.read_text(encoding='utf-8')
old = 'export const QUALITY_VERSION = "fortune-interpretation-quality-v5.1-v23-timing-repair";'
new = 'export const QUALITY_VERSION = "fortune-interpretation-quality-v5-adaptive-length";'
if old not in text and new not in text:
    raise SystemExit('quality version marker not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
