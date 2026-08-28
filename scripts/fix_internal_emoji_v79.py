from pathlib import Path

p=Path('fortune_lab_v71.py')
s=p.read_text(encoding='utf-8')
orig=s

s=s.replace('<div class="fortune-page-icon">♥</div>','<div class="fortune-page-icon">💗</div>',1)
s=s.replace('<div class="fortune-page-icon">✦</div>','<div class="fortune-page-icon">✨</div>',1)

if 'FORTUNE_LAB_VERSION = "v0.1.9"' in s:
    s=s.replace('FORTUNE_LAB_VERSION = "v0.1.9"','FORTUNE_LAB_VERSION = "v0.2.0"',1)

if s==orig:
    raise SystemExit('no changes applied')

p.write_text(s,encoding='utf-8')
print('patched fortune_lab_v71.py internal emoji')
