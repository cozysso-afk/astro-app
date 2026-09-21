from pathlib import Path

path = Path('web/src/lib/basicFortuneReading.ts')
text = path.read_text()
old = "  if (best && watch) headline = `${when}: ${best.meaning} ${watch.topic}은 ${watch.meaning}`\n  else if (best) headline = `${when}: ${best.meaning}`\n  else if (watch) headline = `${when}: ${watch.topic}은 ${watch.meaning}`"
new = "  if (best && watch) headline = `${when}: ${best.topic}은 ${best.meaning} ${watch.topic}은 ${watch.meaning}`\n  else if (best) headline = `${when}: ${best.topic}은 ${best.meaning}`\n  else if (watch) headline = `${when}: ${watch.topic}은 ${watch.meaning}`"
if old not in text:
    raise SystemExit('post-patch headline anchor missing')
path.write_text(text.replace(old, new, 1))
print('headline topic label fix prepared')
