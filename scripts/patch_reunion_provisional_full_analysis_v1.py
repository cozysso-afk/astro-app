from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text()
def write(p,s): (ROOT/p).write_text(s)
def rep(s, old, new, label):
    if old not in s:
        raise SystemExit(f'missing target: {label}')
    return s.replace(old,new,1)

# 1) Entered birth time must remain in analysis even when not provenance-exact.
p=Path('relationship_western_v1.py')
s=read(p)
start=s.index('def _transit_hits(')
end=s.index('\ndef _side_trigger_score', start)
block=s[start:end]
old='''            # Entered-time angles are useful as provisional interpretation context, but
            # they must not change deterministic reunion timing scores until exact.
            if target in {"ASC", "DSC", "MC", "IC"} and not natal_exact:
                continue
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)
'''
new='''            # If a concrete birth time was entered, keep time-sensitive points in the
            # analysis even when provenance is not exact. Reliability is handled below
            # by evidence_confidence/precision_weight instead of silently excluding them.
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)
'''
block=rep(block,old,new,'provisional angle exclusion')
needle='''                meta = decorate_aspect(
                    {"a": t_name, "aspect": aspect, "b": target, "orb": round(orb, 3), "tone": tone},
                    mode=layer_class,
                    chart_a_exact=True,
                    chart_b_exact=natal_exact,
                    orb_limit=orb_limit,
                )
                found.append({
'''
replacement='''                meta = decorate_aspect(
                    {"a": t_name, "aspect": aspect, "b": target, "orb": round(orb, 3), "tone": tone},
                    mode=layer_class,
                    chart_a_exact=True,
                    chart_b_exact=natal_exact,
                    orb_limit=orb_limit,
                )
                confidence = str(meta.get("evidence_confidence") or "moderate")
                precision_weight = 1.0 if not meta.get("birth_time_dependency") else {
                    "high": 1.0,
                    "moderate-high": 0.92,
                    "moderate": 0.82,
                    "low-moderate": 0.70,
                    "low": 0.55,
                }.get(confidence, 0.75)
                score = round(score * precision_weight, 1)
                found.append({
'''
block=rep(block,needle,replacement,'provisional transit weighting')
block=rep(block,'                    "evidence_confidence": meta["evidence_confidence"],\n','                    "evidence_confidence": meta["evidence_confidence"],\n                    "precision_weight": precision_weight,\n','precision weight output')
s=s[:start]+block+s[end:]
write(p,s)

# 2) Reunion stage scores use provisional time-sensitive evidence with lower confidence, not exclusion.
p=Path('reunion_dimension_v1.py')
s=read(p)
old='''    orb_factor = max(0.0, 1.0 - orb / limit)
    return round(100.0 * transit_weight * target_weight * aspect_weight * orb_factor, 1)
'''
new='''    orb_factor = max(0.0, 1.0 - orb / limit)
    confidence_weight = 1.0
    if bool(hit.get("birth_time_dependency")):
        confidence_weight = {
            "high": 1.0,
            "moderate-high": 0.92,
            "moderate": 0.82,
            "low-moderate": 0.70,
            "low": 0.55,
        }.get(str(hit.get("evidence_confidence") or "moderate"), 0.75)
    return round(100.0 * transit_weight * target_weight * aspect_weight * orb_factor * confidence_weight, 1)
'''
s=rep(s,old,new,'dimension confidence weighting')
write(p,s)

# 3) Sensitivity scan now measures uncertainty; it does not prohibit using entered-time layers.
p=Path('relationship_reliability_v1.py')
s=read(p)
s=rep(s,
'''        "policy": "diagnostic birth-time sensitivity only; scan candidates never become exact birth times and never unlock production angle/house scoring",
''',
'''        "policy": "diagnostic birth-time sensitivity only; entered-time Moon/angles/houses stay in analysis with provisional confidence weighting. Scan candidates never become exact birth times.",
''','sensitivity policy')
write(p,s)

