from __future__ import annotations

import re
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex expected one match, got {count}: {pattern[:120]!r}")
    write(path, new)


# ---------- API profile contract ----------
once(
    "api/main.py",
    "from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\n",
    "from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\nfrom birth_time_reliability_v1 import resolve_birth_time_reliability\n",
)
once(
    "api/main.py",
    'APP_VERSION = "api-fortune-v5.4-personal-marriage-forecast"',
    'APP_VERSION = "api-fortune-v5.5-birth-time-provenance"',
)
old_profile = '''class RelationshipProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time | None = None
    time_known: bool = True
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)

    def engine_payload(self) -> dict:
        exact_time = bool(self.time_known and self.birth_time is not None)
        return {
            "name": self.name or "",
            "birth_date": self.birth_date,
            "birth_time": self.birth_time if exact_time else None,
            "time_known": exact_time,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "utc_offset_hours": self.utc_offset_hours,
        }
'''
new_profile = '''TimeSource = Literal["official_record", "family_memory", "user_estimate", "arbitrary_input", "rectified", "unknown"]
TimeConfidence = Literal["exact", "high", "medium", "low", "unknown"]


class RectifiedWindow(BaseModel):
    start: dt_time | None = None
    end: dt_time | None = None


class RelationshipProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time | None = None
    time_known: bool = True
    time_source: TimeSource = "unknown"
    time_confidence: TimeConfidence = "unknown"
    rectified_window: RectifiedWindow | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)

    def engine_payload(self) -> dict:
        raw = {
            "birth_time": self.birth_time,
            "time_known": self.time_known,
            "time_source": self.time_source,
            "time_confidence": self.time_confidence,
            "rectified_window": self.rectified_window.model_dump() if self.rectified_window else None,
        }
        reliability = resolve_birth_time_reliability(raw)
        return {
            "name": self.name or "",
            "birth_date": self.birth_date,
            "birth_time": self.birth_time if reliability["time_available"] else None,
            "time_known": reliability["time_available"],
            "time_source": reliability["time_source"],
            "time_confidence": reliability["time_confidence"],
            "rectified_window": reliability["rectified_window"],
            "time_reliability": reliability,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "utc_offset_hours": self.utc_offset_hours,
        }
'''
once("api/main.py", old_profile, new_profile)
once(
    "api/main.py",
    '''class FortuneProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)
    gender: Gender = "female"
''',
    '''class FortuneProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time
    time_known: bool = True
    time_source: TimeSource = "unknown"
    time_confidence: TimeConfidence = "unknown"
    rectified_window: RectifiedWindow | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)
    gender: Gender = "female"
''',
)

