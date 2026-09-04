from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "web/src/AppNext.tsx",
    """function periodRangeLabel(period: PeriodKey) {
  if (period === 'today') return '1일'
  if (period === 'week') return '7일'
  if (period === 'month') return '31일'
  return '1년 · 365일'
}""",
    """function periodRangeLabel(period: PeriodKey) {
  if (period === 'today') return '1일'
  if (period === 'week') return '월~일 · 7일'
  if (period === 'month') return '달력 월'
  return '달력 연도'
}""",
    "calendar range label",
)

# Prevent internal evidence identifiers such as W:detail:* from leaking into prose.
for path in ["web/src/PeriodAiInterpretationPanel.tsx", "web/src/AiInterpretationPanel.tsx"]:
    p = Path(path)
    text = p.read_text()
    signal_anchor = "function signalClass(signal: string) {"
    if "function visibleAiText(" not in text:
        pos = text.find(signal_anchor)
        if pos < 0:
            raise SystemExit(f"missing signalClass anchor in {path}")
        helper = """function visibleAiText(value: string | undefined) {
  return String(value ?? '')
    .replace(/\\b(?:W|S|T):[^\\s),]+/g, '계산 근거')
    .replace(/\\(\\s*계산 근거\\s*\\)/g, '')
    .replace(/계산 근거(?:\\s*[·,;]\\s*계산 근거)+/g, '계산 근거')
    .replace(/\\s{2,}/g, ' ')
    .trim()
}

"""
        text = text[:pos] + helper + text[pos:]
    text = text.replace("{item.reason&&<p>{item.reason}</p>}", "{item.reason&&<p>{visibleAiText(item.reason)}</p>}")
    text = text.replace("{item.reason&&<p><b>근거</b> {item.reason}</p>}", "{item.reason&&<p><b>근거</b> {visibleAiText(item.reason)}</p>}")
    p.write_text(text)

# Extend the permanent contract to catch both issues.
p = Path("web/src/lib/periodSelectionContract.test.mjs")
text = p.read_text()
if "calendar range labels never hardcode 31 or 365 days" not in text:
    text += """
test('calendar range labels never hardcode 31 or 365 days',()=>{assert.match(app,/return '달력 월'/);assert.match(app,/return '달력 연도'/);assert.doesNotMatch(app,/if \(period === 'month'\) return '31일'/)})
test('internal evidence ids are stripped from visible AI reasons',()=>{assert.match(ai,/function visibleAiText/);assert.match(ai,/visibleAiText\(item.reason\)/);assert.match(readFileSync(new URL('../AiInterpretationPanel.tsx',import.meta.url),'utf8'),/visibleAiText\(item.reason\)/)})
"""
p.write_text(text)
