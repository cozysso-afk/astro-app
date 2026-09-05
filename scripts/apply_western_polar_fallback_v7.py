from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str, expected_min: int = 1) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    count = text.count(old)
    if count < expected_min:
        raise RuntimeError(f"expected >= {expected_min} anchors in {path}, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new), encoding="utf-8")


# ---------------------------------------------------------------------------
# integrated_fortune_v1.py
# ---------------------------------------------------------------------------
replace_once(
    "integrated_fortune_v1.py",
    "from thai_astrology_v2 import ENGINE_VERSION as THAI_ENGINE_VERSION, build_thai_fortune\n",
    "from thai_astrology_v2 import ENGINE_VERSION as THAI_ENGINE_VERSION, build_thai_fortune\n"
    "from western_house_system_v1 import calculate_quadrant_houses\n",
)
replace_once(
    "integrated_fortune_v1.py",
    'ENGINE_VERSION = "integrated-fortune-v2.11-full-daily-evidence"\nWESTERN_ENGINE_VERSION = "western-period-engine-v11-full-daily-evidence"',
    'ENGINE_VERSION = "integrated-fortune-v2.12-polar-safe-houses"\nWESTERN_ENGINE_VERSION = "western-period-engine-v12-polar-safe-houses"',
)
replace_once(
    "integrated_fortune_v1.py",
    '''def _compute_houses(dt_utc: datetime, latitude: float, longitude: float):
    jd_ut = _to_jd_ut(dt_utc)
    placidus_cusps, ascmc = swe.houses_ex(jd_ut, float(latitude), float(longitude), b"P", 0)
    asc, mc, vertex = float(ascmc[0] % 360), float(ascmc[1] % 360), float(ascmc[3] % 360)
    asc_sign = int(asc // 30)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    return {
        "jd_ut": jd_ut,
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": whole_cusps,
        "placidus_cusps": [float(x % 360) for x in placidus_cusps],
    }
''',
    '''def _compute_houses(dt_utc: datetime, latitude: float, longitude: float):
    jd_ut = _to_jd_ut(dt_utc)
    quadrant_raw, ascmc, house_system = calculate_quadrant_houses(
        jd_ut, float(latitude), float(longitude), extended=True
    )
    quadrant_cusps = [float(x % 360) for x in quadrant_raw]
    asc, mc, vertex = float(ascmc[0] % 360), float(ascmc[1] % 360), float(ascmc[3] % 360)
    asc_sign = int(asc // 30)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    return {
        "jd_ut": jd_ut,
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": whole_cusps,
        "quadrant_cusps": quadrant_cusps,
        # Backward-compatible alias. `house_system` identifies whether these are
        # true Placidus cusps or the explicit polar Porphyry fallback.
        "placidus_cusps": list(quadrant_cusps),
        "house_system": house_system,
    }
''',
)
replace_all(
    "integrated_fortune_v1.py",
    'p_house = _cusp_house(snap["lon"], natal_houses["placidus_cusps"])',
    'p_house = _cusp_house(snap["lon"], natal_houses.get("quadrant_cusps") or natal_houses["placidus_cusps"])',
    expected_min=2,
)
replace_all(
    "integrated_fortune_v1.py",
    '                    "placidus_house": p_house,\n',
    '                    "quadrant_house": p_house,\n'
    '                    "quadrant_system": (natal_houses.get("house_system") or {}).get("used", "Placidus"),\n'
    '                    "placidus_house": p_house,\n',
    expected_min=1,
)
replace_once(
    "integrated_fortune_v1.py",
    '''            "whole_house": w_house,
            "placidus_house": p_house,
            "whole_relevant": bool(w_weight),
            "placidus_relevant": bool(p_weight),
''',
    '''            "whole_house": w_house,
            "quadrant_house": p_house,
            "quadrant_system": (natal_houses.get("house_system") or {}).get("used", "Placidus"),
            "placidus_house": p_house,
            "whole_relevant": bool(w_weight),
            "placidus_relevant": bool(p_weight),
''',
)
replace_once(
    "integrated_fortune_v1.py",
    '''def _pack_houses(houses: dict):
    return (
        float(houses["asc"]),
        float(houses["mc"]),
        float(houses["vertex"]),
        tuple(float(x) for x in houses["whole_cusps"]),
        tuple(float(x) for x in houses["placidus_cusps"]),
    )


def _unpack_houses(packed):
    asc, mc, vertex, whole, placidus = packed
    return {
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": list(whole),
        "placidus_cusps": list(placidus),
    }
''',
    '''def _pack_houses(houses: dict):
    meta = houses.get("house_system") or {
        "requested": "Placidus", "used": "Placidus", "fallback": False,
        "fallback_reason": None, "swiss_error": None,
    }
    quadrant = houses.get("quadrant_cusps") or houses["placidus_cusps"]
    return (
        float(houses["asc"]),
        float(houses["mc"]),
        float(houses["vertex"]),
        tuple(float(x) for x in houses["whole_cusps"]),
        tuple(float(x) for x in quadrant),
        str(meta.get("requested") or "Placidus"),
        str(meta.get("used") or "Placidus"),
        bool(meta.get("fallback")),
        meta.get("fallback_reason"),
        meta.get("swiss_error"),
    )


def _unpack_houses(packed):
    # Accept the pre-V7 five-field tuple so an in-process legacy cache or test
    # fixture cannot crash during a rolling deployment.
    if len(packed) == 5:
        asc, mc, vertex, whole, quadrant = packed
        requested = used = "Placidus"
        fallback = False
        fallback_reason = swiss_error = None
    else:
        asc, mc, vertex, whole, quadrant, requested, used, fallback, fallback_reason, swiss_error = packed
    quadrant_list = list(quadrant)
    return {
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": list(whole),
        "quadrant_cusps": quadrant_list,
        "placidus_cusps": list(quadrant_list),
        "house_system": {
            "requested": requested,
            "used": used,
            "fallback": bool(fallback),
            "fallback_reason": fallback_reason,
            "swiss_error": swiss_error,
        },
    }
''',
)
replace_once(
    "integrated_fortune_v1.py",
    '''    if item.get("kind") == "house":
        transit = item.get("transit", "")
        whole = item.get("whole_house")
        placidus = item.get("placidus_house")
        return f"{transit} · Whole Sign {whole}H · Placidus {placidus}H"
''',
    '''    if item.get("kind") == "house":
        transit = item.get("transit", "")
        whole = item.get("whole_house")
        quadrant = item.get("quadrant_house", item.get("placidus_house"))
        system = item.get("quadrant_system") or "Placidus"
        return f"{transit} · Whole Sign {whole}H · {system} {quadrant}H"
''',
)
replace_once(
    "integrated_fortune_v1.py",
    '''                        "whole_house", "placidus_house", "polarity",
''',
    '''                        "whole_house", "quadrant_house", "quadrant_system", "placidus_house", "polarity",
''',
)
replace_once(
    "integrated_fortune_v1.py",
    '''        "natal": {
            "asc": round(natal_houses["asc"], 6),
            "mc": round(natal_houses["mc"], 6),
        },
''',
    '''        "natal": {
            "asc": round(natal_houses["asc"], 6),
            "mc": round(natal_houses["mc"], 6),
            "house_system": natal_houses["house_system"],
        },
''',
)

# ---------------------------------------------------------------------------
# relationship_western_v1.py
# ---------------------------------------------------------------------------
replace_once(
    "relationship_western_v1.py",
    "import swisseph as swe\n",
    "import swisseph as swe\n\nfrom western_house_system_v1 import calculate_quadrant_houses\n",
)
replace_once(
    "relationship_western_v1.py",
    'ENGINE_VERSION = "relationship-western-v1.5-purpose-scoped-transits"',
    'ENGINE_VERSION = "relationship-western-v1.6-polar-safe-houses"',
)
replace_once(
    "relationship_western_v1.py",
    '''def _angles(jd, lat, lon):
    if lat is None or lon is None:
        return {}
    placidus_cusps, ascmc = swe.houses(float(jd), float(lat), float(lon), b"P")
    asc = _norm(ascmc[0])
    asc_sign = int(asc // 30.0)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    placidus = [round(_norm(x), 6) for x in placidus_cusps]
    return {
        "ASC": round(asc, 6),
        "MC": round(_norm(ascmc[1]), 6),
        "DSC": round(_norm(ascmc[0] + 180.0), 6),
        "IC": round(_norm(ascmc[1] + 180.0), 6),
        # `cusps` remains a backward-compatible Placidus alias.
        "cusps": placidus,
        "placidus_cusps": placidus,
        "whole_cusps": whole_cusps,
    }
''',
    '''def _angles(jd, lat, lon):
    if lat is None or lon is None:
        return {}
    quadrant_raw, ascmc, house_system = calculate_quadrant_houses(float(jd), float(lat), float(lon))
    asc = _norm(ascmc[0])
    asc_sign = int(asc // 30.0)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    quadrant = [round(_norm(x), 6) for x in quadrant_raw]
    return {
        "ASC": round(asc, 6),
        "MC": round(_norm(ascmc[1]), 6),
        "DSC": round(_norm(ascmc[0] + 180.0), 6),
        "IC": round(_norm(ascmc[1] + 180.0), 6),
        "cusps": quadrant,
        "quadrant_cusps": quadrant,
        # Backward-compatible alias; check `house_system.used` before calling it Placidus.
        "placidus_cusps": list(quadrant),
        "whole_cusps": whole_cusps,
        "house_system": house_system,
    }
''',
)
replace_once(
    "relationship_western_v1.py",
    '''def _house_overlays(source_chart, target_chart, source_label, target_label):
    angles = target_chart.get("angles") or {}
    placidus_cusps = angles.get("placidus_cusps") or angles.get("cusps")
    asc = angles.get("ASC")
    if not placidus_cusps or asc is None:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        placidus_house = _house_of_longitude(placidus_cusps, info["lon"])
        whole_house = _whole_sign_house(asc, info["lon"])
        if placidus_house or whole_house:
            rows.append({
                "source": source_label,
                "planet": planet,
                "target": target_label,
                # backward-compatible field; new consumers should use both fields below.
                "house": placidus_house,
                "placidus_house": placidus_house,
                "whole_house": whole_house,
            })
    relationship_houses = {4,5,7,8}
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(min(priority.get(x.get("whole_house"),9), priority.get(x.get("placidus_house"),9)), x["planet"]))
    return {
        "available": True,
        "systems": ["Whole Sign", "Placidus"],
        "all": rows,
        "relationship_houses": [x for x in rows if x.get("whole_house") in relationship_houses or x.get("placidus_house") in relationship_houses],
        "note": "Whole Sign(홀사인)과 Placidus(플라시두스)를 병행. 4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원. 두 체계가 다르면 각각 분리해서 읽고 사건 보장/궁합 점수로 합산하지 않음",
    }
''',
    '''def _house_overlays(source_chart, target_chart, source_label, target_label):
    angles = target_chart.get("angles") or {}
    quadrant_cusps = angles.get("quadrant_cusps") or angles.get("placidus_cusps") or angles.get("cusps")
    asc = angles.get("ASC")
    house_system = angles.get("house_system") or {
        "requested": "Placidus", "used": "Placidus", "fallback": False,
        "fallback_reason": None, "swiss_error": None,
    }
    used_system = str(house_system.get("used") or "Placidus")
    if not quadrant_cusps or asc is None:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        quadrant_house = _house_of_longitude(quadrant_cusps, info["lon"])
        whole_house = _whole_sign_house(asc, info["lon"])
        if quadrant_house or whole_house:
            rows.append({
                "source": source_label,
                "planet": planet,
                "target": target_label,
                "house": quadrant_house,
                "quadrant_house": quadrant_house,
                "quadrant_system": used_system,
                # Compatibility alias. Consumers must use `quadrant_system` for the label.
                "placidus_house": quadrant_house,
                "whole_house": whole_house,
            })
    relationship_houses = {4,5,7,8}
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(min(priority.get(x.get("whole_house"),9), priority.get(x.get("quadrant_house"),9)), x["planet"]))
    return {
        "available": True,
        "systems": ["Whole Sign", used_system],
        "house_system": house_system,
        "all": rows,
        "relationship_houses": [x for x in rows if x.get("whole_house") in relationship_houses or x.get("quadrant_house") in relationship_houses],
        "note": f"Whole Sign(홀사인)과 {used_system} 사분면 하우스를 병행. Placidus가 계산 불가능한 극지 위도에서는 Porphyry를 명시적으로 사용함. 4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원.",
    }
''',
)
replace_once(
    "relationship_western_v1.py",
    '        "house_system": "Whole Sign + Placidus for exact-time natal/Davison/Marks charts",',
    '        "house_system": "Whole Sign + quadrant houses; Placidus primary, explicit Porphyry fallback when Swiss cannot calculate Placidus",',
)
replace_once(
    "relationship_western_v1.py",
    '''    if user_natal is None or cp_natal is None:
        return {"ok": False, "error": "natal chart inputs unavailable", "engine": ENGINE_VERSION}

    natal_aspects = _aspects(user_natal, cp_natal, mode="natal")
''',
    '''    if user_natal is None or cp_natal is None:
        return {"ok": False, "error": "natal chart inputs unavailable", "engine": ENGINE_VERSION}

    fallback_labels = []
    for label, chart in (("user", user_natal), ("counterpart", cp_natal)):
        meta = ((chart.get("angles") or {}).get("house_system") or {})
        if meta.get("fallback"):
            fallback_labels.append(label)
    if fallback_labels:
        result["limitations"].append(
            "Polar latitude house fallback: Swiss Ephemeris could not calculate Placidus for "
            + ", ".join(fallback_labels)
            + "; Porphyry quadrant houses were used explicitly instead."
        )

    natal_aspects = _aspects(user_natal, cp_natal, mode="natal")
''',
)
replace_once(
    "relationship_western_v1.py",
    '''        "precision_note": "Both exact birth times/places required. Unknown partner time disables partner-house overlays rather than estimating them." if not cp_exact else "Exact-time Whole Sign + Placidus house overlays available.",
''',
    '''        "precision_note": (
            "Both exact birth times/places required. Unknown partner time disables partner-house overlays rather than estimating them."
            if not cp_exact else (
                "Exact-time Whole Sign + Porphyry polar fallback house overlays available."
                if fallback_labels else "Exact-time Whole Sign + Placidus house overlays available."
            )
        ),
''',
)

# ---------------------------------------------------------------------------
# personal_marriage_v1.py
# ---------------------------------------------------------------------------
replace_once(
    "personal_marriage_v1.py",
    "import swisseph as swe\n",
    "import swisseph as swe\n\nfrom western_house_system_v1 import calculate_quadrant_houses\n",
)
replace_once(
    "personal_marriage_v1.py",
    'ENGINE_VERSION = "personal-marriage-western-v1.1-fun-forecast"',
    'ENGINE_VERSION = "personal-marriage-western-v1.2-polar-safe-houses"',
)
replace_once(
    "personal_marriage_v1.py",
    '''def _house_data(jd_ut: float, latitude: float, longitude: float) -> dict:
    cusps_raw, ascmc = swe.houses(jd_ut, float(latitude), float(longitude), b"P")
    cusps = [_norm(x) for x in cusps_raw]
    asc = _norm(ascmc[0])
    mc = _norm(ascmc[1])
    asc_sign = int(asc // 30.0)
    return {
        "asc": asc, "mc": mc, "dsc": _norm(asc + 180.0), "ic": _norm(mc + 180.0),
        "placidus_cusps": cusps,
        "whole_asc_sign": asc_sign,
    }
''',
    '''def _house_data(jd_ut: float, latitude: float, longitude: float) -> dict:
    cusps_raw, ascmc, house_system = calculate_quadrant_houses(jd_ut, float(latitude), float(longitude))
    quadrant_cusps = [_norm(x) for x in cusps_raw]
    asc = _norm(ascmc[0])
    mc = _norm(ascmc[1])
    asc_sign = int(asc // 30.0)
    return {
        "asc": asc, "mc": mc, "dsc": _norm(asc + 180.0), "ic": _norm(mc + 180.0),
        "quadrant_cusps": quadrant_cusps,
        "placidus_cusps": list(quadrant_cusps),
        "house_system": house_system,
        "whole_asc_sign": asc_sign,
    }
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''def _house_profile(house_number: int, house: dict, positions: dict) -> dict:
    whole_sign_index = (house["whole_asc_sign"] + house_number - 1) % 12
    whole_ruler = RULER_BY_SIGN[whole_sign_index]
    placidus_lon = house["placidus_cusps"][house_number - 1]
    placidus_sign_index = int(placidus_lon // 30.0)
    placidus_ruler = RULER_BY_SIGN[placidus_sign_index]

    def placement(ruler: str) -> dict:
        p = positions[ruler]
        return {
            "planet": ruler,
            "sign": p["sign"],
            "degree": p["degree"],
            "whole_house": _whole_house(p["longitude"], house["whole_asc_sign"]),
            "placidus_house": _placidus_house(p["longitude"], house["placidus_cusps"]),
        }

    return {
        "house": house_number,
        "whole_sign": SIGNS_KO[whole_sign_index],
        "whole_ruler": whole_ruler,
        "whole_ruler_placement": placement(whole_ruler),
        "placidus_sign": SIGNS_KO[placidus_sign_index],
        "placidus_ruler": placidus_ruler,
        "placidus_ruler_placement": placement(placidus_ruler),
    }
''',
    '''def _house_profile(house_number: int, house: dict, positions: dict) -> dict:
    whole_sign_index = (house["whole_asc_sign"] + house_number - 1) % 12
    whole_ruler = RULER_BY_SIGN[whole_sign_index]
    quadrant_cusps = house.get("quadrant_cusps") or house["placidus_cusps"]
    quadrant_lon = quadrant_cusps[house_number - 1]
    quadrant_sign_index = int(quadrant_lon // 30.0)
    quadrant_ruler = RULER_BY_SIGN[quadrant_sign_index]
    quadrant_system = (house.get("house_system") or {}).get("used", "Placidus")

    def placement(ruler: str) -> dict:
        p = positions[ruler]
        quadrant_house = _placidus_house(p["longitude"], quadrant_cusps)
        return {
            "planet": ruler,
            "sign": p["sign"],
            "degree": p["degree"],
            "whole_house": _whole_house(p["longitude"], house["whole_asc_sign"]),
            "quadrant_house": quadrant_house,
            "quadrant_system": quadrant_system,
            "placidus_house": quadrant_house,
        }

    quadrant_sign = SIGNS_KO[quadrant_sign_index]
    return {
        "house": house_number,
        "whole_sign": SIGNS_KO[whole_sign_index],
        "whole_ruler": whole_ruler,
        "whole_ruler_placement": placement(whole_ruler),
        "quadrant_sign": quadrant_sign,
        "quadrant_ruler": quadrant_ruler,
        "quadrant_ruler_placement": placement(quadrant_ruler),
        "quadrant_system": quadrant_system,
        # Compatibility aliases for pre-V7 clients.
        "placidus_sign": quadrant_sign,
        "placidus_ruler": quadrant_ruler,
        "placidus_ruler_placement": placement(quadrant_ruler),
    }
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''def _spouse_archetype(profiles: dict, natal_aspects: list[dict]) -> dict:
    seventh = profiles["7"]
    career_house = profiles["4"]  # 10th from the 7th = partner-career derivative house.
    signs = []
    for sign in (seventh["whole_sign"], seventh["placidus_sign"]):
''',
    '''def _spouse_archetype(profiles: dict, natal_aspects: list[dict]) -> dict:
    seventh = profiles["7"]
    career_house = profiles["4"]  # 10th from the 7th = partner-career derivative house.
    quadrant_sign = seventh.get("quadrant_sign") or seventh["placidus_sign"]
    quadrant_system = seventh.get("quadrant_system") or "Placidus"
    quadrant_label = "플라시두스" if quadrant_system == "Placidus" else "포르피리"
    signs = []
    for sign in (seventh["whole_sign"], quadrant_sign):
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''        f"배우자 축: {seventh['whole_sign']} 중심" + (f" + 플라시두스 {seventh['placidus_sign']} 보조" if seventh['placidus_sign'] != seventh['whole_sign'] else ""),
''',
    '''        f"배우자 축: {seventh['whole_sign']} 중심" + (f" + {quadrant_label} {quadrant_sign} 보조" if quadrant_sign != seventh['whole_sign'] else ""),
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''        "precision_note": "외모·직업·만남 경로는 7하우스/DSC와 주인행성, 파생 10하우스를 이용한 전통적 배우자상 추정이다. 실제 이름·주소·회사처럼 특정 개인의 신원을 맞히는 기능은 아니다.",
''',
    '''        "precision_note": f"외모·직업·만남 경로는 7하우스/DSC와 주인행성, 파생 10하우스를 이용한 전통적 배우자상 추정이다. 사분면 하우스 체계는 {quadrant_label}({quadrant_system})를 사용했다. 실제 이름·주소·회사처럼 특정 개인의 신원을 맞히는 기능은 아니다.",
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''        "period": {"start": start_date.isoformat(), "end": end_date.isoformat(), "day_count": len(timing_rows)},
        "angles": {
''',
    '''        "period": {"start": start_date.isoformat(), "end": end_date.isoformat(), "day_count": len(timing_rows)},
        "house_system": house["house_system"],
        "angles": {
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''                "whole_house": _whole_house(positions[name]["longitude"], house["whole_asc_sign"]),
                "placidus_house": _placidus_house(positions[name]["longitude"], house["placidus_cusps"]),
''',
    '''                "whole_house": _whole_house(positions[name]["longitude"], house["whole_asc_sign"]),
                "quadrant_house": _placidus_house(positions[name]["longitude"], house.get("quadrant_cusps") or house["placidus_cusps"]),
                "quadrant_system": house["house_system"]["used"],
                "placidus_house": _placidus_house(positions[name]["longitude"], house.get("quadrant_cusps") or house["placidus_cusps"]),
''',
)
replace_once(
    "personal_marriage_v1.py",
    '''        "limits": [
            "결혼 가능성 %는 통계적 확률이 아니라 점성학적 신호 강도를 재미용 0~100 지수로 번역한 값이다.",
''',
    '''        "limits": [
            *(["극지 위도에서 Swiss Ephemeris가 Placidus를 계산할 수 없어 Porphyry 사분면 하우스를 명시적으로 사용했다."] if house["house_system"]["fallback"] else []),
            "결혼 가능성 %는 통계적 확률이 아니라 점성학적 신호 강도를 재미용 0~100 지수로 번역한 값이다.",
''',
)

# ---------------------------------------------------------------------------
# web type/label compatibility: never display Porphyry values as Placidus.
# ---------------------------------------------------------------------------
replace_once(
    "web/src/appTypes.ts",
    '''export type Aspect = {
''',
    '''export type HouseSystemMeta = {
  requested: string
  used: string
  fallback: boolean
  fallback_reason?: string | null
  swiss_error?: string | null
}

export type Aspect = {
''',
)
replace_all(
    "web/src/appTypes.ts",
    'Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; whole_house?:number|null }>',
    'Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; quadrant_house?:number|null; quadrant_system?:string; whole_house?:number|null }>',
    expected_min=2,
)
replace_once(
    "web/src/appTypes.ts",
    '''  placidus_house?: number | null
  polarity?: number
''',
    '''  placidus_house?: number | null
  quadrant_house?: number | null
  quadrant_system?: string
  polarity?: number
''',
)
replace_once(
    "web/src/appTypes.ts",
    '    natal: { asc: number; mc: number }',
    '    natal: { asc: number; mc: number; house_system?: HouseSystemMeta }',
)
replace_once(
    "web/src/RelationshipPrecisionDetails.tsx",
    '''  const houseContactCount = houseGroups.reduce((sum, group) => sum + group.rows.length, 0)

  return <>
''',
    '''  const houseContactCount = houseGroups.reduce((sum, group) => sum + group.rows.length, 0)
  const quadrantLabel = (system?: string) => system === 'Porphyry' ? '포르피리' : system === 'Placidus' ? '플라시두스' : (system ?? '사분면')

  return <>
''',
)
replace_once(
    "web/src/RelationshipPrecisionDetails.tsx",
    '''      <summary className="relationship-precision-summary"><span>관계 하우스</span><strong>홀사인 + 플라시두스 상세</strong><small>{houseContactCount}개 접점 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">두 하우스 체계를 따로 보여줘. 숫자가 같으면 중첩 근거, 다르면 서로 다른 해석층이야.</p><div className="month-list">{houseGroups.map((group)=><div className="month-card relationship-precision-month" key={group.title}><div className="month-title"><strong>{group.title}</strong><span>{group.rows.length}개 접점</span></div>{group.rows.slice(0,12).map((row,index)=><div className="tight-row" key={`${group.title}-${row.planet}-${index}`}><span>{planetLabels[row.planet]??row.planet}</span><b>홀사인 {row.whole_house??'—'}H · 플라시두스 {row.placidus_house??row.house??'—'}H</b></div>)}</div>)}</div></div>
''',
    '''      <summary className="relationship-precision-summary"><span>관계 하우스</span><strong>홀사인 + 사분면 하우스 상세</strong><small>{houseContactCount}개 접점 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">사분면 하우스는 플라시두스를 우선 사용하고, 극지에서 계산이 불가능하면 포르피리로 명시 전환해. 숫자가 같으면 중첩 근거, 다르면 서로 다른 해석층이야.</p><div className="month-list">{houseGroups.map((group)=><div className="month-card relationship-precision-month" key={group.title}><div className="month-title"><strong>{group.title}</strong><span>{group.rows.length}개 접점</span></div>{group.rows.slice(0,12).map((row,index)=><div className="tight-row" key={`${group.title}-${row.planet}-${index}`}><span>{planetLabels[row.planet]??row.planet}</span><b>홀사인 {row.whole_house??'—'}H · {quadrantLabel(row.quadrant_system)} {row.quadrant_house??row.placidus_house??row.house??'—'}H</b></div>)}</div>)}</div></div>
''',
)

replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''  result: {
    mode: 'personal_unmarried'
''',
    '''  result: {
    mode: 'personal_unmarried'
    house_system?: { requested: string; used: string; fallback: boolean; fallback_reason?: string | null }
''',
)
replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''      whole_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
      placidus_sign: string
      placidus_ruler: string
      placidus_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
''',
    '''      whole_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
      quadrant_sign?: string
      quadrant_ruler?: string
      quadrant_ruler_placement?: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
      quadrant_system?: string
      placidus_sign: string
      placidus_ruler: string
      placidus_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
''',
)
replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''    relationship_planets: Record<string, { sign: string; degree: number; whole_house: number; placidus_house: number }>
''',
    '''    relationship_planets: Record<string, { sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }>
''',
)
replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''function rulerLine(row: PersonalMarriageResponse['result']['relationship_houses'][string]) {
  const same = row.whole_ruler === row.placidus_ruler
  if (same) return `${row.whole_sign} / ${row.placidus_sign} · 주인행성 ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) · 홀사인 ${row.whole_ruler_placement.whole_house}H / 플라시두스 ${row.whole_ruler_placement.placidus_house}H`
  return `홀사인 ${row.whole_sign} → ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) ${row.whole_ruler_placement.whole_house}H · 플라시두스 ${row.placidus_sign} → ${row.placidus_ruler}(${planetKo[row.placidus_ruler] ?? row.placidus_ruler}) ${row.placidus_ruler_placement.placidus_house}H`
}
''',
    '''function rulerLine(row: PersonalMarriageResponse['result']['relationship_houses'][string]) {
  const system = row.quadrant_system ?? 'Placidus'
  const systemKo = system === 'Porphyry' ? '포르피리' : '플라시두스'
  const quadrantSign = row.quadrant_sign ?? row.placidus_sign
  const quadrantRuler = row.quadrant_ruler ?? row.placidus_ruler
  const quadrantPlacement = row.quadrant_ruler_placement ?? row.placidus_ruler_placement
  const same = row.whole_ruler === quadrantRuler
  if (same) return `${row.whole_sign} / ${quadrantSign} · 주인행성 ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) · 홀사인 ${row.whole_ruler_placement.whole_house}H / ${systemKo} ${row.whole_ruler_placement.quadrant_house ?? row.whole_ruler_placement.placidus_house}H`
  return `홀사인 ${row.whole_sign} → ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) ${row.whole_ruler_placement.whole_house}H · ${systemKo} ${quadrantSign} → ${quadrantRuler}(${planetKo[quadrantRuler] ?? quadrantRuler}) ${quadrantPlacement.quadrant_house ?? quadrantPlacement.placidus_house}H`
}
''',
)
replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''  const windows = forecast.strong_windows.slice(0,3)
  const pressureDays = result.timing.pressure_days.filter((row)=>row.pressure_load>0).slice(0,3)
''',
    '''  const windows = forecast.strong_windows.slice(0,3)
  const pressureDays = result.timing.pressure_days.filter((row)=>row.pressure_load>0).slice(0,3)
  const quadrantLabel = (system?: string) => system === 'Porphyry' ? '포르피리' : '플라시두스'
''',
)
replace_once(
    "web/src/PersonalMarriagePanel.tsx",
    '''      <div className="relationship-key-aspects"><strong>관계 행성의 기본 배치</strong>{planets.map(([key,row])=><div key={key}><b>{key}({planetKo[key]}) · {row.sign} {row.degree.toFixed(1)}°</b><p>홀사인 {row.whole_house}하우스 · 플라시두스 {row.placidus_house}하우스</p></div>)}</div>
''',
    '''      <div className="relationship-key-aspects"><strong>관계 행성의 기본 배치</strong>{planets.map(([key,row])=><div key={key}><b>{key}({planetKo[key]}) · {row.sign} {row.degree.toFixed(1)}°</b><p>홀사인 {row.whole_house}하우스 · {quadrantLabel(row.quadrant_system ?? result.house_system?.used)} {row.quadrant_house ?? row.placidus_house}하우스</p></div>)}</div>
''',
)

# ---------------------------------------------------------------------------
# Required Calculation Audit CI
# ---------------------------------------------------------------------------
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "      - 'personal_marriage_v1.py'\n      - 'astrocartography_v1.py'\n",
    "      - 'personal_marriage_v1.py'\n      - 'western_house_system_v1.py'\n      - 'astrocartography_v1.py'\n",
)
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "      - 'tests/test_astrocartography_external_gold_v6.py'\n      - 'tests/test_thai_*.py'\n",
    "      - 'tests/test_astrocartography_external_gold_v6.py'\n      - 'tests/test_western_polar_timezone_v7.py'\n      - 'tests/test_thai_*.py'\n",
)
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "python -m py_compile integrated_fortune_v1.py relationship_western_v1.py relationship_saju_v1.py personal_marriage_v1.py astrocartography_v1.py thai_lagna_v1.py thai_suriyayat_v1.py api/main.py",
    "python -m py_compile integrated_fortune_v1.py relationship_western_v1.py relationship_saju_v1.py personal_marriage_v1.py western_house_system_v1.py astrocartography_v1.py thai_lagna_v1.py thai_suriyayat_v1.py api/main.py",
)
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "            tests/test_astrocartography_external_gold_v6.py \\\n            tests/test_personal_marriage_v1.py\n",
    "            tests/test_astrocartography_external_gold_v6.py \\\n            tests/test_western_polar_timezone_v7.py \\\n            tests/test_personal_marriage_v1.py\n",
)

print("V7 polar-safe house fallback patch applied")
