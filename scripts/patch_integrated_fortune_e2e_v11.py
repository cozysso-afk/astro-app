from pathlib import Path
import re

# 1) Bump server interpretation contract so server-side caches cannot reuse the old evidence packet.
index_path = Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
s = index_path.read_text(encoding='utf-8')
old_version = 'const VERSION="supabase-ai-v21.3.3-no-zero-paid-fallback";'
new_version = 'const VERSION="supabase-ai-v21.4-e2e-evidence";'
if s.count(old_version) != 1:
    raise SystemExit(f'fortune VERSION anchor count={s.count(old_version)}')
s = s.replace(old_version, new_version, 1)
index_path.write_text(s, encoding='utf-8')

# 2) Keep the browser IndexedDB cache contract exactly aligned with the server interpreter contract.
cache_path = Path('web/src/lib/readingCache.ts')
s = cache_path.read_text(encoding='utf-8')
old_cache = "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21.3.2-relationship-direction-depth'"
new_cache = "const FORTUNE_AI_CACHE_CONTRACT = 'supabase-ai-v21.4-e2e-evidence'"
if s.count(old_cache) != 1:
    raise SystemExit(f'fortune cache anchor count={s.count(old_cache)}')
s = s.replace(old_cache, new_cache, 1)
cache_path.write_text(s, encoding='utf-8')

# 3) Preserve compact Saju baseline + every bounded monthly segment, and Thai rule/limitations.
cost_path = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
s = cost_path.read_text(encoding='utf-8')
compact_thai_anchor = 'function compactThai(thai:any){\n'
if s.count(compact_thai_anchor) != 1:
    raise SystemExit(f'compactThai anchor count={s.count(compact_thai_anchor)}')
compact_saju = '''function compactSaju(saju:any){
  if(!saju)return null;
  return {
    engine:saju?.engine,
    pillars:saju?.pillars??null,
    day_master:saju?.day_master??null,
    elements:saju?.elements??null,
    true_solar:saju?.true_solar??null,
    dayun:Array.isArray(saju?.dayun)?saju.dayun.slice(0,5):[],
    annual:Array.isArray(saju?.annual)?saju.annual:[],
    monthly:Array.isArray(saju?.monthly)?saju.monthly:[],
    pillar_boundary_policy:saju?.pillar_boundary_policy??null,
    yun_policy:saju?.yun_policy??null,
    not_calculated:Array.isArray(saju?.not_calculated)?saju.not_calculated.slice(0,8):[],
  };
}

'''
s = s.replace(compact_thai_anchor, compact_saju + compact_thai_anchor, 1)

old_thai_start = 'engine:thai?.engine,thai_day:thai?.thai_day,birth_planet:thai?.birth_planet??null,ruler:thai?.ruler,'
new_thai_start = 'engine:thai?.engine,thai_day:thai?.thai_day,birth_planet:thai?.birth_planet??null,ruler:thai?.ruler,rule:thai?.rule??null,'
if s.count(old_thai_start) != 1:
    raise SystemExit(f'Thai start anchor count={s.count(old_thai_start)}')
s = s.replace(old_thai_start, new_thai_start, 1)

thai_tail_pattern = re.compile(r'(predictive_status:thai\?\.predictive_status[^\n]*?consensus_policy:thai\?\.consensus_policy[^\n]*?reliability:thai\?\.reliability\?\?null)([^\n]*?\n\s*};)')
m = thai_tail_pattern.search(s)
if not m:
    raise SystemExit('Thai tail anchor not found')
if 'not_calculated:' not in m.group(0):
    replacement = m.group(1) + ',not_calculated:Array.isArray(thai?.not_calculated)?thai.not_calculated.slice(0,8):[]' + m.group(2)
    s = s[:m.start()] + replacement + s[m.end():]

pattern = re.compile(
    r'saju:\{engine:payload\?\.saju\?\.engine,day_master:payload\?\.saju\?\.day_master\?\?null,'
    r'annual:\(payload\?\.saju\?\.annual\?\?\[\]\)\.map\(\(x:any\)=>\(\{.*?\}\)\),'
    r'monthly:\(payload\?\.saju\?\.monthly\?\?\[\]\)\.filter\(\(x:any\)=>keyDates\.some\(\(k:any\)=>.*?\)\)\.map\(\(x:any\)=>\(\{.*?\}\)\)\},',
    re.S,
)
m = pattern.search(s)
if not m:
    raise SystemExit('inline V21 Saju packet anchor not found')
