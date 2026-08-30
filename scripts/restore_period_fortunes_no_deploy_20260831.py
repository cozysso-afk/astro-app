from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / 'web/src/AppNext.tsx'
css_path = ROOT / 'web/src/fortune-ux-v14.css'

app = app_path.read_text(encoding='utf-8')

# -----------------------------------------------------------------------------
# 1) Restore the original IA contract:
#    - Period fortunes (today/week/month/year) are a first-class home navigator.
#    - Integrated fortune is a separate annual cross-system analysis tool.
#    - Precision keeps its own short-range period selector.
# -----------------------------------------------------------------------------
old_dates = """  const integratedStartDate = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
  const integratedSelectionEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
"""
new_dates = """  const annualFortuneYear = integratedCalendarYear ?? queryYear
  const integratedStartDate = selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : queryDate
  const integratedSelectionEnd = selectedTool === 'integrated' ? `${annualFortuneYear}-12-31` : periodEnd(queryDate, period)
"""
if old_dates not in app:
    raise SystemExit('current integrated date contract not found')
app = app.replace(old_dates, new_dates, 1)

selector_pattern = re.compile(
    r"\s*\{\(selectedTool==='integrated'\|\|selectedTool==='precision'\) && <section className=\"section-block\">.*?</section>\}\n(?=\s*<section className=\"section-block tools-section\">)",
    re.S,
)
selector_replacement = """
          <section className="section-block period-fortune-section">
            <div className="section-label">기간 운세</div>
            <div className="period-grid" role="tablist" aria-label="기간 운세">
              {periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${selectedTool===null&&period===key?'is-active':''}`} type="button" onClick={()=>{setPeriod(key);setSelectedTool(null);setIntegratedCalendarYear(null)}}><Icon size={17}/><span>{label}</span></button>)}
            </div>
          </section>
          {selectedTool==='precision' && <section className="section-block precision-period-range"><div className="section-label">정밀분석 기간 선택</div><div className="period-grid">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type="button" onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}><Icon size={17}/><span>{label}</span></button>)}</div></section>}
"""
app, count = selector_pattern.subn(selector_replacement, app, count=1)
if count != 1:
    raise SystemExit(f'merged period selector replacement count={count}')

old_heading = '<div className="tool-panel-heading"><span className="tool-icon tone-gold"><Sparkles size={22}/></span><div><span className="eyebrow">통합 흐름 계산</span><h2>통합운세</h2><p>선택한 일일·주간·월간·연간 범위에서 금전·학업·시험·직장·연애·연락·재회·컨디션 흐름을 Western(서양점성술)·사주·Thai(태국점성술)로 각각 계산하고 한 화면에서 비교해.</p></div></div>'
new_heading = '<div className="tool-panel-heading"><span className="tool-icon tone-gold"><Sparkles size={22}/></span><div><span className="eyebrow">연간 통합 흐름</span><h2>통합운세</h2><p>한 해의 연애·재회·연락·금전·학업·시험·직장·컨디션을 Western(서양점성술)·사주·Thai(태국점성술)로 각각 계산한 뒤, 같은 연도에서 겹치는 흐름과 차이를 종합해서 비교해.</p></div></div>'
if old_heading not in app:
    raise SystemExit('integrated heading marker missing')
app = app.replace(old_heading, new_heading, 1)

old_range = '<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {integratedStartDate} ~ {integratedSelectionEnd} · {integratedCalendarYear?`${integratedCalendarYear}년 전체`:periodRangeLabel(period)}</span></div>'
new_range = '''<section className="annual-fortune-range"><div className="section-heading-row"><div className="section-label">연간 통합운세</div><span className="annual-range-badge">1월 1일 → 12월 31일</span></div><div className="calendar-year-selector annual-year-selector"><div><strong>{annualFortuneYear}년 전체 흐름</strong><span>여러 분야 × 서양점성술 · 사주 · 태국점성술 종합</span></div><select aria-label="연간 통합운세 연도 선택" value={annualFortuneYear} onChange={(e)=>setIntegratedCalendarYear(Number(e.target.value))}>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div></section>
            <div className="calculation-range annual-calculation-range"><CalendarDays size={17}/><span>연간 분석 {integratedStartDate} ~ {integratedSelectionEnd} · {annualFortuneYear}년 전체</span></div>'''
if old_range not in app:
    raise SystemExit('integrated range marker missing')
app = app.replace(old_range, new_range, 1)

app = app.replace("'통합운세 실제 계산'", "'연간 통합운세 계산'", 1)
app = app.replace("'통합 계산 준비 중…'", "'연간 통합 계산 준비 중…'", 1)
app = app.replace('`통합 계산 중 · ${integratedProgress.completed}/${integratedProgress.total}일 (${integratedProgress.percent}%)`', '`연간 통합 계산 중 · ${integratedProgress.completed}/${integratedProgress.total}일 (${integratedProgress.percent}%)`', 1)

# -----------------------------------------------------------------------------
# 2) Restore the distinct home period report that existed before the regression.
#    It may reuse the same calculation engine internally, but user-facing IA must
#    not call it "integrated fortune" or nest it under the integrated tool.
# -----------------------------------------------------------------------------
home_end = """        </>}\n\n        {mainView === 'profile'"""
if home_end not in app:
    raise SystemExit('home fragment end marker missing')
