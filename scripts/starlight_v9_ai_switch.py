from pathlib import Path
p=Path('web/src/AppNext.tsx')
text=p.read_text(encoding='utf-8')
changes={
    "fortune-interpret-v3-preview":"fortune-interpret-v4-preview",
    "relationship-interpret-v7-preview":"relationship-interpret-v8-preview",
}
for old,new in changes.items():
    if old not in text:
        raise SystemExit(f'missing marker: {old}')
    text=text.replace(old,new)
p.write_text(text,encoding='utf-8')
print('AI preview functions switched to v4/v8')
