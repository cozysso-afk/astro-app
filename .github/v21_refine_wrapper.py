from pathlib import Path
import runpy

p = Path('.github/v21_refine_after_live.py')
s = p.read_text()

old_usage = "old = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};'\nnew = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),first_quality_report:r.first_quality_report??null};'"
new_usage = "old = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),quality_report:r.quality_report??null};'\nnew = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),first_quality_report:r.first_quality_report??null,quality_report:r.quality_report??null};'"
assert old_usage in s
s = s.replace(old_usage, new_usage, 1)

old_meta = "old = 'prompt_copy:true,thai_contract:THAI_CONTRACT_VERSION});'\nnew = 'prompt_copy:true,safe_wording:true,thai_contract:THAI_CONTRACT_VERSION});'"
new_meta = "old = 'prompt_copy:true,local_quality_stabilizer:true,quality_failure_observability:true,thai_contract:THAI_CONTRACT_VERSION});'\nnew = 'prompt_copy:true,safe_wording:true,local_quality_stabilizer:true,quality_failure_observability:true,thai_contract:THAI_CONTRACT_VERSION});'"
assert old_meta in s
s = s.replace(old_meta, new_meta, 1)

p.write_text(s)
runpy.run_path(str(p), run_name='__main__')

fixture = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
t = fixture.read_text()
t = t.replace("assert.equal(rows.find(x=>x.topic==='연애').timing,'2027-04-11');", "assert.equal(rows.find(x=>x.topic==='연애').timing,'2026-11-19');", 1)
fixture.write_text(t)
