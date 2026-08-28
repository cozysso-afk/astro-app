from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')

# Human-readable evidence labels for the mobile timing cards.
if 'function humanizeEvidence(' not in s:
    anchor = "const aspectLabels: Record<string, string> = {\n  conjunction:'합', sextile:'육합', square:'사각', trine:'삼각', quincunx:'퀸컨스', opposition:'대립',\n}\n"
    assert anchor in s, 'aspectLabels anchor missing'
    helper = '''\nfunction humanizeEvidence(value: string) {\n  let text = String(value ?? '')\n  const replacements: Array<[RegExp, string]> = [\n    [/True Node/g, '진북교점'], [/Uranus/g, '천왕성'], [/Neptune/g, '해왕성'], [/Saturn/g, '토성'],\n    [/Jupiter/g, '목성'], [/Mercury/g, '수성'], [/Venus/g, '금성'], [/Pluto/g, '명왕성'], [/Mars/g, '화성'],\n    [/Moon/g, '달'], [/Sun/g, '태양'], [/ASC/g, '상승점'], [/DSC/g, '하강점'], [/MC/g, '중천점'], [/IC/g, '천저점'],\n    [/Whole Sign/g, '홀사인'], [/Placidus/g, '플라시두스'],\n  ]\n  replacements.forEach(([pattern, label]) => { text = text.replace(pattern, label) })\n  text = text.replace(/(\\d+)H\\b/g, '$1하우스')\n  text = text.replace(/orb\\s*/gi, '오브 ')\n  return text\n}\n'''
    s = s.replace(anchor, anchor + helper, 1)

# Loading copy: clearly state that leaving the web app does not cancel the server job.
old_loading = '''  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={20}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>Gemini가 실계산 근거를 해석하는 중…</strong><p>숫자를 사건 확률로 바꾸지 않고 Western·사주·Thai를 분리해서 읽고 있어.</p></div></section>'''
new_loading = '''  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={22}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>Gemini가 서버에서 정밀해석 중…</strong><p>앱을 닫거나 다른 앱으로 이동해도 서버 작업은 계속돼. 돌아오면 완료된 리딩을 자동으로 이어받아.</p></div></section>'''
assert old_loading in s, 'AI loading block missing'
s = s.replace(old_loading, new_loading, 1)

# Timing card: split windows and evidence instead of one dense paragraph.
old_time = '''{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`${day.date}-${topic}`}><strong>{topic}</strong>{detail.best_window && <span>↑ 상대적으로 좋은 구간 {detail.best_window.start}~{detail.best_window.end} · {detail.best_window.score}</span>}{detail.caution_window && <span>↓ 주의 구간 {detail.caution_window.start}~{detail.caution_window.end} · {detail.caution_window.score}</span>}{detail.evidence?.length ? <small>{detail.evidence.slice(0,2).join(' · ')}</small> : null}</div>)}'''
new_time = '''{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`${day.date}-${topic}`}><strong className="time-topic-name">{topic}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}'''
assert old_time in s, 'time topic renderer missing'
s = s.replace(old_time, new_time, 1)

p.write_text(s, encoding='utf-8')
print('readability + persistent AI copy patch applied')
