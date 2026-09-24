from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'api/relationship_async_v1.py'
s = path.read_text(encoding='utf-8')
old = '''try:\n    _HARD_TIMEOUT_SECONDS = max(30, min(180, int(os.getenv("ASTRO_RELATIONSHIP_HARD_TIMEOUT_SECONDS", "75"))))\nexcept ValueError:\n    _HARD_TIMEOUT_SECONDS = 75\n'''
new = '''try:\n    # Reunion full-year calculations run as server jobs so iOS backgrounding does not own\n    # the lifetime of the calculation. Keep a bounded server-side ceiling, but do not\n    # reuse the old 75-second browser-era cutoff for these background jobs.\n    _HARD_TIMEOUT_SECONDS = max(300, min(600, int(os.getenv("ASTRO_RELATIONSHIP_HARD_TIMEOUT_SECONDS", "300"))))\nexcept ValueError:\n    _HARD_TIMEOUT_SECONDS = 300\n'''
if old not in s:
    raise SystemExit('relationship async timeout target not found')
path.write_text(s.replace(old, new, 1), encoding='utf-8')
print('patched reunion background server timeout')
