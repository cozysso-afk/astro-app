from pathlib import Path

# ---------------------------------------------------------------------------
# Thai engine: expose validated 10-planet Suriyayat facts without Lagna/scoring
# ---------------------------------------------------------------------------
p=Path('thai_astrology_v2.py')
s=p.read_text(encoding='utf-8')
s=s.replace(
'''Traditional Thai astrology layers that can be computed without pretending to
implement the full Suriyayat planetary canon.''',
'''Traditional Thai astrology layers with cross-validated Suriyayat planet facts.

Suriyayat Lagna and predictive interpretation rules remain intentionally disabled
until they have independent global-coordinate/traditional-rule validation.''',1)
s=s.replace(
'''Not implemented here:
- Full Suriyayat 10-planet longitudes, Lagna, Thai Ketu, dignities or planetary
  ingress/transit. Those remain explicitly unavailable rather than being
  approximated with Western tropical or generic Lahiri sidereal positions.''',
'''Implemented as factual positions only:
- Cross-validated Suriyayat Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn/Rahu/
  Thai Ketu/Uranus longitudes for the natal instant and selected-period endpoints.

Not implemented here:
- Global-coordinate Suriyayat Lagna, houses/dignities/aspect judgement, exact
  ingress scanner, or event-probability conversion.''',1)
s=s.replace('from datetime import date, datetime, time as dt_time, timedelta', 'from datetime import date, datetime, time as dt_time, timedelta, timezone',1)
import_anchor='from typing import Any\n'
assert import_anchor in s
s=s.replace(import_anchor, import_anchor+'\nfrom thai_suriyayat_v1 import ENGINE_VERSION as SURIYAYAT_ENGINE_VERSION, SOURCE_COMMIT as SURIYAYAT_SOURCE_COMMIT, calculate_positions_for_instant\n',1)
s=s.replace('ENGINE_VERSION = "thai-mahathaksa-taksajorn-v2.0"','ENGINE_VERSION = "thai-mahathaksa-taksajorn-suriyayat-v2.1"',1)

anchor='''def build_thai_fortune(\n    birth_date: date,\n'''
assert anchor in s
helpers=r'''def _compact_suriyayat_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    positions = {}
    for key, row in (snapshot.get("positions") or {}).items():
        positions[key] = {
            "arcmin": row.get("arcmin"),
            "longitude_deg": row.get("longitude_deg"),
            "sign_index": row.get("sign_index"),
            "sign_ko": row.get("sign_ko"),
            "degree": row.get("degree"),
            "minute": row.get("minute"),
            "display": row.get("display"),
        }
    return {
        "instant": snapshot.get("instant"),
        "suriyayat_reference_time": snapshot.get("suriyayat_reference_time"),
        "positions": positions,
    }


def _suriyayat_layer(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float,
) -> dict[str, Any]:
    local_tz = timezone(timedelta(hours=float(utc_offset_hours)))
    natal_instant = datetime.combine(birth_date, birth_time, tzinfo=local_tz)
    start_instant = datetime.combine(start_date, dt_time(12, 0), tzinfo=local_tz)
    end_instant = datetime.combine(end_date, dt_time(12, 0), tzinfo=local_tz)
    natal = calculate_positions_for_instant(natal_instant)
    start_snapshot = calculate_positions_for_instant(start_instant)
    end_snapshot = start_snapshot if end_date == start_date else calculate_positions_for_instant(end_instant)
    return {
        "available": True,
        "engine": SURIYAYAT_ENGINE_VERSION,
        "source_commit": SURIYAYAT_SOURCE_COMMIT,
        "time_basis": "Bangkok historical local mean time UTC+06:42",
        "validation": {
            "status": "cross_validated",
            "reference": "myhora Suriyayat August 2026 table + public MIT reference implementation",
            "vectors": 30,
            "dates": 3,
            "max_delta_arcmin": 4,
            "within_1_arcmin": 26,
        },
        "natal": _compact_suriyayat_snapshot(natal),
        "period_start": _compact_suriyayat_snapshot(start_snapshot),
        "period_end": _compact_suriyayat_snapshot(end_snapshot),
        "lagna": {
            "available": False,
            "reason": "Global-coordinate Suriyayat Lagna is not independently validated; Thailand province-offset lookup is not reused for Korean/world birthplaces.",
        },
        "interpretation_status": "planetary_position_facts_only",
        "policy": "Traditional 10-planet position facts only. No Western-score blending, no Thai house/aspect judgement, and no event probability.",
    }


'''
s=s.replace(anchor,helpers+anchor,1)