# 4) UI copy: entered time means full analysis, with confidence labels only.
p=Path('web/src/RelationshipPrecisionDetails.tsx')
s=read(p)
s=s.replace("{partnerTimeExact?'관계 하우스':'입력 생시 참고'}","{partnerTimeExact?'관계 하우스':'입력 생시 분석'}")
s=s.replace("{houseContactCount}개 접점 · {partnerTimeExact?'exact':'provisional'} · 펼쳐보기","{houseContactCount}개 접점 · {partnerTimeExact?'exact':'잠정 신뢰도'} · 펼쳐보기")
s=s.replace("{partnerTimeExact?'검증된 생시 기준이야. ':'입력한 생시를 그대로 쓴 잠정 참고값이야. 생시가 달라지면 하우스와 각도점도 달라질 수 있어. '}","{partnerTimeExact?'검증된 생시 기준이야. ':'입력한 생시를 그대로 사용해 하우스·각도까지 전체 분석에 포함했어. 검증되지 않은 시간민감 근거는 신뢰도를 낮춰 표시해. '}")
s=s.replace('<section className="result-card">\n      <div className="result-card-title"><span>정밀도</span><strong>{partnerTimeAvailable?\'입력 생시 · exact 미검증\':\'출생시간 미상 · 시간민감층 제외\'}</strong></div>', '<section className="result-card relationship-time-reliability-card">\n      <div className="result-card-title"><span>정밀도</span><strong>{partnerTimeAvailable?\'입력 생시 · 전체 분석 포함\':\'출생시간 미상 · 시간민감층 제외\'}</strong></div>')
s=s.replace('''        ? `입력한 출생시간은 그대로 보존해 Moon(달)·ASC/DSC/MC/IC·하우스·진행층·Davison(데이비슨)·Marks(마크스)까지 잠정(provisional) 참고값으로 계산해. 다만 exact 생시로 승격하지 않고, 각도·하우스 계열은 결정적 근거로 쓰지 않아. 출처 ${counterpartReliability?.time_source??'unknown'} · 신뢰도 ${counterpartReliability?.time_confidence??'unknown'}.`
''','''        ? `입력한 출생시간을 그대로 사용해 Moon(달)·ASC/DSC/MC/IC·하우스·진행층·Davison(데이비슨)·Marks(마크스)까지 전부 분석에 포함해. exact 검증이 아니면 시간민감 근거에 provisional 신뢰도와 민감도 가중치를 적용해. 출처 ${counterpartReliability?.time_source??'unknown'} · 신뢰도 ${counterpartReliability?.time_confidence??'unknown'}.`
''')
s=s.replace('''      <p className="result-note">사용자가 시각을 입력했다는 사실과 공식적으로 정확한 생시는 다른 정보야. 사건 발생 확률도 계산하지 않아.</p>
''','''      <p className="result-note">입력 생시는 분석에서 빼지 않아. exact 여부는 근거의 신뢰도와 가중치 표시에만 반영해. 사건 발생 확률은 별도로 계산하지 않아.</p>
''')
s=s.replace("{partnerTimeExact?'정밀 시기':'잠정 시기'}","{partnerTimeExact?'정밀 시기':'입력 생시 시기 분석'}")
s=s.replace("{resultMonths.length}개월 · 펼쳐보기","{resultMonths.length}개월 · {partnerTimeExact?'exact':'잠정 포함'} · 펼쳐보기")
s=s.replace("{partnerTimeExact?'검증된 exact 생시 기반':'입력 시각 기반 provisional 진행·각도 참고층'} · 접점 수는 사건 확률이 아니야.","{partnerTimeExact?'검증된 exact 생시 기반':'입력 생시 기반 진행·각도까지 전체 포함 · 시간민감 근거는 provisional 신뢰도 적용'} · 접점 수는 사건 확률이 아니야.")
write(p,s)

# 5) Mobile spacing: visibly increase the circled in-card whitespace.
p=Path('web/src/mobile-density-v29.css')
s=read(p)
append='''\n\n/* V29.1 · relationship precision cards need breathing room on iPhone. */
@media(max-width:430px){
  .relationship-precision-card>.relationship-precision-summary{
    padding:17px 18px 16px!important;
    row-gap:8px!important;
    column-gap:12px!important;
  }
  .relationship-precision-summary>span{
    margin:0 0 1px!important;
    padding:0!important;
  }
  .relationship-precision-summary>strong{
    margin:0!important;
  }
  .relationship-precision-summary>small{
    margin-top:1px!important;
    padding:0!important;
  }
  .relationship-time-reliability-card{
    padding:18px 18px 17px!important;
  }
  .relationship-time-reliability-card .result-card-title{
    display:grid!important;
    gap:6px!important;
    margin-bottom:13px!important;
  }
  .relationship-time-reliability-card .status-banner{
    margin:0 0 12px!important;
  }
  .relationship-time-reliability-card>.result-note{
    margin:0!important;
  }
}
'''
if 'V29.1 · relationship precision cards need breathing room on iPhone.' not in s:
    s += append
write(p,s)

# 6) AI contract: provisional entered time is analyzed, never silently dropped.
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=read(p)
s=s.replace('const REUNION_VERSION="relationship-v12.6-editorial-stage-story";','const REUNION_VERSION="relationship-v12.7-provisional-full-analysis";')
old='''- 출생시간을 입력했다는 사실과 정밀 검증은 다르다. precision.birth_time_reliability를 우선 확인한다. exact가 아니어도 입력 생시 기반 Moon·ASC/DSC/MC/IC·하우스·Davison/Marks가 데이터에 제공되면 provisional(잠정) 참고 근거로 읽을 수 있지만, 확정·결정적 근거로 승격하지 않는다. sensitivity_scan 경고와 evidence_confidence를 함께 보고 흔들리는 각도/하우스는 보조 맥락으로만 쓴다.
'''
new='''- 출생시간을 입력했다는 사실과 정밀 검증은 다르다. precision.birth_time_reliability를 우선 확인한다. 그러나 concrete entered time이 있으면 Moon·ASC/DSC/MC/IC·하우스·진행층·Davison·Marks를 해설에서 누락하거나 제외하지 말고 전부 분석한다. exact가 아닌 시간민감 근거는 provisional(잠정)이라고 명시하고 sensitivity_scan·evidence_confidence·precision_weight에 따라 강도를 낮춰 읽되, 단지 미검증이라는 이유만으로 본문에서 삭제하지 않는다. exact라고 표현하거나 확정 사실처럼 승격하는 것만 금지한다.
'''
s=rep(s,old,new,'AI provisional policy')
old='''- 정확 생시에서 house_overlays의 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.
'''
new='''- house_overlays.available=true이면 exact/provisional 모두 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. provisional이면 잠정 하우스라고 밝히고 신뢰도를 낮춰 해석하되 생략하지 않는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.
'''
s=rep(s,old,new,'AI house policy')
write(p,s)

