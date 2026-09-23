from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_contract() -> None:
    backend = (ROOT / "api/relationship_async_v1.py").read_text(encoding="utf-8")
    private_app = (ROOT / "api/private_app.py").read_text(encoding="utf-8")
    auth = (ROOT / "web/src/lib/auth.ts").read_text(encoding="utf-8")

    assert '@app.post("/v1/relationship/western/start")' in backend
    assert '@app.get("/v1/relationship/western/jobs/{job_id}")' in backend
    assert "threading.Semaphore" in backend
    assert "_request_index" in backend
    assert "_HARD_TIMEOUT_SECONDS" in backend
    assert "worker.join(timeout=_HARD_TIMEOUT_SECONDS)" in backend
    assert "if worker.is_alive():" in backend
    assert 'status="failed"' in backend
    assert 'status_code=504' in backend
    assert "_can_reuse" in backend
    assert "return (now - anchor) <= (_HARD_TIMEOUT_SECONDS + 5)" in backend
    assert '_progress(job_id, "reunion_hierarchy", 58' in backend
    assert "build_relationship_western" in backend
    assert "augment_relationship_with_returns" in backend
    assert "apply_reunion_hierarchy" in backend
    assert "relationship_async_v1" in private_app

    assert "runAsyncReunionRelationship" in auth
    assert "/v1/relationship/western/start" in auth
    assert "/v1/relationship/western/jobs/" in auth
    assert "analysis_mode === 'reunion'" in auth
    assert "120_000" in auth
    assert "status: 504" not in auth  # timeout must go through the shared JSON response helper
    assert "jsonResponse({ detail: lastDetail }, 504)" in auth

    print("relationship async contract: ok")


if __name__ == "__main__":
    run_contract()
