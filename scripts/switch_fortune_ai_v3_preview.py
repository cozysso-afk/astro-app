from pathlib import Path
p=Path('web/src/AppNext.tsx')
s=p.read_text(encoding='utf-8')
count=s.count("fortune-interpret")
if count < 3:
    raise SystemExit(f'expected fortune-interpret invocations, found {count}')
s=s.replace("fortune-interpret", "fortune-interpret-v3-preview")
p.write_text(s,encoding='utf-8')
print('switched',count,'fortune AI invocations to v3 preview')
