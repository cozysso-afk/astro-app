import { AlertTriangle, LoaderCircle } from 'lucide-react'
import type { RelationshipApiResponse, ReunionTimingContext } from './appTypes'

function reunionScoreBand(score: number) {
  if (score >= 70) return '강함'
  if (score >= 55) return '상승'
  if (score >= 40) return '보통'
  if (score >= 25) return '약함'
  return '매우 약함'
}

export function ReunionTimingPanel({ context, loading, error }: { context: ReunionTimingContext | null; loading: boolean; error: string }) {
  if (loading) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회·연락 시기 계산 중</strong></div><div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>수신·발신·과거인연 재접점 흐름을 같은 기간에서 따로 계산하고 있어.</span></div></section>
  if (error) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회 시기 계산 오류</strong></div><div className="status-banner error"><AlertTriangle size={16}/><span>{error}</span></div></section>
  if (!context) return null
  const rows = [
    { key: 'incoming', title: '상대측 → 관계 · 수신 참고신호', desc: '상대 차트 쪽 관계 트랜짓 활성도. 실제 연락 의도나 확률은 아님', stat: context.incoming },
    { key: 'outgoing', title: '나 → 상대 · 발신 참고신호', desc: '내 차트 쪽 관계 트랜짓 활성도. 실제 연락 결과 확률은 아님', stat: context.outgoing },
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
    <p className="result-note">0~100 값은 실제 연락 확률 %가 아니라 점성 계산의 상대 활성도 지수야. 두 사람 차트의 방향별 활성도를 섞지 않고 따로 봐. 상대의 속마음이나 실제 행동 확률을 뜻하지 않아.</p>
    <div className="reunion-signal-grid">{rows.map(({key,title,desc,stat}) => <article key={key}><div><strong>{title}</strong><small>{desc}</small></div><b>{stat ? stat.average.toFixed(1) : '—'}</b><span>{stat ? reunionScoreBand(stat.average) : '계산 없음'}</span>{stat?.best_days?.length ? <div className="reunion-window-list"><em>강한 시기</em>{stat.best_days.slice(0,3).map((point)=><p key={`${key}-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}{stat?.caution_days?.length ? <div className="reunion-window-list is-low"><em>약한 시기</em>{stat.caution_days.slice(0,2).map((point)=><p key={`${key}-low-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}</article>)}</div>
    {monthRank.length>1 && <div className="reunion-month-rank"><strong>재접점 종합 활성도가 높은 월</strong><small>과거인연 50% · 수신 35% · 발신 15%로 화면 정렬만 한 참고지수야.</small>{monthRank.map((m,index)=><p key={m.calendar_month}><span>{index+1}. {m.calendar_month}</span><b>{m.score.toFixed(1)}</b></p>)}</div>}
  </section>
}

export function ReunionTransitPanel({ result }: { result: RelationshipApiResponse | null }) {
  const data = result?.result?.reunion_transits
  if (!data?.available || !data.top_days?.length) return null
  const aspectKo: Record<string,string> = {conjunction:'합',sextile:'육십분위',square:'사각',trine:'삼각',quincunx:'퀸컨스·150도',opposition:'대립'}
  const pointKo: Record<string,string> = {Sun:'태양',Moon:'달',Mercury:'수성',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성','True Node':'북교점',ASC:'상승점',DSC:'하강점',MC:'중천점',IC:'천저점'}
  const hitText = (hit:any) => `${pointKo[hit.transit]||hit.transit} → ${hit.person==='counterpart'?'상대':'나'} ${pointKo[hit.target]||hit.target} ${aspectKo[hit.aspect]||hit.aspect} · 오브 ${Number(hit.orb).toFixed(2)}°`
  return <section className="result-card reunion-transit-panel">
    <div className="result-card-title"><span>실제 트랜짓</span><strong>두 사람 차트를 직접 건드리는 날짜</strong></div>
    <p className="result-note">단순 재회 점수가 아니라, 선택 기간 안에서 현재 행성이 너와 상대의 출생차트 핵심점을 실제로 건드리는 날짜를 별도로 계산했어. 사건 확률은 아니야.</p>
    <div className="reunion-transit-list">{data.top_days.slice(0,8).map((day,index)=><article className="reunion-transit-day" key={day.date}><header><strong>{index+1}. {day.date}</strong><b>{day.score.toFixed(1)}</b></header><p>{day.hits.slice(0,3).map(hitText).join(' · ')}</p></article>)}</div>
  </section>
}