# ---------- Western relationship engine ----------
once(
    "relationship_western_v1.py",
    "from western_house_system_v1 import calculate_quadrant_houses\n",
    "from western_house_system_v1 import calculate_quadrant_houses\nfrom birth_time_reliability_v1 import resolve_birth_time_reliability\n",
)
once(
    "relationship_western_v1.py",
    'ENGINE_VERSION = "relationship-western-v1.8-timing-timezone-contract"',
    'ENGINE_VERSION = "relationship-western-v1.9-birth-time-provenance"',
)
regex_once(
    "relationship_western_v1.py",
    r'def _profile_chart\(profile, allow_unknown_time=False\):\n.*?\n\ndef _point_map',
    '''def _profile_chart(profile, allow_unknown_time=False):
    reliability = resolve_birth_time_reliability(profile)
    time_available = bool(reliability["time_available"])
    bt = profile.get("birth_time")
    using_noon_proxy = False
    if not time_available or bt is None:
        if not allow_unknown_time:
            return None
        bt = dt_time(12, 0)
        using_noon_proxy = True
    jd = _jd_from_utc(_utc_datetime(profile["birth_date"], bt, profile.get("utc_offset_hours", 9.0)))
    chart = _chart_from_jd(
        jd,
        profile.get("latitude"), profile.get("longitude"),
        include_moon=time_available,
        include_angles=bool(
            reliability["time_exact"]
            and profile.get("latitude") is not None
            and profile.get("longitude") is not None
        ),
    )
    chart["time_reliability"] = reliability
    chart["time_basis"] = "local_noon_proxy" if using_noon_proxy else "entered_birth_time"
    if time_available and not reliability["time_exact"]:
        chart["time_sensitive_points_omitted"] = ["ASC", "DSC", "MC", "IC", "quadrant_houses"]
    elif not time_available:
        chart["time_sensitive_points_omitted"] = ["Moon", "ASC", "DSC", "MC", "IC", "quadrant_houses"]
    return chart


def _point_map''',
)
once(
    "relationship_western_v1.py",
    '''    user_exact = bool(user_profile.get("birth_time") is not None and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_exact = bool(counterpart_profile.get("time_known") and counterpart_profile.get("birth_time") is not None and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)

    user_natal = _profile_chart(user_profile, allow_unknown_time=False)
    cp_natal = _profile_chart(counterpart_profile, allow_unknown_time=True)
''',
    '''    user_reliability = resolve_birth_time_reliability(user_profile)
    cp_reliability = resolve_birth_time_reliability(counterpart_profile)
    user_available = bool(user_reliability["time_available"])
    cp_available = bool(cp_reliability["time_available"])
    user_exact = bool(user_reliability["time_exact"] and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_exact = bool(cp_reliability["time_exact"] and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)
    result["birth_time_reliability"] = {"user": user_reliability, "counterpart": cp_reliability}

    user_natal = _profile_chart(user_profile, allow_unknown_time=True)
    cp_natal = _profile_chart(counterpart_profile, allow_unknown_time=True)
''',
)
once(
    "relationship_western_v1.py",
    '''    result["natal_synastry"] = {
        "available": True,
        "partner_time_exact": cp_exact,
        "aspects": natal_aspects,
        "note": "If partner birth time is unknown, partner Moon and angles are excluded; remaining planets use local noon and should be treated as lower precision near orb boundaries." if not cp_exact else "Both birth times/locations available; planets and angles included.",
    }
''',
    '''    if cp_exact:
        natal_precision_note = "Counterpart birth time is provenance-verified exact; planets and angles are available."
    elif cp_available:
        natal_precision_note = "Counterpart entered birth time is available but not verified exact; planetary positions including Moon use the entered clock time, while ASC/DSC/MC/IC and houses are omitted."
    else:
        natal_precision_note = "Counterpart birth time is unknown; Moon and angles are excluded and remaining planets use local noon as a non-exact proxy."
    result["natal_synastry"] = {
        "available": True,
        "user_time_available": user_available,
        "user_time_exact": user_exact,
        "partner_time_available": cp_available,
        "partner_time_exact": cp_exact,
        "user_time_reliability": user_reliability,
        "partner_time_reliability": cp_reliability,
        "aspects": natal_aspects,
        "note": natal_precision_note,
    }
''',
)
once(
    "relationship_western_v1.py",
    '''        "precision_note": (
            "Both exact birth times/places required. Unknown partner time disables partner-house overlays rather than estimating them."
            if not cp_exact else (
                "Exact-time Whole Sign + Porphyry polar fallback house overlays available."
                if fallback_labels else "Exact-time Whole Sign + Placidus house overlays available."
            )
        ),
''',
    '''        "precision_note": (
            "Exact-time Whole Sign + Porphyry polar fallback house overlays available."
            if user_exact and cp_exact and fallback_labels else
            "Exact-time Whole Sign + Placidus house overlays available."
            if user_exact and cp_exact else
            "House overlays require provenance-verified exact birth times for both people. Entered but unverified times are preserved for provisional planet layers, not promoted to exact houses."
        ),
''',
)
once(
    "relationship_western_v1.py",
    '''    result["composite"] = {
        "available": True,
        "chart": _midpoint_chart(user_natal, cp_natal),
        "note": "Mathematical midpoint composite. Partner angles/Moon are omitted when partner time is unknown.",
    }
''',
    '''    result["composite"] = {
        "available": True,
        "chart": _midpoint_chart(user_natal, cp_natal),
        "precision": "exact" if user_exact and cp_exact else ("provisional" if user_available and cp_available else "time_unknown"),
        "note": "Mathematical midpoint composite. Unverified entered times may support provisional planetary midpoints but never exact angles/houses; unknown time omits Moon and angles.",
    }
''',
)
once(
    "relationship_western_v1.py",
    '''        result["limitations"].append("Partner exact birth time/place missing: Davison, Marks and Marks tertiary progression are disabled rather than estimated.")
''',
    '''        result["limitations"].append("Provenance-verified exact birth time/place missing for one or both people: Davison, Marks and Marks tertiary progression are disabled rather than estimated.")
''',
)
once(
    "relationship_western_v1.py",
    '''        if cp_exact:
            up = _secondary_progressed_chart(user_profile, target)
            cp = _secondary_progressed_chart(counterpart_profile, target)
''',
    '''        if user_available and cp_available:
            up = _secondary_progressed_chart(user_profile, target)
            cp = _secondary_progressed_chart(counterpart_profile, target)
            progressed_precision = "exact" if user_exact and cp_exact else "provisional"
''',
)
once(
    "relationship_western_v1.py",
    '''            row["progressed_synastry"] = {"available": True, **ps}
''',
    '''            row["progressed_synastry"] = {"available": True, "precision": progressed_precision, **ps}
''',
)
once(
    "relationship_western_v1.py",
    '''            row["progressed_composite"] = {
                "available": True,
                "chart": prog_comp,
''',
    '''            row["progressed_composite"] = {
                "available": True,
                "precision": progressed_precision,
                "chart": prog_comp,
''',
)
once(
    "relationship_western_v1.py",
    '''        else:
            row["progressed_synastry"] = {"available": False, "reason": "Exact partner birth time required for reliable progressed synastry."}
            row["progressed_composite"] = {"available": False, "reason": "Exact partner birth time required for progressed composite."}
''',
    '''        else:
            row["progressed_synastry"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed synastry."}
            row["progressed_composite"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed composite."}
''',
)
once(
    "relationship_western_v1.py",
    '''    result["interpretation_policy"] = {
        "static": "Natal synastry/composite/Davison/Marks describe different relationship structures and must not be collapsed into one score.",
        "timing": "Secondary progressed synastry/progressed composite and Marks Tertiary-I are timing layers. Repeated tight contacts across independent layers may be called convergence, never event certainty.",
        "privacy": "No chart layer proves another person's private feelings, intention, contact, or reconciliation.",
    }
''',
    '''    result["interpretation_policy"] = {
        "static": "Natal synastry/composite/Davison/Marks describe different relationship structures and must not be collapsed into one score.",
        "timing": "Secondary progressed synastry/progressed composite and Marks Tertiary-I are timing layers. Repeated tight contacts across independent layers may be called convergence, never event certainty.",
        "birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",
        "privacy": "No chart layer proves another person's private feelings, intention, contact, or reconciliation.",
    }
''',
)

