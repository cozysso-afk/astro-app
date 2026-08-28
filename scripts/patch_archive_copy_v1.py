from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text()


def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'missing marker: {label}')
    s = s.replace(old, new, 1)

rep(
"""  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Gem, Heart, History, Home,
  LoaderCircle, MapPin, Moon, Orbit, Save, Search, Settings, Sparkles, Sun, User,
""",
"""  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Cloud, Copy, Gem, Heart, History, Home,
  LoaderCircle, MapPin, Moon, Orbit, RefreshCw, Save, Search, Settings, Sparkles, Sun, Trash2, User,
""",
'import-icons',
)
rep(
"""import { KoreaBirthplaceSelector } from './koreaBirthplaces'
""",
"""import { KoreaBirthplaceSelector } from './koreaBirthplaces'
import { deleteArchive, listArchive, saveArchive, type ArchiveItem } from './lib/archive'
""",
'archive-import',
)

helpers = r'''
async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // iOS/private browsing fallback below.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

function compactPlace(value: unknown) {
  return String(value ?? '').replace('::', ' ') || '위치 미표기'
}

function integratedPromptText(request: Record<string, unknown>) {
  const profile = (request.profile ?? {}) as Record<string, unknown>
  return [
    '[별빛의 운명 · 통합운세 분석 요청]',
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    `이름: ${String(profile.name ?? '미입력')}`,
    `출생: ${String(profile.birth_date ?? '')} ${String(profile.birth_time ?? '')}`,
    `좌표: ${String(profile.latitude ?? '')}, ${String(profile.longitude ?? '')} / UTC ${String(profile.utc_offset_hours ?? '')}`,
    `성별(사주 대운 계산 기준): ${String(profile.gender ?? '')}`,
    '',
    '계산/해석 원칙:',
    '- Western(서양점성술), 사주, Thai(태국점성술)를 서로 다른 체계로 분리해서 본다.',
    '- Western 점수는 사건 확률이 아니라 상대적 활성도다.',
    '- 사주는 진태양시 보정을 사용하고, 엔진이 계산하지 않은 신강·신약/용희기신 등을 임의 생성하지 않는다.',
    '- Thai transit(태국식 트랜짓)이 미구현이면 출생요일 baseline을 날짜 예측 합의점수에 섞지 않는다.',
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
  ].join('\n')
}

function integratedResultText(result: IntegratedApiResponse) {
  const lines = [
    '[별빛의 운명 · 통합운세 전체 결과]',
    `엔진: ${result.engine} / API: ${result.api_version}`,
    `기간: ${result.period.start} ~ ${result.period.end} (${result.period.day_count}일)`,
    '',
    '■ Western(서양점성술)',
  ]
  topicOrder.forEach((topic) => {
    const stat = result.western.overall[topic]
    if (stat) lines.push(`- ${topic}: ${stat.average.toFixed(1)} · ${stat.band} · 변동폭 ${stat.spread.toFixed(1)}`)
  })
  if (result.saju.ok && result.saju.pillars) {
    lines.push('', '■ 사주')
    lines.push(`- 원국: ${result.saju.pillars.year} / ${result.saju.pillars.month} / ${result.saju.pillars.day} / ${result.saju.pillars.hour}`)
    lines.push(`- 일간: ${result.saju.day_master ?? ''}`)
    if (result.saju.true_solar) lines.push(`- 진태양시: ${result.saju.true_solar.true_solar_time} (보정 ${result.saju.true_solar.total_correction_minutes.toFixed(1)}분)`)
    for (const row of result.saju.dayun ?? []) lines.push(`- 대운: ${row.start_year}~${row.end_year} ${row.ganzhi} (${row.start_age}~${row.end_age}세)`)
    for (const row of result.saju.annual ?? []) lines.push(`- ${row.year} 세운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    for (const row of result.saju.monthly ?? []) lines.push(`- ${row.calendar_month} 월운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    if (result.saju.not_calculated?.length) lines.push(`- 미계산 항목: ${result.saju.not_calculated.join(', ')}`)
  }
  lines.push('', '■ Thai(태국점성술)')
  lines.push(`- ${result.thai.thai_day} · ${result.thai.ruler}`)
  lines.push(`- 규칙: ${result.thai.rule}`)
  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)
  lines.push('', '[원본 계산 JSON]', JSON.stringify(result, null, 2))
  return lines.join('\n')
}

function relationshipPromptText(kind: 'compatibility' | 'marriage', request: Record<string, unknown>) {
  const user = (request.user ?? {}) as Record<string, unknown>
  const cp = (request.counterpart ?? {}) as Record<string, unknown>
  return [
    `[별빛의 운명 · ${kind === 'marriage' ? '결혼운' : '궁합운'} 분석 요청]`,
    `관계 상태: ${String(request.relationship_status ?? '')}`,
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    '',
    `본인: ${String(user.name ?? '나')} / ${String(user.birth_date ?? '')} ${String(user.birth_time ?? '')}`,
    `본인 좌표: ${String(user.latitude ?? '')}, ${String(user.longitude ?? '')} / UTC ${String(user.utc_offset_hours ?? '')}`,
    `상대: ${String(cp.name ?? '상대')} / ${String(cp.birth_date ?? '')} ${cp.time_known ? String(cp.birth_time ?? '') : '출생시간 모름'}`,
    `상대 좌표: ${cp.time_known ? `${String(cp.latitude ?? '')}, ${String(cp.longitude ?? '')}` : '정밀 좌표 레이어 제외'}`,
    '',
    '해석 원칙:',
    '- 정적 시너스트리와 기간별 진행 접점을 분리한다.',
    '- 접점 수/오브를 연락·재회·결혼의 통계 확률처럼 말하지 않는다.',
    '- 상대의 사적인 속마음을 계산값만으로 단정하지 않는다.',
    kind === 'marriage' ? '- 결혼 여부를 예언하지 않고 장기 결속·협력·긴장 활성도를 본다.' : '- 궁합의 구조와 시기 활성도를 구분한다.',
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
  ].join('\n')
}

function relationshipResultText(kind: 'compatibility' | 'marriage', response: RelationshipApiResponse) {
  const result = response.result
  const aspects = result.natal_synastry?.aspects ?? []
  const lines = [
    `[별빛의 운명 · ${kind === 'marriage' ? '결혼운' : '궁합운'} 전체 결과]`,
    `엔진: ${response.engine} / API: ${response.api_version}`,
    `관계 상태: ${response.relationship_status}`,
    `기간: ${response.period.start} ~ ${response.period.end}`,
    '',
    '■ 기본 관계 구조',
    `- 시너스트리 접점: ${aspects.length}`,
    `- 다빈슨: ${result.davison?.available ? 'ON' : `OFF · ${result.davison?.reason ?? ''}`}`,
    `- 마크스: ${result.marks?.available ? 'ON' : `OFF · ${result.marks?.reason ?? ''}`}`,
  ]
  aspects.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb ${aspect.orb.toFixed(2)}° · ${aspect.tone}`))
  for (const month of result.months ?? []) {
    lines.push('', `■ ${month.calendar_month} / 대표일 ${month.representative_date}`)
    lines.push(`- 정밀 ${month.signal_summary.exact_contacts} · 조화 ${month.signal_summary.supportive_contacts} · 긴장 ${month.signal_summary.challenging_contacts}`)
    month.signal_summary.tightest.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb ${aspect.orb.toFixed(2)}°`))
  }
  if (result.limitations?.length) lines.push('', `제한사항: ${result.limitations.join(' ')}`)
  lines.push('', '[원본 계산 JSON]', JSON.stringify(response, null, 2))
  return lines.join('\n')
}
'''
rep('\nexport default function AppNext() {\n', helpers + '\nexport default function AppNext() {\n', 'helpers')

