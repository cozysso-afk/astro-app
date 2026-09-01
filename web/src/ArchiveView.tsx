import { AlertTriangle, Cloud, Copy, History, Home, LoaderCircle, RefreshCw, Search, Trash2 } from 'lucide-react'
import type { ArchiveItem } from './lib/archive'

type ArchiveViewProps = {
  items: ArchiveItem[]
  loading: boolean
  status: string
  error: string
  legacyOpen: ArchiveItem | null
  onRefresh: () => void | Promise<void>
  onCloseLegacy: () => void
  onGoHome: () => void
  onRestore: (item: ArchiveItem) => void | Promise<void>
  onCopy: (item: ArchiveItem) => void | Promise<void>
  onRemove: (item: ArchiveItem) => void | Promise<void>
}

function archiveKindLabel(item: ArchiveItem) {
  if (item.kind === 'integrated') return '통합운세'
  if (item.kind === 'precision') return '정밀분석'
  if (item.kind === 'marriage') return '결혼운'
  if (item.kind === 'compatibility') return '궁합운'
  if (item.kind === 'daily') {
    if (item.request.archive_mode !== 'period_fortune_v16') return '이전 일일운세'
    if (item.periodKey === 'today') return '오늘운세'
    if (item.periodKey === 'week') return '주간운세'
    if (item.periodKey === 'month') return '월간운세'
    return '연간운세'
  }
  return '결과 기록'
}

export function ArchiveView({
  items,
  loading,
  status,
  error,
  legacyOpen,
  onRefresh,
  onCloseLegacy,
  onGoHome,
  onRestore,
  onCopy,
  onRemove,
}: ArchiveViewProps) {
  return <section className="form-card archive-view">
    <div className="form-card-heading"><div className="report-icon"><History size={21}/></div><div><span className="eyebrow">ARCHIVE</span><h2>분석 기록</h2><p>통합운세·정밀분석·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p></div></div>
    <div className="archive-sync-row"><span><Cloud size={15}/>{loading ? '기록 연결 상태 확인 중' : status || '기록 연결 상태 확인 전'}</span><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw className={loading?'spin':''} size={15}/>새로고침</button></div>
    {legacyOpen && <section className={`legacy-archive-detail legacy-${legacyOpen.kind}`}>
      <div className="legacy-archive-head"><div><span className={`archive-kind kind-${legacyOpen.kind}`}>{legacyOpen.kind==='daily'?'이전 일일운세':'결과 기록'}</span><strong>{legacyOpen.title}</strong><small>{legacyOpen.periodStart} · {new Date(legacyOpen.createdAt).toLocaleString('ko-KR')}</small></div><button type="button" onClick={onCloseLegacy}>닫기</button></div>
      <p>{legacyOpen.kind==='daily'?'이전 앱에서 저장한 일일운세 원문이야. 기존 계산·해석 데이터를 수정하지 않고 그대로 보존했어.':'이전 앱에서 남긴 실제 결과/피드백 기록이야. 당시 메모와 점수를 원본 그대로 보존했어.'}</p>
      <details open><summary>원문 데이터 보기</summary><pre>{JSON.stringify(legacyOpen.result,null,2)}</pre></details>
    </section>}
    {error && <div className="status-banner error"><AlertTriangle size={16}/><span>{error}</span></div>}
    {loading && items.length===0 && <div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
    {!loading && !error && items.length===0 && <div className="archive-empty"><History size={22}/><strong>저장된 기록 0개</strong><span>클라우드 연결은 정상이고, 현재 세션에 저장된 분석 결과가 아직 없어. 계산 결과에서 “기록 저장”을 누르면 여기에 쌓여.</span><button className="archive-empty-action" type="button" onClick={onGoHome}><Home size={15}/>홈에서 계산하고 기록 저장하기</button></div>}
    <div className="archive-list">{items.map((item)=><article className="archive-card" key={item.id}>
      <div className="archive-card-top"><div><span className={`archive-kind kind-${item.kind}`}>{archiveKindLabel(item)}</span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.periodStart}~{item.periodEnd}</small></div><span className={`sync-chip ${item.syncState}`}><Cloud size={12}/>{item.syncState==='cloud'?'클라우드':'이 기기'}</span></div>
      <div className="archive-actions">
        <button type="button" onClick={()=>onRestore(item)}><Search size={14}/>다시 열기</button>
        <button type="button" onClick={()=>onCopy(item)}><Copy size={14}/>전체복사</button>
        <button className="danger" type="button" onClick={()=>onRemove(item)}><Trash2 size={14}/>삭제</button>
      </div>
    </article>)}</div>
  </section>
}
