from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / 'integrated_fortune_v1.py'
s = p.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2"', 'ENGINE_VERSION = "integrated-fortune-v2.1"', 1)
anchor = '    evidences.sort(key=lambda x: x["score"], reverse=True)\n    return {\n'
if anchor not in s:
    raise SystemExit('evidence sort anchor missing')
s = s.replace(anchor, '    evidences.sort(key=lambda x: x["score"], reverse=True)\n    # Scores already include every contribution. Retain only the strongest\n    # evidence rows for interpretation/UI to keep Render memory bounded.\n    evidences = evidences[:8]\n    return {\n', 1)
s = s.replace('@lru_cache(maxsize=1000)\ndef _daily_detailed_cached', '@lru_cache(maxsize=64)\ndef _daily_detailed_cached', 1)
p.write_text(s, encoding='utf-8')

p = ROOT / 'api/main.py'
s = p.read_text(encoding='utf-8')
s = s.replace('APP_VERSION = "api-fortune-v4"', 'APP_VERSION = "api-fortune-v4.1"', 1)
p.write_text(s, encoding='utf-8')
print('Render stabilization patch applied')