# ---------- Relationship Saju precision wording ----------
once(
    "relationship_saju_v1.py",
    "from integrated_fortune_v1 import _natal_saju_components, _ten_god\n",
    "from integrated_fortune_v1 import _natal_saju_components, _ten_god\nfrom birth_time_reliability_v1 import resolve_birth_time_reliability\n",
)
once(
    "relationship_saju_v1.py",
    'ENGINE_VERSION = "relationship-saju-v1"',
    'ENGINE_VERSION = "relationship-saju-v1.1-birth-time-provenance"',
)
once(
    "relationship_saju_v1.py",
    '''def _pillars(profile: dict) -> dict:
    known = bool(profile.get("time_known", True) and profile.get("birth_time") is not None)
    bt = profile.get("birth_time") or dt_time(12, 0)
''',
    '''def _pillars(profile: dict) -> dict:
    time_reliability = resolve_birth_time_reliability(profile)
    known = bool(time_reliability["time_available"])
    exact = bool(time_reliability["time_exact"])
    bt = profile.get("birth_time") or dt_time(12, 0)
''',
)
once(
    "relationship_saju_v1.py",
    '''    precision = (
        "exact_true_solar" if known and lon is not None
        else "legal_time_no_longitude" if known
        else "date_noon_proxy"
    )
''',
    '''    precision = (
        "exact_true_solar" if exact and lon is not None
        else "exact_clock_no_longitude" if exact
        else "provisional_true_solar" if known and lon is not None
        else "provisional_legal_time_no_longitude" if known
        else "date_noon_proxy"
    )
''',
)
once(
    "relationship_saju_v1.py",
    '''        "pillar_boundary_policy": natal["boundary_policy"],
        "time_known": known,
''',
    '''        "pillar_boundary_policy": natal["boundary_policy"],
        "time_known": known,
        "time_exact": exact,
        "time_reliability": time_reliability,
''',
)
once(
    "relationship_saju_v1.py",
    '''    if not a["time_known"]: limitations.append("A 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
    if not b["time_known"]: limitations.append("B 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
''',
    '''    if not a["time_known"]: limitations.append("A 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
    elif not a["time_exact"]: limitations.append("A 출생시간 입력값은 있으나 exact 검증 아님: 입력 시각 기준 시주는 provisional로 사용")
    if not b["time_known"]: limitations.append("B 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
    elif not b["time_exact"]: limitations.append("B 출생시간 입력값은 있으나 exact 검증 아님: 입력 시각 기준 시주는 provisional로 사용")
''',
)

