from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_reunion_background_job_has_no_75_second_frontend_cutoff():
    auth = (ROOT / 'web/src/lib/auth.ts').read_text(encoding='utf-8')
    backend = (ROOT / 'api/relationship_async_v1.py').read_text(encoding='utf-8')
    assert 'DIRECT_REUNION_TIMEOUT_MS' not in auth
    assert '재회운 계산 응답이 75초를 넘겼어.' not in auth
    assert 'REUNION_JOB_MAX_AGE_MS = 29 * 60_000' in auth
    assert 'REUNION_PENDING_STORAGE_PREFIX' in auth
    assert 'pollReunionJob' in auth
    assert 'max(300, min(600, int(os.getenv("ASTRO_RELATIONSHIP_HARD_TIMEOUT_SECONDS", "300"))))' in backend
    assert '_HARD_TIMEOUT_SECONDS = 300' in backend


def test_app_background_is_height_invariant():
    main = (ROOT / 'web/src/main.tsx').read_text(encoding='utf-8')
    css = (ROOT / 'web/src/background-stability-v1.css').read_text(encoding='utf-8')
    assert "import './background-stability-v1.css'" in main
    assert 'at 14% 0px' in css
    assert 'at 88% 170px' in css
    assert 'at 88% 10%' not in css
