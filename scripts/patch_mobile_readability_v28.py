from pathlib import Path

root = Path(__file__).resolve().parents[1]

# 1) Typography/readability corrections stay inside the single late V27 layer.
css_path = root / 'web/src/mobile-design-v27.css'
css = css_path.read_text()
marker = '/* V28 · screenshot-driven Korean readability correction */'
if marker not in css:
    css += r'''

/* V28 · screenshot-driven Korean readability correction */
html{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}
body,.app-shell,.app-shell button,.app-shell input,.app-shell select,.app-shell textarea{letter-spacing:0!important;font-kerning:normal!important}
.app-shell h1,.app-shell h2,.app-shell h3,.app-shell h4,.app-shell strong,.app-shell b{letter-spacing:-.012em!important}
.app-shell .eyebrow,.app-shell .section-label,.app-shell .result-card-title>span,.app-shell .period-ai-kicker,.app-shell .ai-section-kicker,.app-shell .period-ai-section-title>span,.app-shell .ai-section-heading>span{letter-spacing:0!important}
.app-shell p,.app-shell span,.app-shell strong,.app-shell b,.app-shell small,.app-shell summary{word-break:keep-all;overflow-wrap:break-word}

.period-fortune-report .period-report-heading{padding:14px!important;gap:10px!important}
.period-report-icon{width:38px!important;height:38px!important;flex-basis:38px!important}
.period-report-heading h2{font-size:1.38rem!important;line-height:1.2!important}
.period-report-copy>p{font-size:.84rem!important;line-height:1.48!important}
.period-report-range,.period-report-range strong{font-size:.74rem!important}

.period-ai-card,.ai-interpret-card{padding:15px 14px!important;gap:12px!important}
.period-ai-head h3,.ai-interpret-head h3{font-size:1.04rem!important;line-height:1.38!important;font-weight:780!important}
.period-ai-kicker,.ai-interpret-head .eyebrow{font-size:.76rem!important;line-height:1.25!important;font-weight:760!important}
.period-ai-overall-brief>p>strong,.ai-overall-brief>p>span,.ai-overall-brief>p,.period-ai-overall-brief>p{font-size:.88rem!important;line-height:1.5!important}
.period-ai-section-title>strong,.ai-section-heading>strong{font-size:1rem!important;line-height:1.34!important}
.period-ai-section-title>span,.ai-section-heading>span{font-size:.73rem!important;line-height:1.3!important}

.period-ai-quick-date,.ai-quick-date{padding:9px 10px!important;gap:7px!important}
.period-ai-quick-date>b,.ai-quick-date>b{font-size:.81rem!important;line-height:1.35!important}
.period-ai-quick-date>div>strong,.ai-quick-date>span>strong{font-size:.84rem!important;line-height:1.35!important}
.period-ai-quick-date>div>small,.ai-quick-date>span>small{font-size:.7rem!important;line-height:1.35!important}
.period-ai-quick-date>span,.ai-quick-date>em{font-size:.67rem!important}

.period-ai-actions{gap:9px!important}.period-ai-actions>article,.ai-decision-list>article{padding:11px!important;gap:8px!important;border-radius:14px!important}
.period-ai-action-index,.ai-decision-index{width:28px!important;height:28px!important;font-size:.78rem!important;border-radius:9px!important}
.period-ai-actions article>div>strong,.ai-decision-list article>div>strong{font-size:.9rem!important;line-height:1.38!important}
.period-ai-action-time,.ai-decision-list article>div>b{font-size:.74rem!important;line-height:1.3!important}
.period-ai-condition,.ai-decision-condition{display:flex!important;align-items:flex-start!important;gap:8px!important;padding:8px 9px!important;border-radius:10px!important;font-size:.82rem!important;line-height:1.5!important}
.period-ai-condition>b,.ai-decision-condition>b{flex:0 0 auto!important}
.period-ai-action-more>summary,.ai-decision-more>summary{font-size:.76rem!important;line-height:1.35!important}
.period-ai-action-more>p,.ai-decision-more>p{font-size:.84rem!important;line-height:1.52!important}

.period-ai-window,.ai-key-window{padding:12px!important;border-radius:14px!important}
.period-ai-window-head>div>b,.ai-window-date{font-size:.8rem!important;line-height:1.35!important}
.period-ai-window-head>div>strong,.ai-key-window-top>div>strong{font-size:.88rem!important;line-height:1.38!important}
.period-ai-window>p,.period-ai-window-line,.ai-key-window>p,.ai-window-action,.ai-window-avoid{font-size:.84rem!important;line-height:1.55!important}
.period-ai-window-topics>span,.ai-window-topics>span{font-size:.68rem!important}

.period-ai-relationship-summary,.ai-relationship-section{background:#fff!important}
.period-ai-relationship-summary>p,.ai-relationship-highlight>span{font-size:.88rem!important;line-height:1.52!important}
.period-ai-relationship-directions,.ai-direction-grid{display:grid!important;gap:7px!important}
.period-ai-relationship-directions .period-ai-window-line,.ai-direction-grid>article{padding:9px 10px!important;border:1px solid var(--v27-line)!important;border-radius:11px!important;background:#faf9fb!important}
.period-ai-relationship-directions .period-ai-window-line{grid-template-columns:72px minmax(0,1fr)!important}
.period-ai-relationship-directions b,.ai-direction-grid strong{font-size:.78rem!important;line-height:1.4!important}
.period-ai-relationship-directions span,.ai-direction-grid p{font-size:.82rem!important;line-height:1.48!important;margin:0!important}
.period-ai-relationship-more>summary,.ai-relationship-more>summary{font-size:.78rem!important}
.period-ai-relationship-more>p,.ai-relationship-more>p{font-size:.83rem!important;line-height:1.52!important}

.period-ai-details>summary,.period-ai-topic-disclosure>summary,.ai-meta-details>summary{font-size:.82rem!important}
.period-ai-section>p,.period-ai-topic>p,.period-ai-cross-list>article>p,.ai-cross-system-lines p,.ai-cross-synthesis p{font-size:.83rem!important;line-height:1.52!important}

.result-headline{min-height:auto!important;padding:11px 12px!important}
.result-headline strong{font-size:.91rem!important}.result-headline span{font-size:.75rem!important}
.bottom-nav .nav-label{letter-spacing:0!important;font-size:.67rem!important}

@media(max-width:430px){
  .period-report-heading h2{font-size:1.32rem!important}
  .period-ai-card,.ai-interpret-card{padding:14px 13px!important}
  .period-ai-head h3,.ai-interpret-head h3{font-size:1.01rem!important}
  .period-ai-quick-date{grid-template-columns:84px minmax(0,1fr) auto!important}
  .ai-quick-date{grid-template-columns:84px minmax(0,1fr) auto!important}
}
'''
css_path.write_text(css)

