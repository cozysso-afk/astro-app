from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(path: str, old: str, new: str, label: str) -> None:
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# The reunion compact payload must actually contain the fields that the prompt and
# grounding layer are instructed to use. Previously v15 built these fields but
# stripped them immediately before Gemini.
patch(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    'return {analysis_mode:base.analysis_mode,period:base.period,relationship_status:base.relationship_status,timing_contract:base.timing_contract,precision:base.precision,saju_relationship:base.saju_relationship,reunion_evidence_v2,limitations:base.limitations};',
    'return {analysis_mode:base.analysis_mode,period:base.period,relationship_status:base.relationship_status,timing_contract:base.timing_contract,precision:base.precision,saju_relationship:base.saju_relationship,reunion_dimensions:base.reunion_dimensions,reunion_secondary_support:base.reunion_secondary_support,reunion_timing_windows:base.reunion_timing_windows,reunion_return_support:base.reunion_return_support,reunion_evidence_v2,limitations:base.limitations};',
    'reunion compact payload fields',
)

patch(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    '- 연락·재접촉 / 감정 재활성 / 관계 재구축 지원층을 하나의 재회 점수로 합치지 않는다. 연락이 열리는 것과 안정적 재결합은 별개로 결론낸다.',
    '- 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 네 단계로 분리하고 한 단계의 강함을 다음 단계의 성립으로 자동 승격하지 않는다.',
    'old three-stage prompt wording',
)

patch(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    '- 선택기간 내 2~4개 시기창을 제시하되, Secondary Progression을 Daily Transit보다 상위 시기근거로 둔다.',
    '- 시기창은 기간 신호와 날짜 트리거를 분리한다. Secondary Progression은 기간 배경만 만들고, 특정 날짜는 reunion_timing_windows에 실제 fast transit trigger가 있을 때만 제시한다.',
    'old progression timing wording',
)

# Browser cache must invalidate the old three-stage reunion prose when v15 lands.
patch(
    'web/src/lib/readingCache.ts',
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11.10-editorial-polish-v1'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11.11-four-stage-gated-dates-v1'",
    'reunion browser cache contract',
)

# Keep the explicit contract test in sync and make it protect the fields required
# for exact-date gating from being accidentally stripped again.
p = ROOT / 'web/src/lib/relationshipModeContract.test.mjs'
s = p.read_text(encoding='utf-8')
s = s.replace("assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11\\.10-editorial-polish-v1'/)", "assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11\\.11-four-stage-gated-dates-v1'/)")
s = s.replace("assert.match(relationshipFn, /relationship-v11\\.10-provisional-time-reference/)", "assert.match(relationshipFn, /relationship-v11\\.11-four-stage-gated-dates/)")
anchor = "  assert.match(relationshipFn, /CALCULATED_DATA\\.reunion_evidence_v2/)\n"
if anchor not in s:
    raise RuntimeError('relationship contract anchor missing')
extra = (
    anchor
    + "  assert.match(relationshipFn, /reunion_dimensions:base\\.reunion_dimensions/)\n"
    + "  assert.match(relationshipFn, /reunion_timing_windows:base\\.reunion_timing_windows/)\n"
    + "  assert.match(relationshipFn, /reunion_secondary_support:base\\.reunion_secondary_support/)\n"
    + "  assert.match(relationshipFn, /initiative_gate/)\n"
    + "  assert.match(relationshipFn, /감정 활성 \\/ 연락·재접촉 \\/ 실제 만남 \\/ 관계 재결합/)\n"
)
s = s.replace(anchor, extra, 1)
p.write_text(s, encoding='utf-8')

print('reunion v15 prompt/cache contract hardened')
