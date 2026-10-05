from pathlib import Path

path=Path('supabase/functions/fortune-interpret-v6-preview/qualityV2.ts')
s=path.read_text(encoding='utf-8')
old='fortune-interpretation-quality-v6.1-no-padding-gates'
new='fortune-interpretation-quality-v7-no-padding-gates'
assert old in s, 'old Quality version not found'
path.write_text(s.replace(old,new,1),encoding='utf-8')
