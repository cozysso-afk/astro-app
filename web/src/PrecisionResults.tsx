import { AlertTriangle, CheckCircle2, Cloud, Copy, Save, Sun } from 'lucide-react'
import type { FortuneStat, IntegratedApiResponse } from './appTypes'

type TopicRow = { topic: string; stat: FortuneStat }
type RelationshipSignalRow = [string, FortuneStat]

type PrecisionResultsProps = {
  result: IntegratedApiResponse
  topTopics: TopicRow[]
  relationshipSignals: RelationshipSignalRow[]
  topicOrder: readonly string[]
  actionNotice: string
  archiveStatus: string
  archiveSaving: boolean
  onCopyPrompt: () => void
  onCopyResult: () => void
  onSave: () => void
}

export function PrecisionResults({
  result,
  topTopics,
  relationshipSignals,
  topicOrder,
  actionNotice,
  archiveStatus,
  archiveSaving,
  onCopyPrompt,
  onCopyResult,
  onSave,
}: PrecisionResultsProps) {
  return <div className="results-wrap precision-results">
    <div className="result-headline"><CheckCircle2 size={20}/><div><strong>정밀 실계산 준비 완료</strong><span>{result.period.day_count}일 분석 · 원자료 확장 보기</span></div></div>
    <div className="result-actions">
      <button type="button" onClick={onCopyPrompt}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
      <button type="button" onClick={onCopyResult}><Copy size={15}/><span>결과 전체복사</span></button>
      <button className="save-action" type="button" onClick={onSave} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'정밀 기록 저장'}</span></button>
    </div>
    {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
    {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

    <section className="result-card">
      <div className="result-card-title"><span>WESTERN AXES</span><strong>출생축 · 계산 엔진</strong></div>
      <div className="precision-kpi-grid">
        <div className="precision-kpi"><span>ASC(상승점)</span><strong>{result.western.natal.asc.toFixed(3)}°</strong></div>
        <div className="precision-kpi"><span>MC(중천점)</span><strong>{result.western.natal.mc.toFixed(3)}°</strong></div>
        <div className="precision-kpi"><span>천문력</span><strong>{result.western.ephemeris}</strong></div>
        <div className="precision-kpi"><span>Western 엔진</span><strong>{result.western.engine}</strong></div>
      </div>
      <p className="result-note">{result.western.score_policy}</p>
    </section>

    <section className="result-card">
      <div className="result-card-title"><span>ALL TOPICS</span><strong>전 분야 세부 지표</strong></div>
      <div className="precision-table">{topTopics.map(({topic,stat})=>{
        const best = stat.best_days?.[0]
        const caution = stat.caution_days?.[0]
        return <div className="precision-row" key={`precision-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band} · Δ{stat.spread.toFixed(2)}</span><div className="precision-date-stack"><span>↑ {best ? `${best.date} ${best.score.toFixed(1)}` : '—'}</span><span>↓ {caution ? `${caution.date} ${caution.score.toFixed(1)}` : '—'}</span></div></div>
      })}</div>
    </section>

    {relationshipSignals.length>0 && <section className="result-card">
      <div className="result-card-title"><span>RELATIONSHIP SIGNALS</span><strong>관계 관련 기간 신호</strong></div>
      <div className="precision-table">{relationshipSignals.map(([topic,stat])=><div className="precision-row" key={`relationship-signal-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>변동폭 {stat.spread.toFixed(2)}</span></div>)}</div>
      <p className="result-note">이 값도 연락·재회·결혼의 사건 확률이 아니라 상대적 활성도야.</p>
    </section>}

    {result.western.months.length>0 && <section className="result-card">
      <div className="result-card-title"><span>MONTH RAW</span><strong>월별 전체 지표</strong></div>
      {result.western.months.map((month)=><details className="precision-details" key={`precision-month-${month.calendar_month}`}><summary>{month.calendar_month} · {month.start}~{month.end}</summary><div className="precision-details-body"><div className="precision-table">{topicOrder.map((topic)=>{
        const stat = month.topics[topic]
        return stat ? <div className="precision-row" key={`${month.calendar_month}-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>Δ {stat.spread.toFixed(2)}</span></div> : null
      })}</div></div></details>)}
    </section>}

    <section className="result-card">
      <div className="result-card-title"><span>SAJU RAW</span><strong>사주 계산 원자료</strong></div>
      {result.saju.ok && result.saju.pillars ? <>
        <div className="pillar-grid">
          <div><span>년주</span><strong>{result.saju.pillars.year}</strong></div><div><span>월주</span><strong>{result.saju.pillars.month}</strong></div><div><span>일주</span><strong>{result.saju.pillars.day}</strong></div><div><span>시주</span><strong>{result.saju.pillars.hour}</strong></div>
        </div>
        {result.saju.elements && <><div className="subsection-title">오행 카운트</div><div className="element-grid">{Object.entries(result.saju.elements).map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div></>}
        {result.saju.true_solar && <div className="coordinate-note"><Sun size={16}/><span>법정 출생시 {result.saju.true_solar.legal_local_time} → 진태양시 {result.saju.true_solar.true_solar_time} · 총 보정 {result.saju.true_solar.total_correction_minutes>0?'+':''}{result.saju.true_solar.total_correction_minutes.toFixed(2)}분</span></div>}
        {(result.saju.dayun?.length??0)>0 && <details className="precision-details" open><summary>대운 전체</summary><div className="precision-details-body">{result.saju.dayun?.map((row)=><div className="tight-row" key={`${row.start_year}-${row.ganzhi}`}><span>{row.start_year}~{row.end_year} · {row.start_age}~{row.end_age}세</span><b>{row.ganzhi}</b></div>)}</div></details>}
        {(result.saju.annual?.length??0)>0 && <details className="precision-details"><summary>세운 전체 · 입춘 경계</summary><div className="precision-details-body">{result.saju.annual?.map((row,index)=><div className="tight-row" key={`${row.year}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:`${row.year}`} · {row.start_jie_ko?`${row.start_jie_ko}(${row.start_jie}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
        {(result.saju.monthly?.length??0)>0 && <details className="precision-details"><summary>월운 전체 · 절(節) 경계</summary><div className="precision-details-body">{result.saju.monthly?.map((row,index)=><div className="tight-row" key={`${row.calendar_month}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:row.calendar_month} · {row.jie_name_ko?`${row.jie_name_ko}(${row.jie_name}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
        {(result.saju.not_calculated?.length??0)>0 && <><div className="subsection-title">엔진 미계산 · 임의 추정 금지</div><div className="precision-badge-row">{result.saju.not_calculated?.map((item)=><span key={item}>{item}</span>)}</div></>}
      </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{result.saju.error||'사주 계산 원자료가 없어.'}</span></div>}
    </section>

    <section className="result-card">
      <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>
      <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{result.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{result.thai.ruler}</strong></div></div>
      <div className="tight-row"><span>Mahathaksa</span><b>{result.thai.mahathaksa?.available?'8궁 계산됨':'미계산'}</b></div>
      <div className="tight-row"><span>Taksajorn</span><b>{result.thai.taksajorn?.available?'연령 기간 계산됨':'미계산'}</b></div>
      <div className="tight-row"><span>Suriyayat 10행성 위치</span><b>{result.thai.suriyayat?.available?`교차검증됨 · 최대 Δ${result.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}′`:'미계산'}</b></div>
      <div className="tight-row"><span>Suriyayat Lagna(라그나)</span><b>{result.thai.suriyayat?.lagna?.available?(result.thai.suriyayat.lagna.display||'검증된 숫자 위치 계산됨'):'제품 계약 미충족 · 해설 제외'}</b></div>
      <div className="tight-row"><span>하우스 설명 경로</span><b>{result.thai.suriyayat?.ai_safe_packet_product?.eligible_for_gemini&&result.thai.suriyayat.ai_safe_packet_product.route_count===12?'12개 검증됨 · 비예측 설명만':'AI 해설 제외'}</b></div>
      <div className="tight-row"><span>설명 범위</span><b>검증된 위치·하우스 맥락만</b></div>
      <div className="tight-row"><span>예측 제한</span><b>사건·시기·확률·점수 미제공</b></div>
      {result.thai.taksajorn?.method_variance_note && <p className="result-note">{result.thai.taksajorn.method_variance_note}</p>}
      {!!result.thai.not_calculated?.length && <p className="result-note">아직 미계산: {result.thai.not_calculated.join(' · ')}</p>}
    </section>

    <section className="result-card">
      <div className="result-card-title"><span>RAW JSON</span><strong>원본 계산 응답</strong></div>
      <details className="precision-details"><summary>원본 JSON(제이슨·데이터 형식) 전체 펼치기</summary><div className="precision-details-body"><pre className="precision-json">{JSON.stringify(result,null,2)}</pre></div></details>
    </section>
  </div>
}
