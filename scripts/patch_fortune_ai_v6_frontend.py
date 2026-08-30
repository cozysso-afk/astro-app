from pathlib import Path

# One-shot verified switch for the isolated work branch.
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
old_slug = "fortune-interpret-v5-preview"
new_slug = "fortune-interpret-v6-preview"
count = s.count(old_slug)
if count < 2:
    raise SystemExit(f'expected at least 2 old fortune AI slug references, found {count}')
s = s.replace(old_slug, new_slug)
old_version = "interpreter_version: 'supabase-ai-v2-background-jobs',"
new_version = "interpreter_version: data.interpreter_version || 'supabase-ai-v6-exact-jie-suriyayat-safe',"
if old_version not in s:
    raise SystemExit('old AI interpreter version marker not found')
s = s.replace(old_version, new_version)
if old_slug in s:
    raise SystemExit('old v5 fortune AI slug survived')
if new_slug not in s:
    raise SystemExit('new v6 fortune AI slug missing')
p.write_text(s, encoding='utf-8')
print('PATCH_FORTUNE_AI_V6_FRONTEND_APPLIED', count)