rep(
"""  const [integratedLoading, setIntegratedLoading] = useState(false)
  const [integratedError, setIntegratedError] = useState('')
""",
"""  const [integratedLoading, setIntegratedLoading] = useState(false)
  const [integratedError, setIntegratedError] = useState('')
  const [integratedRequestSnapshot, setIntegratedRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [relationshipRequestSnapshot, setRelationshipRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState('')
  const [actionNotice, setActionNotice] = useState('')
""",
'states',
)

rep(
"""  const apiLabel = useMemo(() => {
""",
"""  useEffect(() => {
    if (mainView === 'history') void refreshArchive()
  }, [mainView])

  const apiLabel = useMemo(() => {
""",
'archive-effect',
)

rep(
"""  const runIntegrated = async () => {
    setIntegratedError(''); setIntegratedResult(null)
""",
"""  const runIntegrated = async () => {
    setIntegratedError(''); setIntegratedResult(null); setIntegratedRequestSnapshot(null)
""",
'integrated-reset',
)

old_integrated = """    setIntegratedLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/integrated`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          profile: {
            name: birthProfile.name || null,
            birth_date: birthProfile.birthDate,
            birth_time: birthProfile.birthTime,
            latitude,
            longitude,
            utc_offset_hours: Number(birthProfile.utcOffset || 9),
            gender: birthProfile.gender,
          },
          start_date: queryDate,
          end_date: periodEnd(queryDate, period),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '통합운세 계산 요청에 실패했어.')
      setIntegratedResult(payload as IntegratedApiResponse)
"""
new_integrated = """    const body: Record<string, unknown> = {
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
      end_date: periodEnd(queryDate, period),
    }
    setIntegratedLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/integrated`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '통합운세 계산 요청에 실패했어.')
      setIntegratedResult(payload as IntegratedApiResponse)
      setIntegratedRequestSnapshot(body)
"""
rep(old_integrated, new_integrated, 'integrated-body')

