import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { AlertTriangle, Cloud, Copy, Download, History, Home, LoaderCircle, RefreshCw, Search, Trash2, X } from 'lucide-react'
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
  onExport: () => void | Promise<void>
  onRemove: (item: ArchiveItem) => void | Promise<void>
}

type ArchiveSection = 'fortune' | 'verification'
type ArchiveDateField = 'target' | 'saved'
type ArchiveTypeFilter = 'all' | 'integrated' | 'precision' | 'marriage' | 'compatibility' | 'today' | 'week' | 'month' | 'year' | 'legacy-daily'

function archiveKindLabel(item: ArchiveItem) {
  if (item.kind === 'integrated') return '통합운세'
  if (item.kind === 'precision') return '정밀분석'
  if (item.kind === 'marriage') return '결혼운'
  if (item.kind === 'compatibility') return '궁합운'
  if (item.kind === 'outcome') return '검증 기록'
  if (item.kind === 'daily') {
    if (item.request.archive_mode !== 'period_fortune_v16') return '이전 일일운세'
    if (item.periodKey === 'today') return '오늘운세'
    if (item.periodKey === 'week') return '주간운세'
    if (item.periodKey === 'month') return '월간운세'
    return '연간운세'
  }
  return '결과 기록'
}

function archiveTypeKey(item: ArchiveItem): Exclude<ArchiveTypeFilter, 'all'> | 'outcome' {
  if (item.kind !== 'daily') return item.kind
  if (item.request.archive_mode !== 'period_fortune_v16') return 'legacy-daily'
  return item.periodKey
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR')
}

function searchableArchiveText(item: ArchiveItem) {
  return normalizeSearchValue([
    item.title,
    archiveKindLabel(item),
    item.periodKey,
    item.periodStart,
    item.periodEnd,
    item.engine,
    JSON.stringify(item.request),
    JSON.stringify(item.result),
    JSON.stringify(item.interpretation ?? {}),
  ].join(' '))
}

function localDateKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function matchesDateRange(item: ArchiveItem, field: ArchiveDateField, from: string, to: string) {
  if (!from && !to) return true
  if (field === 'saved') {
    const saved = localDateKey(item.createdAt)
    return (!from || saved >= from) && (!to || saved <= to)
  }

  const start = item.periodStart || item.periodEnd
  const end = item.periodEnd || item.periodStart
  if (!start && !end) return false
  return (!from || end >= from) && (!to || start <= to)
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
  onExport,
  onRemove,
}: ArchiveViewProps) {
  const [section, setSection] = useState<ArchiveSection>('fortune')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ArchiveTypeFilter>('all')
  const [dateField, setDateField] = useState<ArchiveDateField>('target')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ArchiveItem | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  useEffect(() => {
    if (!pendingDelete) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !removeBusy) setPendingDelete(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [pendingDelete, removeBusy])

  const normalizedQuery = normalizeSearchValue(query)
  const hasTextQuery = Boolean(normalizedQuery)
  const fortuneItems = useMemo(() => items.filter((item) => item.kind !== 'outcome'), [items])
  const verificationItems = useMemo(() => items.filter((item) => item.kind === 'outcome'), [items])
  const sectionItems = section === 'fortune' ? fortuneItems : verificationItems
  const searchIndex = useMemo(() => {
    if (!hasTextQuery) return null
    return new Map(items.map((item) => [item.id, searchableArchiveText(item)]))
  }, [hasTextQuery, items])
  const hasSearchFilter = Boolean(normalizedQuery || dateFrom || dateTo || (section === 'fortune' && typeFilter !== 'all'))

  const visibleItems = useMemo(() => sectionItems.filter((item) => {
    if (section === 'fortune' && typeFilter !== 'all' && archiveTypeKey(item) !== typeFilter) return false
    if (hasTextQuery && !(searchIndex?.get(item.id) ?? '').includes(normalizedQuery)) return false
    return matchesDateRange(item, dateField, dateFrom, dateTo)
  }), [dateField, dateFrom, dateTo, hasTextQuery, normalizedQuery, searchIndex, section, sectionItems, typeFilter])
  const sectionItemCount = sectionItems.length

  const emptyTitle = section === 'fortune' ? '저장된 운세 기록이 없어' : '아직 검증 기록이 없어'
  const emptyDescription = section === 'fortune'
    ? '자동 저장된 오늘·주간·월간·연간 운세와 저장한 분석 결과가 여기에 모여.'
    : '네가 실제 결과를 확인하고 직접 남긴 검증 기록만 여기에 따로 모여.'

  const resetSearch = () => {
    setQuery('')
    setTypeFilter('all')
    setDateField('target')
    setDateFrom('')
    setDateTo('')
  }

  const changeSection = (next: ArchiveSection) => {
    setSection(next)
    setTypeFilter('all')
  }

  const confirmRemove = async () => {
    if (!pendingDelete || removeBusy) return
    setRemoveBusy(true)
    try {
      await onRemove(pendingDelete)
    } finally {
      setRemoveBusy(false)
      setPendingDelete(null)
    }
  }

  return <section className="form-card archive-view">
    <div className="form-card-heading"><div className="report-icon"><History size={21}/></div><div><span className="eyebrow">ARCHIVE</span><h2>기록함</h2><p>자동 저장되는 운세 기록과 직접 남긴 검증 기록을 분리해서 볼 수 있어.</p></div></div>
    <div className="archive-sync-row">
      <span><Cloud size={15}/>{loading ? '기록 연결 상태 확인 중' : status || '기록 연결 상태 확인 전'}</span>
      <div className="archive-toolbar-actions">
        <button type="button" onClick={onExport} disabled={loading || items.length === 0}><Download size={15}/>전체 백업</button>
        <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw className={loading?'spin':''} size={15}/>새로고침</button>
      </div>
    </div>
    <div className="archive-tabs" role="tablist" aria-label="기록 종류">
      <button type="button" role="tab" aria-selected={section==='fortune'} className={`archive-tab fortune ${section==='fortune'?'active':''}`} onClick={()=>changeSection('fortune')}>
        <span>운세 기록</span><strong>{fortuneItems.length}</strong>
      </button>
      <button type="button" role="tab" aria-selected={section==='verification'} className={`archive-tab verification ${section==='verification'?'active':''}`} onClick={()=>changeSection('verification')}>
        <span>검증 기록</span><strong>{verificationItems.length}</strong>
      </button>
    </div>

    <section className={`archive-search-panel archive-search-${section}`} aria-label="기록 검색">
      <label className="archive-search-query">
        <span className="archive-filter-label">내용 검색</span>
        <span className="archive-search-input"><Search size={15}/><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>)=>setQuery(event.target.value)} placeholder="제목·이름·질문·메모·결과 내용" type="search"/></span>
      </label>
      <div className="archive-filter-grid">
        {section === 'fortune' && <label>
          <span className="archive-filter-label">운세 유형</span>
          <select value={typeFilter} onChange={(event: ChangeEvent<HTMLSelectElement>)=>setTypeFilter(event.target.value as ArchiveTypeFilter)}>
            <option value="all">전체 유형</option>
            <option value="today">오늘운세</option>
            <option value="week">주간운세</option>
            <option value="month">월간운세</option>
            <option value="year">연간운세</option>
            <option value="integrated">통합운세</option>
            <option value="precision">정밀분석</option>
            <option value="compatibility">궁합운</option>
            <option value="marriage">결혼운</option>
            <option value="legacy-daily">이전 일일운세</option>
          </select>
        </label>}
        <label>
          <span className="archive-filter-label">날짜 기준</span>
          <select value={dateField} onChange={(event: ChangeEvent<HTMLSelectElement>)=>setDateField(event.target.value as ArchiveDateField)}>
            <option value="target">운세·검증 대상일</option>
            <option value="saved">저장한 날짜</option>
          </select>
        </label>
        <label>
          <span className="archive-filter-label">시작일</span>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event: ChangeEvent<HTMLInputElement>)=>setDateFrom(event.target.value)}/>
        </label>
        <label>
          <span className="archive-filter-label">종료일</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event: ChangeEvent<HTMLInputElement>)=>setDateTo(event.target.value)}/>
        </label>
      </div>
      <div className="archive-search-summary" aria-live="polite">
        <span>검색 결과 <strong>{visibleItems.length}</strong>건</span>
        {hasSearchFilter && <button type="button" onClick={resetSearch}><X size={14}/>조건 초기화</button>}
      </div>
    </section>

    {legacyOpen && <section className={`legacy-archive-detail legacy-${legacyOpen.kind}`}>
      <div className="legacy-archive-head"><div><span className={`archive-kind kind-${legacyOpen.kind}`}>{archiveKindLabel(legacyOpen)}</span><strong>{legacyOpen.title}</strong><small>{legacyOpen.periodStart} · {new Date(legacyOpen.createdAt).toLocaleString('ko-KR')}</small></div><button type="button" onClick={onCloseLegacy}>닫기</button></div>
      <p>{legacyOpen.kind==='daily'?'이전 앱에서 저장한 일일운세 원문이야. 기존 계산·해석 데이터를 수정하지 않고 그대로 보존했어.':legacyOpen.kind==='outcome'?'직접 남긴 실제 결과 검증 기록이야. 당시 메모와 점수를 원본 그대로 보존했어.':'이전 앱에서 남긴 실제 결과/피드백 기록이야. 당시 메모와 점수를 원본 그대로 보존했어.'}</p>
      <details open><summary>원문 데이터 보기</summary><pre>{JSON.stringify(legacyOpen.result,null,2)}</pre></details>
    </section>}
    {error && <div className="status-banner error"><AlertTriangle size={16}/><span>{error}</span></div>}
    {loading && items.length===0 && <div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
    {!loading && !error && sectionItemCount===0 && <div className={`archive-empty archive-empty-${section}`}><History size={22}/><strong>{emptyTitle}</strong><span>{emptyDescription}</span>{section==='fortune' && <button className="archive-empty-action" type="button" onClick={onGoHome}><Home size={15}/>홈에서 운세 보기</button>}</div>}
    {!loading && !error && sectionItemCount>0 && visibleItems.length===0 && <div className={`archive-empty archive-empty-${section} archive-search-empty`}><Search size={22}/><strong>검색 조건에 맞는 기록이 없어</strong><span>검색어 또는 날짜 범위를 바꾸거나 조건을 초기화해봐.</span><button className="archive-empty-action" type="button" onClick={resetSearch}><X size={15}/>검색 조건 초기화</button></div>}
    <div className={`archive-list archive-list-${section}`}>{visibleItems.map((item)=><article className={`archive-card archive-card-${section}`} key={item.id}>
      <div className="archive-card-top"><div><span className={`archive-kind kind-${item.kind}`}>{archiveKindLabel(item)}</span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.periodStart}~{item.periodEnd}</small></div><span className={`sync-chip ${item.syncState}`}><Cloud size={12}/>{item.syncState==='cloud'?'클라우드':'이 기기'}</span></div>
      <div className="archive-actions">
        <button type="button" onClick={()=>onRestore(item)}><Search size={14}/>다시 열기</button>
        <button type="button" onClick={()=>onCopy(item)}><Copy size={14}/>전체복사</button>
        <button className="danger" type="button" onClick={()=>setPendingDelete(item)}><Trash2 size={14}/>삭제</button>
      </div>
    </article>)}</div>
    {pendingDelete && <div className="archive-confirm-backdrop" onMouseDown={(event)=>{
      if (event.currentTarget === event.target && !removeBusy) setPendingDelete(null)
    }}>
      <div className="archive-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="archive-delete-title" aria-describedby="archive-delete-description">
        <div className="archive-confirm-icon"><AlertTriangle size={22}/></div>
        <div className="archive-confirm-copy">
          <span className="eyebrow">DELETE RECORD</span>
          <h3 id="archive-delete-title">이 기록을 삭제할까?</h3>
          <strong>{pendingDelete.title}</strong>
          <p id="archive-delete-description">{pendingDelete.cloudId
            ? '이 기기와 클라우드에서 모두 삭제돼. 삭제 후에는 되돌릴 수 없어.'
            : '아직 클라우드에 없는 기록이라 이 기기에서 지우면 복구할 수 없어. 필요하면 먼저 전체 백업을 받아줘.'}</p>
        </div>
        <div className="archive-confirm-actions">
          <button type="button" autoFocus onClick={()=>setPendingDelete(null)} disabled={removeBusy}>취소</button>
          <button className="danger" type="button" onClick={()=>void confirmRemove()} disabled={removeBusy}>
            {removeBusy ? <><LoaderCircle className="spin" size={15}/>삭제 중…</> : <><Trash2 size={15}/>삭제하기</>}
          </button>
        </div>
      </div>
    </div>}
  </section>
}
