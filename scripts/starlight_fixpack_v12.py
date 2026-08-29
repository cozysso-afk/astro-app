from pathlib import Path
import re

ROOT=Path('.')

def replace_once(path, old, new):
    p=ROOT/path
    text=p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'marker missing in {path}: {old[:140]!r}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')

# -----------------------------------------------------------------------------
# 1) Integrated fortune: add interpersonal/family/social relationship axis.
# -----------------------------------------------------------------------------
p=ROOT/'integrated_fortune_v1.py'
text=p.read_text(encoding='utf-8')
text=text.replace('ENGINE_VERSION = "integrated-fortune-v2.2-legacy-exact"','ENGINE_VERSION = "integrated-fortune-v2.3-interpersonal"')
text=text.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v5-legacy-exact"','WESTERN_ENGINE_VERSION = "western-period-engine-v6-interpersonal"')
needle='''    "연애": {\n        "targets": {"Venus": 1.0, "Moon": .85, "Mars": .65, "Sun": .45, "Mercury": .35, "ASC": .45},'''
insert='''    "대인관계": {\n        "targets": {"Mercury": .90, "Venus": .85, "Moon": .80, "Jupiter": .65, "Saturn": .55, "Sun": .45, "ASC": .45},\n        "transits": {"Mercury": .95, "Venus": .80, "Moon": .80, "Jupiter": .65, "Saturn": .55, "Mars": .45, "Uranus": .35, "Sun": .35},\n        "houses": {3: .75, 4: .90, 7: .85, 11: 1.0, 5: .35},\n        "ruler_houses": [3, 4, 7, 11],\n    },\n    "연애": {\n        "targets": {"Venus": 1.0, "Moon": .85, "Mars": .65, "Sun": .45, "Mercury": .35, "ASC": .45},'''
if needle not in text: raise SystemExit('integrated interpersonal insertion marker missing')
text=text.replace(needle,insert,1)
text=text.replace('TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]',
                  'TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]')
