from pathlib import Path

panel_path = Path('web/src/PeriodFortuneNarrativeV2.tsx')
panel = panel_path.read_text()

anchor = """export function compactEditorialCopy(value: string) {
  const text = String(value ?? '').replace(/\\s+/g, ' ').trim()
  if (!editorialCopyUsable(text)) return ''
  const sentences = (text.match(/[^.!?]+[.!?]?/g) ?? []).map(sentence => sentence.trim()).filter(Boolean)
  if (sentences.length >= 3) return `${sentences[0]} ${sentences[2]}`.trim()
  return sentences.slice(0, 2).join(' ').trim() || text
}
"""
addition = anchor + """

export function focusEditorialParts(value: string) {
  const text = String(value ?? '').replace(/\\s+/g, ' ').trim()
  if (!editorialCopyUsable(text)) return null
  const sentences = (text.match(/[^.!?]+[.!?]?/g) ?? []).map(sentence => sentence.trim()).filter(Boolean)
  if (sentences.length < 4) return null
  return {
    conclusion: sentences[0],
    sceneAction: `${sentences[1]} ${sentences[2]}`.trim(),
    change: sentences.slice(3).join(' ').trim(),
  }
}
"""
if anchor not in panel:
    raise SystemExit('compactEditorialCopy anchor not found')
panel = panel.replace(anchor, addition, 1)

start_marker = '      <div className="period-ai-topic-list">{summary.focusTopics.map(item => <article className="period-ai-topic"'
end_marker = '      </article>)}</div>'
start = panel.find(start_marker)
if start < 0:
    raise SystemExit('focus topic start marker not found')
end = panel.find(end_marker, start)
if end < 0:
    raise SystemExit('focus topic end marker not found')
end += len(end_marker)
replacement = '''      <div className="period-ai-topic-list">{summary.focusTopics.map(item => {
        const deepEditorial = verifiedNarrative && !field ? focusEditorialParts(editorial.topicEditorial[item.topic] ?? '') : null
        return <article className="period-ai-topic" data-reading-export-tone={topicTone(item.topic)} key={`v4-${item.topic}`}>
          <strong>{item.topic}</strong>
          <b>{deepEditorial?.conclusion || item.conclusion}</b>
          {deepEditorial ? <>
            <p className="period-ai-topic-editorial-v4">{deepEditorial.sceneAction}</p>
            <p className="period-ai-topic-change-v9"><em>판단 바뀌는 조건</em> {deepEditorial.change}</p>
          </> : <>
            {item.action && <p><em>실제로는</em> {item.action}</p>}
            {item.observe && <p><em>확인할 것</em> {item.observe}</p>}
          </>}
          <details className="reading-topic-depth">
            <summary>왜 이렇게 보나</summary>
            <ReadingExplanation kind="reason">{item.reason}</ReadingExplanation>
            {item.timing && <ReadingExplanation kind="timing">{item.timing}</ReadingExplanation>}
            {item.caution && <ReadingExplanation kind="caution">{item.caution}</ReadingExplanation>}
          </details>
        </article>
      })}</div>'''
panel = panel[:start] + replacement + panel[end:]
panel_path.write_text(panel)

test_path = Path('web/src/lib/fortuneEditorialV3.test.mjs')
test = test_path.read_text()
test_start_marker = "test('verified non-relationship fields surface structured editorial without replacing deterministic cards',()=>{"
test_end_marker = "\n})\n\ntest('overall hero accepts only verified reader-facing integrated editorial and keeps deterministic fallback'"
test_start = test.find(test_start_marker)
if test_start < 0:
    raise SystemExit('editorial test start marker not found')
test_end = test.find(test_end_marker, test_start)
if test_end < 0:
    raise SystemExit('editorial test end marker not found')
new_test = """test('verified non-relationship fields surface structured editorial in main focus cards with deterministic fallback',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/const structuredFieldTopics = verifiedNarrative && field/)
  assert.match(panel,/editorial\\.topicEditorial\\[topic\\] \\?\\? ''/)
  assert.match(panel,/연애','대인관계','연락','재회','투자주의/)
  assert.match(panel,/editorialCopyUsable\\(item\\.text\\)/)
  assert.match(panel,/export function focusEditorialParts/)
  assert.match(panel,/verifiedNarrative && !field \\? focusEditorialParts\\(editorial\\.topicEditorial\\[item\\.topic\\]/)
  assert.match(panel,/deepEditorial\\?\\.conclusion \\|\\| item\\.conclusion/)
  assert.match(panel,/period-ai-topic-editorial-v4/)
  assert.match(panel,/deepEditorial\\.sceneAction/)
  assert.match(panel,/판단 바뀌는 조건/)
  assert.match(panel,/deepEditorial\\.change/)
  assert.match(panel,/<em>실제로는<\\/em> \\{item\\.action\\}/)
  assert.match(panel,/<em>확인할 것<\\/em> \\{item\\.observe\\}/)
})
"""
test = test[:test_start] + new_test + test[test_end + len('\n})\n'):]
test_path.write_text(test)

Path('.github/workflows/editorial-depth-v9-patch.yml').unlink(missing_ok=True)
Path('scripts/apply-editorial-depth-v9.py').unlink(missing_ok=True)
