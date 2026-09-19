from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'
s = p.read_text(encoding='utf-8')
old = ".replace(/(?:오차|오브)\\s*0\\.01° 미만(?:\\s*수준)?의?\\s*(?:극도로\\s*)?정밀한/g, '아주 가까운')"
new = ".replace(/(?:오차|오브)\\s*0\\.01° 미만(?:\\s*수준)?의?\\s*(?:극도로\\s*)?정밀한/g, '오브 0.01° 미만으로 매우 가까운')"
if s.count(old) != 1:
    raise RuntimeError(f'tiny orb wording: expected 1, got {s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('tiny orb display preserves <0.01 degree precision')