s = s[:m.start()] + 'saju:compactSaju(payload?.saju),' + s[m.end():]
cost_path.write_text(s, encoding='utf-8')

# 4) Strengthen the already-required V21 regression test; no workflow change needed.
test_path = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
s = test_path.read_text(encoding='utf-8')
old_assert = r'assert.match(src,/supabase-ai-v21\.3\.3-no-zero-paid-fallback/);'
new_assert = r'assert.match(src,/supabase-ai-v21\.4-e2e-evidence/);'
if s.count(old_assert) != 1:
    raise SystemExit(f'legacy version assertion count={s.count(old_assert)}')
s = s.replace(old_assert, new_assert, 1)
s = s.replace("test('V21.3.3 runtime preserves paid usage and exposes local fallback instead of zero content'", "test('V21/V11 runtime preserves paid usage and exposes local fallback instead of zero content'", 1)
append = r'''

test('V11 E2E prompt keeps complete bounded Saju baseline/months and Thai limitations',()=>{
  const p=packet();
  p.saju.pillars={year:'庚午',month:'戊子',day:'丙寅',hour:'甲午'};
  p.saju.elements={wood:2,fire:3,earth:1,metal:1,water:1};
  p.saju.true_solar={legal_local_time:'1990-01-01T12:00:00',true_solar_time:'1990-01-01T11:56:00',total_correction_minutes:-4};
  p.saju.dayun=Array.from({length:5},(_,i)=>({start_year:1995+i*10,end_year:2004+i*10,start_age:5+i*10,end_age:14+i*10,ganzhi:`D${i}`}));
  p.saju.monthly=Array.from({length:13},(_,i)=>({calendar_month:`2026-${String((i%12)+1).padStart(2,'0')}`,ganzhi:`M${i}`,stem_ten_god:'context',branch_links:[],segment_start:`2026-${String((i%12)+1).padStart(2,'0')}-01`,segment_end_exclusive:`2026-${String((i%12)+1).padStart(2,'0')}-28`,evidence_id:`S:month:${i+1}`}));
  p.saju.pillar_boundary_policy='absolute Jie for year/month; true-solar for day/hour';
  p.saju.yun_policy='bounded test policy';
  p.saju.not_calculated=['unsupported historic timezone inference'];
  p.thai.rule='06:00 traditional day boundary';
  p.thai.not_calculated=['research-only predictive route'];

  const compact=buildPromptPacket(p);
  assert.deepEqual(compact.saju.pillars,p.saju.pillars);
  assert.deepEqual(compact.saju.elements,p.saju.elements);
  assert.equal(compact.saju.dayun.length,5);
  assert.equal(compact.saju.annual.length,p.saju.annual.length);
  assert.equal(compact.saju.monthly.length,p.saju.monthly.length,'Saju months must not be filtered by Western key dates');
  assert.deepEqual(compact.saju.not_calculated,p.saju.not_calculated);
  assert.equal(compact.thai.rule,p.thai.rule);
  assert.deepEqual(compact.thai.not_calculated,p.thai.not_calculated);
  const budget=promptBudget(p);
  assert.equal(budget.ok,true,`expanded V11 evidence must remain inside ${budget.max_bytes} byte budget; got ${budget.bytes}`);
});

test('V11 server interpreter version and browser fortune AI cache contract stay identical',()=>{
  const runtime=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  const cache=fs.readFileSync(new URL('../../../web/src/lib/readingCache.ts',import.meta.url),'utf8');
  const runtimeVersion=runtime.match(/const VERSION=\"([^\"]+)\";/)?.[1];
  const cacheVersion=cache.match(/FORTUNE_AI_CACHE_CONTRACT = '([^']+)'/)?.[1];
  assert.ok(runtimeVersion);
  assert.equal(cacheVersion,runtimeVersion,'browser cache must break whenever the fortune interpreter contract changes');
});
'''
if "V11 E2E prompt keeps complete bounded Saju baseline/months" in s:
    raise SystemExit('V11 tests already present')
s += append
test_path.write_text(s, encoding='utf-8')

print('Integrated Fortune E2E V11 patch applied')
