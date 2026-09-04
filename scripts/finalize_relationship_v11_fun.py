from pathlib import Path

# Repair the one-shot v11 patcher itself: re.sub replacement strings containing
# JS regex backslashes must be inserted via a callable replacement.
p = Path('scripts/patch_relationship_audit_v11.py')
s = p.read_text()
s = s.replace('s=pat.sub(new_tail,s)', 's=pat.sub(lambda _m: new_tail,s)', 1)
if 's=pat.sub(lambda _m: new_tail,s)' not in s:
    raise SystemExit('v11 regex replacement repair did not apply')
p.write_text(s)


def finalize_runtime_and_contract() -> None:
    # Run this function AFTER the prepared v11 patch scripts have produced final files.
    p = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
    s = p.read_text()

    # Product contract: unmarried readings are allowed to be fun/predictive. We only
    # prohibit pretending the astrology output is a guaranteed fact or empirical probability.
    conservative = "'결혼하나?'를 예언하지 말고 '이 둘이 결혼생활로 들어가면 어떻게 작동하나'를 깊게 본다."
    predictive = "'결혼으로 공식화될 가능성·프러포즈/약혼/결혼 결정이 강해지는 시기'를 재미용 점성 해석으로 적극적으로 제시한다. 다만 통계적 확률이나 확정된 미래 사실처럼 단정하지 않는다. 이어서 '이 둘이 결혼생활로 들어가면 어떻게 작동하나'를 깊게 본다."
    if conservative in s:
        s = s.replace(conservative, predictive, 1)

    s = s.replace(
        '두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고 결혼 성사 여부는 예언하지 마라.',
        '두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고, 결혼으로 공식화될 가능성과 프러포즈·약혼·결혼 결정이 강해지는 시기 흐름도 계산 근거 범위에서 적극적으로 제시하되 확정 사실처럼 단정하지 마라.',
    )

    # Require both semantics to remain visible in source after replacements.
    if '공식화될 가능성' not in s or '확정 사실처럼 단정하지' not in s:
        raise SystemExit('unmarried partner predictive contract missing')
    if '이미 결혼한' not in s or '결혼 가능성' not in s:
        raise SystemExit('married semantics missing')
    p.write_text(s)

    # Permanent static regression contract, updated for the user's desired fun forecast.
    test_path = Path('web/src/lib/relationshipModeContract.test.mjs')
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

test('unmarried marriage splits no-counterpart forecast from specific-partner marriage compatibility', () => {
  assert.match(app, /marriageScope.*'personal'.*'partner'/s)
  assert.match(app, /상대 없음 · 개인 결혼운/)
  assert.match(app, /결혼 가능성 · 시기 · 미래 배우자상/)
  assert.match(app, /특정 상대 있음 · 결혼궁합/)
  assert.match(app, /const isPersonalMarriage/)
  assert.match(app, /const needsCounterpart/)
  assert.match(app, /\/v1\/marriage\/personal/)
  assert.match(app, /isPersonalMarriage\?runPersonalMarriage:runRelationship/)
  assert.match(app, /\{needsCounterpart&&<>/)
  assert.match(app, /setMarriageMode\('married'\);setMarriageScope\('partner'\)/)
  assert.doesNotMatch(personalPanel, /supabase\.functions\.invoke|GEMINI_API_KEY|generateContent/)
})

test('no-counterpart personal marriage actively provides fun probability timing and spouse archetype', () => {
  assert.match(api, /@app\.post\("\/v1\/marriage\/personal"\)/)
  assert.match(api, /counterpart_required["']:\s*False/)
  assert.match(personalEngine, /"counterpart_required": False/)
  assert.match(personalEngine, /"marriage_probability": True/)
  assert.match(personalEngine, /"spouse_archetype_prediction": True/)
  assert.match(personalEngine, /"specific_identity_claims": False/)
  assert.match(personalEngine, /marriage_probability_percent/)
  assert.match(personalEngine, /spouse_archetype/)
  assert.match(personalEngine, /appearance_hints/)
  assert.match(personalEngine, /career_clusters/)
  assert.match(personalEngine, /meeting_route/)
  assert.match(personalPanel, /결혼 가능성 지수/)
  assert.match(personalPanel, /외모 · 분위기/)
  assert.match(personalPanel, /직업 · 분야/)
  assert.match(personalPanel, /어디서 만날 가능성이 큰지/)
  assert.match(personalPanel, /점성 엔터테인먼트 지수/)
})

test('relationship AI keeps compatibility reunion unmarried-partner and married semantics separate', () => {
  assert.match(relationshipFn, /type Purpose="compatibility"\|"reunion"\|"marriage_unmarried"\|"marriage_married"/)
  assert.match(relationshipFn, /수신\/발신\/재접점을 분리/)
  assert.match(relationshipFn, /특정 상대가 있는 미혼 결혼궁합/)
  assert.match(relationshipFn, /공식화될 가능성/)
  assert.match(relationshipFn, /프러포즈·약혼·결혼 결정/)
  assert.match(relationshipFn, /확정 사실처럼 단정하지/)
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

test('relationship AI has bounded paid calls cumulative usage server cache and rolling breaker', () => {
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


if __name__ == '__main__':
    # Before the prepared patchers run, only repair their regex substitution.
    pass
