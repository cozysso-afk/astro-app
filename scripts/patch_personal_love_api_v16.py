from pathlib import Path

path = Path('api/main.py')
text = path.read_text(encoding='utf-8')


def once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one match, got {count}: {old[:100]!r}')
    text = text.replace(old, new, 1)


once('from pydantic import BaseModel, Field', 'from pydantic import BaseModel, ConfigDict, Field')
once(
    'from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\n',
    'from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\n'
    'from personal_love_forecast_v1 import ENGINE_VERSION as PERSONAL_LOVE_ENGINE_VERSION, build_personal_love_forecast\n',
)
once(
    'APP_VERSION = "api-fortune-v5.6-relationship-e2e-contract"',
    'APP_VERSION = "api-fortune-v5.7-purpose-separated-love"',
)
once(
    '''class RelationshipRequest(BaseModel):\n    user: RelationshipProfile\n    counterpart: RelationshipProfile\n    start_date: date\n    end_date: date\n    relationship_status: RelationshipStatus = "dating"\n    analysis_mode: Literal["compatibility", "reunion", "marriage_unmarried", "marriage_married"] = "compatibility"\n\n\nclass FortuneProfile(BaseModel):\n''',
    '''class RelationshipRequest(BaseModel):\n    user: RelationshipProfile\n    counterpart: RelationshipProfile\n    start_date: date\n    end_date: date\n    relationship_status: RelationshipStatus = "dating"\n    analysis_mode: Literal["compatibility", "reunion", "marriage_unmarried", "marriage_married"] = "compatibility"\n\n\nclass PersonalLoveRequest(BaseModel):\n    model_config = ConfigDict(extra="forbid")\n\n    profile: RelationshipProfile\n    start_date: date\n    end_date: date\n\n\nclass FortuneProfile(BaseModel):\n''',
)
once(
    '''        "personal_marriage_engine": PERSONAL_MARRIAGE_ENGINE_VERSION,\n        "calculation_engine_connected": True,\n''',
    '''        "personal_marriage_engine": PERSONAL_MARRIAGE_ENGINE_VERSION,\n        "personal_love_engine": PERSONAL_LOVE_ENGINE_VERSION,\n        "calculation_engine_connected": True,\n''',
)
once(
    '''            "relationship/western",\n            "fortune/integrated",\n''',
    '''            "relationship/western",\n            "love/personal",\n            "love/new-relationship",\n            "fortune/integrated",\n''',
)
route_anchor = '@app.post("/v1/marriage/personal")\ndef personal_marriage(request: PersonalMarriageRequest) -> dict:\n'
if route_anchor not in text:
    raise SystemExit('personal marriage route anchor missing')
route_block = '''def _personal_love_response(request: PersonalLoveRequest, mode: Literal["personal_love_forecast", "new_relationship"]) -> dict:\n    profile_payload = request.profile.engine_payload()\n    try:\n        result = build_personal_love_forecast(\n            profile_payload,\n            start_date=request.start_date,\n            end_date=request.end_date,\n            mode=mode,\n        )\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc)) from exc\n    except Exception as exc:\n        raise HTTPException(status_code=500, detail=f"personal love calculation failed: {exc}") from exc\n    return {\n        "ok": bool(result.get("ok", True)),\n        "api_version": APP_VERSION,\n        "engine": result.get("engine", PERSONAL_LOVE_ENGINE_VERSION),\n        "analysis_mode": mode,\n        "period": result.get("period") or {"start": request.start_date.isoformat(), "end": request.end_date.isoformat()},\n        "result": result,\n        "interpretation_policy": {\n            "counterpart_required": False,\n            "counterpart_data_allowed": False,\n            "reunion_inference_allowed": False,\n            "known_person_private_intent_claims": False,\n            "event_probability": "not_calculated",\n            "score_semantics": "single-person astrology activation index only",\n        },\n    }\n\n\n@app.post("/v1/love/personal")\ndef personal_love(request: PersonalLoveRequest) -> dict:\n    return _personal_love_response(request, "personal_love_forecast")\n\n\n@app.post("/v1/love/new-relationship")\ndef new_relationship(request: PersonalLoveRequest) -> dict:\n    return _personal_love_response(request, "new_relationship")\n\n\n'''
text = text.replace(route_anchor, route_block + route_anchor, 1)
path.write_text(text, encoding='utf-8')
print('personal love API V16 patch applied')
