from pathlib import Path

path = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
text = path.read_text(encoding='utf-8')
old = '- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다. 각 핵심 문단마다 가능한 한 실제 애스펙트 이름과 오브를 1~3개 근거로 든다.'
new = '- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다.\n- 각 핵심 문단마다 가능한 한 실제 애스펙트 이름과 오브를 1~3개 근거로 든다.'
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one V14 prompt normalization anchor, got {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('normalized V14 relationship prompt anchor')
