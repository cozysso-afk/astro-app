from pathlib import Path

p = Path('web/src/lib/interpretationUiContract.test.mjs')
text = p.read_text(encoding='utf-8')
old = '''  assert.match(defaultMarkup, /userSummary\\.headline/)
  assert.match(defaultMarkup, /userSummary\\.favorableCards/)
  assert.match(defaultMarkup, /userSummary\\.cautionCards/)
  assert.match(defaultMarkup, /userSummary\\.focusTopics/)
  assert.match(defaultMarkup, /userSummary\\.importantWindows/)
  assert.doesNotMatch(defaultMarkup, /data\\.(?:headline|overall|clusters|systems|priorities)|item\\.(?:verdict|confidence)|technicalEvidence/)
  assert.match(defaultMarkup, /ReadingExplanation kind="reason"/)
'''
new = '''  assert.match(defaultMarkup, /heroHeadline/)
  assert.match(defaultMarkup, /heroSummary/)
  assert.match(period.slice(0, renderStart), /verifiedHero \\? visibleAiText\\(data\\.headline\\) \\|\\| userSummary\\.headline : userSummary\\.headline/)
  assert.match(period.slice(0, renderStart), /verifiedHero[\\s\\S]*visibleAiText\\(data\\.overall\\.summary\\) \\|\\| userSummary\\.summary/)
  assert.match(defaultMarkup, /userSummary\\.favorableCards/)
  assert.match(defaultMarkup, /userSummary\\.cautionCards/)
  assert.match(defaultMarkup, /userSummary\\.focusTopics/)
  assert.match(defaultMarkup, /userSummary\\.importantWindows/)
  assert.doesNotMatch(defaultMarkup, /data\\.(?:headline|overall|clusters|systems|priorities)|item\\.(?:verdict|confidence)|technicalEvidence/)
  assert.match(defaultMarkup, /ReadingExplanation kind="reason"/)
'''
if old not in text:
    raise SystemExit('old UI contract block not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
