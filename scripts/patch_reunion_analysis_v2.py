from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')

# Purpose type
anchor = "type RelationshipStatus = 'single' | 'dating' | 'long_term' | 'cohabiting' | 'engaged' | 'married'\n"
if "type RelationshipPurpose" not in s:
    assert anchor in s
    s = s.replace(anchor, anchor + "type RelationshipPurpose = 'compatibility' | 'reunion'\n", 1)

# Deep reunion AI response
anchor = "    reunion_context: string\n"
if "reunion_reading?:" not in s:
    assert anchor in s
    s = s.replace(anchor, """    reunion_context: string
    reunion_reading?: {
      bottom_line: string
      incoming_contact: string
      outgoing_contact: string
      reconnection_windows: string
      low_windows: string
      relationship_filter: string
      precision_note: string
    }
""", 1)

# Timing context type
anchor = "type IntegratedApiResponse = {\n"
if "type ReunionTimingContext" not in s:
    assert anchor in s
    s = s.replace(anchor, """type ReunionTimingContext = {
  period: { start: string; end: string }
  incoming: FortuneStat | null
  outgoing: FortuneStat | null
  reconnection: FortuneStat | null
  months: Array<{
    calendar_month: string
    start: string
    end: string
    incoming: FortuneStat | null
    outgoing: FortuneStat | null
    reconnection: FortuneStat | null
  }>
}

""" + anchor, 1)

# Timing helpers + panel
anchor = "async function copyToClipboard(text: string) {\n"
if "function ReunionTimingPanel" not in s:
    assert anchor in s
    helper = r'''function buildReunionTimingContext(result: IntegratedApiResponse): ReunionTimingContext {
  return {
    period: { start: result.period.start, end: result.period.end },
    incoming: result.western.relationship_signals['수신신호'] ?? null,
    outgoing: result.western.relationship_signals['발신적합'] ?? null,
    reconnection: result.western.relationship_signals['과거인연접점'] ?? null,
    months: (result.western.months ?? []).map((month) => ({
      calendar_month: month.calendar_month,
      start: month.start,
      end: month.end,
      incoming: month.relationship_signals['수신신호'] ?? null,
      outgoing: month.relationship_signals['발신적합'] ?? null,
      reconnection: month.relationship_signals['과거인연접점'] ?? null,
    })),
  }
}

function reunionScoreBand(score: number) {
  if (score >= 70) return '강함'
  if (score >= 55) return '상승'
  if (score >= 40) return '보통'
  if (score >= 25) return '약함'
  return '매우 약함'
}

function ReunionTimingPanel({ context, loading, error }: { context: ReunionTimingContext | null; loading: boolean; error: string }) {
  if (loading) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회·연락 시기 계산 중</strong></div><div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>수신·발신·과거인연 재접점 흐름을 같은 기간에서 따로 계산하고 있어.</span></div></section>
  if (error) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회 시기 계산 오류</strong></div><div className="status-banner error"><AlertTriangle size={16}/><span>{error}</span></div></section>
  if (!context) return null
  const rows = [
    { key: 'incoming', title: '상대 → 나 · 수신 신호', desc: '상대 쪽에서 연락·소식이 들어오는 흐름', stat: context.incoming },
    { key: 'outgoing', title: '나 → 상대 · 발신 적합도', desc: '내가 먼저 연락했을 때 흐름이 받쳐주는 정도', stat: context.outgoing },
    { key: 'reconnection', title: '과거인연 · 재접점', desc: '끊겼던 관계가 다시 활성화되는 흐름', stat: context.reconnection },
  ] as const
  const monthRank = [...context.months]
    .filter((m) => m.reconnection || m.incoming || m.outgoing)
    .map((m) => ({
      ...m,
      score: ((m.reconnection?.average ?? 0) * .5) + ((m.incoming?.average ?? 0) * .35) + ((m.outgoing?.average ?? 0) * .15),
    }))
    .sort((a,b) => b.score-a.score)
    .slice(0, 4)
  return <section className="result-card reunion-timing-card">
    <div className="result-card-title"><span>REUNION TIMING</span><strong>재회운 · 연락 방향과 시기</strong></div>
    <p className="result-note">0~100 값은 실제 연락 확률 %가 아니라 점성 계산의 상대 활성도 지수야. 수신과 발신을 섞지 않고 따로 봐.</p>
    <div className="reunion-signal-grid">{rows.map(({key,title,desc,stat}) => <article key={key}><div><strong>{title}</strong><small>{desc}</small></div><b>{stat ? stat.average.toFixed(1) : '—'}</b><span>{stat ? reunionScoreBand(stat.average) : '계산 없음'}</span>{stat?.best_days?.length ? <div className="reunion-window-list"><em>강한 시기</em>{stat.best_days.slice(0,3).map((point)=><p key={`${key}-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}{stat?.caution_days?.length ? <div className="reunion-window-list is-low"><em>약한 시기</em>{stat.caution_days.slice(0,2).map((point)=><p key={`${key}-low-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}</article>)}</div>
    {monthRank.length>1 && <div className="reunion-month-rank"><strong>재접점 종합 활성도가 높은 월</strong><small>과거인연 50% · 수신 35% · 발신 15%로 화면 정렬만 한 참고지수야.</small>{monthRank.map((m,index)=><p key={m.calendar_month}><span>{index+1}. {m.calendar_month}</span><b>{m.score.toFixed(1)}</b></p>)}</div>}
  </section>
}

'''
    s = s.replace(anchor, helper + anchor, 1)

