from pathlib import Path

# Reframe no-counterpart unmarried marriage mode as an entertainment forecast:
# probability-style index, timing, spouse archetype, work/meeting clues — without
# pretending to know a literal future person's legal identity.

p = Path('personal_marriage_v1.py')
s = p.read_text()

s = s.replace(
'''"""Single-person marriage/commitment astrology facts.\n\nThis engine is intentionally separate from two-person synastry. It never invents a\ncounterpart and never returns marriage/event probabilities. It describes the\nnative partnership/home/intimacy structure and selected-period activation of\nthose natal factors.\n"""''',
'''"""Single-person unmarried marriage forecast.\n\nThis engine is intentionally separate from two-person synastry. With no known\ncounterpart it uses the native partnership/home/intimacy structure and selected-\nperiod transits to produce an entertainment-oriented marriage potential index,\ntiming windows and spouse archetype clues. Scores are interpretive astrology\nindices rather than empirical probabilities, and no literal person's identity is\nfabricated.\n"""''')
s = s.replace('ENGINE_VERSION = "personal-marriage-western-v1.0"', 'ENGINE_VERSION = "personal-marriage-western-v1.1-fun-forecast"')

anchor = '''ASPECT_WEIGHTS = {\n    "conjunction": 1.00, "opposition": .95, "square": .92,\n    "trine": .82, "sextile": .76, "quincunx": .68,\n}\n'''
extra = r'''

SIGN_ARCHETYPE = {
    "양자리": {
        "appearance": "선이 또렷하고 활동적인 인상, 빠른 걸음이나 탄탄한 체형 쪽",
        "personality": "직진형·독립적·결단이 빠르고 경쟁심이 있는 타입",
    },
    "황소자리": {
        "appearance": "목소리나 목선이 인상적이고 단정하며 안정감 있는 체형·분위기",
        "personality": "느긋하지만 고집이 있고 감각·생활 안정·경제 감각을 중시하는 타입",
    },
    "쌍둥이자리": {
        "appearance": "젊어 보이고 슬림하거나 가벼운 인상, 표정과 손동작이 풍부한 편",
        "personality": "말이 빠르고 호기심이 많으며 정보·이동·사람을 연결하는 타입",
    },
    "게자리": {
        "appearance": "눈매나 얼굴선이 부드럽고 편안하며 친근한 인상",
        "personality": "가족·정서적 안전·돌봄을 중요하게 여기고 보호적인 타입",
    },
    "사자자리": {
        "appearance": "헤어·자세·존재감이 눈에 띄고 당당하거나 화려한 인상",
        "personality": "자존감·표현력·리더십이 강하고 인정받는 것을 좋아하는 타입",
    },
    "처녀자리": {
        "appearance": "깔끔하고 정돈된 인상, 마른 체형이나 섬세한 디테일이 두드러지는 편",
        "personality": "실무적·분석적·꼼꼼하고 생활 루틴과 효율을 중시하는 타입",
    },
    "천칭자리": {
        "appearance": "균형 잡힌 이목구비, 옷차림과 미감이 좋고 세련된 인상",
        "personality": "예의·균형·협상 감각이 좋고 관계의 분위기를 중요하게 보는 타입",
    },
    "전갈자리": {
        "appearance": "눈빛이 강하거나 신비롭고 선명한 인상, 차분한 카리스마",
        "personality": "집중력·충성도·경계심이 강하고 친밀감은 깊게 가는 타입",
    },
    "사수자리": {
        "appearance": "키가 크거나 팔다리가 길고 활동적인 인상, 캐주얼·스포티한 느낌",
        "personality": "낙천적·솔직하고 여행·배움·새 경험을 좋아하는 타입",
    },
    "염소자리": {
        "appearance": "뼈대나 턱선이 또렷하고 마른 편, 실제 나이보다 성숙하거나 단정한 인상",
        "personality": "책임감·직업의식·장기계획이 강하고 쉽게 관계를 시작하지 않는 타입",
    },
    "물병자리": {
        "appearance": "개성이 분명하고 슬림하거나 독특한 스타일, 평범하지 않은 분위기",
        "personality": "독립적·합리적·친구 같은 관계를 선호하고 자기 세계가 있는 타입",
    },
    "물고기자리": {
        "appearance": "눈매가 부드럽거나 몽환적이고 유연한 분위기, 선이 둥근 편",
        "personality": "감수성·공감력이 높고 예술·상상력·정서적 연결을 중시하는 타입",
    },
}

PLANET_CAREERS = {
    "Sun": ["관리·리더십", "공공·대외업무", "창작·브랜딩"],
    "Moon": ["돌봄·복지·상담", "식음료·서비스", "주거·부동산"],
    "Mercury": ["IT·데이터·기획", "교육·언어·콘텐츠", "영업·무역·유통"],
    "Venus": ["디자인·뷰티·패션", "금융·고객관계", "문화·예술·외교"],
    "Mars": ["기술·엔지니어링", "운영·현장관리", "스포츠·의료·안전"],
    "Jupiter": ["교육·연구", "법·행정·컨설팅", "해외·여행·국제업무"],
    "Saturn": ["공무·행정·규제", "건설·엔지니어링", "재무·감사·관리"],
    "Uranus": ["IT·스타트업", "과학·기술", "혁신·프리랜스"],
    "Neptune": ["영상·음악·예술", "치유·상담", "비영리·서비스"],
    "Pluto": ["금융·투자·세무", "연구·보안·수사", "의료·심층전문직"],
}

MEETING_BY_HOUSE = {
    1: "내가 직접 시작한 활동·자기계발·개인 프로젝트에서 연결될 가능성",
    2: "돈·쇼핑·자산·식음료·생활 취향을 공유하는 자리에서 연결될 가능성",
    3: "동네·지인 소개·짧은 이동·교육·SNS/메신저 같은 소통 경로",
    4: "가족·주거·이사·부동산·고향이나 오래 아는 생활권을 통한 연결",
    5: "취미·공연·데이트·창작·여가·스포츠처럼 즐거움을 위한 자리",
    6: "직장 실무·루틴·운동·건강관리·자주 가는 생활 동선",
    7: "소개팅·중개·협업·계약처럼 처음부터 일대일 관계가 분명한 경로",
    8: "공동재정·보험·세무·연구·심층 상담처럼 사적인 정보를 다루는 환경",
    9: "여행·외국·대학원·자격공부·종교·전문교육처럼 세계가 넓어지는 자리",
    10: "직장·공적 활동·커리어 네트워크·업무상 만남처럼 사회적 역할이 드러나는 곳",
    11: "친구·모임·온라인 커뮤니티·동호회·단체 활동을 통한 연결",
    12: "조용한 온라인 연결·비공개 활동·휴식·치유·봉사처럼 외부 노출이 적은 환경",
}
'''
if anchor not in s:
    raise SystemExit('constants anchor missing')