sig_old='''def build_thai_fortune(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:'''
sig_new='''def build_thai_fortune(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float = 9.0,
) -> dict[str, Any]:'''
assert sig_old in s
s=s.replace(sig_old,sig_new,1)

insert_anchor='''    natal_wheel = _wheel(birth_planet)\n\n    segments = []'''
assert insert_anchor in s
s=s.replace(insert_anchor,'''    natal_wheel = _wheel(birth_planet)\n    suriyayat = _suriyayat_layer(birth_date, birth_time, start_date, end_date, utc_offset_hours)\n\n    segments = []''',1)

old_tail='''        "predictive_status": "period_layer_available_no_suriyayat_transit",
        "consensus_policy": "Mahathaksa/Taksajorn period facts are available as an independent Thai layer. Full Suriyayat planetary transit is not yet verified, so Thai data is not converted into Western-style numerical timing scores.",
        "reliability": {
            "weekday_rule": "established_rule",
            "mahathaksa_wheel": "established_table_rule",
            "taksajorn": "documented_method_variant",
            "suriyayat_transit": "not_implemented",
        },
        "not_calculated": [
            "full Suriyayat 10-planet longitudes",
            "Suriyayat Lagna",
            "Thai Ketu formula",
            "Rahu mean/true school selection",
            "Suriyayat transit/ingress",
        ],'''
new_tail='''        "suriyayat": suriyayat,
        "predictive_status": "mahathaksa_taksajorn_plus_verified_suriyayat_positions_no_lagna_rules",
        "consensus_policy": "Mahathaksa/Taksajorn period facts and cross-validated Suriyayat 10-planet positions are available as independent Thai layers. Lagna/house/aspect/event rules are not yet validated and nothing is converted into Western-style probability scores.",
        "reliability": {
            "weekday_rule": "established_rule",
            "mahathaksa_wheel": "established_table_rule",
            "taksajorn": "documented_method_variant",
            "suriyayat_10planet_positions": "cross_validated_30_vectors_max_4_arcmin",
            "suriyayat_lagna": "not_implemented",
            "suriyayat_predictive_rules": "not_implemented",
        },
        "not_calculated": [
            "global-coordinate Suriyayat Lagna",
            "Suriyayat houses/dignities/aspect judgement",
            "exact Suriyayat ingress scanner",
            "alternate Rahu true-school selection",
            "Suriyayat event/probability conversion",
        ],'''
assert old_tail in s, 'Thai old Suriyayat tail missing'
s=s.replace(old_tail,new_tail,1)
p.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# Integrated engine passes profile timezone into Thai layer and updates policy.
# ---------------------------------------------------------------------------
p=Path('integrated_fortune_v1.py')
s=p.read_text(encoding='utf-8')
s=s.replace('ENGINE_VERSION = "integrated-fortune-v2.8-saju-jie-exact-thai"','ENGINE_VERSION = "integrated-fortune-v2.9-suriyayat-position-layer"',1)
old='''def _thai_payload(birth_date: date, birth_time: dt_time, start_date: date, end_date: date):
    return build_thai_fortune(birth_date, birth_time, start_date, end_date)'''
new='''def _thai_payload(birth_date: date, birth_time: dt_time, start_date: date, end_date: date, utc_offset_hours: float):
    return build_thai_fortune(birth_date, birth_time, start_date, end_date, utc_offset_hours=utc_offset_hours)'''
