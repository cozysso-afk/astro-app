from pathlib import Path

p = Path('web/src/lib/relationshipModeContract.test.mjs')
s = p.read_text()
s = s.replace("assert.match(personalPanel, /점성 엔터테인먼트 지수/)", "assert.match(personalPanel, /0~100은 실제 통계 확률이 아니/)", 1)
if "0~100은 실제 통계 확률이 아니" not in s:
    raise SystemExit('forecast disclaimer contract update missing')
p.write_text(s)