p.write_text(text,encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) Relationship engine: add daily transits to both natal charts.
# -----------------------------------------------------------------------------
p=ROOT/'relationship_western_v1.py'
text=p.read_text(encoding='utf-8')
text=text.replace('ENGINE_VERSION = "relationship-western-v1.0"','ENGINE_VERSION = "relationship-western-v1.1-transit-triggers"')
transit_code=r'''

TRANSIT_WEIGHTS = {
    "Sun": .45, "Mercury": 1.00, "Venus": .95, "Mars": .90,
    "Jupiter": .85, "Saturn": .70, "Uranus": .70, "Neptune": .55, "Pluto": .65,
}
TRANSIT_TARGET_WEIGHTS = {
    "Sun": 1.00, "Mercury": .95, "Venus": 1.00, "Mars": .90,
    "Jupiter": .55, "Saturn": .65, "Uranus": .45, "Neptune": .50, "Pluto": .75,
    "True Node": .65, "ASC": .90, "DSC": .90, "MC": .55, "IC": .45,
}
TRANSIT_ASPECT_WEIGHTS = {
    "conjunction": 1.00, "opposition": .95, "square": .92,
    "trine": .82, "sextile": .76, "quincunx": .68,
}


def _transit_orb_limit(planet):
    return 1.4 if planet in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else 1.0


def _transit_hits(transit_chart, natal_chart, person):
    transits = transit_chart.get("positions") or {}
    targets = _point_map(natal_chart)
    found = []
    for t_name, t_info in transits.items():
        if t_name not in TRANSIT_WEIGHTS:
            continue
        t_lon = float(t_info["lon"])
        orb_limit = _transit_orb_limit(t_name)
        for target, n_lon in targets.items():
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)
            dist = _angle_distance(t_lon, float(n_lon))
            for aspect, exact in ASPECTS.items():
                orb = abs(dist - exact)
                if orb > orb_limit:
                    continue
                orb_factor = max(0.0, 1.0 - orb / orb_limit)
                score = 100.0 * TRANSIT_WEIGHTS[t_name] * target_weight * TRANSIT_ASPECT_WEIGHTS[aspect] * orb_factor
                tone = "supportive" if aspect in SUPPORTIVE else ("challenging" if aspect in CHALLENGING else "mixed")
                found.append({
                    "person": person,
                    "transit": t_name,
                    "aspect": aspect,
                    "target": target,
                    "orb": round(orb, 3),
                    "tone": tone,
                    "score": round(score, 1),
                })
    found.sort(key=lambda x: (-x["score"], x["orb"]))
    return found[:10]


def _side_trigger_score(hits):
    if not hits:
        return 0.0
    top = [float(x["score"]) for x in hits[:4]]
    return round(min(100.0, sum(top) / 2.35), 1)


def _build_reunion_transits(user_natal, cp_natal, start_date, end_date, utc_offset_hours):
    rows = []
    cursor = start_date
    tz = timezone(timedelta(hours=float(utc_offset_hours or 9.0)))
    while cursor <= end_date:
        target_local = datetime.combine(cursor, dt_time(12, 0), tzinfo=tz)
        transit_chart = _chart_from_jd(_jd_from_utc(target_local.astimezone(timezone.utc)), include_moon=False, include_angles=False)
        user_hits = _transit_hits(transit_chart, user_natal, "user")
        cp_hits = _transit_hits(transit_chart, cp_natal, "counterpart")
        user_score = _side_trigger_score(user_hits)
        cp_score = _side_trigger_score(cp_hits)
        shared_bonus = 8.0 if user_score >= 35 and cp_score >= 35 else 0.0
        combined = round(min(100.0, user_score * .45 + cp_score * .55 + shared_bonus), 1)
        rows.append({
            "date": cursor.isoformat(),
            "score": combined,
            "user_score": user_score,
            "counterpart_score": cp_score,
            "shared_activation": bool(user_score >= 25 and cp_score >= 25),
            "hits": (cp_hits[:3] + user_hits[:3])[:6],
        })
        cursor += timedelta(days=1)

    ranked = sorted(rows, key=lambda x: (-x["score"], x["date"]))
    # Avoid filling the top list with adjacent dates from the same transit pass.
    top_days = []
    for row in ranked:
        d = date.fromisoformat(row["date"])
        if any(abs((d - date.fromisoformat(existing["date"])).days) <= 1 for existing in top_days):
            continue
        top_days.append(row)
        if len(top_days) >= 18:
            break

    months = {}
    for row in rows:
        key = row["date"][:7]
        months.setdefault(key, []).append(row)
    top_months = []
    for key, month_rows in months.items():
        strongest = sorted(month_rows, key=lambda x: x["score"], reverse=True)[:5]
        score = round(sum(x["score"] for x in strongest) / max(1, len(strongest)), 1)
        top_months.append({"calendar_month": key, "score": score, "top_dates": [x["date"] for x in strongest[:3]]})
    top_months.sort(key=lambda x: (-x["score"], x["calendar_month"]))
    return {
        "available": True,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "policy": "daily transits to both natal charts; descriptive activation, not contact/reunion probability",
        "top_days": top_days,
        "top_months": top_months[:12],
    }
'''
marker='''CHALLENGING = {"square", "opposition", "quincunx"}\n'''
if marker not in text: raise SystemExit('relationship transit insertion marker missing')
text=text.replace(marker,marker+transit_code,1)
text=text.replace('''def build_relationship_western(user_profile, counterpart_profile, month_segments):\n    """Return static and monthly advanced relationship layers.''',
'''def build_relationship_western(user_profile, counterpart_profile, month_segments):\n    """Return static and monthly advanced relationship layers.''',1)
needle='''    result = {\n        "ok": True,'''
replacement='''    month_segments = list(month_segments)\n    result = {\n        "ok": True,'''
if needle not in text: raise SystemExit('relationship segments marker missing')
text=text.replace(needle,replacement,1)
needle='''    result["composite"] = {\n        "available": True,\n        "chart": _midpoint_chart(user_natal, cp_natal),\n        "note": "Mathematical midpoint composite. Partner angles/Moon are omitted when partner time is unknown.",\n    }\n'''
replacement=needle+'''\n    if month_segments:\n        result["reunion_transits"] = _build_reunion_transits(\n            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)\n        )\n'''
if needle not in text: raise SystemExit('relationship transit call marker missing')
text=text.replace(needle,replacement,1)
p.write_text(text,encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) API: location ranking endpoint and version bump.
# -----------------------------------------------------------------------------
p=ROOT/'api/main.py'
text=p.read_text(encoding='utf-8')
text=text.replace('from relationship_western_v1 import build_relationship_western', 'from relationship_western_v1 import build_relationship_western\nfrom astrocartography_v1 import ENGINE_VERSION as LOCATION_ENGINE_VERSION, build_location_fit')
text=text.replace('APP_VERSION = "api-fortune-v4.5-integrated-fix"','APP_VERSION = "api-fortune-v4.6-fixpack"')
needle='''class IntegratedInterpretRequest(BaseModel):\n    calculation: dict\n    model: str = AI_DEFAULT_MODEL\n'''
replacement=needle+'''\n\nclass LocationFitRequest(BaseModel):\n    profile: FortuneProfile\n'''
if needle not in text: raise SystemExit('location request marker missing')
text=text.replace(needle,replacement,1)
text=text.replace('''            "fortune/interpret",\n        ],''','''            "fortune/interpret",\n            "location/fit",\n        ],''',1)
route='''\n\n@app.post("/v1/location/fit")\ndef location_fit(request: LocationFitRequest) -> dict:\n    try:\n        result = build_location_fit(\n            birth_date=request.profile.birth_date,\n            birth_time=request.profile.birth_time,\n            utc_offset_hours=request.profile.utc_offset_hours,\n        )\n    except Exception as exc:\n        raise HTTPException(status_code=500, detail=f"location fit calculation failed: {exc}") from exc\n    return {\n        "api_version": APP_VERSION,\n        "engine": LOCATION_ENGINE_VERSION,\n        **result,\n    }\n'''
marker='''@app.post("/v1/relationship/western")\ndef relationship_western(request: RelationshipRequest) -> dict:\n'''
if marker not in text: raise SystemExit('location route marker missing')
text=text.replace(marker,route+'\n'+marker,1)
p.write_text(text,encoding='utf-8')

