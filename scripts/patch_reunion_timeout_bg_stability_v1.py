from pathlib import Path

root = Path(__file__).resolve().parents[1]

auth = root / 'web/src/lib/auth.ts'
text = auth.read_text(encoding='utf-8')
old = "const DIRECT_REUNION_TIMEOUT_MS = 30_000"
new = "const DIRECT_REUNION_TIMEOUT_MS = 75_000"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('DIRECT_REUNION_TIMEOUT_MS anchor not found')
text = text.replace("재회운 계산 응답이 30초를 넘겼어. 잠시 후 다시 시도해줘.", "재회운 계산 응답이 75초를 넘겼어. 서버 계산이 계속 지연되고 있어. 잠시 후 다시 시도해줘.")
auth.write_text(text, encoding='utf-8')

css = root / 'web/src/background-stability-v1.css'
css.write_text("""/* Stable app background: do not move aurora centers when form height changes. */
.app-shell {
  background:
    radial-gradient(circle 260px at 14% 0px, rgba(231,223,240,.52), transparent 100%),
    radial-gradient(circle 240px at 88% 170px, rgba(223,233,240,.42), transparent 100%),
    linear-gradient(180deg,#f7f5f9 0%,#f4f2f6 100%) !important;
  background-color: #f5f3f8 !important;
}
""", encoding='utf-8')

main = root / 'web/src/main.tsx'
main_text = main.read_text(encoding='utf-8')
anchor = "import './reading-font-fix-v54.css'"
import_line = "import './background-stability-v1.css'"
if import_line not in main_text:
    if anchor not in main_text:
        raise SystemExit('main css import anchor not found')
    main_text = main_text.replace(anchor, anchor + "\n" + import_line, 1)
main.write_text(main_text, encoding='utf-8')

test = root / 'tests/test_reunion_timeout_background_stability_v1.py'
test.write_text("""from pathlib import Path

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
""", encoding='utf-8')