assert old in s
s=s.replace(old,new,1)
old_call='thai = _thai_payload(birth_date, birth_time, start_date, end_date)'
assert old_call in s
s=s.replace(old_call,'thai = _thai_payload(birth_date, birth_time, start_date, end_date, utc_offset_hours)',1)
old_policy='"thai": "Mahathaksa/Taksajorn 기간층은 독립 계산. 검증 전 Full Suriyayat Lagna/태국식 트랜짓은 Western 수치점수에 임의 합산하지 않음.",'
new_policy='"thai": "Mahathaksa/Taksajorn + 교차검증 Suriyayat 10행성 위치를 독립 사실층으로 제공. Lagna/하우스/예측규칙 미검증 항목은 추정하거나 Western 수치점수에 합산하지 않음.",'
assert old_policy in s
s=s.replace(old_policy,new_policy,1)
p.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# Backend AI compact payload: allow facts but explicitly forbid invented rules.
# ---------------------------------------------------------------------------
p=Path('ai_interpret_v1.py')
s=p.read_text(encoding='utf-8')
s=s.replace('AI_INTERPRETER_VERSION = "mobile-ai-v2.2-thai-period-safe"','AI_INTERPRETER_VERSION = "mobile-ai-v2.3-suriyayat-position-safe"',1)
compact_anchor='''            "taksajorn": thai.get("taksajorn"),
            "predictive_status": thai.get("predictive_status"),'''
assert compact_anchor in s
s=s.replace(compact_anchor,'''            "taksajorn": thai.get("taksajorn"),
            "suriyayat": thai.get("suriyayat"),
            "predictive_status": thai.get("predictive_status"),''',1)
old_prompt='Thai는 mahathaksa와 taksajorn에 실제 데이터가 있을 때만 그 연령 구간과 8궁 배치를 설명한다. not_calculated의 Suriyayat(수리야얏) 행성·라그나·라후/게투는 절대 추정하지 말고, Thai 층을 Western 수치점수처럼 확률화하거나 임의 합산하지 마라.'
new_prompt='Thai는 mahathaksa/taksajorn과 suriyayat에 실제 데이터가 있을 때만 사용한다. suriyayat.positions는 교차검증된 전통 10행성 위치 사실이지만 Lagna·하우스·디그니티·애스펙트·사건판정 규칙은 아직 계산하지 않는다. not_calculated 항목은 절대 추정하지 말고, Thai 층을 Western 수치점수처럼 확률화하거나 임의 합산하지 마라.'
assert old_prompt in s
s=s.replace(old_prompt,new_prompt,1)
# Exact Saju segment safety now that annual/monthly can contain multiple rows in one civil year/month.
saju_prompt='사주에서 not_calculated에 있는 신강·신약, 용신·희신·기신, 형·파·해 전체 규칙은 임의 추정하지 마라.'
assert saju_prompt in s
s=s.replace(saju_prompt,saju_prompt+'\n사주 annual은 입춘, monthly는 절(節) 정확시각 경계로 이미 분할된 구간이다. 같은 달력 연도·월 표기가 반복되어도 서로 다른 간지 구간을 임의 병합하지 마라.',1)
p.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# Frontend types, copy, and visible status.
# ---------------------------------------------------------------------------
p=Path('web/src/AppNext.tsx')
s=p.read_text(encoding='utf-8')
type_anchor='''    taksajorn?: { available:boolean; method:string; method_variance_note?:string; segments:Array<{ start:string; end:string; age_in_progress:number; annual_boriwan:{ key:string; number:number; thai_name:string; label:string }; landed_center:boolean; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }> }
    predictive_status: string'''
assert type_anchor in s
sur_type='''    taksajorn?: { available:boolean; method:string; method_variance_note?:string; segments:Array<{ start:string; end:string; age_in_progress:number; annual_boriwan:{ key:string; number:number; thai_name:string; label:string }; landed_center:boolean; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }> }
    suriyayat?: { available:boolean; engine:string; source_commit?:string; time_basis:string; validation?:{status:string;reference?:string;vectors?:number;dates?:number;max_delta_arcmin?:number;within_1_arcmin?:number}; natal?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; period_start?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; period_end?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; lagna?:{available:boolean;reason?:string}; interpretation_status?:string; policy?:string }
    predictive_status: string'''
