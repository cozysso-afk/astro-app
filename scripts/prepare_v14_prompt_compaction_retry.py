from pathlib import Path

old = 'relationship-v11\\.5-reunion-dimensions'
new = 'relationship-v11\\.6-reunion-compact-evidence'

for filename in (
    'web/src/lib/relationshipModeContract.test.mjs',
    'web/src/lib/relationshipEvidencePipeline.test.mjs',
):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 2:
        raise SystemExit(f'{filename}: expected exactly two V14 cache-version regexes, got {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'normalized one of two cache-version regexes in {filename}')