# -----------------------------------------------------------------------------
# 4) Frontend AppNext: separate relationship period, location tool, save UX,
#    contextual reports, richer reunion transit evidence, interpersonal axis.
# -----------------------------------------------------------------------------
p=ROOT/'web/src/AppNext.tsx'
text=p.read_text(encoding='utf-8')
text=text.replace("type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'precision'", "type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'location' | 'precision'")

# Relationship API transit type.
needle='''    months?: RelationshipMonth[]\n  }\n}\n'''
replacement='''    months?: RelationshipMonth[]\n    reunion_transits?: {\n      available: boolean\n      period: { start: string; end: string }\n      policy: string\n      top_days: Array<{\n        date: string; score: number; user_score: number; counterpart_score: number; shared_activation: boolean\n        hits: Array<{ person: 'user'|'counterpart'; transit: string; aspect: string; target: string; orb: number; tone: string; score: number }>\n      }>\n      top_months: Array<{ calendar_month: string; score: number; top_dates: string[] }>\n    }\n  }\n}\n'''
if needle not in text: raise SystemExit('relationship api type marker missing')
text=text.replace(needle,replacement,1)

location_type='''\ntype LocationFitResponse = {\n  ok: boolean\n  api_version: string\n  engine: string\n  policy: { meaning: string; probability: boolean; guarantee: boolean; catalog_scope: string; distance_rule: string }\n  countries: Array<{ country: string; score: number; best_city: string; evidence: Array<{planet:string;angle:string;separation_deg:number;tone:string}> }>\n  purposes: Record<string,{ label:string; cities:Array<{city:string;country:string;score:number;evidence:Array<{planet:string;angle:string;separation_deg:number;tone:string}>}> }>\n}\n'''
marker='''type AiTopicInterpretation = {\n'''
if marker not in text: raise SystemExit('location type insertion marker missing')
text=text.replace(marker,location_type+'\n'+marker,1)

text=text.replace("const coreTopicOrder = ['금전','학업','시험','직장','이직','연애','재회','소식','컨디션']", "const coreTopicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','재회','소식','컨디션']")
marker="const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']"
extra="""const topicEmoji: Record<string,string> = {금전:'💰',학업:'📚',시험:'✍️',직장:'💼',이직:'🧭',대인관계:'🤝',연애:'💗',재회:'🪐',소식:'💌',컨디션:'🌿',투자심리:'📈',수익실현:'💵',신규진입:'🚪',투자주의:'⚠️'}\nconst topicDisplay = (topic:string) => `${topicEmoji[topic] ?? '✦'} ${topic}`\nconst relationshipDayPresets = [7,31,90,180,365]\n"""
if marker not in text: raise SystemExit('topic helper marker missing')
text=text.replace(marker,extra+marker,1)

# Tools: add location card.
needle="""  { key: 'marriage' as const, label: '결혼운', desc: '현재 관계의 장기 결속과 주기 흐름', icon: Gem, tone: 'champagne' },\n  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },"""
replacement="""  { key: 'marriage' as const, label: '결혼운', desc: '현재 관계의 장기 결속과 주기 흐름', icon: Gem, tone: 'champagne' },\n  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },\n  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },"""
if needle not in text: raise SystemExit('tools location marker missing')
text=text.replace(needle,replacement,1)

# State.
needle="""  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n  const [reunionTiming, setReunionTiming] = useState<ReunionTimingContext | null>(null)"""
replacement="""  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n  const [relationshipDays, setRelationshipDays] = useState(365)\n  const [reunionTiming, setReunionTiming] = useState<ReunionTimingContext | null>(null)"""
if needle not in text: raise SystemExit('relationship days state marker missing')
text=text.replace(needle,replacement,1)
needle="""  const [archiveStatus, setArchiveStatus] = useState('')\n  const [archiveError, setArchiveError] = useState('')"""
replacement="""  const [archiveStatus, setArchiveStatus] = useState('')\n  const [archiveError, setArchiveError] = useState('')\n  const [archiveSaving, setArchiveSaving] = useState(false)\n  const [locationResult, setLocationResult] = useState<LocationFitResponse | null>(null)\n  const [locationLoading, setLocationLoading] = useState(false)\n  const [locationError, setLocationError] = useState('')"""
if needle not in text: raise SystemExit('save/location state marker missing')
text=text.replace(needle,replacement,1)

