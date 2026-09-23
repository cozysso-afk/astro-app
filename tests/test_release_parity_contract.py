from __future__ import annotations

import inspect

from api import main as api_main


def test_health_exposes_release_provenance() -> None:
    payload = api_main.health()
    assert payload["status"] == "ok"
    assert payload["version"] == api_main.APP_VERSION
    assert payload["calculation_schema_version"] == api_main.CALCULATION_SCHEMA_VERSION
    assert payload["interpretation_version"] == api_main.INTERPRETATION_CONTRACT_VERSION
    assert isinstance(payload["git_sha"], str)
    assert payload["git_sha"]


def test_relationship_response_carries_same_release_contract() -> None:
    source = inspect.getsource(api_main.relationship_western)
    assert '"calculation_schema_version": CALCULATION_SCHEMA_VERSION' in source
    assert '"interpretation_version": INTERPRETATION_CONTRACT_VERSION' in source
    assert '"git_sha": GIT_SHA' in source
    assert '"engine_version": result.get("engine", REL_ENGINE_VERSION)' in source