# Common helper expansion and user-facing text sanitizer.
def patch_helper(path: Path):
    s = path.read_text()
    old = """function visibleAiText(value: string | undefined) {\n  return String(value ?? '')\n    .replace(/\\b(?:W|S|T):[^\\s),]+/g, '계산 근거')\n    .replace(/\\(\\s*계산 근거\\s*\\)/g, '')\n    .replace(/계산 근거(?:\\s*[·,;]\\s*계산 근거)+/g, '계산 근거')\n    .replace(/\\s{2,}/g, ' ')\n    .trim()\n}\n"""
    new = """function visibleAiText(value: string | undefined) {\n  return String(value ?? '')\n    .replace(/\\b(?:W|S|T):[^\\s),]+/g, '계산 근거')\n    .replace(/\\(\\s*계산 근거\\s*\\)/g, '')\n    .replace(/계산 근거(?:\\s*[·,;]\\s*계산 근거)+/g, '계산 근거')\n    .replace(/이직\\s*(?:및|·)?\\s*진로\\s*타깃\\s*시간/g, '이직·진로에 집중하기 좋은 시간')\n    .replace(/타깃\\s*시간/g, '집중하기 좋은 시간')\n    .replace(/타깃/g, '집중 지점')\n    .replace(/영역\\s*활성도/g, '영역 흐름')\n    .replace(/활성도/g, '흐름 강도')\n    .replace(/대인관계\\s*(?:및|·)?\\s*소통\\s*혼합\\s*시간/g, '대인관계·소통에 조율이 필요한 시간')\n    .replace(/\\s{2,}/g, ' ')\n    .trim()\n}\n\nfunction firstAiSentence(value: string | undefined) {\n  const text = visibleAiText(value)\n  const match = text.match(/^.*?[.!?](?:\\s|$)/)\n  return (match?.[0] || text).trim()\n}\n"""
    assert old in s, f'visibleAiText helper not found in {path.name}'
    s = s.replace(old, new)
    return s

