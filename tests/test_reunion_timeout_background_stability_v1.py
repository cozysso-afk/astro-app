from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_reunion_direct_timeout_matches_production_runtime():
    auth = (ROOT / 'web/src/lib/auth.ts').read_text(encoding='utf-8')
    assert 'const DIRECT_REUNION_TIMEOUT_MS = 75_000' in auth
    assert '재회운 계산 응답이 75초를 넘겼어.' in auth


def test_app_background_is_height_invariant():
    main = (ROOT / 'web/src/main.tsx').read_text(encoding='utf-8')
    css = (ROOT / 'web/src/background-stability-v1.css').read_text(encoding='utf-8')
    assert "import './background-stability-v1.css'" in main
    assert 'at 14% 0px' in css
    assert 'at 88% 170px' in css
    assert 'at 88% 10%' not in css