s = s.replace(anchor, anchor + extra, 1)

# A house-ruler alias is the same physical planet, not a second conjunction.
s = s.replace(
'''            if a.endswith("ruler") and b.endswith("ruler") and points[a] == points[b]:\n                continue''',
'''            if points[a] == points[b] and (a.endswith("ruler") or b.endswith("ruler")):\n                continue''',
1,
)

old_targets = '''    for label, key in [("7th_ruler", "7"), ("4th_ruler", "4"), ("8th_ruler", "8")]:\n        targets[label] = positions[profiles[key]["whole_ruler"]]["longitude"]\n    return targets'''
new_targets = '''    for label, key in [("7th_ruler", "7"), ("4th_ruler", "4"), ("8th_ruler", "8")]:\n        lon = positions[profiles[key]["whole_ruler"]]["longitude"]\n        duplicate = next((name for name, value in targets.items() if _angle_distance(value, lon) < 1e-8), None)\n        if duplicate:\n            # Prefer the 7H-ruler label when one physical planet has multiple semantic aliases.\n            if label == "7th_ruler":\n                targets.pop(duplicate, None)\n                targets[label] = lon\n            continue\n        targets[label] = lon\n    return targets'''
if old_targets not in s:
    raise SystemExit('timing targets anchor missing')
s = s.replace(old_targets, new_targets, 1)

