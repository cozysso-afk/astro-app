from pathlib import Path

# one-shot trigger for verified stale-contract cleanup
p=Path('web/src/lib/readingExperience.test.mjs')
s=p.read_text()
old="""  assert.match(view.headline,/초반에는/)\n  assert.match(view.headline,/중반에는/)\n  assert.match(view.headline,/후반에는/)\n  assert.match(view.headline,/이어지는 주야/)\n  assert.doesNotMatch(view.headline,/힘을 쓰기 괜찮지만|속도를 낮추는 편이 좋아/)\n"""
new="""  assert.match(view.headline,/초반엔/)\n  assert.match(view.headline,/중반엔/)\n  assert.match(view.headline,/후반엔/)\n  assert.match(view.headline,/마무리되는 주야/)\n  assert.doesNotMatch(view.headline,/두드러져|하는 쪽|보는 쪽|힘을 쓰기 괜찮지만|속도를 낮추는 편이 좋아/)\n"""
if old not in s:
    raise SystemExit('stale weekly assertion anchor missing')
p.write_text(s.replace(old,new,1))
print('weekly stale test updated')