rep(
"""  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null)
""",
"""  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null)
""",
'relationship-reset',
)
rep(
"""      setRelationshipResult(payload as RelationshipApiResponse)
""",
"""      setRelationshipResult(payload as RelationshipApiResponse)
      setRelationshipRequestSnapshot(body as Record<string, unknown>)
""",
'relationship-snapshot',
)

handlers = r'''
  async function handleCopy(label: string, text: string) {
    const ok = await copyToClipboard(text)
    setActionNotice(ok ? `${label} 완료` : '복사 권한을 사용할 수 없어. 브라우저에서 다시 시도해줘.')
    window.setTimeout(() => setActionNotice(''), 2200)
  }

  async function saveIntegratedRecord() {
    if (!integratedResult || !integratedRequestSnapshot) return
    const label = periods.find((item) => item.key === period)?.label ?? period
    const saved = await saveArchive({
      kind: 'integrated',
      periodKey: period,
      title: `${label} 통합운세 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
    if (mainView === 'history') await refreshArchive()
  }

  async function saveRelationshipRecord() {
    if (!relationshipResult || !relationshipRequestSnapshot) return
    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'
    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>
    const saved = await saveArchive({
      kind,
      periodKey: period,
      title: `${kind === 'marriage' ? '결혼운' : '궁합운'} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,
      periodStart: relationshipResult.period.start,
      periodEnd: relationshipResult.period.end,
      engine: relationshipResult.engine,
      request: relationshipRequestSnapshot,
      result: relationshipResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
  }

  async function refreshArchive() {
    setArchiveLoading(true)
    try {
      const data = await listArchive()
      setArchiveItems(data.items)
      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : 'Supabase 클라우드 기록 연결됨')
      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : '이 기기 기록 사용 중')
    } finally {
      setArchiveLoading(false)
    }
  }

  function restoreArchive(item: ArchiveItem) {
    setQueryDate(item.periodStart)
    setPeriod(item.periodKey)
    if (item.kind === 'integrated') {
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setSelectedTool('integrated')
    } else {
      const request = item.request
      const cp = (request.counterpart ?? {}) as Record<string, unknown>
      const known = cp.time_known !== false
      setRelationshipResult(item.result as unknown as RelationshipApiResponse)
      setRelationshipRequestSnapshot(request)
      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')
      setCounterpart({
        ...emptyCounterpart,
        name: String(cp.name ?? ''),
        birthDate: String(cp.birth_date ?? ''),
        birthTime: known ? String(cp.birth_time ?? '').slice(0, 5) : '',
        latitude: known && cp.latitude != null ? String(cp.latitude) : '',
        longitude: known && cp.longitude != null ? String(cp.longitude) : '',
        utcOffset: String(cp.utc_offset_hours ?? 9),
        timeKnown: known,
      })
      setSelectedTool(item.kind)
    }
    setMainView('home')
  }

  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'integrated') {
      await handleCopy('저장 결과 전체복사', integratedResultText(item.result as unknown as IntegratedApiResponse))
    } else {
      await handleCopy('저장 결과 전체복사', relationshipResultText(item.kind, item.result as unknown as RelationshipApiResponse))
    }
  }

  async function removeArchive(item: ArchiveItem) {
    try {
      await deleteArchive(item)
      setArchiveStatus('기록 삭제 완료')
      await refreshArchive()
    } catch (error) {
      setArchiveStatus(error instanceof Error ? error.message : '기록 삭제 중 오류가 발생했어.')
    }
  }
'''
rep('\n  return (\n', '\n' + handlers + '\n  return (\n', 'handlers')