anchor2 = '''def build_personal_marriage(*, birth_date: date, birth_time: dt_time, latitude: float, longitude: float,\n                            utc_offset_hours: float, start_date: date, end_date: date) -> dict:\n'''
helpers = r'''
def _window_theme(row: dict) -> list[str]:
    themes = []
    targets = {hit.get("target") for hit in row.get("hits", [])}
    planets = {hit.get("transit") for hit in row.get("hits", [])}
    if targets & {"DSC", "7th_ruler"}:
        themes.append("배우자·파트너십")
    if targets & {"Venus", "Moon"} or "Venus" in planets:
        themes.append("연애·호감")
    if targets & {"IC", "4th_ruler"}:
        themes.append("동거·가정")
    if "8th_ruler" in targets:
        themes.append("친밀감·공유자원")
    if planets & {"Jupiter", "Saturn"} and targets & {"DSC", "7th_ruler", "IC", "4th_ruler"}:
        themes.append("공식화·책임")
    return themes[:3] or ["관계 전환"]


def _marriage_forecast(rows: list[dict]) -> dict:
    strongest = sorted(rows, key=lambda x: (-float(x["activation"]), x["date"]))[:8]
    core = strongest[:5]
    if not core:
        score = 20.0
        supportive = pressure = commitment = 0.0
    else:
        activation = sum(float(x["activation"]) for x in core) / len(core)
        supportive = sum(float(x["supportive_load"]) for x in core) / len(core)
        pressure = sum(float(x["pressure_load"]) for x in core) / len(core)
        commitment_strengths = [
            float(hit.get("strength", 0))
            for row in strongest for hit in row.get("hits", [])
            if hit.get("transit") in {"Jupiter", "Saturn"}
            and hit.get("target") in {"DSC", "7th_ruler", "IC", "4th_ruler"}
        ]
        commitment = min(100.0, sum(sorted(commitment_strengths, reverse=True)[:4]) / 2.0) if commitment_strengths else 0.0
        # Entertainment-oriented interpretive index. Strong activation raises eventfulness;
        # supportive load and Jupiter/Saturn commitment hits raise formalisation potential;
        # pressure tempers the result without treating hard aspects as "no marriage".
        score = 10.0 + activation * .45 + supportive * .25 + commitment * .20 - pressure * .10
        score = max(5.0, min(95.0, score))
    if score >= 80:
        label = "매우 강함"
    elif score >= 65:
        label = "강함"
    elif score >= 50:
        label = "중간 이상"
    elif score >= 35:
        label = "보통"
    else:
        label = "낮음"
    windows = []
    for row in _spaced(rows, "activation", 6):
        windows.append({
            "date": row["date"],
            "score": row["activation"],
            "themes": _window_theme(row),
            "supportive_load": row["supportive_load"],
            "pressure_load": row["pressure_load"],
            "strongest_hit": row.get("hits", [None])[0] if row.get("hits") else None,
        })
    return {
        "marriage_probability_percent": round(score, 1),
        "label": label,
        "supportive_component": round(supportive, 1),
        "pressure_component": round(pressure, 1),
        "commitment_component": round(commitment, 1),
        "strong_windows": windows,
        "probability_note": "통계적·과학적 확률이 아니라 선택 기간의 결혼/공식화 신호를 0~100으로 번역한 점성 엔터테인먼트 지수다.",
    }


def _spouse_archetype(profiles: dict, natal_aspects: list[dict]) -> dict:
    seventh = profiles["7"]
    career_house = profiles["4"]  # 10th from the 7th = partner-career derivative house.
    signs = []
    for sign in (seventh["whole_sign"], seventh["placidus_sign"]):
        if sign not in signs:
            signs.append(sign)
    appearance = [SIGN_ARCHETYPE[x]["appearance"] for x in signs if x in SIGN_ARCHETYPE]
    personality = [SIGN_ARCHETYPE[x]["personality"] for x in signs if x in SIGN_ARCHETYPE]
    ruler = seventh["whole_ruler"]
    ruler_house = int(seventh["whole_ruler_placement"]["whole_house"])
    career_ruler = career_house["whole_ruler"]
    careers = list(PLANET_CAREERS.get(career_ruler, []))
    extras = []
    for row in natal_aspects:
        pair = {row.get("a"), row.get("b")}
        if not (pair & {"DSC", "7th_ruler"}):
            continue
        if "Saturn" in pair:
            extras.append("책임감이 강하거나 실제 나이보다 성숙해 보이는 사람")
        if "Jupiter" in pair:
            extras.append("교육·전문성·해외경험처럼 시야를 넓혀 주는 배경이 있는 사람")
        if "Venus" in pair:
            extras.append("미감·옷차림·대인매너를 중요하게 여기는 사람")
        if "Mars" in pair:
            extras.append("행동력이 빠르거나 운동·기술·현장성이 강한 사람")
    personality.extend(x for x in extras if x not in personality)
    meeting = MEETING_BY_HOUSE.get(ruler_house, "7하우스 주인행성의 배치와 연결된 생활권")
    identity_clues = [
        f"배우자 축: {seventh['whole_sign']} 중심" + (f" + 플라시두스 {seventh['placidus_sign']} 보조" if seventh['placidus_sign'] != seventh['whole_sign'] else ""),
        f"7하우스 주인행성 {ruler}가 홀사인 {ruler_house}하우스에 위치",
        f"배우자 직업 단서는 7하우스의 10번째인 본인 4하우스와 그 주인행성 {career_ruler}를 우선 참고",
    ]
    return {
        "summary": f"{seventh['whole_sign']} 배우자상과 {ruler} 주인행성 성격이 중심이고, 실제 만남 환경은 {ruler_house}하우스 주제가 강하게 잡힌다.",
        "appearance_hints": appearance[:4],
        "personality_hints": personality[:5],
        "career_clusters": careers[:4],
        "meeting_route": meeting,
        "identity_clues": identity_clues,
        "precision_note": "외모·직업·만남 경로는 7하우스/DSC와 주인행성, 파생 10하우스를 이용한 전통적 배우자상 추정이다. 실제 이름·주소·회사처럼 특정 개인의 신원을 맞히는 기능은 아니다.",
    }


'''
if anchor2 not in s:
    raise SystemExit('build function anchor missing')
