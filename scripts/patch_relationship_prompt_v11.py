from pathlib import Path

p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=p.read_text()
old='marriage_reading의 bottom_line/bond/emotional_home/daily_life/conflict_repair/commitment_or_current_cycle/timing/caution을 각각 최소 4문장 수준으로 충분히 쓴다. 결속이 강해도 생활궁합이 힘들 수 있고, 끌림이 강해도 책임 구조가 약할 수 있음을 분리한다.'
new='marriage_reading의 bottom_line/bond/emotional_home/daily_life/intimacy_resources/conflict_repair/commitment_or_current_cycle/timing/caution을 각각 충분히 쓴다. intimacy_resources에는 8하우스·Pluto(명왕성)·Venus(금성)/Mars(화성) 근거가 실제 데이터에 있을 때만 친밀감·공유재정·공유자원을 별도로 읽는다. 결속이 강해도 생활궁합이 힘들 수 있고, 끌림이 강해도 책임 구조가 약할 수 있음을 분리한다.'
if old not in s: raise SystemExit('unmarried marriage output field instruction missing')
s=s.replace(old,new,1)

old='[기혼 결혼 marriage_married]\n이미 결혼한 관계다. 결혼 가능성 표현 금지. 현재 결속·정서적 거리·생활역할·공유재정/친밀감·반복갈등·회복력·시기별 긴장/완화를 위 포인트로 깊게 읽는다.'
new='[기혼 결혼 marriage_married]\n이미 결혼한 관계다. 결혼 가능성·결혼 성사 여부·프러포즈 가능성 표현은 금지한다. 현재 결속·정서적 거리·생활역할·공유재정/친밀감·반복갈등·회복력·시기별 긴장/완화를 위 포인트로 깊게 읽는다. marriage_reading.intimacy_resources는 현재의 친밀감·공유재정·공유자원 구조로만 해석한다.'
if old not in s: raise SystemExit('married instruction missing')
s=s.replace(old,new,1)
p.write_text(s)