# Visual viewport keyboard guard.
needle="""  useEffect(() => {\n    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)\n  }, [aiModel])\n"""
replacement=needle+"""\n  useEffect(() => {\n    const viewport = window.visualViewport\n    if (!viewport) return\n    const syncKeyboard = () => {\n      const keyboardOpen = window.innerHeight - viewport.height > 160\n      document.documentElement.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false'\n    }\n    syncKeyboard()\n    viewport.addEventListener('resize', syncKeyboard)\n    viewport.addEventListener('scroll', syncKeyboard)\n    return () => { viewport.removeEventListener('resize', syncKeyboard); viewport.removeEventListener('scroll', syncKeyboard) }\n  }, [])\n"""
if needle not in text: raise SystemExit('visual viewport marker missing')
text=text.replace(needle,replacement,1)

# Derived relationship range.
needle="""  const activeDayun = currentDayun(integratedResult)\n  const integratedSelectionEnd = periodEnd(queryDate, period)"""
replacement="""  const activeDayun = currentDayun(integratedResult)\n  const clampedRelationshipDays = Math.max(7, Math.min(365, Number(relationshipDays) || 365))\n  const relationshipEndDate = addDays(queryDate, clampedRelationshipDays - 1)\n  const relationshipPeriodKey: PeriodKey = clampedRelationshipDays >= 365 ? 'year' : clampedRelationshipDays >= 28 ? 'month' : 'week'\n  const integratedSelectionEnd = periodEnd(queryDate, period)"""
if needle not in text: raise SystemExit('relationship derived marker missing')
text=text.replace(needle,replacement,1)

# Relationship ranges in calculation functions.
text=text.replace('const end = periodEnd(queryDate, period)', 'const end = relationshipEndDate', 1)
text=text.replace('start_date: queryDate, end_date: periodEnd(queryDate, period),', 'start_date: queryDate, end_date: relationshipEndDate,', 1)

# Relationship AI slug.
text=text.replace("relationship-interpret-v8-preview", "relationship-interpret-v9-preview")
text=text.replace("fortune-interpret-v4-preview", "fortune-interpret-v5-preview")

# Location runner inserted before handleCopy.
marker='''  async function handleCopy(label: string, text: string) {\n'''
location_runner='''  async function runLocationFit() {\n    if (!birthProfile.birthDate || !birthProfile.birthTime) { setLocationError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return }\n    setLocationLoading(true); setLocationError(''); setLocationResult(null)\n    try {\n      const response = await fetch(`${API_BASE}/v1/location/fit`, {\n        method:'POST', headers:{'Content-Type':'application/json'},\n        body:JSON.stringify({profile:{name:birthProfile.name||null,birth_date:birthProfile.birthDate,birth_time:birthProfile.birthTime,latitude:Number(birthProfile.latitude||0),longitude:Number(birthProfile.longitude||0),utc_offset_hours:Number(birthProfile.utcOffset||9),gender:birthProfile.gender}}),\n      })\n      const payload = await response.json()\n      if (!response.ok || !payload?.ok) throw new Error(payload?.detail || payload?.error || '지역·국가운 계산에 실패했어.')\n      setLocationResult(payload as LocationFitResponse)\n    } catch (error) { setLocationError(error instanceof Error ? error.message : '지역·국가운 계산 중 오류가 발생했어.') }\n    finally { setLocationLoading(false) }\n  }\n\n'''
if marker not in text: raise SystemExit('location runner marker missing')
text=text.replace(marker,location_runner+marker,1)