s = s.replace(anchor2, helpers + anchor2, 1)

# Compute natal aspects once and expose forecast/archetype.
s = s.replace(
'''    timing_rows = _daily_timing(start_date, end_date, utc_offset_hours, _timing_targets(positions, house, profiles))\n    activation_values = [row["activation"] for row in timing_rows]\n    return {''',
'''    natal_aspects = _natal_aspects(positions, house, profiles)\n    timing_rows = _daily_timing(start_date, end_date, utc_offset_hours, _timing_targets(positions, house, profiles))\n    activation_values = [row["activation"] for row in timing_rows]\n    forecast = _marriage_forecast(timing_rows)\n    spouse_archetype = _spouse_archetype(profiles, natal_aspects)\n    return {''',
1,
)

s = s.replace(
'''        "policy": {\n            "counterpart_required": False,\n            "marriage_probability": False,\n            "spouse_identity_prediction": False,\n            "meaning": "개인 출생차트의 4·5·7·8하우스와 관계 행성, 선택 기간 트랜짓의 상대적 활성도를 계산한다.",\n        },''',
'''        "policy": {\n            "counterpart_required": False,\n            "marriage_probability": True,\n            "spouse_archetype_prediction": True,\n            "specific_identity_claims": False,\n            "entertainment_index": True,\n            "meaning": "상대가 없을 때도 개인 차트로 결혼 가능성 지수·강한 시기·배우자상(외모/성향/직업군/만남 경로)을 적극적으로 본다.",\n        },''',
1,
)
s = s.replace('"natal_aspects": _natal_aspects(positions, house, profiles),', '"natal_aspects": natal_aspects,\n        "forecast": forecast,\n        "spouse_archetype": spouse_archetype,', 1)
s = s.replace(
'''        "limits": [\n            "상대가 없는 개인 결혼운이므로 특정 인물과의 궁합·상대 속마음·결혼 성사 여부를 계산하지 않는다.",\n            "강한 날짜는 결혼 사건 확률이 아니라 동반자·가정·친밀감·책임 주제의 상대적 활성 구간이다.",\n            "실제 배우자의 외모·직업·신원처럼 계산으로 확정할 수 없는 속성은 만들지 않는다.",\n        ],''',
'''        "limits": [\n            "결혼 가능성 %는 통계적 확률이 아니라 점성학적 신호 강도를 재미용 0~100 지수로 번역한 값이다.",\n            "배우자 외모·성향·직업군·만남 경로는 차트에서 적극적으로 추정하되 실제 미래 인물의 이름·주소·회사 같은 특정 신원은 만들어내지 않는다.",\n            "특정 상대가 생기면 이 개인 결혼운과 별도로 두 사람의 실제 결혼궁합을 계산해야 한다.",\n        ],''',
1,
)
p.write_text(s)

