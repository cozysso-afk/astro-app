from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {path}: {old[:70]!r}')


# Relationship calculation: entered clock time + coordinates may produce provisional
# angle/house/Davison/Marks reference layers, while `time_exact` remains untouched.
path = 'relationship_western_v1.py'
replace_once(path,
    'person\'s private feelings. Angles/houses and Davison/Marks layers require exact birth time and place.',
    'person\'s private feelings. Entered birth time/place may produce provisional angle/house/Davison/Marks reference layers; only provenance-verified time is labelled exact.')
replace_once(path,
    'ENGINE_VERSION = "relationship-western-v1.11-reunion-dimensions"',
    'ENGINE_VERSION = "relationship-western-v1.12-provisional-entered-time"')
replace_once(path,
'''        include_angles=bool(
            reliability["time_exact"]
            and profile.get("latitude") is not None
            and profile.get("longitude") is not None
        ),''',
'''        include_angles=bool(
            time_available
            and profile.get("latitude") is not None
            and profile.get("longitude") is not None
        ),''')
replace_once(path,
'''    if time_available and not reliability["time_exact"]:
        chart["time_sensitive_points_omitted"] = ["ASC", "DSC", "MC", "IC", "quadrant_houses"]
    elif not time_available:
        chart["time_sensitive_points_omitted"] = ["Moon", "ASC", "DSC", "MC", "IC", "quadrant_houses"]''',
'''    if time_available and not reliability["time_exact"]:
        chart["time_sensitive_points_provisional"] = ["Moon", "ASC", "DSC", "MC", "IC", "quadrant_houses"]
        chart["time_sensitive_points_omitted"] = []
    elif not time_available:
        chart["time_sensitive_points_omitted"] = ["Moon", "ASC", "DSC", "MC", "IC", "quadrant_houses"]''')
replace_once(path,
'''        for target, n_lon in targets.items():
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)''',
'''        for target, n_lon in targets.items():
            # Entered-time angles are useful as provisional interpretation context, but
            # they must not change deterministic reunion timing scores until exact.
            if target in {"ASC", "DSC", "MC", "IC"} and not natal_exact:
                continue
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)''')
replace_once(path,
'''    user_exact = bool(user_reliability["time_exact"] and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_exact = bool(cp_reliability["time_exact"] and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)
    result["birth_time_reliability"] = {"user": user_reliability, "counterpart": cp_reliability}''',
'''    user_exact = bool(user_reliability["time_exact"] and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_exact = bool(cp_reliability["time_exact"] and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)
    user_clock_ready = bool(user_available and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_clock_ready = bool(cp_available and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)
    result["birth_time_reliability"] = {"user": user_reliability, "counterpart": cp_reliability}''')
replace_once(path,
    '"policy": "non-exact entered times are scanned diagnostically; scan-only angle/house candidates never enter production scores",',
    '"policy": "non-exact entered times are scanned diagnostically; entered-time angles/houses may appear as provisional reference layers, while scan candidates and provisional angles never alter deterministic timing scores",')
replace_once(path,
    'natal_precision_note = "Counterpart entered birth time is available but not verified exact; planetary positions including Moon use the entered clock time, while ASC/DSC/MC/IC and houses are omitted."',
    'natal_precision_note = "Counterpart entered birth time is available but not verified exact; Moon and entered-time ASC/DSC/MC/IC are calculated as provisional reference points and must not be described as exact."')
