from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'missing marker: {label}')
    s = s.replace(old, new, 1)

# Add copy formatters for the independent precision view.
marker = """function relationshipResultText(kind: 'compatibility' | 'marriage', response: RelationshipApiResponse) {
"""
if marker not in s:
    raise SystemExit('missing marker: relationship-result-helper')
end_marker = """  return lines.join('\\n')
}

export default function AppNext() {
"""
helpers = """  return lines.join('\\n')
}

function precisionPromptText(request: Record<string, unknown>) {
  return integratedPromptText(request)
    .replace('[별빛의 운명 · 통합운세 분석 요청]', '[별빛의 운명 · 정밀분석 요청]')
    .concat('\\n\\n[정밀분석 표시 원칙]\\n- 요약 점수를 새로 만들지 않고 동일 실계산의 원자료를 더 자세히 펼쳐본다.\\n- 엔진이 계산하지 않은 항목은 추정하지 않는다.')
}

function precisionResultText(result: IntegratedApiResponse) {
  return integratedResultText(result)
    .replace('[별빛의 운명 · 통합운세 전체 결과]', '[별빛의 운명 · 정밀분석 전체 결과]')
}

export default function AppNext() {
"""
rep(end_marker, helpers, 'precision-copy-helpers')

# Add computed relationship signals for precision output.
old = """  const cautionIntegratedDays = integratedMatchesSelection
    ? collectFortuneHighlights(topIntegratedTopics, 'caution_days')
    : []

  const switchMainView = (view: MainView) => { setMainView(view); if (view !== 'home') setSelectedTool(null) }
"""
new = """  const cautionIntegratedDays = integratedMatchesSelection
    ? collectFortuneHighlights(topIntegratedTopics, 'caution_days')
    : []
  const precisionRelationshipSignals = integratedResult
    ? Object.entries(integratedResult.western.relationship_signals)
        .filter((row): row is [string, FortuneStat] => Boolean(row[1]))
        .sort((a, b) => b[1].average - a[1].average)
    : []

  const switchMainView = (view: MainView) => { setMainView(view); if (view !== 'home') setSelectedTool(null) }
"""
rep(old, new, 'precision-computed-signals')

# Add precision archive save.
old = """  async function saveRelationshipRecord() {
"""
precision_save = """  async function savePrecisionRecord() {
    if (!integratedResult || !integratedRequestSnapshot) return
    const saved = await saveArchive({
      kind: 'precision',
      periodKey: period,
      title: `정밀분석 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '정밀분석 기록 저장 + Supabase 동기화 완료' : `이 기기에 정밀분석 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
  }

  async function saveRelationshipRecord() {
"""
rep(old, precision_save, 'precision-save-handler')

# Restore precision records using the same real integrated response shape.
old = """    if (item.kind === 'integrated') {
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setSelectedTool('integrated')
    } else {
"""
new = """    if (item.kind === 'integrated' || item.kind === 'precision') {
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setSelectedTool(item.kind)
    } else {
"""
rep(old, new, 'precision-restore')

# Copy saved precision results with the precision title.
old = """  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'integrated') {
      await handleCopy('저장 결과 전체복사', integratedResultText(item.result as unknown as IntegratedApiResponse))
    } else {
      await handleCopy('저장 결과 전체복사', relationshipResultText(item.kind, item.result as unknown as RelationshipApiResponse))
    }
  }
"""
new = """  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'integrated' || item.kind === 'precision') {
      const result = item.result as unknown as IntegratedApiResponse
      await handleCopy('저장 결과 전체복사', item.kind === 'precision' ? precisionResultText(result) : integratedResultText(result))
    } else {
      await handleCopy('저장 결과 전체복사', relationshipResultText(item.kind, item.result as unknown as RelationshipApiResponse))
    }
  }
"""
rep(old, new, 'precision-archive-copy')

