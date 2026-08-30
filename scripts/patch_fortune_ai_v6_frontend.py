from pathlib import Path

# Safe to rerun: apply the isolated v6 switch once, then become a no-op.
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
old_slug = "fortune-interpret-v5-preview"
new_slug = "fortune-interpret-v6-preview"
old_version = "interpreter_version: 'supabase-ai-v2-background-jobs',"
new_version = "interpreter_version: data.interpreter_version || 'supabase-ai-v6-exact-jie-suriyayat-safe',"

count = s.count(old_slug)
if count == 0:
    if new_slug not in s or new_version not in s:
        raise SystemExit('v5 is absent but the verified v6 frontend markers are incomplete')
    print('PATCH_FORTUNE_AI_V6_FRONTEND_ALREADY_APPLIED')
    raise SystemExit(0)
if count < 2:
    raise SystemExit(f'partial old fortune AI references found: {count}')
if old_version not in s:
    raise SystemExit('old AI interpreter version marker not found')

s = s.replace(old_slug, new_slug)
s = s.replace(old_version, new_version)
if old_slug in s:
    raise SystemExit('old v5 fortune AI slug survived')
if new_slug not in s or new_version not in s:
    raise SystemExit('verified v6 frontend markers missing after patch')

p.write_text(s, encoding='utf-8')
print('PATCH_FORTUNE_AI_V6_FRONTEND_APPLIED', count)