replace_once(path,
'''    result["house_overlays"] = {
        "available": bool(user_exact and cp_exact),
        "user_in_counterpart": _house_overlays(user_natal, cp_natal, "user", "counterpart"),
        "counterpart_in_user": _house_overlays(cp_natal, user_natal, "counterpart", "user"),
        "precision_note": (
            "Exact-time Whole Sign + Porphyry polar fallback house overlays available."
            if user_exact and cp_exact and fallback_labels else
            "Exact-time Whole Sign + Placidus house overlays available."
            if user_exact and cp_exact else
            "House overlays require provenance-verified exact birth times for both people. Entered but unverified times are preserved for provisional planet layers, not promoted to exact houses."
        ),
    }''',
'''    result["house_overlays"] = {
        "available": bool(user_clock_ready and cp_clock_ready),
        "precision": "exact" if user_exact and cp_exact else ("provisional" if user_clock_ready and cp_clock_ready else "unavailable"),
        "user_in_counterpart": _house_overlays(user_natal, cp_natal, "user", "counterpart"),
        "counterpart_in_user": _house_overlays(cp_natal, user_natal, "counterpart", "user"),
        "precision_note": (
            "Exact-time Whole Sign + Porphyry polar fallback house overlays available."
            if user_exact and cp_exact and fallback_labels else
            "Exact-time Whole Sign + Placidus house overlays available."
            if user_exact and cp_exact else
            "Entered-time Whole Sign + quadrant house overlays are shown as provisional reference only; birth-time sensitivity can materially move angles and houses."
            if user_clock_ready and cp_clock_ready else
            "House overlays require a concrete entered birth time and coordinates for both people."
        ),
    }''')
replace_once(path,
    '"note": "Mathematical midpoint composite. Unverified entered times may support provisional planetary midpoints but never exact angles/houses; unknown time omits Moon and angles.",',
    '"note": "Mathematical midpoint composite. Unverified entered times may support provisional planetary and angle midpoints; only provenance-verified time is exact. Unknown time omits Moon and angles.",')
replace_once(path,
'''    davison = marks_a = marks_b = None
    if user_exact and cp_exact:
        davison = _davison_from_profiles(user_profile, counterpart_profile)
        marks_a = _marks_chart(user_profile, davison)
        marks_b = _marks_chart(counterpart_profile, davison)
        result["davison"] = {"available": True, "chart": davison}
        result["marks"] = {
            "available": True,
            "user": marks_a,
            "counterpart": marks_b,
            "method": "Bob Marks method: Davison(person, relationship Davison), calculated separately for each direction",
        }
    else:
        result["davison"] = {"available": False, "reason": "Davison requires exact birth time and coordinates for both people."}
        result["marks"] = {"available": False, "reason": "Marks charts require the exact-time Davison base chart."}
        result["limitations"].append("Provenance-verified exact birth time/place missing for one or both people: Davison, Marks and Marks tertiary progression are disabled rather than estimated.")''',
'''    davison = marks_a = marks_b = None
    if user_clock_ready and cp_clock_ready:
        relationship_precision = "exact" if user_exact and cp_exact else "provisional"
        davison = _davison_from_profiles(user_profile, counterpart_profile)
        marks_a = _marks_chart(user_profile, davison)
        marks_b = _marks_chart(counterpart_profile, davison)
        result["davison"] = {
            "available": True,
            "precision": relationship_precision,
            "chart": davison,
            "note": "Provisional when based on entered but unverified clock time; never promote to exact without provenance verification." if relationship_precision == "provisional" else "Provenance-verified exact-time Davison chart.",
        }
        result["marks"] = {
            "available": True,
            "precision": relationship_precision,
            "user": marks_a,
            "counterpart": marks_b,
            "method": "Bob Marks method: Davison(person, relationship Davison), calculated separately for each direction",
            "note": "Provisional when the Davison base uses entered but unverified clock time." if relationship_precision == "provisional" else "Exact-time Marks base.",
        }
        if relationship_precision == "provisional":
            result["limitations"].append("Entered but unverified birth time/place: house, Davison and Marks layers are calculated as provisional reference only and may shift if the recorded time changes.")
    else:
        result["davison"] = {"available": False, "reason": "Davison requires a concrete entered birth time and coordinates for both people."}
        result["marks"] = {"available": False, "reason": "Marks charts require an available Davison base chart."}
        result["limitations"].append("Concrete birth time/place missing for one or both people: Davison, Marks and Marks tertiary progression remain unavailable.")''')