# Deep reunion AI UI
needle = "<article><strong>재회 맥락</strong><p>{ai.data.reunion_context}</p></article></div>"
if "reunion-ai-deep" not in s:
    assert needle in s
    s = s.replace(needle, needle + "{ai.data.reunion_reading?.bottom_line&&<div className=\"reunion-ai-deep\"><strong>재회운 정밀 해석</strong><p className=\"reunion-ai-bottom\">{ai.data.reunion_reading.bottom_line}</p><div className=\"reunion-ai-grid\"><article><b>상대 → 나 · 수신</b><p>{ai.data.reunion_reading.incoming_contact}</p></article><article><b>나 → 상대 · 발신</b><p>{ai.data.reunion_reading.outgoing_contact}</p></article><article><b>재접점 강한 시기</b><p>{ai.data.reunion_reading.reconnection_windows}</p></article><article><b>약한 시기</b><p>{ai.data.reunion_reading.low_windows}</p></article><article><b>이 인연의 반복 패턴</b><p>{ai.data.reunion_reading.relationship_filter}</p></article><article><b>정밀도</b><p>{ai.data.reunion_reading.precision_note}</p></article></div></div>}", 1)

# States
anchor = "  const [relationshipMode, setRelationshipMode] = useState<RelationshipStatus>('dating')\n"
if "const [relationshipPurpose" not in s:
    assert anchor in s
    s = s.replace(anchor, """  const [relationshipMode, setRelationshipMode] = useState<RelationshipStatus>('dating')
  const [relationshipPurpose, setRelationshipPurpose] = useState<RelationshipPurpose>('compatibility')
  const [reunionTiming, setReunionTiming] = useState<ReunionTimingContext | null>(null)
  const [reunionTimingLoading, setReunionTimingLoading] = useState(false)
  const [reunionTimingError, setReunionTimingError] = useState('')
""", 1)

# Reunion timing calculator
anchor = "  const runRelationship = async () => {\n"
if "const runReunionTiming" not in s:
    assert anchor in s
    runner = r'''  const runReunionTiming = async (): Promise<ReunionTimingContext | null> => {
    setReunionTimingLoading(true); setReunionTimingError('')
    try {
      const end = periodEnd(queryDate, period)
      if (integratedResult && integratedResult.period.start === queryDate && integratedResult.period.end === end) {
        const cached = buildReunionTimingContext(integratedResult)
        setReunionTiming(cached)
        return cached
      }
      const latitude = parseOptionalNumber(birthProfile.latitude)
      const longitude = parseOptionalNumber(birthProfile.longitude)
      if (latitude === null || longitude === null) throw new Error('내 출생지역 좌표가 필요해.')
      const body = {
        profile: {
          name: birthProfile.name || null,
          birth_date: birthProfile.birthDate,
          birth_time: birthProfile.birthTime,
          latitude,
          longitude,
          utc_offset_hours: Number(birthProfile.utcOffset || 9),
          gender: birthProfile.gender,
          place_key: birthProfile.placeKey,
        },
        start_date: queryDate,
        end_date: end,
      }
      const startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const started = await startResponse.json()
      if (!startResponse.ok || !started?.job_id) throw new Error(started?.detail || started?.error || '재회 시기 계산을 시작하지 못했어.')
      let calculation: IntegratedApiResponse | null = null
      for (let attempt=0; attempt<120; attempt++) {
        await new Promise((resolve)=>window.setTimeout(resolve, 2000))
        const pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
        const job = await pollResponse.json()
        if (!pollResponse.ok) throw new Error(job?.detail || '재회 시기 계산 상태를 확인하지 못했어.')
        if (job.status === 'failed') throw new Error(job.error || '재회 시기 계산이 실패했어.')
        if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
      }
      if (!calculation) throw new Error('재회 시기 계산 시간이 길어지고 있어. 다시 시도해줘.')
      const context = buildReunionTimingContext(calculation)
      setReunionTiming(context)
      return context
    } catch (error) {
      const message = error instanceof Error ? error.message : '재회 시기 계산 중 오류가 발생했어.'
      setReunionTimingError(message)
      return null
    } finally { setReunionTimingLoading(false) }
  }

'''
    s = s.replace(anchor, runner + anchor, 1)