# Period panel
p = root / 'web/src/PeriodAiInterpretationPanel.tsx'
s = patch_helper(p)
s = s.replace("<h3>{data.headline || '기간 흐름 요약'}</h3>", "<h3>{visibleAiText(data.headline) || '기간 흐름 요약'}</h3>")
s = s.replace("<strong>{brief.flow}</strong>", "<strong>{visibleAiText(brief.flow)}</strong>")
s = s.replace("<strong>{brief.remember}</strong>", "<strong>{visibleAiText(brief.remember)}</strong>")
s = s.replace("<span>가장 먼저 볼 날짜</span><strong>핵심 시기 TOP 3</strong>", "<span>먼저 볼 날짜</span><strong>먼저 볼 핵심 시기</strong>")
s = s.replace("<div><strong>{item.label}</strong>", "<div><strong>{visibleAiText(item.label)}</strong>")
s = s.replace("<div><strong>{item.action}</strong>", "<div><strong>{visibleAiText(item.action)}</strong>")
s = s.replace("className=\"period-ai-action-time\">{item.timing}</b>", "className=\"period-ai-action-time\">{visibleAiText(item.timing)}</b>")
s = s.replace("<span>{item.watch}</span>", "<span>{visibleAiText(item.watch)}</span>")
s = s.replace("<span>{item.avoid}</span>", "<span>{visibleAiText(item.avoid)}</span>")
s = s.replace("<strong>{item.label}</strong></div><span>{item.signal}</span>", "<strong>{visibleAiText(item.label)}</strong></div><span>{item.signal}</span>")
s = s.replace("<p>{item.summary}</p>", "<p>{visibleAiText(item.summary)}</p>")
s = s.replace("<span>{item.action}</span>", "<span>{visibleAiText(item.action)}</span>")
old_rel = '''{showRelationshipFocus && relationshipReading ? <section className="period-ai-window-section period-ai-relationship-section"><div className="period-ai-section-title"><span>관계 · 연락 · 재회</span><strong>세 방향을 따로 보면</strong></div><article className="period-ai-window is-mixed period-ai-relationship-summary"><p>{relationshipReading.flow}</p>{data.contact_flow ? <div className="period-ai-relationship-directions"><div className="period-ai-window-line"><b>상대 → 나</b><span>{data.contact_flow.incoming}</span></div><div className="period-ai-window-line"><b>나 → 상대</b><span>{data.contact_flow.outgoing}</span></div><div className="period-ai-window-line"><b>과거 인연 재접점</b><span>{data.contact_flow.reconnection}</span></div></div> : null}<div className="period-ai-window-line"><b>주목 시기</b><span>{relationshipReading.focus_timing}</span></div><details className="period-ai-relationship-more"><summary>판단 기준 · 주의 보기</summary><p><b>세 축 기준</b> {relationshipReading.context}</p><p><b>현실에서 확인</b> {relationshipReading.watch}</p><p className="is-avoid"><b>과대해석 주의</b> {relationshipReading.avoid}</p></details></article></section> : null}'''
new_rel = '''{showRelationshipFocus && relationshipReading ? <section className="period-ai-window-section period-ai-relationship-section"><div className="period-ai-section-title"><span>관계 · 연락 · 재회</span><strong>세 방향을 따로 보면</strong></div><article className="period-ai-window is-mixed period-ai-relationship-summary"><p>{firstAiSentence(relationshipReading.flow)}</p>{data.contact_flow ? <div className="period-ai-relationship-directions"><div className="period-ai-window-line"><b>상대 → 나</b><span>{firstAiSentence(data.contact_flow.incoming)}</span></div><div className="period-ai-window-line"><b>나 → 상대</b><span>{firstAiSentence(data.contact_flow.outgoing)}</span></div><div className="period-ai-window-line"><b>과거 인연</b><span>{firstAiSentence(data.contact_flow.reconnection)}</span></div></div> : null}<details className="period-ai-relationship-more"><summary>전체 관계 해설 · 판단 기준 보기</summary><p><b>관계 요약</b> {visibleAiText(relationshipReading.flow)}</p>{data.contact_flow&&<><p><b>상대 → 나</b> {visibleAiText(data.contact_flow.incoming)}</p><p><b>나 → 상대</b> {visibleAiText(data.contact_flow.outgoing)}</p><p><b>과거 인연 재접점</b> {visibleAiText(data.contact_flow.reconnection)}</p></>}<p><b>주목 시기</b> {visibleAiText(relationshipReading.focus_timing)}</p><p><b>현실에서 확인</b> {visibleAiText(relationshipReading.watch)}</p><p className="is-avoid"><b>과대해석 주의</b> {visibleAiText(relationshipReading.avoid)}</p></details></article></section> : null}'''
assert old_rel in s, 'period relationship block not found'
s = s.replace(old_rel, new_rel)
p.write_text(s)

