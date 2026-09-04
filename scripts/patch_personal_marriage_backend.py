from pathlib import Path

p = Path('api/main.py')
s = p.read_text()

old = 'from astrocartography_v1 import ENGINE_VERSION as LOCATION_ENGINE_VERSION, build_location_fit\n'
new = old + 'from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\n'
if old not in s:
    raise SystemExit('import anchor missing')
s = s.replace(old, new, 1)

old = 'APP_VERSION = "api-fortune-v5.2-purpose-scoped-relationship"'
new = 'APP_VERSION = "api-fortune-v5.3-personal-marriage-scope"'
if old not in s:
    raise SystemExit('app version anchor missing')
s = s.replace(old, new, 1)

old = '''class IntegratedFortuneRequest(BaseModel):\n    profile: FortuneProfile\n    start_date: date\n    end_date: date\n\n\nclass IntegratedInterpretRequest(BaseModel):'''
new = '''class IntegratedFortuneRequest(BaseModel):\n    profile: FortuneProfile\n    start_date: date\n    end_date: date\n\n\nclass PersonalMarriageRequest(BaseModel):\n    profile: FortuneProfile\n    start_date: date\n    end_date: date\n\n\nclass IntegratedInterpretRequest(BaseModel):'''
if old not in s:
    raise SystemExit('request model anchor missing')
s = s.replace(old, new, 1)

old = '        "location_engine": LOCATION_ENGINE_VERSION,\n'
new = old + '        "personal_marriage_engine": PERSONAL_MARRIAGE_ENGINE_VERSION,\n'
if old not in s:
    raise SystemExit('meta engine anchor missing')
s = s.replace(old, new, 1)

old = '            "location/fit",\n'
new = old + '            "marriage/personal",\n'
if old not in s:
    raise SystemExit('meta route anchor missing')
s = s.replace(old, new, 1)

anchor = '''@app.post("/v1/relationship/western")\ndef relationship_western(request: RelationshipRequest) -> dict:\n'''
route = '''@app.post("/v1/marriage/personal")\ndef personal_marriage(request: PersonalMarriageRequest) -> dict:\n    profile = request.profile\n    try:\n        result = build_personal_marriage(\n            birth_date=profile.birth_date,\n            birth_time=profile.birth_time,\n            latitude=profile.latitude,\n            longitude=profile.longitude,\n            utc_offset_hours=profile.utc_offset_hours,\n            start_date=request.start_date,\n            end_date=request.end_date,\n        )\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc)) from exc\n    except Exception as exc:\n        raise HTTPException(status_code=500, detail=f"personal marriage calculation failed: {exc}") from exc\n    return {\n        "ok": True,\n        "api_version": APP_VERSION,\n        "engine": PERSONAL_MARRIAGE_ENGINE_VERSION,\n        "period": result["period"],\n        "result": result,\n        "interpretation_policy": {\n            "counterpart_required": False,\n            "probability": False,\n            "spouse_identity_claims": False,\n            "mode": "상대가 없는 미혼 개인 결혼운 · 결혼 확률이 아니라 본인 차트의 결혼생활 구조와 활성 구간을 계산",\n        },\n    }\n\n\n'''
if anchor not in s:
    raise SystemExit('relationship route anchor missing')
s = s.replace(anchor, route + anchor, 1)

p.write_text(s)