replace_once(path,
'''            up = _secondary_progressed_chart(user_profile, target)
            cp = _secondary_progressed_chart(counterpart_profile, target)''',
'''            up = _secondary_progressed_chart(user_profile, target, include_angles=user_clock_ready)
            cp = _secondary_progressed_chart(counterpart_profile, target, include_angles=cp_clock_ready)''')
replace_once(path,
'''            row["marks_tertiary"] = {
                "available": True,
                "user": {"completed_lunar_months": n_a, "chart": mt_a, "to_base_marks_aspects": a_contacts},''',
'''            row["marks_tertiary"] = {
                "available": True,
                "precision": "exact" if user_exact and cp_exact else "provisional",
                "user": {"completed_lunar_months": n_a, "chart": mt_a, "to_base_marks_aspects": a_contacts},''')
replace_once(path,
    'row["marks_tertiary"] = {"available": False, "reason": "Exact-time Marks base charts unavailable."}',
    'row["marks_tertiary"] = {"available": False, "reason": "Marks base charts unavailable because a concrete birth time/place is missing."}')
replace_once(path,
    '"birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",',
    '"birth_time": "An entered clock time is not automatically exact. When a concrete time and coordinates exist, Moon/angles/houses/Davison/Marks may be calculated as provisional reference layers; only provenance-verified time may be labelled exact or treated as decisive. Provisional angles do not alter deterministic timing scores.",')
replace_once(path,
    'return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}',
    'return {"available": False, "reason": f"{target_label} entered birth time/place required for house overlays"}')

# Web: keep Moon and entered-time reference layers visible, while exact-only angle aspects
# remain excluded from the compact fallback unless they are explicitly rendered as provisional detail.
replace_once('web/src/AppNext.tsx',
    "const relationshipTimeSensitivePoints = new Set(['Moon','ASC','DSC','MC','IC'])",
    "const relationshipTimeSensitivePoints = new Set(['ASC','DSC','MC','IC'])")
replace_once('web/src/lib/relationshipUserSummary.ts',
    "const SENSITIVE = new Set(['Moon', 'ASC', 'DSC', 'MC', 'IC', 'Vertex'])",
    "const SENSITIVE = new Set(['ASC', 'DSC', 'MC', 'IC', 'Vertex'])")
replace_once('web/src/lib/readingExperience.test.mjs',
'''test('unverified time excludes sensitive aspects and absent direction remains unknown', () => {
  const unsafe=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]
  const view=buildRelationshipUserSummary({aspects:unsafe,partnerExact:false,mode:'reunion'})
  assert.ok(view.ranked.every(a=>!['Moon','ASC'].includes(a.a)))
  assert.equal(view.incoming.band,'정보 부족')
  assert.equal(view.outgoing.band,'정보 부족')
  assert.equal(view.windows.length,0)
})''',
'''test('entered provisional time keeps Moon but excludes exact-only angle aspects from compact fallback', () => {
  const unsafe=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]
  const view=buildRelationshipUserSummary({aspects:unsafe,partnerExact:false,mode:'reunion'})
  assert.ok(view.ranked.some(a=>a.a==='Moon'))
  assert.ok(view.ranked.every(a=>a.a!=='ASC'))
  assert.equal(view.incoming.band,'정보 부족')
  assert.equal(view.outgoing.band,'정보 부족')
  assert.equal(view.windows.length,0)
})''')
replace_once('web/src/RelationshipPrecisionDetails.tsx',
    '{partnerTimeExact && houseOverlays?.available && <details className="result-card relationship-precision-card">',
    '{houseOverlays?.available && <details className="result-card relationship-precision-card">')