# Replace the placeholder with the actual independent precision view.
old = """          {selectedTool === 'precision' && <section className="report-card"><div className="report-icon"><Search size={21}/></div><div className="report-copy"><span className="eyebrow">PRECISION</span><strong>정밀분석</strong><p>궁합/결혼운에서는 실제 정밀 접점이 이미 연결돼 있어. 독립 화면은 통합운세 안정화 뒤 확장해.</p></div></section>}
"""
new = """          {selectedTool === 'precision' && <section className="tool-panel precision-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><Search size={22}/></span><div><span className="eyebrow">LIVE PRECISION ENGINE</span><h2>정밀분석</h2><p>새 점수를 만들지 않고 운영 중인 통합 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON까지 확인할 수 있어.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>
            <div className="coordinate-note"><Search size={16}/><span>통합운세와 같은 `/v1/fortune/integrated` 실제 엔진을 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 응답을 정밀 화면에서 그대로 펼쳐 보여줘.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            {!integratedMatchesSelection && <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}<span>{integratedLoading?'정밀 계산 중…':'정밀분석 실제 계산'}</span></button>}

            {integratedMatchesSelection && integratedResult && <div className="results-wrap precision-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>정밀 실계산 준비 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · 원자료 확장 보기</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('정밀 요청/프롬프트 전체복사', precisionPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('정밀 결과 전체복사', precisionResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={savePrecisionRecord}><Save size={15}/><span>정밀 기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

              <section className="result-card">
                <div className="result-card-title"><span>WESTERN AXES</span><strong>출생축 · 계산 엔진</strong></div>
                <div className="precision-kpi-grid">
                  <div className="precision-kpi"><span>ASC(상승점)</span><strong>{integratedResult.western.natal.asc.toFixed(3)}°</strong></div>
                  <div className="precision-kpi"><span>MC(중천점)</span><strong>{integratedResult.western.natal.mc.toFixed(3)}°</strong></div>
                  <div className="precision-kpi"><span>천문력</span><strong>{integratedResult.western.ephemeris}</strong></div>
                  <div className="precision-kpi"><span>Western 엔진</span><strong>{integratedResult.western.engine}</strong></div>
                </div>
                <p className="result-note">{integratedResult.western.score_policy}</p>
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>ALL TOPICS</span><strong>전 분야 세부 지표</strong></div>
                <div className="precision-table">{topIntegratedTopics.map(({topic,stat})=>{
                  const best = stat.best_days?.[0]
                  const caution = stat.caution_days?.[0]
                  return <div className="precision-row" key={`precision-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band} · Δ{stat.spread.toFixed(2)}</span><div className="precision-date-stack"><span>↑ {best ? `${best.date} ${best.score.toFixed(1)}` : '—'}</span><span>↓ {caution ? `${caution.date} ${caution.score.toFixed(1)}` : '—'}</span></div></div>
                })}</div>
              </section>

              {precisionRelationshipSignals.length>0 && <section className="result-card">
                <div className="result-card-title"><span>RELATIONSHIP SIGNALS</span><strong>관계 관련 기간 신호</strong></div>
                <div className="precision-table">{precisionRelationshipSignals.map(([topic,stat])=><div className="precision-row" key={`relationship-signal-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>변동폭 {stat.spread.toFixed(2)}</span></div>)}</div>
                <p className="result-note">이 값도 연락·재회·결혼의 사건 확률이 아니라 상대적 활성도야.</p>
              </section>}

              {integratedResult.western.months.length>0 && <section className="result-card">
                <div className="result-card-title"><span>MONTH RAW</span><strong>월별 전체 지표</strong></div>
                {integratedResult.western.months.map((month)=><details className="precision-details" key={`precision-month-${month.calendar_month}`}><summary>{month.calendar_month} · {month.start}~{month.end}</summary><div className="precision-details-body"><div className="precision-table">{topicOrder.map((topic)=>{
                  const stat = month.topics[topic]
                  return stat ? <div className="precision-row" key={`${month.calendar_month}-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>Δ {stat.spread.toFixed(2)}</span></div> : null
                })}</div></div></details>)}
              </section>}

              <section className="result-card">
                <div className="result-card-title"><span>SAJU RAW</span><strong>사주 계산 원자료</strong></div>
                {integratedResult.saju.ok && integratedResult.saju.pillars ? <>
                  <div className="pillar-grid">
                    <div><span>년주</span><strong>{integratedResult.saju.pillars.year}</strong></div><div><span>월주</span><strong>{integratedResult.saju.pillars.month}</strong></div><div><span>일주</span><strong>{integratedResult.saju.pillars.day}</strong></div><div><span>시주</span><strong>{integratedResult.saju.pillars.hour}</strong></div>
                  </div>
                  {integratedResult.saju.elements && <><div className="subsection-title">오행 카운트</div><div className="element-grid">{Object.entries(integratedResult.saju.elements).map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div></>}
                  {integratedResult.saju.true_solar && <div className="coordinate-note"><Sun size={16}/><span>법정 출생시 {integratedResult.saju.true_solar.legal_local_time} → 진태양시 {integratedResult.saju.true_solar.true_solar_time} · 총 보정 {integratedResult.saju.true_solar.total_correction_minutes>0?'+':''}{integratedResult.saju.true_solar.total_correction_minutes.toFixed(2)}분</span></div>}
                  {(integratedResult.saju.dayun?.length??0)>0 && <details className="precision-details" open><summary>대운 전체</summary><div className="precision-details-body">{integratedResult.saju.dayun?.map((row)=><div className="tight-row" key={`${row.start_year}-${row.ganzhi}`}><span>{row.start_year}~{row.end_year} · {row.start_age}~{row.end_age}세</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.annual?.length??0)>0 && <details className="precision-details"><summary>세운 전체</summary><div className="precision-details-body">{integratedResult.saju.annual?.map((row)=><div className="tight-row" key={`${row.year}-${row.ganzhi}`}><span>{row.year} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.monthly?.length??0)>0 && <details className="precision-details"><summary>월운 전체</summary><div className="precision-details-body">{integratedResult.saju.monthly?.map((row)=><div className="tight-row" key={`${row.calendar_month}-${row.ganzhi}`}><span>{row.calendar_month} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.not_calculated?.length??0)>0 && <><div className="subsection-title">엔진 미계산 · 임의 추정 금지</div><div className="precision-badge-row">{integratedResult.saju.not_calculated?.map((item)=><span key={item}>{item}</span>)}</div></>}
                </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{integratedResult.saju.error||'사주 계산 원자료가 없어.'}</span></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>
                <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{integratedResult.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{integratedResult.thai.ruler}</strong></div></div>
                <div className="tight-row"><span>규칙</span><b>{integratedResult.thai.rule}</b></div>
                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>
                <div className="tight-row"><span>합의 정책</span><b>{integratedResult.thai.consensus_policy}</b></div>
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>RAW JSON</span><strong>원본 계산 응답</strong></div>
                <details className="precision-details"><summary>원본 JSON 전체 펼치기</summary><div className="precision-details-body"><pre className="precision-json">{JSON.stringify(integratedResult,null,2)}</pre></div></details>
              </section>
            </div>}
          </section>}
"""
rep(old, new, 'precision-view')

# History copy and labels.
rep(
"""<p>통합운세·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p>""",
"""<p>통합운세·정밀분석·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p>""",
'history-description',
)
rep(
"""{item.kind==='integrated'?'통합운세':item.kind==='marriage'?'결혼운':'궁합운'}""",
"""{item.kind==='integrated'?'통합운세':item.kind==='precision'?'정밀분석':item.kind==='marriage'?'결혼운':'궁합운'}""",
'history-kind-label',
)

p.write_text(s)
print('precision-patch-ok')
