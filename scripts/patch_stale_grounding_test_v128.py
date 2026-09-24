from pathlib import Path

p=Path('supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.test.mjs')
s=p.read_text()
old="""test('deterministic claims fail closed instead of being displayed as calculation facts',()=>{\n  const x=reading(); x.headline='반드시 연락한다'\n  const out=repairReunionGroundingV2(x,payload)\n  assert.equal(out.ok,false)\n  assert.equal(out.reason,'unsupported_deterministic_claim')\n})\n"""
new="""test('deterministic claims are repaired before display while grounded content survives',()=>{\n  const x=reading(); x.headline='반드시 연락한다'\n  const out=repairReunionGroundingV2(x,payload)\n  assert.equal(out.ok,true)\n  assert.doesNotMatch(JSON.stringify(out.data),/반드시 연락한다/)\n  assert.match(out.data.headline,/확정할 수는 없지만/)\n})\n"""
if old not in s: raise SystemExit('stale deterministic-claim test block not found')
p.write_text(s.replace(old,new,1))

p=Path('web/src/lib/relationshipModeContract.test.mjs')
s=p.read_text()
old="assert.match(relationshipFn, /MAX_PROMPT_BYTES=180000,MAX_AI_JOB_ESTIMATED_KRW=300/)"
new="assert.match(relationshipFn, /MAX_PROMPT_BYTES=180000,REUNION_PROMPT_TARGET_BYTES=85000,MAX_AI_JOB_ESTIMATED_KRW=300/)"
if old not in s: raise SystemExit('stale prompt budget assertion not found')
p.write_text(s.replace(old,new,1))
print('stale grounding and budget contract tests aligned')
