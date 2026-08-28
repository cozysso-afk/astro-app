from pathlib import Path

path = Path('web/src/AppNext.tsx')
text = path.read_text(encoding='utf-8')

helper_anchor = """function currentDayun(result: IntegratedApiResponse | null) {\n  if (!result?.saju.dayun?.length) return null\n  const y = Number(result.period.start.slice(0,4))\n  return result.saju.dayun.find((row) => row.start_year <= y && row.end_year >= y) ?? result.saju.dayun[0]\n}\n"""
helper_insert = helper_anchor + """\nfunction collectFortuneHighlights(\n  rows: Array<{ topic: string; stat: FortuneStat }>,\n  key: 'best_days' | 'caution_days',\n  limit = 3,\n) {\n  const byDate = new Map<string, FortunePoint & { topic: string }>()\n  rows.forEach(({ topic, stat }) => {\n    for (const point of stat[key] ?? []) {\n      const previous = byDate.get(point.date)\n      const shouldReplace = !previous || (key === 'best_days' ? point.score > previous.score : point.score < previous.score)\n      if (shouldReplace) byDate.set(point.date, { ...point, topic })\n    }\n  })\n  return [...byDate.values()]\n    .sort((a, b) => key === 'best_days' ? b.score - a.score : a.score - b.score)\n    .slice(0, limit)\n}\n"""
if helper_anchor not in text:
    raise SystemExit('helper anchor not found')
text = text.replace(helper_anchor, helper_insert, 1)

derived_anchor = """  const activeDayun = currentDayun(integratedResult)\n"""
derived_insert = """  const activeDayun = currentDayun(integratedResult)\n  const integratedSelectionEnd = periodEnd(queryDate, period)\n  const integratedMatchesSelection = Boolean(\n    integratedResult &&\n    integratedResult.period.start === queryDate &&\n    integratedResult.period.end === integratedSelectionEnd\n  )\n  const cautionIntegratedTopics = [...topIntegratedTopics]\n    .sort((a,b) => a.stat.average - b.stat.average)\n    .slice(0,2)\n  const bestIntegratedDays = integratedMatchesSelection\n    ? collectFortuneHighlights(topIntegratedTopics, 'best_days')\n    : []\n  const cautionIntegratedDays = integratedMatchesSelection\n    ? collectFortuneHighlights(topIntegratedTopics, 'caution_days')\n    : []\n"""
if derived_anchor not in text:
    raise SystemExit('derived anchor not found')
text = text.replace(derived_anchor, derived_insert, 1)

old_result_gate = """            {integratedResult && <div className=\"results-wrap integrated-results\">"""
new_result_gate = """            {integratedMatchesSelection && integratedResult && <div className=\"results-wrap integrated-results\">"""
if old_result_gate not in text:
    raise SystemExit('integrated result gate not found')
text = text.replace(old_result_gate, new_result_gate, 1)

old_report = """          <section className=\"report-card\"><div className=\"report-icon\"><Moon size={21}/></div><div className=\"report-copy\"><span className=\"eyebrow\">DAILY CELESTIAL REPORT</span><strong>{period==='today'?'오늘의 리포트':`${periods.find((item)=>item.key===period)?.label} 리포트`}</strong><p>운세 기준일 {queryDate}. 통합운세 실계산 결과를 다음 단계에서 이 홈 리포트에도 재사용해.</p></div></section>\n"""
new_report = """          <section className=\"tool-panel\">\n            <div className=\"tool-panel-heading\"><span className=\"tool-icon tone-gold\"><Moon size={22}/></span><div><span className=\"eyebrow\">LIVE CELESTIAL REPORT</span><h2>{period==='today'?'오늘의 리포트':`${periods.find((item)=>item.key===period)?.label} 리포트`}</h2><p>{queryDate} → {integratedSelectionEnd} · 통합운세 실계산 요약</p></div></div>\n\n            {!integratedMatchesSelection && <>\n              <div className=\"coordinate-note\"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 아래 버튼은 통합운세와 같은 Render 실계산을 한 번만 실행하고, 그 응답을 이 홈 리포트와 상세 통합운세가 함께 재사용해.</span></div>\n              {integratedError && <div className=\"status-banner error\"><AlertTriangle size={17}/><span>{integratedError}</span></div>}\n              <button className=\"primary-button\" type=\"button\" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className=\"spin\" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'리포트 계산 중…':`${period==='today'?'오늘':periods.find((item)=>item.key===period)?.label} 리포트 계산`}</span></button>\n            </>}\n\n            {integratedMatchesSelection && integratedResult && <>\n              <div className=\"result-headline\"><CheckCircle2 size={20}/><div><strong>실계산 리포트 준비 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>\n\n              <section className=\"result-card\">\n                <div className=\"result-card-title\"><span>CORE FLOW</span><strong>핵심 흐름</strong></div>\n                <div className=\"integrated-topic-grid\">\n                  {topIntegratedTopics.slice(0,3).map(({topic,stat})=><div className=\"integrated-topic\" key={`home-top-${topic}`}><span>{topic}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}\n                </div>\n                {cautionIntegratedTopics.length>0 && <div className=\"best-window\"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}\n              </section>\n\n              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className=\"result-card\">\n                <div className=\"result-card-title\"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>\n                {bestIntegratedDays.map((point)=><div className=\"tight-row\" key={`best-${point.date}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}\n                {cautionIntegratedDays.map((point)=><div className=\"tight-row\" key={`caution-${point.date}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}\n                <p className=\"result-note\">날짜 점수는 사건 확률이 아니라 기존 Western 기간엔진의 상대적 활성도야.</p>\n              </section>}\n\n              <section className=\"result-card\">\n                <div className=\"result-card-title\"><span>SYSTEMS</span><strong>사주 · Thai 요약</strong></div>\n                <div className=\"saju-summary\">\n                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}\n                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}\n                  <span>Thai <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>\n                </div>\n                <p className=\"result-note\">Thai는 아직 출생요일 baseline만 표시하며 날짜별 예측 점수에는 섞지 않아.</p>\n              </section>\n\n              <button className=\"primary-button\" type=\"button\" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>\n            </>}\n          </section>\n"""
if old_report not in text:
    raise SystemExit('home report anchor not found')
text = text.replace(old_report, new_report, 1)

required = [
    'LIVE CELESTIAL REPORT',
    'integratedMatchesSelection',
    'collectFortuneHighlights',
    '좋은 날짜 · 주의 날짜',
    '상세 통합운세 보기',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f'missing marker: {marker}')
if '통합운세 실계산 결과를 다음 단계에서 이 홈 리포트에도 재사용해.' in text:
    raise SystemExit('old placeholder report remains')

path.write_text(text, encoding='utf-8')
print('home-live-report-patch-ok')
