from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")
old = '''@media (max-width:640px) {
    .block-container { padding-left: .9rem; padding-right: .9rem; padding-top:.7rem; }
'''
new = '''@media (max-width:640px) {
    html, body { scroll-padding-bottom: calc(9rem + env(safe-area-inset-bottom)); }
    .block-container {
        padding-left: .9rem;
        padding-right: .9rem;
        padding-top: .7rem;
        padding-bottom: calc(9rem + env(safe-area-inset-bottom));
    }
'''
if new in text:
    print("iOS bottom safe-area fix already applied")
    raise SystemExit(0)
if old not in text:
    raise SystemExit("mobile CSS anchor not found")
text = text.replace(old, new, 1)
APP.write_text(text, encoding="utf-8")
print("iOS bottom toolbar safe-area fix applied")