# Annual/integrated panel
p = root / 'web/src/AiInterpretationPanel.tsx'
s = patch_helper(p)
s = s.replace("<h3>{data.headline || '통합 계산 해설'}</h3>", "<h3>{visibleAiText(data.headline) || '통합 계산 해설'}</h3>")
s = s.replace("<span>{brief.flow}</span>", "<span>{visibleAiText(brief.flow)}</span>")
s = s.replace("<span>{brief.remember}</span>", "<span>{visibleAiText(brief.remember)}</span>")
s = s.replace("<span>가장 먼저 볼 날짜</span><strong>핵심 시기 TOP 3</strong>", "<span>먼저 볼 날짜</span><strong>먼저 볼 핵심 시기</strong>")
s = s.replace("<span><strong>{item.label}</strong>", "<span><strong>{visibleAiText(item.label)}</strong>")
s = s.replace("<div><strong>{item.action}</strong>", "<div><strong>{visibleAiText(item.action)}</strong>")
s = s.replace("{item.timing&&<b>{item.timing}</b>}", "{item.timing&&<b>{visibleAiText(item.timing)}</b>}")
s = s.replace("<span>{item.watch}</span>", "<span>{visibleAiText(item.watch)}</span>")
s = s.replace("<span>{item.avoid}</span>", "<span>{visibleAiText(item.avoid)}</span>")
s = s.replace("<strong>{item.label}</strong></div><b>{item.signal}</b>", "<strong>{visibleAiText(item.label)}</strong></div><b>{item.signal}</b>")
s = s.replace("<p>{item.summary}</p>", "<p>{visibleAiText(item.summary)}</p>")
s = s.replace("<span>{item.action}</span>", "<span>{visibleAiText(item.action)}</span>")
old_rel = '''{showRelationshipFocus && relationshipReading ? <section className="ai-relationship-section"><div className="ai-section-heading"><span>관계 · 연락 · 재회</span><strong>세 방향을 따로 보면</strong></div><div className="ai-highlight ai-relationship-highlight"><strong>관계 방향 요약</strong><span>{relationshipReading.flow}</span></div>{data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) ? <div className="ai-direction-grid ai-relationship-direction"><article><strong>상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div> : null}<div className="ai-relationship-timing"><b>주목 시기</b><span>{relationshipReading.focus_timing}</span></div><details className="ai-relationship-more"><summary>판단 기준 · 주의 보기</summary><p><b>세 축 기준</b> {relationshipReading.context}</p><p><b>현실에서 확인</b> {relationshipReading.watch}</p><p><b>과대해석 주의</b> {relationshipReading.avoid}</p></details></section> : null}'''
new_rel = '''{showRelationshipFocus && relationshipReading ? <section className="ai-relationship-section"><div className="ai-section-heading"><span>관계 · 연락 · 재회</span><strong>세 방향을 따로 보면</strong></div><div className="ai-highlight ai-relationship-highlight"><strong>관계 방향 요약</strong><span>{firstAiSentence(relationshipReading.flow)}</span></div>{data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) ? <div className="ai-direction-grid ai-relationship-direction"><article><strong>상대 → 나</strong><p>{firstAiSentence(data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.')}</p></article><article><strong>나 → 상대</strong><p>{firstAiSentence(data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.')}</p></article><article><strong>과거 인연</strong><p>{firstAiSentence(data.contact_flow.reconnection || '재접점 근거가 약해.')}</p></article></div> : null}<details className="ai-relationship-more"><summary>전체 관계 해설 · 판단 기준 보기</summary><p><b>관계 요약</b> {visibleAiText(relationshipReading.flow)}</p>{data.contact_flow&&<><p><b>상대 → 나</b> {visibleAiText(data.contact_flow.incoming)}</p><p><b>나 → 상대</b> {visibleAiText(data.contact_flow.outgoing)}</p><p><b>과거 인연 재접점</b> {visibleAiText(data.contact_flow.reconnection)}</p></>}<p><b>주목 시기</b> {visibleAiText(relationshipReading.focus_timing)}</p><p><b>현실에서 확인</b> {visibleAiText(relationshipReading.watch)}</p><p><b>과대해석 주의</b> {visibleAiText(relationshipReading.avoid)}</p></details></section> : null}'''
assert old_rel in s, 'annual relationship block not found'
s = s.replace(old_rel, new_rel)
p.write_text(s)