# Add action bar to integrated detailed results.
rep(
"""              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span></div></div>

              <section className="result-card">
""",
"""              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

              <section className="result-card">
""",
'integrated-actions',
)

# Relationship actions.
rep(
"""              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실제 계산 완료</strong><span>{relationshipResult.engine} · {relationshipResult.period.month_segments}개 월 구간</span></div></div>
              <section className="result-card">
""",
"""              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실제 계산 완료</strong><span>{relationshipResult.engine} · {relationshipResult.period.month_segments}개 월 구간</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>relationshipRequestSnapshot && handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', relationshipResultText(selectedTool==='marriage'?'marriage':'compatibility', relationshipResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveRelationshipRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              <section className="result-card">
""",
'relationship-actions',
)

# Home report gets the same convenience actions.
rep(
"""              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>
""",
"""              <div className="result-actions home-result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>
""",
'home-actions',
)

# Profile privacy note must reflect cloud archive behavior.
rep(
"""          <div className="privacy-note"><CheckCircle2 size={16}/><span>현재 단계에서는 서버 계정 DB나 공개 GitHub에 개인 출생정보를 저장하지 않아.</span></div>
""",
"""          <div className="privacy-note"><CheckCircle2 size={16}/><span>출생 프로필 자체는 이 브라우저에 저장해. 분석 기록에서 “기록 저장”을 누르면 계산 입력과 결과가 본인 전용 Supabase 기록에도 동기화될 수 있어.</span></div>
""",
'privacy-copy',
)

# Replace history placeholder with real archive.
old_history = """        {mainView === 'history' && <section className="report-card"><div className="report-icon"><History size={21}/></div><div className="report-copy"><span className="eyebrow">ARCHIVE</span><strong>기록</strong><p>{integratedResult||relationshipResult?'이번 세션의 최근 계산 결과는 홈 카드에 남아 있어. 영구 저장은 계산 API 안정화 뒤 Supabase로 붙일게.':'아직 저장된 분석 기록이 없어.'}</p></div></section>}
"""
new_history = """        {mainView === 'history' && <section className="form-card archive-view">
          <div className="form-card-heading"><div className="report-icon"><History size={21}/></div><div><span className="eyebrow">ARCHIVE</span><h2>분석 기록</h2><p>통합운세·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p></div></div>
          <div className="archive-sync-row"><span><Cloud size={15}/>{archiveStatus || '기록 연결 상태 확인 중'}</span><button type="button" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>
          {archiveLoading && archiveItems.length===0 && <div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
          {!archiveLoading && archiveItems.length===0 && <div className="archive-empty"><History size={22}/><strong>아직 저장된 기록이 없어</strong><span>계산 결과에서 “기록 저장”을 누르면 여기에 쌓여.</span></div>}
          <div className="archive-list">{archiveItems.map((item)=><article className="archive-card" key={item.id}>
            <div className="archive-card-top"><div><span className={`archive-kind kind-${item.kind}`}>{item.kind==='integrated'?'통합운세':item.kind==='marriage'?'결혼운':'궁합운'}</span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.periodStart}~{item.periodEnd}</small></div><span className={`sync-chip ${item.syncState}`}><Cloud size={12}/>{item.syncState==='cloud'?'클라우드':'이 기기'}</span></div>
            <div className="archive-actions">
              <button type="button" onClick={()=>restoreArchive(item)}><Search size={14}/>다시 열기</button>
              <button type="button" onClick={()=>copyArchiveResult(item)}><Copy size={14}/>전체복사</button>
              <button className="danger" type="button" onClick={()=>removeArchive(item)}><Trash2 size={14}/>삭제</button>
            </div>
          </article>)}</div>
        </section>}
"""
rep(old_history, new_history, 'history-view')

p.write_text(s)
print('archive-copy-patch-ok')