s=s.replace(type_anchor,sur_type,1)

old_rule='- Thai(태국점성술)는 Mahathaksa(마하탁사)·Taksajorn(탁사쫀)의 실제 계산 구간만 독립적으로 해석한다. Full Suriyayat(수리야얏) 행성·Lagna(라그나)·Rahu/Ketu(라후/게투) 트랜짓은 검증 전이므로 만들거나 Western(서양점성술) 수치점수에 임의 합산하지 않는다.'
new_rule='- Thai(태국점성술)는 Mahathaksa(마하탁사)·Taksajorn(탁사쫀)과 교차검증된 Suriyayat(수리야얏) 10행성 위치 사실을 독립적으로 읽는다. Lagna(라그나)·하우스·애스펙트·사건판정 규칙은 미검증이므로 만들거나 Western(서양점성술) 수치점수에 임의 합산하지 않는다.'
assert old_rule in s
s=s.replace(old_rule,new_rule,1)
old_external='- Thai(태국점성술)는 CALCULATED_DATA.thai의 mahathaksa/taksajorn에 실제 들어온 값만 사용하고, not_calculated의 Suriyayat(수리야얏) 항목은 추정하지 않는다.'
new_external='- Thai(태국점성술)는 CALCULATED_DATA.thai의 mahathaksa/taksajorn/suriyayat에 실제 들어온 값만 사용한다. suriyayat.positions는 위치 사실로만 읽고 Lagna·하우스·애스펙트·사건 확률을 새로 만들지 않으며 not_calculated 항목은 추정하지 않는다.'
assert old_external in s
s=s.replace(old_external,new_external,1)
old_coord='Thai(태국점성술)는 출생요일 규칙과 Mahathaksa(마하탁사)·Taksajorn(탁사쫀) 기간층을 계산하며 Full Suriyayat(수리야얏) 트랜짓은 아직 검증 전이야.'
new_coord='Thai(태국점성술)는 출생요일·Mahathaksa(마하탁사)·Taksajorn(탁사쫀)과 교차검증된 Suriyayat(수리야얏) 10행성 위치를 계산해. Suriyayat Lagna(라그나)·하우스·예측규칙은 아직 검증 전이야.'
assert old_coord in s
s=s.replace(old_coord,new_coord,1)

# Copy output includes a compact Suriyayat fact block.
copy_anchor='''  for (const seg of result.thai.taksajorn?.segments ?? []) lines.push(`- Taksajorn(탁사쫀) ${seg.start}~${seg.end}: 나이 진행 ${seg.age_in_progress} · 연간 Boriwan ${seg.annual_boriwan.label}${seg.landed_center?' (중앙 착지→Jupiter 적용)':''}`)
  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)'''
assert copy_anchor in s
s=s.replace(copy_anchor,'''  for (const seg of result.thai.taksajorn?.segments ?? []) lines.push(`- Taksajorn(탁사쫀) ${seg.start}~${seg.end}: 나이 진행 ${seg.age_in_progress} · 연간 Boriwan ${seg.annual_boriwan.label}${seg.landed_center?' (중앙 착지→Jupiter 적용)':''}`)
  if (result.thai.suriyayat?.available) {
    lines.push(`- Suriyayat 10행성: 검증됨 · 기준 ${result.thai.suriyayat.time_basis} · 최대 검산오차 ${result.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}각분`)
    const natal = result.thai.suriyayat.natal?.positions ?? {}
    const natalText = Object.entries(natal).map(([key,row])=>`${key} ${row.display}`).join(' · ')
    if (natalText) lines.push(`- Suriyayat 출생위치: ${natalText}`)
    lines.push(`- Suriyayat Lagna: ${result.thai.suriyayat.lagna?.available?'계산됨':'미계산 · 글로벌 좌표 공식 검증 대기'}`)
  }
  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)''',1)