replace_once('web/src/RelationshipPrecisionDetails.tsx',
    '<summary className="relationship-precision-summary"><span>관계 하우스</span><strong>홀사인 + 사분면 하우스 상세</strong><small>{houseContactCount}개 접점 · 펼쳐보기</small></summary>',
    '<summary className="relationship-precision-summary"><span>{partnerTimeExact?\'관계 하우스\':\'입력 생시 참고\'}</span><strong>홀사인 + 사분면 하우스 상세</strong><small>{houseContactCount}개 접점 · {partnerTimeExact?\'exact\':\'provisional\'} · 펼쳐보기</small></summary>')
replace_once('web/src/RelationshipPrecisionDetails.tsx',
    '사분면 하우스는 플라시두스를 우선 사용하고, 극지에서 계산이 불가능하면 포르피리로 명시 전환해. 숫자가 같으면 중첩 근거, 다르면 서로 다른 해석층이야.',
    '{partnerTimeExact?\'검증된 생시 기준이야. \':\'입력한 생시를 그대로 쓴 잠정 참고값이야. 생시가 달라지면 하우스와 각도점도 달라질 수 있어. \'}사분면 하우스는 플라시두스를 우선 사용하고, 극지에서 계산이 불가능하면 포르피리로 명시 전환해. 숫자가 같으면 중첩 근거, 다르면 서로 다른 해석층이야.')
replace_once('web/src/RelationshipPrecisionDetails.tsx',
    '? `입력한 출생시간은 그대로 보존해 행성 위치와 잠정(provisional) 진행층에 사용하지만 exact 생시로 승격하지 않아. ASC/DSC/MC/IC·하우스·Davison(데이비슨)·Marks(마크스)는 비활성화돼. 출처 ${counterpartReliability?.time_source??\'unknown\'} · 신뢰도 ${counterpartReliability?.time_confidence??\'unknown\'}.`',
    '? `입력한 출생시간은 그대로 보존해 Moon(달)·ASC/DSC/MC/IC·하우스·진행층·Davison(데이비슨)·Marks(마크스)까지 잠정(provisional) 참고값으로 계산해. 다만 exact 생시로 승격하지 않고, 각도·하우스 계열은 결정적 근거로 쓰지 않아. 출처 ${counterpartReliability?.time_source??\'unknown\'} · 신뢰도 ${counterpartReliability?.time_confidence??\'unknown\'}.`')
replace_once('web/src/RelationshipPrecisionDetails.tsx',
    "{partnerTimeExact?'검증된 exact 생시 기반':'입력 시각 기반 provisional 행성 진행층'}",
    "{partnerTimeExact?'검증된 exact 생시 기반':'입력 시각 기반 provisional 진행·각도 참고층'}")

