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
    assert "relationship_western(request)" in backend
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