# Save functions: visible busy feedback and proper relationship period key.
text=text.replace("""  async function saveIntegratedRecord() {\n    if (!integratedResult || !integratedRequestSnapshot) return\n    const label = periods.find((item) => item.key === period)?.label ?? period\n    const saved = await saveArchive({""",
"""  async function saveIntegratedRecord() {\n    if (!integratedResult || !integratedRequestSnapshot || archiveSaving) return\n    setArchiveSaving(true); setArchiveStatus('기록 저장 중…')\n    const label = periods.find((item) => item.key === period)?.label ?? period\n    try {\n    const saved = await saveArchive({""",1)
text=text.replace("""    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n    if (mainView === 'history') await refreshArchive()\n  }\n\n  async function savePrecisionRecord()""",
"""    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n    setActionNotice('기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)\n    if (mainView === 'history') await refreshArchive()\n    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '기록 저장 실패') } finally { setArchiveSaving(false) }\n  }\n\n  async function savePrecisionRecord()""",1)
text=text.replace("""  async function savePrecisionRecord() {\n    if (!integratedResult || !integratedRequestSnapshot) return\n    const saved = await saveArchive({""",
"""  async function savePrecisionRecord() {\n    if (!integratedResult || !integratedRequestSnapshot || archiveSaving) return\n    setArchiveSaving(true); setArchiveStatus('정밀분석 기록 저장 중…')\n    try {\n    const saved = await saveArchive({""",1)
text=text.replace("""    setArchiveStatus(saved.cloudSynced ? '정밀분석 기록 저장 + Supabase 동기화 완료' : `이 기기에 정밀분석 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n  }\n\n  async function saveRelationshipRecord()""",
"""    setArchiveStatus(saved.cloudSynced ? '정밀분석 기록 저장 + Supabase 동기화 완료' : `이 기기에 정밀분석 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n    setActionNotice('정밀분석 기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)\n    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '정밀분석 기록 저장 실패') } finally { setArchiveSaving(false) }\n  }\n\n  async function saveRelationshipRecord()""",1)
text=text.replace("""  async function saveRelationshipRecord() {\n    if (!relationshipResult || !relationshipRequestSnapshot) return\n    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'\n    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>\n    const saved = await saveArchive({\n      kind,\n      periodKey: period,""",
"""  async function saveRelationshipRecord() {\n    if (!relationshipResult || !relationshipRequestSnapshot || archiveSaving) return\n    setArchiveSaving(true); setArchiveStatus('관계 분석 기록 저장 중…')\n    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'\n    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>\n    try {\n    const saved = await saveArchive({\n      kind,\n      periodKey: relationshipPeriodKey,""",1)
text=text.replace("""    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n  }\n\n  async function refreshArchive()""",
"""    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)\n    setActionNotice('관계 분석 기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)\n    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '관계 분석 기록 저장 실패') } finally { setArchiveSaving(false) }\n  }\n\n  async function refreshArchive()""",1)

# Restore exact relationship day range.
needle="""      setRelationshipResult(item.result as unknown as RelationshipApiResponse)\n      setRelationshipRequestSnapshot(request)\n      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')"""
replacement="""      setRelationshipResult(item.result as unknown as RelationshipApiResponse)\n      setRelationshipRequestSnapshot(request)\n      const restoredDays = Math.max(7, Math.min(365, Math.round((new Date(`${item.periodEnd}T12:00:00Z`).getTime()-new Date(`${item.periodStart}T12:00:00Z`).getTime())/86400000)+1))\n      setRelationshipDays(restoredDays)\n      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')"""
if needle not in text: raise SystemExit('restore relationship range marker missing')
text=text.replace(needle,replacement,1)

# Global period selector only belongs to integrated/precision. Tool cards handle relation range separately.
old="""          <section className=\"section-block\"><div className=\"section-label\">기간 선택</div><div className=\"period-grid\">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type=\"button\" onClick={()=>setPeriod(key)}><Icon size={17}/><span>{label}</span></button>)}</div></section>"""
new="""          {(selectedTool==='integrated'||selectedTool==='precision') && <section className=\"section-block\"><div className=\"section-label\">통합운세 기간 선택</div><div className=\"period-grid\">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type=\"button\" onClick={()=>setPeriod(key)}><Icon size={17}/><span>{label}</span></button>)}</div></section>}"""
if old not in text: raise SystemExit('global period section marker missing')
text=text.replace(old,new,1)

# Tool selection does not mutate integrated period; relation gets its own 365-day default.
old="""onClick={()=>{setSelectedTool(key); if(key==='marriage') setPeriod('year')}}"""
new="""onClick={()=>{setSelectedTool(key); if(key==='compatibility'||key==='marriage') setRelationshipDays(365); if(key==='location'){setLocationError('');setLocationResult(null)}}}"""
if old not in text: raise SystemExit('tool selection marker missing')
text=text.replace(old,new,1)

