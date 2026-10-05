from pathlib import Path

path=Path('.github/workflows/interpretation-v3-ci.yml')
s=path.read_text(encoding='utf-8')
anchor='          node --experimental-strip-types --test supabase/functions/fortune-interpret-v23-preview/proseOwnershipV23.contract.test.mjs\n'
line='          node --experimental-strip-types --test supabase/functions/fortune-interpret-v23-preview/proseGoldenRegressionV1.test.mjs\n'
assert anchor in s, 'prose ownership CI anchor missing'
assert line not in s, 'golden regression command already present'
path.write_text(s.replace(anchor,anchor+line,1),encoding='utf-8')