# 7) Cache/version contracts: force a fresh AI reading after policy change.
for rel in [
    'web/src/lib/readingCache.ts',
    'web/src/lib/relationshipModeContract.test.mjs',
    'web/src/lib/relationshipEvidencePipeline.test.mjs',
    'web/src/lib/relationshipReunionV2.contract.test.mjs',
    'web/src/lib/reunionEditorialV126.test.mjs',
    'web/src/lib/humanLanguageV25.test.mjs',
]:
    p=Path(rel)
    if not p.exists():
        continue
    s=read(p)
    s=s.replace('relationship-v12.6-editorial-stage-story-v1','relationship-v12.7-provisional-full-analysis-v1')
    s=s.replace('relationship-v12\\.6-editorial-stage-story-v1','relationship-v12\\.7-provisional-full-analysis-v1')
    s=s.replace('relationship-v12.6-editorial-stage-story','relationship-v12.7-provisional-full-analysis')
    s=s.replace('relationship-v12\\.6-editorial-stage-story','relationship-v12\\.7-provisional-full-analysis')
    write(p,s)

# 8) Focused regression tests.
p=Path('tests/test_birth_time_reliability_v12.py')
s=read(p)
s=s.replace('from relationship_western_v1 import _profile_chart, build_relationship_western','from relationship_western_v1 import _profile_chart, _transit_hits, build_relationship_western')
if 'test_entered_provisional_angle_is_analyzed_with_reduced_confidence' not in s:
    s += '''\n\ndef test_entered_provisional_angle_is_analyzed_with_reduced_confidence():\n    transit = {"positions": {"Mercury": {"lon": 10.0}}}\n    natal = {\n        "positions": {"Sun": {"lon": 100.0}},\n        "angles": {"ASC": 10.0},\n        "time_reliability": {"time_exact": False},\n    }\n    hits = _transit_hits(transit, natal, "counterpart")\n    angle = next(row for row in hits if row["target"] == "ASC")\n    assert angle["birth_time_dependency"] is True\n    assert angle["evidence_confidence"] == "low"\n    assert 0 < angle["precision_weight"] < 1\n    assert angle["score"] > 0\n'''
write(p,s)

p=Path('tests/test_reunion_dimensions_v14.py')
s=read(p)
if 'test_provisional_time_sensitive_hit_is_included_but_downweighted' not in s:
    s += '''\n\ndef test_provisional_time_sensitive_hit_is_included_but_downweighted():\n    exact = _hit("Mercury", "ASC")\n    exact["birth_time_dependency"] = False\n    exact["evidence_confidence"] = "high"\n    provisional = dict(exact)\n    provisional["birth_time_dependency"] = True\n    provisional["time_sensitivity"] = "fragile"\n    provisional["evidence_confidence"] = "low"\n    exact_score = score_transit_hit(exact, "contact_recontact")\n    provisional_score = score_transit_hit(provisional, "contact_recontact")\n    assert exact_score > provisional_score > 0\n'''
write(p,s)

p=Path('web/src/lib/provisionalFullAnalysisV127.test.mjs')
p.write_text(r'''import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const ui=readFileSync(new URL('../RelationshipPrecisionDetails.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../mobile-density-v29.css',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('entered birth time is presented as full provisional analysis, not excluded',()=>{
  assert.match(ui,/입력 생시 · 전체 분석 포함/)
  assert.match(ui,/전부 분석에 포함해/)
  assert.match(ui,/입력 생시는 분석에서 빼지 않아/)
  assert.doesNotMatch(ui,/각도·하우스 계열은 결정적 근거로 쓰지 않아/)
})

test('circled precision summaries have visible mobile inset and rhythm',()=>{
  assert.match(css,/relationship-precision-card>\.relationship-precision-summary[\s\S]*padding:17px 18px 16px!important/)
  assert.match(css,/row-gap:8px!important/)
  assert.match(css,/relationship-time-reliability-card[\s\S]*padding:18px 18px 17px!important/)
})

test('AI contract analyzes all entered-time layers while marking uncertainty',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.7-provisional-full-analysis"/)
  assert.match(edge,/누락하거나 제외하지 말고 전부 분석한다/)
  assert.match(edge,/exact\/provisional 모두 whole_house/)
  assert.match(cache,/relationship-v12\.7-provisional-full-analysis-v1/)
})
''')

print('provisional full-analysis + spacing patch applied')
