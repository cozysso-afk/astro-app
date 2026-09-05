from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'api/main.py',
    'APP_VERSION = "api-fortune-v5.5-birth-time-provenance"',
    'APP_VERSION = "api-fortune-v5.6-relationship-e2e-contract"',
)

replace_once(
    'api/main.py',
    '    time_known: bool = True\n    time_source: TimeSource = "unknown"\n',
    '    time_known: bool | None = None\n    time_source: TimeSource = "unknown"\n',
)

replace_once(
    'api/main.py',
    '''    def engine_payload(self) -> dict:\n        raw = {\n            "birth_time": self.birth_time,\n            "time_known": self.time_known,\n            "time_source": self.time_source,\n''',
    '''    def engine_payload(self) -> dict:\n        # `time_known` may be omitted by API clients. Infer only from the\n        # presence of a concrete birth_time; an explicit false still wins.\n        normalized_time_known = self.time_known if self.time_known is not None else self.birth_time is not None\n        raw = {\n            "birth_time": self.birth_time,\n            "time_known": normalized_time_known,\n            "time_source": self.time_source,\n''',
)

replace_once(
    'api/main.py',
    '''    if not request.user.time_known or request.user.birth_time is None:\n        raise HTTPException(status_code=422, detail="user birth_time is required for the precision relationship engine")\n    if request.user.latitude is None or request.user.longitude is None:\n        raise HTTPException(status_code=422, detail="user birth coordinates are required for the precision relationship engine")\n    if request.counterpart.time_known:\n        if request.counterpart.birth_time is None:\n            raise HTTPException(status_code=422, detail="counterpart birth_time is required when time_known=true")\n        if request.counterpart.latitude is None or request.counterpart.longitude is None:\n            raise HTTPException(status_code=422, detail="counterpart birth coordinates are required when time_known=true")\n\n    segments = _month_segments(request.start_date, request.end_date)\n''',
    '''    if not user_payload["time_known"] or user_payload["birth_time"] is None:\n        raise HTTPException(status_code=422, detail="user birth_time is required for the relationship engine")\n    # Coordinates are precision inputs, not an all-or-nothing API gate.\n    # Missing coordinates disable angle/house/Davison layers inside the engine\n    # while preserving valid planetary and Saju calculations.\n    if cp_payload["time_known"] and cp_payload["birth_time"] is None:\n        raise HTTPException(status_code=422, detail="counterpart birth_time is required when time_known=true")\n\n    if request.analysis_mode == "marriage_married" and request.relationship_status != "married":\n        raise HTTPException(status_code=422, detail="analysis_mode=marriage_married requires relationship_status=married")\n    if request.analysis_mode == "marriage_unmarried" and request.relationship_status == "married":\n        raise HTTPException(status_code=422, detail="analysis_mode=marriage_unmarried cannot be used with relationship_status=married")\n\n    segments = _month_segments(request.start_date, request.end_date)\n''',
)

# Remove an accidental no-op assertion from the probe test now that the real
# axis-level probability contract is asserted immediately below it.
replace_once(
    'tests/test_relationship_api_e2e_v15.py',
    '    assert result["reunion_dimensions"]["event_probability"] if False else True\n',
    '',
)

print('relationship API E2E V15 patch applied')