# Main Thai card gets a concise verified-position summary, not a fake interpretation.
main_anchor='''                {!!integratedResult.thai.taksajorn?.segments?.length && <div className="saju-list">{integratedResult.thai.taksajorn.segments.map((seg)=><div key={`${seg.start}-${seg.end}`}><strong>{seg.start} ~ {seg.end}</strong><span>나이 진행 {seg.age_in_progress} · 연간 Boriwan(브리완) {seg.annual_boriwan.label}{seg.landed_center?' · 중앙 착지 후 Jupiter(목성) 적용':''}</span></div>)}</div>}
                <p className="result-note">Mahathaksa/Taksajorn은 독립 태국 기간층으로 계산해. Full Suriyayat(수리야얏) 10행성·Lagna(라그나)·태국식 Rahu/Ketu(라후/게투) 트랜짓은 검증 전이라 아직 만들거나 점수에 섞지 않아.</p>'''
assert main_anchor in s
s=s.replace(main_anchor,'''                {!!integratedResult.thai.taksajorn?.segments?.length && <div className="saju-list">{integratedResult.thai.taksajorn.segments.map((seg)=><div key={`${seg.start}-${seg.end}`}><strong>{seg.start} ~ {seg.end}</strong><span>나이 진행 {seg.age_in_progress} · 연간 Boriwan(브리완) {seg.annual_boriwan.label}{seg.landed_center?' · 중앙 착지 후 Jupiter(목성) 적용':''}</span></div>)}</div>}
                {integratedResult.thai.suriyayat?.available && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>Suriyayat(수리야얏) 10행성 위치 검증층 ON · 30개 기준값 교차검산 · 최대 오차 {integratedResult.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}각분. Lagna(라그나)는 글로벌 좌표 공식 검증 전이라 OFF.</span></div>}
                <p className="result-note">Mahathaksa/Taksajorn은 태국 기간층, Suriyayat은 현재 검증된 10행성 위치 사실층이야. Lagna·하우스·애스펙트·사건판정은 아직 만들지 않고 Western 점수에도 섞지 않아.</p>''',1)

# Precision Thai status explicitly distinguishes verified positions from unvalidated Lagna/rules.
precision_anchor='''                <div className="tight-row"><span>Mahathaksa</span><b>{integratedResult.thai.mahathaksa?.available?'8궁 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>Taksajorn</span><b>{integratedResult.thai.taksajorn?.available?'연령 기간 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>'''
assert precision_anchor in s
s=s.replace(precision_anchor,'''                <div className="tight-row"><span>Mahathaksa</span><b>{integratedResult.thai.mahathaksa?.available?'8궁 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>Taksajorn</span><b>{integratedResult.thai.taksajorn?.available?'연령 기간 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>Suriyayat 10행성 위치</span><b>{integratedResult.thai.suriyayat?.available?`교차검증됨 · 최대 Δ${integratedResult.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}′`:'미계산'}</b></div>
                <div className="tight-row"><span>Suriyayat Lagna(라그나)</span><b>{integratedResult.thai.suriyayat?.lagna?.available?'계산됨':'미계산 · 글로벌 공식 검증 대기'}</b></div>
                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>''',1)

# Home system note no longer calls all Suriyayat unvalidated.
old_home='Thai는 Mahathaksa/Taksajorn 기간층까지 계산하고, 검증 전 Suriyayat 행성 트랜짓은 합의 점수에 섞지 않아.'
new_home='Thai는 Mahathaksa/Taksajorn 기간층과 교차검증 Suriyayat 10행성 위치까지 계산해. Suriyayat Lagna·하우스·예측규칙은 미검증이라 합의 점수에 섞지 않아.'
assert old_home in s
s=s.replace(old_home,new_home,1)
p.write_text(s,encoding='utf-8')

print('PATCH_SURIYAYAT_INTEGRATION_V1_APPLIED')
