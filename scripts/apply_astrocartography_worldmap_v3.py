from pathlib import Path

# --- Engine: calculate real ASC/DC/MC/IC world lines ---
p = Path('astrocartography_v1.py')
s = p.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "astrocartography-city-fit-v1.0"', 'ENGINE_VERSION = "astrocartography-world-lines-v2.0"')

anchor = '\n\ndef build_location_fit(*, birth_date: date, birth_time: dt_time, utc_offset_hours: float) -> dict[str, Any]:\n'
block = r'''

def _split_world_line(points: list[dict[str, float]]) -> list[list[dict[str, float]]]:
    """Split a sampled line at antimeridian jumps so clients do not draw across the globe."""
    if not points:
        return []
    segments: list[list[dict[str, float]]] = []
    current: list[dict[str, float]] = [points[0]]
    for point in points[1:]:
        if abs(float(point["longitude"]) - float(current[-1]["longitude"])) > 180.0:
            if len(current) >= 2:
                segments.append(current)
            current = [point]
        else:
            current.append(point)
    if len(current) >= 2:
        segments.append(current)
    return segments


def _horizon_segments(*, ra_deg: float, dec_deg: float, gst_deg: float, rising: bool) -> list[list[dict[str, float]]]:
    """Sample the exact altitude=0 rising/setting curve from -85° to +85° latitude."""
    segments: list[list[dict[str, float]]] = []
    current: list[dict[str, float]] = []
    dec = math.radians(float(dec_deg))
    for lat in range(-85, 86, 2):
        phi = math.radians(float(lat))
        value = -math.tan(phi) * math.tan(dec)
        if not -1.0 <= value <= 1.0:
            if len(current) >= 2:
                segments.extend(_split_world_line(current))
            current = []
            continue
        h_abs = math.degrees(math.acos(max(-1.0, min(1.0, value))))
        hour_angle = -h_abs if rising else h_abs
        lon = _norm180(float(ra_deg) + hour_angle - float(gst_deg))
        current.append({"latitude": float(lat), "longitude": round(lon, 4)})
    if len(current) >= 2:
        segments.extend(_split_world_line(current))
    return segments


def _astrocartography_lines(jd: float, positions: dict[str, tuple[float, float]]) -> list[dict[str, Any]]:
    """Return standard natal astrocartography angular lines for a world map.

    MC/IC are meridians where the planet culminates/anti-culminates. ASC/DC are
    the sampled terrestrial loci where the planet is exactly on the horizon.
    """
    gst_deg = float(swe.sidtime(float(jd))) * 15.0
    lines: list[dict[str, Any]] = []
    vertical_lats = [-85.0, 85.0]
    for planet, (ra_deg, dec_deg) in positions.items():
        mc_lon = round(_norm180(float(ra_deg) - gst_deg), 4)
        ic_lon = round(_norm180(mc_lon + 180.0), 4)
        lines.append({
            "planet": planet,
            "angle": "MC",
            "segments": [[
                {"latitude": vertical_lats[0], "longitude": mc_lon},
                {"latitude": vertical_lats[1], "longitude": mc_lon},
            ]],
        })
        lines.append({
            "planet": planet,
            "angle": "IC",
            "segments": [[
                {"latitude": vertical_lats[0], "longitude": ic_lon},
                {"latitude": vertical_lats[1], "longitude": ic_lon},
            ]],
        })
        lines.append({
            "planet": planet,
            "angle": "ASC",
            "segments": _horizon_segments(ra_deg=ra_deg, dec_deg=dec_deg, gst_deg=gst_deg, rising=True),
        })
        lines.append({
            "planet": planet,
            "angle": "DC",
            "segments": _horizon_segments(ra_deg=ra_deg, dec_deg=dec_deg, gst_deg=gst_deg, rising=False),
        })
    return lines
'''
if '_astrocartography_lines' not in s:
    assert anchor in s, 'build_location_fit anchor missing'
    s = s.replace(anchor, block + anchor, 1)

old = '''    jd = _birth_jd(birth_date, birth_time, utc_offset_hours)\n    positions = _planet_equatorial(jd)\n\n    by_purpose: dict[str, list[dict[str, Any]]] = {}'''
new = '''    jd = _birth_jd(birth_date, birth_time, utc_offset_hours)\n    positions = _planet_equatorial(jd)\n    world_lines = _astrocartography_lines(jd, positions)\n\n    by_purpose: dict[str, list[dict[str, Any]]] = {}'''
assert old in s, 'location build start missing'
s = s.replace(old, new, 1)

old = '''        "countries": countries[:16],\n        "purposes": {'''
new = '''        "map": {\n            "projection": "web_mercator",\n            "latitude_limit": 85.0,\n            "line_policy": "ASC=자기표현·새 출발, DC=관계·타인, MC=커리어·사회적 방향, IC=집·내면·정착. 행성선 자체는 길흉 확률이 아니며 목적별 도시 점수와 함께 읽는다.",\n            "lines": world_lines,\n        },\n        "countries": countries[:16],\n        "purposes": {'''
assert old in s, 'location return anchor missing'
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# --- Frontend: map + portable prompt copies ---
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')

import_anchor = "import { KoreaBirthplaceSelector } from './koreaBirthplaces'\n"
if "AstrocartographyWorldMap" not in s:
    assert import_anchor in s, 'AppNext import anchor missing'
    s = s.replace(import_anchor, import_anchor + "import { AstrocartographyWorldMap } from './AstrocartographyWorldMap'\n", 1)