# Permanent regression test.
test_path = root / 'web/src/lib/mobileReadabilityLanguage.test.mjs'
test_path.write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const annual = readFileSync(new URL('../AiInterpretationPanel.tsx', import.meta.url), 'utf8')
const period = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../mobile-design-v27.css', import.meta.url), 'utf8')

test('Korean typography does not use exaggerated tracking or iOS autosizing', () => {
  assert.match(css, /-webkit-text-size-adjust:100%!important/)
  assert.match(css, /body,.app-shell,.app-shell button[^{]*\{letter-spacing:0!important/)
  assert.match(css, /period-ai-head h3,.ai-interpret-head h3\{font-size:1\.04rem!important/)
})

test('AI display language removes internal targeting jargon and misleading TOP 3 label', () => {
  for (const source of [annual, period]) {
    assert.match(source, /이직\\s*\(\?:및\|·\)\?\\s*진로\\s*타깃/)
    assert.match(source, /'이직·진로에 집중하기 좋은 시간'/)
    assert.doesNotMatch(source, />핵심 시기 TOP 3</)
    assert.match(source, />먼저 볼 핵심 시기</)
  }
})

test('relationship directions are compact by default and preserve full text in disclosure', () => {
  for (const source of [annual, period]) {
    assert.match(source, /firstAiSentence\(relationshipReading\.flow\)/)
    assert.match(source, /전체 관계 해설 · 판단 기준 보기/)
    assert.match(source, /visibleAiText\(data\.contact_flow\.incoming\)/)
  }
})
''')
print('patched V28 mobile readability and display language')