# Relationship mode/range UI.
old="""                <button type=\"button\" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setPeriod('year');setReunionTiming(null);setRelationshipAi(null)}}>재회</button>"""
new="""                <button type=\"button\" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setRelationshipDays(365);setReunionTiming(null);setRelationshipAi(null)}}>재회</button>"""
if old not in text: raise SystemExit('reunion click marker missing')
text=text.replace(old,new,1)
range_pattern=re.compile(r'''              <div className="relationship-range-block">\n                <div><strong>\{relationshipPurpose==='reunion'\?'재회운 분석기간':'궁합 시기 분석기간'\}</strong><span>\{queryDate\} ~ \{periodEnd\(queryDate,period\)\} · \{periodRangeLabel\(period\)\}</span></div>\n                <div className="relationship-range-buttons">\{periods\.map\(\(item\)=><button key=\{item\.key\} type="button" className=\{period===item\.key\?'is-active':''\} onClick=\{\(\)=>setPeriod\(item\.key\)\}>\{item\.key==='today'\?'1일':item\.key==='week'\?'7일':item\.key==='month'\?'31일':'1년'\}</button>\)\}</div>\n                <small className="relationship-range-note">\{relationshipPurpose==='reunion'\?'재회는 기본 1년으로 열리고, 수신·발신·재접점의 강한 날짜와 약한 날짜를 이 범위 안에서 비교해\.':'기본 궁합 구조는 출생차트끼리 보는 고정 구조야\. 여기서 고르는 기간은 관계의 시기 흐름에만 적용돼\.'\}</small>\n              </div>''')
new_range='''              <div className="relationship-range-block">\n                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong><span>{queryDate} ~ {relationshipEndDate} · {clampedRelationshipDays}일</span></div>\n                <div className="relationship-range-buttons">{relationshipDayPresets.map((days)=><button key={days} type="button" className={clampedRelationshipDays===days?'is-active':''} onClick={()=>setRelationshipDays(days)}>{days===365?'1년':`${days}일`}</button>)}</div>\n                <div className="relationship-custom-days"><span>직접 지정</span><label><input type="number" min="7" max="365" step="1" value={clampedRelationshipDays} onChange={(e)=>setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)))}/><em>일</em></label></div>\n                <small className="relationship-range-note">{relationshipPurpose==='reunion'?'재회는 기본 365일. 수신·발신·재접점과 두 사람 차트를 건드리는 실제 트랜짓 날짜를 이 범위 안에서 비교해.':'기본 궁합 구조는 고정이고, 여기 지정한 7~365일은 관계 시기 흐름에만 적용돼.'}</small>\n              </div>'''
text,n=range_pattern.subn(new_range,text,count=1)
if n!=1: raise SystemExit('relationship range regex did not match')

# Marriage range.
old="""            {selectedTool==='marriage'&&<div className=\"relationship-range-block marriage-range-block\"><div><strong>{marriageMode==='unmarried'?'미혼 결혼운 분석기간':'기혼 결혼운 분석기간'}</strong><span>{queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div><div className=\"relationship-range-buttons\">{periods.map((item)=><button key={item.key} type=\"button\" className={period===item.key?'is-active':''} onClick={()=>setPeriod(item.key)}>{item.key==='today'?'1일':item.key==='week'?'7일':item.key==='month'?'31일':'1년'}</button>)}</div><small className=\"relationship-range-note\">결혼운은 기본 1년으로 열고, 관계 구조 자체와 선택 기간의 긴장·완화 흐름을 분리해서 봐.</small></div>}"""
new="""            {selectedTool==='marriage'&&<div className=\"relationship-range-block marriage-range-block\"><div><strong>{marriageMode==='unmarried'?'미혼 결혼운 분석기간':'기혼 결혼운 분석기간'}</strong><span>{queryDate} ~ {relationshipEndDate} · {clampedRelationshipDays}일</span></div><div className=\"relationship-range-buttons\">{relationshipDayPresets.map((days)=><button key={days} type=\"button\" className={clampedRelationshipDays===days?'is-active':''} onClick={()=>setRelationshipDays(days)}>{days===365?'1년':`${days}일`}</button>)}</div><div className=\"relationship-custom-days\"><span>직접 지정</span><label><input type=\"number\" min=\"7\" max=\"365\" step=\"1\" value={clampedRelationshipDays} onChange={(e)=>setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)))}/><em>일</em></label></div><small className=\"relationship-range-note\">결혼운은 기본 365일. 관계 구조와 선택 기간의 긴장·완화 흐름을 분리해서 봐.</small></div>}"""
if old not in text: raise SystemExit('marriage range marker missing')
text=text.replace(old,new,1)
text=text.replace("현재 범위는 {queryDate}~{periodEnd(queryDate,period)}이고, 위 버튼에서 1일·7일·31일·1년으로 바꿀 수 있어.", "현재 범위는 {queryDate}~{relationshipEndDate}이고, 7~365일 안에서 직접 바꿀 수 있어.")
text=text.replace("분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}", "분석기간 {queryDate} ~ {relationshipEndDate} · {clampedRelationshipDays}일", 1)
text=text.replace("<span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {periodRangeLabel(period)}</span>", "<span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {clampedRelationshipDays}일</span>")