# API policy should describe the feature users actually selected.
p = Path('api/main.py')
s = p.read_text()
s = s.replace('APP_VERSION = "api-fortune-v5.3-personal-marriage-scope"', 'APP_VERSION = "api-fortune-v5.4-personal-marriage-forecast"', 1)
s = s.replace(
'''        "interpretation_policy": {\n            "counterpart_required": False,\n            "probability": False,\n            "spouse_identity_claims": False,\n            "mode": "상대가 없는 미혼 개인 결혼운 · 결혼 확률이 아니라 본인 차트의 결혼생활 구조와 활성 구간을 계산",\n        },''',
'''        "interpretation_policy": {\n            "counterpart_required": False,\n            "probability_style_forecast": True,\n            "spouse_archetype": True,\n            "specific_identity_claims": False,\n            "mode": "상대가 없는 미혼 개인 결혼운 · 결혼 가능성 지수/시기/배우자상/직업군/만남 경로를 점성 엔터테인먼트 해석으로 제공",\n        },''',
1,
)
p.write_text(s)

# Permanent regression contract.
p = Path('tests/test_personal_marriage_v1.py')
s = p.read_text()
s = s.replace('assert result["policy"]["marriage_probability"] is False', 'assert result["policy"]["marriage_probability"] is True', 1)
s = s.replace('assert result["policy"]["spouse_identity_prediction"] is False', 'assert result["policy"]["spouse_archetype_prediction"] is True\n    assert result["policy"]["specific_identity_claims"] is False', 1)
s = s.replace(
'''    text = str(result)\n    assert "marriage_probability': True" not in text\n    assert "spouse_identity_prediction': True" not in text''',
'''    forecast = result["forecast"]\n    assert 0 <= forecast["marriage_probability_percent"] <= 100\n    assert forecast["label"] in {"매우 강함", "강함", "중간 이상", "보통", "낮음"}\n    assert forecast["strong_windows"]\n    assert "통계적" in forecast["probability_note"]\n    spouse = result["spouse_archetype"]\n    assert spouse["appearance_hints"]\n    assert spouse["personality_hints"]\n    assert spouse["career_clusters"]\n    assert spouse["meeting_route"]\n    assert spouse["identity_clues"]\n    assert "실제 이름" in spouse["precision_note"]''',
1,
)
p.write_text(s)