# ---------- Web profile types ----------
once(
    "web/src/appTypes.ts",
    "export type Gender = 'female' | 'male'\n",
    "export type Gender = 'female' | 'male'\nexport type TimeSource = 'official_record' | 'family_memory' | 'user_estimate' | 'arbitrary_input' | 'rectified' | 'unknown'\nexport type TimeConfidence = 'exact' | 'high' | 'medium' | 'low' | 'unknown'\n\nexport type BirthTimeReliability = {\n  time_available: boolean\n  time_exact: boolean\n  status: 'exact' | 'provisional' | 'unknown'\n  time_source: TimeSource\n  time_confidence: TimeConfidence\n  rectified_window?: { start?: string | null; end?: string | null } | null\n  provisional?: boolean\n  policy?: string\n}\n",
)
once(
    "web/src/appTypes.ts",
    '''  utcOffset: string
  gender: Gender
}
''',
    '''  utcOffset: string
  gender: Gender
  timeSource: TimeSource
  timeConfidence: TimeConfidence
  rectifiedWindowStart: string
  rectifiedWindowEnd: string
}
''',
)
once(
    "web/src/appTypes.ts",
    '''    limitations?: string[]
    timing_timezone_policy?: string
''',
    '''    limitations?: string[]
    birth_time_reliability?: { user: BirthTimeReliability; counterpart: BirthTimeReliability }
    timing_timezone_policy?: string
''',
)
once(
    "web/src/appTypes.ts",
    '''    natal_synastry?: { available: boolean; partner_time_exact: boolean; aspects: Aspect[]; note?: string }
''',
    '''    natal_synastry?: { available: boolean; user_time_available?: boolean; user_time_exact?: boolean; partner_time_available?: boolean; partner_time_exact: boolean; user_time_reliability?: BirthTimeReliability; partner_time_reliability?: BirthTimeReliability; aspects: Aspect[]; note?: string }
''',
)