# Birth date/time classes for stable ratio.
text=text.replace('<label className="field"><span>생년월일</span><input type="date" value={counterpart.birthDate}', '<label className="field birth-date-field"><span>생년월일</span><input type="date" value={counterpart.birthDate}',1)
text=text.replace('<label className="field"><span>출생시간</span><input type="time" value={counterpart.birthTime}', '<label className="field birth-time-field"><span>출생시간</span><input type="time" value={counterpart.birthTime}',1)
text=text.replace('<label className="field"><span>생년월일</span><input type="date" value={birthProfile.birthDate}', '<label className="field birth-date-field"><span>생년월일</span><input type="date" value={birthProfile.birthDate}',1)
text=text.replace('<label className="field"><span>출생시간</span><input type="time" value={birthProfile.birthTime}', '<label className="field birth-time-field"><span>출생시간</span><input type="time" value={birthProfile.birthTime}',1)

# Emoji labels in core grids.
text=text.replace('<span>{topic}</span><strong>{stat.average.toFixed(1)}</strong>', '<span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong>')

# Relationship transit panel component inserted before AppNext.
marker='''export default function AppNext() {\n'''
component=r'''
function ReunionTransitPanel({ result }: { result: RelationshipApiResponse | null }) {
  const data = result?.result?.reunion_transits
  if (!data?.available || !data.top_days?.length) return null
  const aspectKo: Record<string,string> = {conjunction:'합',sextile:'육십분위',square:'사각',trine:'삼각',quincunx:'퀸컨스·150도',opposition:'대립'}
  const pointKo: Record<string,string> = {Sun:'태양',Moon:'달',Mercury:'수성',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성','True Node':'북교점',ASC:'상승점',DSC:'하강점',MC:'중천점',IC:'천저점'}
  const hitText = (hit:any) => `${pointKo[hit.transit]||hit.transit} → ${hit.person==='counterpart'?'상대':'나'} ${pointKo[hit.target]||hit.target} ${aspectKo[hit.aspect]||hit.aspect} · 오브 ${Number(hit.orb).toFixed(2)}°`
  return <section className="result-card reunion-transit-panel">
    <div className="result-card-title"><span>실제 트랜짓</span><strong>두 사람 차트를 직접 건드리는 날짜</strong></div>
    <p className="result-note">단순 재회 점수가 아니라, 선택 기간 안에서 현재 행성이 너와 상대의 출생차트 핵심점을 실제로 건드리는 날짜를 별도로 계산했어. 사건 확률은 아니야.</p>
    <div className="reunion-transit-list">{data.top_days.slice(0,8).map((day,index)=><article className="reunion-transit-day" key={day.date}><header><strong>{index+1}. {day.date}</strong><b>{day.score.toFixed(1)}</b></header><p>{day.hits.slice(0,3).map(hitText).join(' · ')}</p></article>)}</div>
  </section>
}

'''
if marker not in text: raise SystemExit('transit component marker missing')
text=text.replace(marker,component+marker,1)

# Add transit panel after the existing reunion timing panel.
old="""              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTimingPanel context={reunionTiming} loading={reunionTimingLoading} error={reunionTimingError}/>}\n              <RelationshipInterpretationPanel"""
new="""              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTimingPanel context={reunionTiming} loading={reunionTimingLoading} error={reunionTimingError}/>}\n              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTransitPanel result={relationshipResult}/>}\n              <RelationshipInterpretationPanel"""
if old not in text: raise SystemExit('reunion transit render marker missing')
text=text.replace(old,new,1)

# AI system notes become collapsed details.
text=text.replace('<div className="ai-system-note"><strong>체계별 해석</strong>', '<details className="ai-system-note"><summary>체계별 계산 근거</summary>')
text=text.replace('</p>}</div>\n    {data.limits', '</p>}</details>\n    {data.limits',1)

