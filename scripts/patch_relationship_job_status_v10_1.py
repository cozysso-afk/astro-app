from pathlib import Path

edge_path = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s = edge_path.read_text(encoding='utf-8')
old = 'if(cached?.status==="pending")return respond({ok:false,inflight:true,cost_guard_blocked:true,error:"같은 관계 해설이 이미 생성 중이라 중복 Gemini 호출을 막았어."},200);'
new = 'if(cached?.status==="queued"||cached?.status==="running")return respond({ok:false,inflight:true,cost_guard_blocked:true,error:"같은 관계 해설이 이미 생성 중이라 중복 Gemini 호출을 막았어."},200);'
if s.count(old) != 1:
    raise SystemExit(f'inflight status anchor count={s.count(old)}')
s = s.replace(old, new, 1)
old_insert = 'status:"pending"'
if s.count(old_insert) != 1:
    raise SystemExit(f'pending insert anchor count={s.count(old_insert)}')
s = s.replace(old_insert, 'status:"queued"', 1)
edge_path.write_text(s, encoding='utf-8')

test_path = Path('supabase/functions/relationship-interpret-v9-preview/jobStatusContract.test.mjs')
test_path.write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('relationship cost-guard job states match ai_interpret_jobs database contract', () => {
  assert.match(source, /status:\"queued\"/)
  assert.match(source, /cached\?\.status===\"queued\"\|\|cached\?\.status===\"running\"/)
  assert.doesNotMatch(source, /status:\"pending\"/)
  assert.doesNotMatch(source, /cached\?\.status===\"pending\"/)
})
''', encoding='utf-8')
print('relationship job status V10.1 patch applied')
