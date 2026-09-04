from pathlib import Path

# Permanent full-mode static contract.
test_path=Path('web/src/lib/relationshipModeContract.test.mjs')
test_path.write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const personalPanel = readFileSync(new URL('../PersonalMarriagePanel.tsx', import.meta.url), 'utf8')
const cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')
const relationshipFn = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')
const personalEngine = readFileSync(new URL('../../../personal_marriage_v1.py', import.meta.url), 'utf8')

test('unmarried marriage splits no-counterpart personal fortune from specific-partner compatibility', () => {
  assert.match(app, /marriageScope.*'personal'.*'partner'/s)
  assert.match(app, /상대 없음 · 개인 결혼운/)
  assert.match(app, /특정 상대 있음 · 결혼궁합/)
  assert.match(app, /const isPersonalMarriage/)
  assert.match(app, /const needsCounterpart/)
  assert.match(app, /\/v1\/marriage\/personal/)
  assert.match(app, /isPersonalMarriage\?runPersonalMarriage:runRelationship/)
  assert.match(app, /\{needsCounterpart&&<>/)
  assert.match(app, /setMarriageMode\('married'\);setMarriageScope\('partner'\)/)
  assert.doesNotMatch(personalPanel, /supabase\.functions\.invoke|GEMINI_API_KEY|generateContent/)
})

test('personal marriage calculation never invents a counterpart, probability, or spouse identity', () => {
  assert.match(api, /@app\.post\("\/v1\/marriage\/personal"\)/)
  assert.match(api, /counterpart_required["']:\s*False/)
  assert.match(personalEngine, /"counterpart_required": False/)
  assert.match(personalEngine, /"marriage_probability": False/)
  assert.match(personalEngine, /"spouse_identity_prediction": False/)
  assert.match(personalEngine, /for h in \(4, 5, 7, 8\)/)
  assert.match(personalEngine, /same_physical_point/)
})

test('relationship AI keeps compatibility reunion unmarried-partner and married semantics separate', () => {
  assert.match(relationshipFn, /type Purpose="compatibility"\|"reunion"\|"marriage_unmarried"\|"marriage_married"/)
  assert.match(relationshipFn, /수신\/발신\/재접점을 분리/)
  assert.match(relationshipFn, /특정 상대가 있는 미혼 결혼궁합/)
  assert.match(relationshipFn, /이미 결혼한 두 사람의 결혼생활 분석/)
  assert.match(relationshipFn, /결혼 가능성 표현은 금지/)
  assert.match(relationshipFn, /intimacy_resources/)
  assert.match(relationshipFn, /if\(!exact\)aspects=aspects\.filter/)
  assert.match(app, /analysisMode === 'reunion' && !reunionTiming/)
})

test('marriage UI makes marriage-specific reading primary and keeps generic compatibility evidence secondary', () => {
  assert.match(panel, /isMarriage&&ai\.data\.marriage_reading\?\.bottom_line/)
  assert.match(panel, /친밀감 · 공유자원/)
  assert.match(panel, /className="marriage-base-evidence"/)
  assert.match(panel, /<summary>기본 궁합 근거 보기<\/summary>/)
  assert.match(panel, /\{!isMarriage\?<><div className="relationship-ai-grid"/)
})

test('relationship AI has bounded paid calls, cumulative usage, server cache and rolling breaker', () => {
  assert.match(relationshipFn, /MAX_GEMINI_CALLS=2/)
  assert.match(relationshipFn, /MAX_PROMPT_BYTES=110000/)
  assert.match(relationshipFn, /addUsage\(firstUsage,second\.usage/)
  assert.match(relationshipFn, /attempt_count:calls/)
  assert.match(relationshipFn, /supabase-relationship-v11/)
  assert.match(relationshipFn, /server_cache:true/)
  assert.match(relationshipFn, /rolling_job_guard:true/)
  assert.match(relationshipFn, /cost_guard_blocked:true/)
  assert.match(relationshipFn, /ai_interpret_jobs/)
  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11-mode-split-cost-guard'/)
  assert.match(cache, /contract: RELATIONSHIP_AI_CACHE_CONTRACT/)
})
''')

# Release CI must own all relationship/personal-marriage contracts, not only fortune V21.
p=Path('.github/workflows/interpretation-v3-ci.yml')
s=p.read_text()
old="      - 'integrated_fortune_v1.py'\n"
new="      - 'integrated_fortune_v1.py'\n      - 'personal_marriage_v1.py'\n      - 'tests/test_personal_marriage_v1.py'\n      - 'api/main.py'\n      - 'supabase/functions/relationship-interpret-v9-preview/**'\n"
if old not in s: raise SystemExit('CI paths anchor missing')
s=s.replace(old,new,1)
old='''      - name: Calculation syntax contract\n        run: |\n          python -m py_compile integrated_fortune_v1.py api/main.py\n          grep -q 'daily_scores' integrated_fortune_v1.py\n'''
new='''      - name: Calculation syntax contract\n        run: |\n          python -m py_compile integrated_fortune_v1.py personal_marriage_v1.py api/main.py\n          grep -q 'daily_scores' integrated_fortune_v1.py\n      - name: Personal marriage calculation regression\n        run: |\n          python -m pip install -r api/requirements.txt\n          python -m pip install pytest\n          python -m pytest -q tests/test_personal_marriage_v1.py\n'''
if old not in s: raise SystemExit('CI calculation step anchor missing')
s=s.replace(old,new,1)
old='          node --test web/src/lib/interpretationUiContract.test.mjs\n'
new=old+'          node --test web/src/lib/relationshipModeContract.test.mjs\n          node --experimental-strip-types --check supabase/functions/relationship-interpret-v9-preview/index.ts\n'
if old not in s: raise SystemExit('CI node contract anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