# Relationship AI: preserve provisional entered-time layers in the packet, mark them as
# non-decisive, and invalidate cached generation so the new evidence contract takes effect.
path = 'supabase/functions/relationship-interpret-v9-preview/index.ts'
replace_once(path,
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.7-reunion-specific";',
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.8-provisional-time-reference";')
replace_once(path,
    'const REUNION_VERSION="relationship-v11.9-evidence-grounding-repair";',
    'const REUNION_VERSION="relationship-v11.10-provisional-time-reference";')
replace_once(path,
    'if(!exact)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));',
    'if(!available)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));')
replace_once(path,
    'return {available:true,reason:x?.reason??"",method:x?.method??null,chart:chartCore(x?.chart,n),user:chartCore(x?.user,n),counterpart:chartCore(x?.counterpart,n)};',
    'return {available:true,reason:x?.reason??"",precision:x?.precision??null,note:x?.note??null,method:x?.method??null,chart:chartCore(x?.chart,n),user:chartCore(x?.user,n),counterpart:chartCore(x?.counterpart,n)};')
replace_once(path,
    '- 출생시간을 입력했다는 사실과 exact 검증은 다르다. precision.birth_time_reliability를 우선 확인하고, exact가 아니면 ASC/DSC/MC/IC·하우스·Davison/Marks를 확정 근거로 사용하지 않는다. provisional 행성층은 잠정 근거라고 명시한다.',
    '- 출생시간을 입력했다는 사실과 exact 검증은 다르다. precision.birth_time_reliability를 우선 확인한다. exact가 아니어도 입력 생시 기반 Moon·ASC/DSC/MC/IC·하우스·Davison/Marks가 데이터에 제공되면 provisional(잠정) 참고 근거로 읽을 수 있지만, 확정·결정적 근거로 승격하지 않는다. sensitivity_scan 경고와 evidence_confidence를 함께 보고 흔들리는 각도/하우스는 보조 맥락으로만 쓴다.')

replace_once('web/src/lib/relationshipReunionV2.contract.test.mjs',
    'assert.match(server,/REUNION_VERSION="relationship-v11\\.9-evidence-grounding-repair"/)',
    'assert.match(server,/REUNION_VERSION="relationship-v11\\.10-provisional-time-reference"/)')

# Regression contracts for provisional entered-time computation.
replace_once('tests/test_birth_time_reliability_v12.py',
'''    assert "Moon" in chart["positions"]
    assert chart["angles"] == {}
    assert chart["time_reliability"]["time_exact"] is False''',
'''    assert "Moon" in chart["positions"]
    assert chart["angles"].get("ASC") is not None
    assert "ASC" in chart["time_sensitive_points_provisional"]
    assert chart["time_reliability"]["time_exact"] is False''')
replace_once('tests/test_birth_time_reliability_v12.py',
'''    assert out["house_overlays"]["available"] is False
    assert out["davison"]["available"] is False
    assert out["marks"]["available"] is False
    month = out["months"][0]
    assert month["progressed_synastry"]["available"] is True
    assert month["progressed_synastry"]["precision"] == "provisional"
    assert month["progressed_composite"]["available"] is True
    assert month["progressed_composite"]["precision"] == "provisional"
    assert month["marks_tertiary"]["available"] is False''',
'''    assert out["house_overlays"]["available"] is True
    assert out["house_overlays"]["precision"] == "provisional"
    assert out["davison"]["available"] is True
    assert out["davison"]["precision"] == "provisional"
    assert out["marks"]["available"] is True
    assert out["marks"]["precision"] == "provisional"
    month = out["months"][0]
    assert month["progressed_synastry"]["available"] is True
    assert month["progressed_synastry"]["precision"] == "provisional"
    assert month["progressed_composite"]["available"] is True
    assert month["progressed_composite"]["precision"] == "provisional"
    assert month["marks_tertiary"]["available"] is True
    assert month["marks_tertiary"]["precision"] == "provisional"''')
replace_once('tests/test_relationship_reliability_v13.py',
    'def test_provisional_partner_gets_five_point_sensitivity_scan_without_unlocking_exact_layers():',
    'def test_provisional_partner_gets_scan_and_provisional_reference_layers_without_becoming_exact():')
replace_once('tests/test_relationship_reliability_v13.py',
'''    assert out["natal_synastry"]["partner_time_exact"] is False
    assert out["house_overlays"]["available"] is False
    assert out["davison"]["available"] is False
    assert out["marks"]["available"] is False
    assert out["months"][0]["progressed_synastry"]["precision"] == "provisional"''',
'''    assert out["natal_synastry"]["partner_time_exact"] is False
    assert out["house_overlays"]["available"] is True
    assert out["house_overlays"]["precision"] == "provisional"
    assert out["davison"]["available"] is True
    assert out["davison"]["precision"] == "provisional"
    assert out["marks"]["available"] is True
    assert out["marks"]["precision"] == "provisional"
    assert out["months"][0]["progressed_synastry"]["precision"] == "provisional"
    assert out["months"][0]["marks_tertiary"]["precision"] == "provisional"''')

print('provisional relationship-time patch complete')