# Location tool panel inserted before precision panel.
marker="""          {selectedTool === 'precision' && <section className=\"tool-panel precision-panel\">"""
location_panel=r'''          {selectedTool === 'location' && <section className="tool-panel location-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><MapPin size={22}/></span><div><span className="eyebrow">지역 활성도 계산</span><h2>지역·국가운</h2><p>출생 순간의 행성이 각 도시의 ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)에 얼마나 가까이 놓이는지 계산해서 장기거주·연애·커리어·공부·휴식 목적별로 비교해.</p></div></div>
            <div className="coordinate-note"><MapPin size={16}/><span>좋은 나라를 단정하는 기능은 아니야. 대표 도시의 점성 활성도를 비교하고, 비자·생활비·치안·언어·직업시장 같은 현실 조건은 별도로 봐야 해.</span></div>
            {locationError && <div className="status-banner error"><AlertTriangle size={17}/><span>{locationError}</span></div>}
            <button className="primary-button" type="button" onClick={runLocationFit} disabled={locationLoading||apiStatus==='offline'}>{locationLoading?<LoaderCircle className="spin" size={18}/>:<MapPin size={18}/>}<span>{locationLoading?'국가·도시 계산 중…':'나와 맞는 국가·도시 계산'}</span></button>
            {locationResult && <div className="results-wrap">
              <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div><div className="location-rank-list">{locationResult.countries.slice(0,10).map((row,index)=><div className="location-rank-row" key={row.country}><span>{index+1}</span><div><strong>{row.country}</strong><small>대표 도시 {row.best_city}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div><p className="result-note">점수는 대표 도시 카탈로그 안의 상대적 점성 활성도야. 실제 이민·여행 성공 확률이 아니야.</p></section>
              <div className="location-purpose-grid">{Object.entries(locationResult.purposes).map(([key,group])=><section className="location-purpose-card" key={key}><strong>{group.label}</strong><div className="location-rank-list">{group.cities.slice(0,5).map((row,index)=><div className="location-rank-row" key={`${key}-${row.city}`}><span>{index+1}</span><div><strong>{row.city} · {row.country}</strong><small>{row.evidence.slice(0,2).map((ev)=>`${ev.planet}(${annotateUserFacingText(ev.planet).replace(ev.planet,'').replace(/[()]/g,'')||ev.planet})-${ev.angle} ${ev.separation_deg}°`).join(' · ')}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div></section>)}</div>
              <p className="location-evidence">{locationResult.policy.meaning} · {locationResult.policy.catalog_scope}</p>
            </div>}
          </section>}

'''
if marker not in text: raise SystemExit('location panel marker missing')
text=text.replace(marker,location_panel+marker,1)

# Unconditional home report is only for integrated tool.
old='''          <section className="tool-panel">\n            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">천체 흐름 리포트</span>'''
new='''          {selectedTool==='integrated' && <section className="tool-panel">\n            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">천체 흐름 리포트</span>'''
if old not in text: raise SystemExit('home report start marker missing')
text=text.replace(old,new,1)
old='''              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>\n            </>}\n          </section>\n        </>}'''
new='''              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>\n            </>}\n          </section>}\n        </>}'''
if old not in text: raise SystemExit('home report end marker missing')
text=text.replace(old,new,1)

# Collapse systems summary rather than a large always-open block.
text=text.replace('<section className="result-card">\n                <div className="result-card-title"><span>SYSTEMS</span><strong>사주 · Thai 요약</strong></div>', '<details className="result-card system-summary-details">\n                <summary>사주·Thai(태국점성술) 계산 근거</summary>')
text=text.replace('</section>\n\n              <div className="result-actions home-result-actions">', '</details>\n\n              <div className="result-actions home-result-actions">',1)

# Save buttons reflect saving state.
text=text.replace('<button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>', '<button className="save-action" type="button" onClick={saveIntegratedRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?\'저장 중…\':\'기록 저장\'}</span></button>')
text=text.replace('<button className="save-action" type="button" onClick={saveRelationshipRecord}><Save size={15}/><span>기록 저장</span></button>', '<button className="save-action" type="button" onClick={saveRelationshipRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?\'저장 중…\':\'기록 저장\'}</span></button>')
text=text.replace('<button className="save-action" type="button" onClick={savePrecisionRecord}><Save size={15}/><span>정밀 기록 저장</span></button>', '<button className="save-action" type="button" onClick={savePrecisionRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?\'저장 중…\':\'정밀 기록 저장\'}</span></button>')
# There are two integrated save buttons; replace any remaining.
text=text.replace('<button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>', '<button className="save-action" type="button" onClick={saveIntegratedRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?\'저장 중…\':\'기록 저장\'}</span></button>')

# Visible save toast and bottom nav.
old='''      </main>\n      <nav className="bottom-nav" aria-label="하단 탐색">'''
new='''      </main>\n      {actionNotice && actionNotice.includes('저장') && <div className="save-feedback-toast" role="status" aria-live="polite">{actionNotice}</div>}\n      <nav className="bottom-nav" aria-label="하단 탐색">'''
if old not in text: raise SystemExit('save toast marker missing')
text=text.replace(old,new,1)

p.write_text(text,encoding='utf-8')

# -----------------------------------------------------------------------------
# 5) main.tsx loads v12 corrections last.
# -----------------------------------------------------------------------------
p=ROOT/'web/src/main.tsx'
text=p.read_text(encoding='utf-8')
needle="import './mobile-spacing-v11.css'"
if needle not in text: raise SystemExit('main css marker missing')
text=text.replace(needle,needle+"\nimport './fixpack-v12.css'",1)
p.write_text(text,encoding='utf-8')

print('starlight fixpack v12 patch applied')