# ---------- Profile UI ----------
once(
    "web/src/ProfileView.tsx",
    "import { KoreaBirthplaceSelector } from './koreaBirthplaces'\n",
    "import { KoreaBirthplaceSelector } from './koreaBirthplaces'\nimport { BirthTimeReliabilityFields } from './BirthTimeReliabilityFields'\n",
)
once(
    "web/src/ProfileView.tsx",
    '''      <label className="field birth-time-field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(event)=>onChange({...birthProfile,birthTime:event.target.value})}/></label>
      <label className="field field-wide"><span>성별 · 사주 대운 계산 기준</span>''',
    '''      <label className="field birth-time-field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(event)=>onChange({...birthProfile,birthTime:event.target.value})}/></label>
      <BirthTimeReliabilityFields value={birthProfile} onChange={(patch)=>onChange({...birthProfile,...patch})}/>
      <label className="field field-wide"><span>성별 · 사주 대운 계산 기준</span>''',
)

# ---------- App request plumbing ----------
once(
    "web/src/AppNext.tsx",
    "import { ProfileView } from './ProfileView'\n",
    "import { ProfileView } from './ProfileView'\nimport { BirthTimeReliabilityFields } from './BirthTimeReliabilityFields'\n",
)
once(
    "web/src/AppNext.tsx",
    '''const emptyProfile: BirthProfile = {
  name: '', birthDate: '', birthTime: '', placeKey: '', latitude: '', longitude: '', utcOffset: '9', gender: 'female',
}
''',
    '''const emptyProfile: BirthProfile = {
  name: '', birthDate: '', birthTime: '', placeKey: '', latitude: '', longitude: '', utcOffset: '9', gender: 'female',
  timeSource: 'unknown', timeConfidence: 'unknown', rectifiedWindowStart: '', rectifiedWindowEnd: '',
}
''',
)
once(
    "web/src/AppNext.tsx",
    '''function parseOptionalNumber(value: string) {
  const n = Number(value.trim()); return value.trim() && Number.isFinite(n) ? n : null
}
''',
    '''function parseOptionalNumber(value: string) {
  const n = Number(value.trim()); return value.trim() && Number.isFinite(n) ? n : null
}
function birthTimeRequestMeta(profile: BirthProfile, timeKnown = Boolean(profile.birthTime)) {
  const available = Boolean(timeKnown && profile.birthTime)
  const rectifiedWindow = profile.timeSource === 'rectified' && (profile.rectifiedWindowStart || profile.rectifiedWindowEnd)
    ? { start: profile.rectifiedWindowStart || null, end: profile.rectifiedWindowEnd || null }
    : null
  return {
    time_known: available,
    time_source: profile.timeSource,
    time_confidence: profile.timeConfidence,
    rectified_window: rectifiedWindow,
  }
}
''',
)
once(
    "web/src/AppNext.tsx",
    '''        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: userLatitude, longitude: userLongitude, utc_offset_hours: Number(birthProfile.utcOffset || 9),
''',
    '''        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime,
        ...birthTimeRequestMeta(birthProfile),
        latitude: userLatitude, longitude: userLongitude, utc_offset_hours: Number(birthProfile.utcOffset || 9),
''',
)
once(
    "web/src/AppNext.tsx",
    '''        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown, latitude: counterpartLatitude,
''',
    '''        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        ...birthTimeRequestMeta(counterpart, counterpart.timeKnown), latitude: counterpartLatitude,
''',
)
once(
    "web/src/AppNext.tsx",
    '''              <label className="check-field field-wide"><input type="checkbox" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 출생지역은 그대로 기록 가능 · Moon(달)·각도·하우스·다빈슨/마크스 등 시간민감 레이어만 자동 제외</span></label>
              <KoreaBirthplaceSelector''',
    '''              <label className="check-field field-wide"><input type="checkbox" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime,timeSource:e.target.checked?'unknown':counterpart.timeSource,timeConfidence:e.target.checked?'unknown':counterpart.timeConfidence})}/><span>상대 출생시간 모름 — 출생지역은 그대로 기록 가능 · Moon(달)·각도·하우스·다빈슨/마크스 등 시간민감 레이어만 자동 제외</span></label>
              <BirthTimeReliabilityFields value={counterpart} disabled={!counterpart.timeKnown} onChange={(patch)=>setCounterpart({...counterpart,...patch})}/>
              <KoreaBirthplaceSelector''',
)
once(
    "web/src/AppNext.tsx",
    '''  const resultMonths = (relationshipResult?.result?.natal_synastry?.partner_time_exact ? relationshipResult?.result?.months : []) ?? []
''',
    '''  const resultMonths = relationshipResult?.result?.months ?? []
''',
)