old_type = '''type LocationFitResponse = {\n  ok: boolean\n  api_version: string\n  engine: string\n  policy: { meaning: string; probability: boolean; guarantee: boolean; catalog_scope: string; distance_rule: string }\n  countries: Array<{ country: string; score: number; best_city: string; evidence: Array<{planet:string;angle:string;separation_deg:number;tone:string}> }>\n  purposes: Record<string,{ label:string; cities:Array<{city:string;country:string;score:number;evidence:Array<{planet:string;angle:string;separation_deg:number;tone:string}>}> }>\n}\n'''
new_type = '''type LocationFitResponse = {\n  ok: boolean\n  api_version: string\n  engine: string\n  policy: { meaning: string; probability: boolean; guarantee: boolean; catalog_scope: string; distance_rule: string }\n  map: {\n    projection: string\n    latitude_limit: number\n    line_policy: string\n    lines: Array<{ planet:string; angle:'ASC'|'DC'|'MC'|'IC'; segments:Array<Array<{latitude:number;longitude:number}>> }>\n  }\n  countries: Array<{ country: string; score: number; best_city: string; evidence: Array<{planet:string;angle:string;separation_deg:number;tone:string}> }>\n  purposes: Record<string,{ label:string; cities:Array<{city:string;country:string;latitude:number;longitude:number;score:number;evidence:Array<{planet:string;angle:string;separation_deg:number;tone:string}>}> }>\n}\n'''
assert old_type in s, 'LocationFitResponse block missing'
s = s.replace(old_type, new_type, 1)

# Portable integrated prompt: include calculated data so another AI does not have to reproduce ephemeris calculations.
s = s.replace('function integratedPromptText(request: Record<string, unknown>) {', 'function integratedPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {', 1)
old_tail = '''    '[원본 API 요청 JSON]',\n    JSON.stringify(request, null, 2),\n  ].join('\\n')\n}\n\nfunction integratedResultText'''
new_tail = '''    '[원본 API 요청 JSON]',\n    JSON.stringify(request, null, 2),\n    '',\n    '[외부 AI 해석 지시]',\n    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 값이다. 행성 위치·하우스·점수·사주를 다시 계산하거나 임의 수정하지 말고 이 값만 근거로 해석한다.',\n    '- 데이터에 없는 점성술/사주 요소, 사건 확률, 상대의 속마음은 만들지 않는다.',\n    '- 전문용어는 한국어 뜻을 붙이고, 결론→계산 근거→현실에서 체감되는 방식→시기 순서로 설명한다.',\n    '',\n    '[CALCULATED_DATA · 원본 계산 JSON]',\n    calculation ? JSON.stringify(calculation, null, 2) : '계산 결과 없음',\n  ].join('\\n')\n}\n\nfunction integratedResultText'''
assert old_tail in s, 'integrated prompt tail missing'
s = s.replace(old_tail, new_tail, 1)

s = s.replace("function relationshipPromptText(kind: 'compatibility' | 'marriage', request: Record<string, unknown>) {", "function relationshipPromptText(kind: 'compatibility' | 'marriage', request: Record<string, unknown>, calculation?: RelationshipApiResponse | null) {", 1)
old_rel_tail = '''    '[원본 API 요청 JSON]',\n    JSON.stringify(request, null, 2),\n  ].join('\\n')\n}\n\nfunction relationshipResultText'''
new_rel_tail = '''    '[원본 API 요청 JSON]',\n    JSON.stringify(request, null, 2),\n    '',\n    '[외부 AI 해석 지시]',\n    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 관계 계산값이다. 다른 천문력/사주 계산으로 덮어쓰지 말고 이 데이터를 해석의 단일 근거로 사용한다.',\n    '- 오브가 좁은 실제 접점을 우선하고, 접점 수나 점수를 재회·결혼·연락 확률로 바꾸지 않는다.',\n    '- 생시 미상으로 빠진 Moon(달)·각도점·하우스·진행 레이어는 추정하지 않는다.',\n    '- 사주는 CALCULATED_DATA에 실제 포함된 일간 관계·십성·배우자궁·교차 지지관계만 사용하고, 없는 천간합·신강/신약·용신·배우자성 등을 만들지 않는다.',\n    '- 결론→계산 근거→관계에서 실제 체감되는 패턴→시기 순서로 구체적으로 설명한다.',\n    '',\n    '[CALCULATED_DATA · 원본 관계 계산 JSON]',\n    calculation ? JSON.stringify(calculation, null, 2) : '계산 결과 없음',\n  ].join('\\n')\n}\n\nfunction relationshipResultText'''
assert old_rel_tail in s, 'relationship prompt tail missing'
s = s.replace(old_rel_tail, new_rel_tail, 1)

s = s.replace('function precisionPromptText(request: Record<string, unknown>) {\n  return integratedPromptText(request)', 'function precisionPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {\n  return integratedPromptText(request, calculation)', 1)

s = s.replace("handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))", "handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot, integratedResult))", 1)
s = s.replace("handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot))", "handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot, relationshipResult))", 1)
s = s.replace("handleCopy('정밀 요청/프롬프트 전체복사', precisionPromptText(integratedRequestSnapshot))", "handleCopy('정밀 요청/프롬프트 전체복사', precisionPromptText(integratedRequestSnapshot, integratedResult))", 1)

location_anchor = '''            {locationResult && <div className="results-wrap">\n              <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div>'''
location_new = '''            {locationResult && <div className="results-wrap">\n              <AstrocartographyWorldMap map={locationResult.map} purposes={locationResult.purposes}/>\n              <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div>'''
assert location_anchor in s, 'location UI anchor missing'
s = s.replace(location_anchor, location_new, 1)
p.write_text(s, encoding='utf-8')
