from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
text = INDEX.read_text()
old = 'const VERSION="supabase-ai-v23.2-editorial-polish";'
new = 'const VERSION="supabase-ai-v23.3-editorial-flow";'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('V23 runtime version anchor missing')
INDEX.write_text(text)
