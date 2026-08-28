from pathlib import Path

APP=Path('app.py')
s=APP.read_text(encoding='utf-8')
old='from fortune_lab_v71 import render_fortune_lab\n'
new='''import importlib\nimport fortune_lab_v71 as fortune_lab_module\nfortune_lab_module = importlib.reload(fortune_lab_module)\nrender_fortune_lab = fortune_lab_module.render_fortune_lab\n'''
if old in s:
    s=s.replace(old,new,1)
elif 'fortune_lab_module = importlib.reload(fortune_lab_module)' not in s:
    raise SystemExit('fortune lab import marker not found')
APP.write_text(s,encoding='utf-8')

FL=Path('fortune_lab_v71.py')
f=FL.read_text(encoding='utf-8')
if 'FORTUNE_LAB_VERSION = "v0.1.4"' not in f:
    f=f.replace('FORTUNE_LAB_VERSION = "v0.1.3"','FORTUNE_LAB_VERSION = "v0.1.4"',1)
marker='''    st.markdown("### 🧭 FORTUNE LAB · 다체계 운세 분석")\n'''
if '운영 버전 · {FORTUNE_LAB_VERSION}' not in f:
    if marker not in f:
        raise SystemExit('fortune lab render marker not found')
    f=f.replace(marker,marker+'    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")\n',1)
FL.write_text(f,encoding='utf-8')
print('Applied Fortune Lab forced module reload v0.1.4')
