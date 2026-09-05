from pathlib import Path

path = Path('web/src/lib/relationshipModeContract.test.mjs')
text = path.read_text(encoding='utf-8')
old = 'relationship-v11\\.5-reunion-dimensions'
new = 'relationship-v11\\.6-reunion-compact-evidence'
count = text.count(old)
if count != 2:
    raise SystemExit(f'expected exactly two V14 cache-version regexes, got {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('normalized one of two relationshipModeContract cache-version regexes')