# Replace the panel with a user-facing forecast-first layout.
p = Path('web/src/PersonalMarriagePanel.tsx')
p.write_text(r'''import { AlertTriangle, CalendarDays, Gem, Home, Sparkles } from 'lucide-react'

export type PersonalMarriageResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number }
  result: {
    mode: 'personal_unmarried'
    policy: {
      counterpart_required: boolean
      marriage_probability: boolean
      spouse_archetype_prediction: boolean
      specific_identity_claims: boolean
      entertainment_index: boolean
      meaning: string
    }
    relationship_houses: Record<string, {
      house: number
      whole_sign: string
      whole_ruler: string
      whole_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
      placidus_sign: string
      placidus_ruler: string
      placidus_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
    }>
    relationship_planets: Record<string, { sign: string; degree: number; whole_house: number; placidus_house: number }>
    natal_aspects: Array<{ a: string; aspect: string; b: string; orb: number; tone: string }>
    forecast: {
      marriage_probability_percent: number
      label: string
      supportive_component: number
      pressure_component: number
      commitment_component: number
      probability_note: string
      strong_windows: Array<{
        date: string
        score: number
        themes: string[]
        supportive_load: number
        pressure_load: number
        strongest_hit: { transit: string; aspect: string; target: string; orb: number; tone: string; strength: number } | null
      }>
    }
    spouse_archetype: {
      summary: string
      appearance_hints: string[]
      personality_hints: string[]
      career_clusters: string[]
      meeting_route: string
      identity_clues: string[]
      precision_note: string
    }
    timing: {
      average_activation: number
      spread: number
      top_days: Array<{ date: string; activation: number; supportive_load: number; pressure_load: number; hits: Array<{ transit: string; aspect: string; target: string; orb: number; tone: string; strength: number }> }>
      pressure_days: Array<{ date: string; activation: number; supportive_load: number; pressure_load: number; hits: Array<{ transit: string; aspect: string; target: string; orb: number; tone: string; strength: number }> }>
      top_months: Array<{ calendar_month: string; activation: number; top_dates: string[] }>
    }
    limits: string[]
  }
}

const planetKo: Record<string,string> = {Moon:'달',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성',Sun:'태양',Mercury:'수성','True Node':'진북교점'}
const pointKo: Record<string,string> = {DSC:'DSC(하강점)',IC:'IC(천저점)',Venus:'Venus(금성)',Moon:'Moon(달)',Saturn:'Saturn(토성)',Jupiter:'Jupiter(목성)','7th_ruler':'7하우스 주인행성','4th_ruler':'4하우스 주인행성','8th_ruler':'8하우스 주인행성'}
const aspectKo: Record<string,string> = {conjunction:'합',sextile:'육십분위',square:'사각',trine:'삼각',quincunx:'퀸컨스·150도각',opposition:'대립'}
const houseMeaning: Record<string,string> = {'4':'가정 · 함께 사는 생활','5':'연애 · 즐거움 · 애정표현','7':'배우자 · 동반자 관계','8':'친밀감 · 공유자원 · 깊은 결속'}

function rulerLine(row: PersonalMarriageResponse['result']['relationship_houses'][string]) {
  const same = row.whole_ruler === row.placidus_ruler
  if (same) return `${row.whole_sign} / ${row.placidus_sign} · 주인행성 ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) · 홀사인 ${row.whole_ruler_placement.whole_house}H / 플라시두스 ${row.whole_ruler_placement.placidus_house}H`
  return `홀사인 ${row.whole_sign} → ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) ${row.whole_ruler_placement.whole_house}H · 플라시두스 ${row.placidus_sign} → ${row.placidus_ruler}(${planetKo[row.placidus_ruler] ?? row.placidus_ruler}) ${row.placidus_ruler_placement.placidus_house}H`
}

function hitText(hit?: { transit: string; aspect: string; target: string; orb: number }) {
  if (!hit) return '직접 활성 접점은 약한 편'
  return `${hit.transit}(${planetKo[hit.transit] ?? hit.transit}) ${aspectKo[hit.aspect] ?? hit.aspect} ${pointKo[hit.target] ?? hit.target} · 오브 ${hit.orb.toFixed(2)}°`
}

export function PersonalMarriagePanel({ data }: { data: PersonalMarriageResponse }) {
  const result = data.result
  const forecast = result.forecast
  const spouse = result.spouse_archetype
  const houses = ['7','4','8','5'].map((key)=>[key,result.relationship_houses[key]] as const).filter(([,row])=>!!row)
  const planets = ['Moon','Venus','Mars','Jupiter','Saturn'].map((key)=>[key,result.relationship_planets[key]] as const).filter(([,row])=>!!row)
  const windows = forecast.strong_windows.slice(0,3)
  const pressureDays = result.timing.pressure_days.filter((row)=>row.pressure_load>0).slice(0,3)

  return <section className="relationship-ai-card personal-marriage-card">
    <span className="eyebrow">상대 없이 보는 미혼 결혼운</span>
    <h3>결혼 가능성 · 시기 · 미래 배우자상</h3>

    <div className="status-banner marriage-intro"><Gem size={16}/><span><b>결혼 가능성 지수 {forecast.marriage_probability_percent.toFixed(1)}/100 · {forecast.label}</b> · {forecast.probability_note}</span></div>

    <section className="relationship-key-aspects">
      <strong><CalendarDays size={15}/> 결혼·공식화가 강해지는 시기 TOP 3</strong>
      {windows.length ? windows.map((row)=><div key={row.date}><b>{row.date} · {row.score.toFixed(1)} · {row.themes.join(' · ')}</b><p>{hitText(row.strongest_hit ?? undefined)}</p></div>) : <p>선택 기간에서는 결혼·공식화 신호가 크게 솟는 구간이 적어.</p>}
    </section>

    <section className="marriage-ai-deep">
      <strong>미래 배우자상 · 차트 단서</strong>
      <p className="marriage-ai-bottom">{spouse.summary}</p>
      <div className="marriage-ai-grid">
        <article><b>외모 · 분위기</b>{spouse.appearance_hints.map((x,i)=><p key={`appearance-${i}`}>{x}</p>)}</article>
        <article><b>성격 · 관계 방식</b>{spouse.personality_hints.map((x,i)=><p key={`personality-${i}`}>{x}</p>)}</article>
        <article><b>직업 · 분야</b><p>{spouse.career_clusters.join(' · ')}</p></article>
        <article><b>어디서 만날 가능성이 큰지</b><p>{spouse.meeting_route}</p></article>
        <article><b>신원 단서</b>{spouse.identity_clues.map((x,i)=><p key={`identity-${i}`}>{x}</p>)}</article>
        <article><b>해석 정밀도</b><p>{spouse.precision_note}</p></article>
      </div>
    </section>

    {!!result.timing.top_months.length && <section className="relationship-key-aspects"><strong><Home size={15}/> 월별 결혼운 활성 상위</strong>{result.timing.top_months.slice(0,6).map((row)=><div key={row.calendar_month}><b>{row.calendar_month} · {row.activation.toFixed(1)}</b><p>{row.top_dates.slice(0,3).join(' · ')}</p></div>)}</section>}

    {pressureDays.length ? <section className="relationship-key-aspects"><strong><AlertTriangle size={15}/> 관계 결정 압력이 커지는 시기</strong>{pressureDays.map((row)=><div key={row.date}><b>{row.date} · 압력 {row.pressure_load.toFixed(1)}</b><p>{hitText(row.hits.find((hit)=>hit.tone==='challenging') ?? row.hits[0])}</p></div>)}</section> : null}

    <details className="ai-system-note"><summary>왜 이런 배우자상·결혼운이 나오는지 · 원차트 근거</summary>
      <div className="relationship-ai-grid">{houses.map(([key,row])=><article key={key}><strong>{row.house}하우스 · {houseMeaning[key]}</strong><p>{rulerLine(row)}</p></article>)}</div>
      <div className="relationship-key-aspects"><strong>관계 행성의 기본 배치</strong>{planets.map(([key,row])=><div key={key}><b>{key}({planetKo[key]}) · {row.sign} {row.degree.toFixed(1)}°</b><p>홀사인 {row.whole_house}하우스 · 플라시두스 {row.placidus_house}하우스</p></div>)}</div>
      {!!result.natal_aspects.length && <div className="relationship-key-aspects"><strong>주요 애스펙트</strong>{result.natal_aspects.slice(0,10).map((row,index)=><p key={`${row.a}-${row.b}-${index}`}><b>{row.a} {aspectKo[row.aspect] ?? row.aspect} {row.b}</b> · 오브 {row.orb.toFixed(2)}° · {row.tone==='supportive'?'조화':row.tone==='challenging'?'긴장':'혼합'}</p>)}</div>}
    </details>

    <details className="ai-system-note"><summary>해석 한계</summary>{result.limits.map((line,index)=><p key={`${index}-${line}`}>{line}</p>)}</details>
    <p className="ai-limits"><Sparkles size={13}/> 재미로 보는 예측은 적극적으로 보여주되, 0~100은 실제 통계 확률이 아니고 실제 미래 사람의 이름·주소·회사를 만들어내지는 않아.</p>
  </section>
}
''')