# Add provenance to personal-profile API requests without changing their current calculation semantics yet.
for old, new in [
    ('''          birth_time: birthProfile.birthTime,
          latitude: Number(birthProfile.latitude),''', '''          birth_time: birthProfile.birthTime,
          ...birthTimeRequestMeta(birthProfile),
          latitude: Number(birthProfile.latitude),'''),
    ('''        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime,
        latitude, longitude,''', '''        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime,
        ...birthTimeRequestMeta(birthProfile),
        latitude, longitude,'''),
]:
    text = read("web/src/AppNext.tsx")
    if old in text:
        write("web/src/AppNext.tsx", text.replace(old, new, 1))

# ---------- Precision UI ----------
path = "web/src/RelationshipPrecisionDetails.tsx"
text = read(path)
text = text.replace(
    '''  const resultMonths = result.result.months ?? []
  const houseOverlays = result.result.house_overlays
''',
    '''  const resultMonths = result.result.months ?? []
  const houseOverlays = result.result.house_overlays
  const counterpartReliability = result.result.birth_time_reliability?.counterpart ?? result.result.natal_synastry?.partner_time_reliability
  const partnerTimeAvailable = Boolean(counterpartReliability?.time_available ?? result.result.natal_synastry?.partner_time_available ?? partnerTimeExact)
''',
    1,
)
old_block = '''    {!partnerTimeExact ? <section className="result-card">
      <div className="result-card-title"><span>정밀도</span><strong>출생시간 미상 · 일부 시기층 제외</strong></div>
      <div className="status-banner subtle"><AlertTriangle size={16}/><span>상대 출생시간을 몰라 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 입력한 출생지역은 기록에 보존하지만 시간민감 각도·하우스 계산에는 사용하지 않아. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.</span></div>
      <p className="result-note">현재는 출생시간 없이도 확정 가능한 행성 간 기본 궁합 접점만 해석 근거로 사용해.</p>
    </section> : resultMonths.length>0 && <details className="result-card relationship-precision-card">
      <summary className="relationship-precision-summary"><span>정밀 시기</span><strong>기간별 접점 상세</strong><small>{resultMonths.length}개월 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 확인하는 참고 자료야.</p><div className="month-list relationship-precision-month-list">{resultMonths.map((month)=><div className="month-card relationship-precision-month" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></div>
    </details>}
'''
new_block = '''    {!partnerTimeExact && <section className="result-card">
      <div className="result-card-title"><span>정밀도</span><strong>{partnerTimeAvailable?'입력 생시 · exact 미검증':'출생시간 미상 · 시간민감층 제외'}</strong></div>
      <div className="status-banner subtle"><AlertTriangle size={16}/><span>{partnerTimeAvailable
        ? `입력한 출생시간은 그대로 보존해 행성 위치와 잠정(provisional) 진행층에 사용하지만 exact 생시로 승격하지 않아. ASC/DSC/MC/IC·하우스·Davison(데이비슨)·Marks(마크스)는 비활성화돼. 출처 ${counterpartReliability?.time_source??'unknown'} · 신뢰도 ${counterpartReliability?.time_confidence??'unknown'}.`
        : '상대 출생시간을 몰라 Moon(달)·ASC/DSC/MC/IC·하우스·진행층·Davison(데이비슨)·Marks(마크스)를 임의 추정하지 않아.'}</span></div>
      <p className="result-note">사용자가 시각을 입력했다는 사실과 공식적으로 정확한 생시는 다른 정보야. 사건 발생 확률도 계산하지 않아.</p>
    </section>}
    {resultMonths.length>0 && <details className="result-card relationship-precision-card">
      <summary className="relationship-precision-summary"><span>{partnerTimeExact?'정밀 시기':'잠정 시기'}</span><strong>기간별 접점 상세</strong><small>{resultMonths.length}개월 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">{partnerTimeExact?'검증된 exact 생시 기반':'입력 시각 기반 provisional 행성 진행층'} · 접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 접점을 확인하는 참고 자료야.</p><div className="month-list relationship-precision-month-list">{resultMonths.map((month)=><div className="month-card relationship-precision-month" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></div>
    </details>}
'''
if old_block not in text:
    raise SystemExit("RelationshipPrecisionDetails old block not found")
