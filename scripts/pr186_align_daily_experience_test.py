from pathlib import Path
p=Path('web/src/lib/readingExperience.test.mjs')
s=p.read_text()
old="  assert.match(view.headline,/생각을 정리하고 말을 주고받는 방식/)\n  assert.match(view.headline,/실제 약속이나 일정/)"
new="  assert.match(view.headline,/대화의 요점과 실제 합의/)\n  assert.match(view.headline,/실제 약속이나 일정/)\n  assert.doesNotMatch(view.headline,/생각을 정리하고 말을 주고받는 방식이 특히 두드러지고/)"
assert old in s
p.write_text(s.replace(old,new,1))