# Reset reunion state on relationship rerun
old = "    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError('')\n"
if old in s:
    s = s.replace(old, "    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')\n", 1)

# API mode
old = "      start_date: queryDate, end_date: periodEnd(queryDate, period), relationship_status: relationshipMode,\n"
if old in s:
    s = s.replace(old, "      start_date: queryDate, end_date: periodEnd(queryDate, period), relationship_status: relationshipPurpose === 'reunion' ? 'single' : relationshipMode,\n", 1)

# After relationship result, calculate reunion timing
old = "      setRelationshipResult(payload as RelationshipApiResponse)\n      setRelationshipRequestSnapshot(body as Record<string, unknown>)\n"
if "await runReunionTiming()" not in s:
    assert old in s
    s = s.replace(old, old + "      if (relationshipPurpose === 'reunion') await runReunionTiming()\n", 1)

# AI call v5 with reunion context
old = "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n    setRelationshipAiLoading(true); setRelationshipAiError('')\n"
if "재회 시기 계산이 먼저 완료" not in s:
    assert old in s
    s = s.replace(old, "  const runRelationshipAi = async () => {\n    if (!relationshipResult) return\n    if (relationshipPurpose === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }\n    setRelationshipAiLoading(true); setRelationshipAiError('')\n", 1)
old = "      const { data, error } = await supabase.functions.invoke('relationship-interpret-v4-preview', { body: { calculation: relationshipResult, model: aiModel } })\n"
if old in s:
    s = s.replace(old, "      const { data, error } = await supabase.functions.invoke('relationship-interpret-v5-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: relationshipPurpose, model: aiModel } })\n", 1)

# Purpose selector
old = "            <div className=\"relationship-mode-row\">{relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>\n"
if "relationship-purpose-row" not in s:
    assert old in s
    new = "            {selectedTool==='compatibility' && <div className=\"relationship-purpose-row\"><button type=\"button\" className={relationshipPurpose==='compatibility'?'is-active':''} onClick={()=>{setRelationshipPurpose('compatibility');setReunionTiming(null);setRelationshipAi(null)}}>궁합 구조</button><button type=\"button\" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setReunionTiming(null);setRelationshipAi(null)}}>재회운 · 연락 시기</button></div>}\n            {(selectedTool==='marriage'||relationshipPurpose==='compatibility') && <div className=\"relationship-mode-row\">{relationshipModes.map(([value,label])=><button key={value} type=\"button\" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>}\n            {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<div className=\"status-banner reunion-intro\"><Heart size={16}/><span>과거 인연 기준으로 수신(상대→나) · 발신(나→상대) · 재접점 흐름과 강한 시기를 따로 계산해.</span></div>}\n"
    s = s.replace(old, new, 1)

# Button label
old = "<span>{relationshipLoading?'정밀 계산 중…':'실제 계산 실행'}</span>"
if old in s:
    s = s.replace(old, "<span>{relationshipLoading?(relationshipPurpose==='reunion'?'재회운 계산 중…':'정밀 계산 중…'):(relationshipPurpose==='reunion'?'재회운 정밀 계산':'실제 계산 실행')}</span>", 1)

# Dedicated reunion panel
old = "              <RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} />\n"
if "<ReunionTimingPanel" not in s:
    assert old in s
    s = s.replace(old, "              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTimingPanel context={reunionTiming} loading={reunionTimingLoading} error={reunionTimingError}/>}\n" + old, 1)

p.write_text(s, encoding='utf-8')