text = text.replace(old_block, new_block, 1)
text = text.replace(
    '''    {(result.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{partnerTimeExact ? result.result.limitations?.map(formatLimit).join(' ') : '상대 출생시간을 몰라 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.'}</span></div>}
''',
    '''    {(result.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{result.result.limitations?.map(formatLimit).join(' ')}</span></div>}
''',
    1,
)
write(path, text)

# ---------- External prompt + relationship Gemini precision metadata ----------
once(
    "web/src/lib/resultFormatters.ts",
    '''    precision: { partner_time_exact:Boolean(natal?.partner_time_exact), note:natal?.note ?? null },
''',
    '''    precision: { partner_time_available:Boolean(natal?.partner_time_available), partner_time_exact:Boolean(natal?.partner_time_exact), birth_time_reliability:rawResult.birth_time_reliability ?? null, note:natal?.note ?? null },
''',
)
once(
    "web/src/lib/readingCache.ts",
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.2-evidence-pipeline'",
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.3-birth-time-provenance'",
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'VERSION="relationship-v11.2-evidence-pipeline"',
    'VERSION="relationship-v11.3-birth-time-provenance"',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''function sajuPerson(x:any){if(!x||typeof x!=="object")return null;return {year:x?.year??null,month:x?.month??null,day:x?.day??null,hour:x?.hour??null,day_stem:x?.day_stem??null,day_branch:x?.day_branch??null,precision:x?.precision??null,time_known:Boolean(x?.time_known)};}
''',
    '''function sajuPerson(x:any){if(!x||typeof x!=="object")return null;return {year:x?.year??null,month:x?.month??null,day:x?.day??null,hour:x?.hour??null,day_stem:x?.day_stem??null,day_branch:x?.day_branch??null,precision:x?.precision??null,time_known:Boolean(x?.time_known),time_exact:Boolean(x?.time_exact),time_reliability:x?.time_reliability??null};}
''',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    ''' const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact);
''',
    ''' const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact),available=Boolean(n?.partner_time_available??exact);
''',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''   precision:{partner_time_exact:exact,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
''',
    '''   precision:{partner_time_available:available,partner_time_exact:exact,birth_time_reliability:r?.birth_time_reliability??null,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
''',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''- 오브가 좁은 실제 접점을 우선한다.''',
    '''- 출생시간을 입력했다는 사실과 exact 검증은 다르다. precision.birth_time_reliability를 우선 확인하고, exact가 아니면 ASC/DSC/MC/IC·하우스·Davison/Marks를 확정 근거로 사용하지 않는다. provisional 행성층은 잠정 근거라고 명시한다.\n- 오브가 좁은 실제 접점을 우선한다.''',
)

# ---------- Existing exact-regression fixtures now declare their provenance explicitly ----------
for path in ["tests/test_relationship_midpoints_v8.py", "tests/test_relationship_timing_v9.py"]:
    text = read(path)
    old = '''        "time_known": True,
'''
    if old not in text:
        raise SystemExit(f"{path}: exact test helper time_known anchor missing")
    text = text.replace(old, '''        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
''', 1)
    write(path, text)

print("birth-time provenance V12 patches applied")