if 'period-fortune-report' in app:
    raise SystemExit('period fortune report already exists')

period_report = '''          {selectedTool===null && <section className="tool-panel period-fortune-report">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">PERIOD FORTUNE</span><h2>{period==='today'?'오늘의 운세':`${periods.find((item)=>item.key===period)?.label}운세`}</h2><p>{queryDate} → {integratedSelectionEnd} · 선택한 기간만 따로 보는 기간 운세야.</p></div></div>

            {!integratedMatchesSelection && <>
              <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 통합운세 메뉴와는 별개로 이 기간의 흐름만 계산해.</span></div>
              {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
              <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'기간 운세 계산 중…':`${period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 계산`}</span></button>
            </>}

            {integratedMatchesSelection && integratedResult && <>
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>{period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>

              <section className="result-card">
                <div className="result-card-title"><span>CORE FLOW</span><strong>핵심 흐름</strong></div>
                <div className="integrated-topic-grid">
                  {topIntegratedTopics.slice(0,3).map(({topic,stat})=><div className="integrated-topic" key={`period-top-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {cautionIntegratedTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${topicDisplay(row.topic)} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card period-date-highlights">
                <div className="result-card-title"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>
                {bestIntegratedDays.map((point)=><div className="tight-row" key={`period-best-${point.date}-${point.topic}`}><span>✨ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                {cautionIntegratedDays.map((point)=><div className="tight-row" key={`period-caution-${point.date}-${point.topic}`}><span>⚠️ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                <p className="result-note">기간 안의 상대 활성도 비교야. 특정 사건 발생 확률은 아니야.</p>
              </section>}

              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence period-time-evidence"><summary>시간대별 계산 근거 펼치기</summary><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`period-day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`period-${day.date}-${topic}`}><strong className="time-topic-name">{topicDisplay(topic)}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`period-${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></details> : null}

              <section className="result-card">
                <div className="result-card-title"><span>SYSTEMS</span><strong>체계별 보조 흐름</strong></div>
                <div className="saju-summary">
                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}
                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
                  <span>Thai(태국점성술) <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>
                </div>
              </section>
            </>}
          </section>}

'''
app = app.replace(home_end, period_report + home_end, 1)

# Hard guards against the regression returning again.
for token in [
    '<div className="section-label">기간 운세</div>',
    "selectedTool===null&&period===key?'is-active':''",
    "selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : queryDate",
    'aria-label="연간 통합운세 연도 선택"',
    'period-fortune-report',
]:
    if token not in app:
        raise SystemExit(f'missing restored IA token: {token}')
if '통합운세 기간 선택' in app:
    raise SystemExit('regressed merged period selector still present')
if '선택한 일일·주간·월간·연간 범위에서' in app:
    raise SystemExit('regressed integrated-fortune copy still present')

app_path.write_text(app, encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) Fix iOS date value vertical alignment. The old v14 rule only centered the
#    value horizontally and left WebKit's internal value box free to sit high.
# -----------------------------------------------------------------------------
css = css_path.read_text(encoding='utf-8')
css_patch = r'''

/* v15 · restore period-fortune IA + true iOS date vertical centering */
.period-fortune-section{margin-top:4px!important}
.period-fortune-report{margin-top:14px!important}
.annual-fortune-range{margin:12px 0!important;padding:13px!important;border:1px solid rgba(126,101,153,.12)!important;border-radius:17px!important;background:linear-gradient(145deg,rgba(252,247,255,.82),rgba(241,250,248,.80))!important}
.annual-range-badge{font-size:.68rem;font-weight:850;color:#765f8b;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(126,101,153,.12)}
.annual-year-selector{margin-top:8px!important}
.annual-calculation-range{background:linear-gradient(120deg,rgba(250,240,255,.80),rgba(235,250,247,.78))!important}

/* iOS Safari: center the actual native date value vertically, not just its box. */
.birth-date-field input[type="date"]{
  height:52px!important;
  min-height:52px!important;
  box-sizing:border-box!important;
  padding-top:0!important;
  padding-bottom:0!important;
  line-height:normal!important;
}
.birth-date-field input[type="date"]::-webkit-date-and-time-value{
  display:flex!important;
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  line-height:normal!important;
}
.birth-date-field input[type="date"]::-webkit-datetime-edit,
.birth-date-field input[type="date"]::-webkit-datetime-edit-fields-wrapper{
  display:flex!important;
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  align-items:center!important;
  justify-content:center!important;
  line-height:normal!important;
}
.birth-date-field input[type="date"]::-webkit-datetime-edit-year-field,
.birth-date-field input[type="date"]::-webkit-datetime-edit-month-field,
.birth-date-field input[type="date"]::-webkit-datetime-edit-day-field,
.birth-date-field input[type="date"]::-webkit-datetime-edit-text{
  padding-top:0!important;
  padding-bottom:0!important;
  line-height:normal!important;
}
'''
if 'v15 · restore period-fortune IA' not in css:
    css += css_patch
css_path.write_text(css, encoding='utf-8')