css = Path('web/src/visual-overhaul-v5.css')
c = css.read_text(encoding='utf-8')
if 'v6 · dedicated reunion reading' not in c:
    c += r'''

/* v6 · dedicated reunion reading */
.relationship-purpose-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:4px 0 16px}.relationship-purpose-row button{min-height:52px;border:1px solid rgba(133,103,159,.16);border-radius:18px;background:rgba(255,255,255,.66);color:#66566f;font-size:.98rem;font-weight:850}.relationship-purpose-row button.is-active{background:linear-gradient(135deg,rgba(239,220,255,.96),rgba(221,246,245,.9));border-color:rgba(132,91,166,.28);box-shadow:0 9px 24px rgba(106,79,135,.1)}
.reunion-intro{margin-bottom:15px!important;background:linear-gradient(135deg,rgba(252,239,249,.9),rgba(239,249,248,.88))!important;color:#655465!important}
.reunion-timing-card{background:radial-gradient(circle at 0 0,rgba(246,218,239,.46),transparent 28%),radial-gradient(circle at 100% 0,rgba(217,239,252,.5),transparent 30%),rgba(255,255,255,.88)!important}.reunion-signal-grid{display:grid;gap:13px;margin-top:16px}.reunion-signal-grid>article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;padding:18px;border-radius:22px;background:rgba(255,255,255,.73);border:1px solid rgba(137,112,155,.11)}.reunion-signal-grid>article>div:first-child{display:grid;gap:4px}.reunion-signal-grid>article>div:first-child strong{font-size:1.04rem;color:#493d50}.reunion-signal-grid>article>div:first-child small{font-size:.83rem;line-height:1.45;color:#887c89}.reunion-signal-grid>article>b{font-size:1.55rem;color:#765b85;font-variant-numeric:tabular-nums}.reunion-signal-grid>article>span{grid-column:2;font-size:.78rem;font-weight:850;color:#8b718f;text-align:right}.reunion-window-list{grid-column:1/-1;display:grid;gap:7px;margin-top:8px;padding-top:12px;border-top:1px solid rgba(132,110,146,.1)}.reunion-window-list em{font-style:normal;font-size:.78rem;font-weight:900;color:#6f6277}.reunion-window-list p{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;margin:0;padding:8px 10px;border-radius:12px;background:rgba(239,248,245,.72)}.reunion-window-list.is-low p{background:rgba(253,241,239,.74)}.reunion-window-list p strong{font-size:.88rem;color:#55495b}.reunion-window-list p span{font-size:.81rem;color:#7b707c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reunion-window-list p b{font-size:.9rem;color:#6f5b79}.reunion-month-rank{display:grid;gap:7px;margin-top:16px;padding:17px;border-radius:20px;background:linear-gradient(145deg,rgba(247,240,255,.78),rgba(238,249,247,.76))}.reunion-month-rank>strong{font-size:1rem;color:#514357}.reunion-month-rank>small{font-size:.78rem;line-height:1.5;color:#867988}.reunion-month-rank p{display:flex;justify-content:space-between;margin:0;padding:8px 0;border-bottom:1px solid rgba(120,99,139,.09)}.reunion-month-rank p:last-child{border-bottom:0}.reunion-month-rank p span{font-size:.9rem}.reunion-month-rank p b{font-size:.95rem;color:#735c80}
.reunion-ai-deep{display:grid;gap:14px;padding:19px;border-radius:24px;background:linear-gradient(145deg,rgba(248,237,255,.84),rgba(234,249,246,.8));border:1px solid rgba(137,111,158,.12)}.reunion-ai-deep>strong{font-size:1.13rem;color:#4c3e54}.reunion-ai-bottom{margin:0;font-size:1rem;line-height:1.82;color:#574d59}.reunion-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.reunion-ai-grid article{padding:15px;border-radius:17px;background:rgba(255,255,255,.7)}.reunion-ai-grid b{font-size:.9rem;color:#66506f}.reunion-ai-grid p{margin:7px 0 0;font-size:.9rem;line-height:1.7;color:#655c67}
@media(max-width:430px){.relationship-purpose-row{grid-template-columns:1fr}.reunion-ai-grid{grid-template-columns:1fr}.reunion-signal-grid>article{padding:16px}.reunion-window-list p{grid-template-columns:auto 1fr auto}.reunion-window-list p span{font-size:.78rem}}
'''
    css.write_text(c, encoding='utf-8')
