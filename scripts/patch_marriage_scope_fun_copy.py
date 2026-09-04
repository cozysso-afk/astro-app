from pathlib import Path
import runpy

# Reuse the already-audited scope patch, then correct its earlier overly-conservative copy.
runpy.run_path('scripts/patch_marriage_scope_ui.py', run_name='__main__')

p = Path('web/src/AppNext.tsx')
s = p.read_text()
s = s.replace(
    "<strong>상대 없음 · 개인 결혼운</strong><span>내 결혼생활 성향 · 동반자 구조 · 주목 시기</span>",
    "<strong>상대 없음 · 개인 결혼운</strong><span>결혼 가능성 · 시기 · 미래 배우자상</span>",
    1,
)
s = s.replace(
    "marriageScope==='personal'?'특정 상대를 가정하지 않고 내 출생차트의 동반자·가정·친밀감·책임 구조와 선택 기간의 상대활성도를 봐. 결혼 성사 확률이나 미래 배우자 신원은 예언하지 않아.':'결혼 여부 예언이 아니라, 이 특정 상대와 결혼생활로 들어갈 때의 결속·생활·친밀감·돈/공유자원·갈등·지속성을 깊게 봐.'",
    "marriageScope==='personal'?'상대가 없어도 내 차트로 결혼 가능성 지수·강한 시기·배우자 외모/성향/직업군·만남 경로를 적극적으로 봐. 0~100은 점성 엔터테인먼트 지수이고 실제 이름·주소·회사처럼 특정 신원만 만들어내지 않아.':'이 특정 상대와 결혼생활로 들어갈 때의 결속·생활·친밀감·돈/공유자원·갈등·지속성과 결혼 흐름을 깊게 봐.'",
    1,
)
p.write_text(s)
