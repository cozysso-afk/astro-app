from pathlib import Path


def rep(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing marker {label} in {path}')
    p.write_text(s.replace(old, new, 1))

# auth.ts: keep a synchronous, already-authorized session path for reunion calls.
rep(
    'web/src/lib/auth.ts',
    """let originalFetch: typeof window.fetch | null = null
let authenticatedFetchInstalled = false
let authorizedApiSession: Session | null = null
""",
    """let originalFetch: typeof window.fetch | null = null
let authenticatedFetchInstalled = false
let authRefreshSubscriptionInstalled = false
let authorizedApiSession: Session | null = null
""",
    'auth-state',
)

rep(
    'web/src/lib/auth.ts',
    """function sessionHasUsableToken(session: Session | null): session is Session {
  if (!session?.access_token) return false
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000
  return !expiresAtMs || expiresAtMs - Date.now() > AUTH_SESSION_MIN_VALIDITY_MS
}

async function getAuthorizedApiSession(): Promise<Session | null> {
""",
    """function sessionHasUsableToken(session: Session | null): session is Session {
  if (!session?.access_token) return false
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000
  return !expiresAtMs || expiresAtMs - Date.now() > AUTH_SESSION_MIN_VALIDITY_MS
}

export function getAuthorizedSessionSnapshot(): Session | null {
  return authorizedApiSession
}

export async function fetchAuthorizedReunionRelationship(init: RequestInit): Promise<Response> {
  const session = authorizedApiSession
  if (!sessionHasUsableToken(session)) {
    return jsonResponse({ detail: '로그인 세션을 다시 확인해야 해. 앱을 다시 열어줘.' }, 401)
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  const fetcher = originalFetch ?? window.fetch.bind(window)
  return runDirectReunionRelationship(fetcher, PRIVATE_API_BASE, init, headers)
}

async function getAuthorizedApiSession(): Promise<Session | null> {
""",
    'auth-sync-helper',
)

rep(
    'web/src/lib/auth.ts',
    """  originalFetch = window.fetch.bind(window)
  const base = PRIVATE_API_BASE

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
""",
    """  originalFetch = window.fetch.bind(window)
  const base = PRIVATE_API_BASE

  if (!authRefreshSubscriptionInstalled) {
    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        authorizedApiSession = null
        return
      }
      if (nextSession && authorizedApiSession?.user.id === nextSession.user.id) {
        authorizedApiSession = nextSession
      }
    })
    authRefreshSubscriptionInstalled = true
  }

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
""",
    'auth-refresh-listener',
)

# archive.ts: list light metadata, hydrate one record only when opened/copied.
rep(
    'web/src/lib/archive.ts',
    """import { ensureSupabaseSession, supabase } from './supabase'
""",
    """import { ensureSupabaseSession, supabase } from './supabase'
import { getAuthorizedSessionSnapshot } from './auth'
""",
    'archive-auth-import',
)

rep(
    'web/src/lib/archive.ts',
    """  syncState: 'local' | 'cloud'
}
""",
    """  syncState: 'local' | 'cloud'
  hydrated?: boolean
  cloudSource?: 'readings' | 'relationship_readings'
}
""",
    'archive-item-fields',
)

rep(
    'web/src/lib/archive.ts',
    """async function ensureArchiveUser() {
  try {
""",
    """async function ensureArchiveUser() {
  const cached = getAuthorizedSessionSnapshot()
  if (cached?.user?.id) return { userId: cached.user.id, error: null as string | null }
  try {
""",
    'archive-cached-user',
)

marker = """const cloudColumns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, interpretation_json, summary, created_at'

async function fetchCloudTable(table: CloudArchiveTable, kindFallback: ArchiveKind, userId: string): Promise<ArchiveItem[]> {
"""
insert = """const cloudColumns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, interpretation_json, summary, created_at'
const archiveIndexColumns = 'id,user_id,source_table,reading_type,period_start,period_end,engine_version,summary,created_at,local_id,period_key,request_json,has_interpretation'

function cloudIndexRowToItem(row: Record<string, unknown>): ArchiveItem | null {
  const source = String(row.source_table ?? '')
  if (source !== 'readings' && source !== 'relationship_readings') return null
  const rawKind = String(row.reading_type ?? (source === 'readings' ? 'integrated' : 'compatibility'))
  const kind: ArchiveKind = rawKind === 'marriage' || rawKind === 'compatibility' || rawKind === 'integrated' || rawKind === 'precision' || rawKind === 'daily' || rawKind === 'outcome'
    ? rawKind
    : source === 'readings' ? 'integrated' : 'compatibility'
  const rawPeriod = String(row.period_key ?? 'today')
  const periodKey: ArchivePeriod = rawPeriod === 'week' || rawPeriod === 'month' || rawPeriod === 'year' ? rawPeriod : 'today'
  const request = row.request_json && typeof row.request_json === 'object' ? row.request_json as Record<string, unknown> : {}
  return {
    id: String(row.local_id || `cloud-${row.id}`),
    cloudId: String(row.id),
    cloudSource: source,
    hydrated: false,
    kind,
    periodKey,
    title: String(row.summary || '저장된 분석'),
    periodStart: String(row.period_start || ''),
    periodEnd: String(row.period_end || ''),
    engine: String(row.engine_version || ''),
    request,
    result: {},
    createdAt: String(row.created_at || new Date().toISOString()),
    syncState: 'cloud',
  }
}

async function fetchCloudIndex(userId: string): Promise<CloudFetchResult> {
  const query = supabase
    .from('archive_index_v1')
    .select(archiveIndexColumns)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  const response = await withArchiveTimeout(query, ARCHIVE_QUERY_TIMEOUT_MS, '클라우드 기록 목록 조회가 지연되고 있어.')
  if (response.error) throw response.error
  const items = (response.data ?? [])
    .map((row) => cloudIndexRowToItem(row as Record<string, unknown>))
    .filter((row): row is ArchiveItem => Boolean(row))
  return { items, warnings: [] }
}

async function fetchCloudTable(table: CloudArchiveTable, kindFallback: ArchiveKind, userId: string): Promise<ArchiveItem[]> {
"""
rep('web/src/lib/archive.ts', marker, insert, 'archive-index-functions')

rep(
    'web/src/lib/archive.ts',
    """    const cloud = await withArchiveTimeout(
      fetchCloudItems(auth.userId),
      ARCHIVE_QUERY_TIMEOUT_MS * 2,
      '클라우드 기록 전체 조회가 지연되고 있어. 이 기기 기록을 먼저 보여줄게.',
    )
""",
    """    const cloud = await withArchiveTimeout(
      fetchCloudIndex(auth.userId),
      ARCHIVE_QUERY_TIMEOUT_MS * 2,
      '클라우드 기록 목록 조회가 지연되고 있어. 이 기기 기록을 먼저 보여줄게.',
    )
""",
    'archive-use-index',
)

rep(
    'web/src/lib/archive.ts',
    """    cloud.items.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }))
""",
    """    cloud.items.forEach((item) => {
      const existing = merged.get(item.id)
      const existingHasFullResult = Boolean(existing && existing.hydrated !== false && Object.keys(existing.result ?? {}).length > 0)
      if (existingHasFullResult) {
        merged.set(item.id, { ...item, ...existing, cloudId: item.cloudId, cloudSource: item.cloudSource, hydrated: true, syncState: 'cloud' })
      } else {
        merged.set(item.id, { ...existing, ...item })
      }
    })
""",
    'archive-preserve-full-local',
)

hydrate_marker = """export async function deleteArchive(item: ArchiveItem) {
"""
hydrate_code = """export async function hydrateArchiveItem(item: ArchiveItem): Promise<ArchiveItem> {
  if (item.hydrated !== false || !item.cloudId) return item
  const auth = await ensureArchiveUser()
  if (!auth.userId) throw new Error(auth.error || '클라우드 기록 로그인이 필요해.')
  const table: CloudArchiveTable = item.cloudSource ?? (item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome' ? 'readings' : 'relationship_readings')
  const fallback: ArchiveKind = table === 'readings' ? 'integrated' : 'compatibility'
  const query = supabase.from(table).select(cloudColumns).eq('user_id', auth.userId).eq('id', item.cloudId).single()
  const response = await withArchiveTimeout(query, ARCHIVE_QUERY_TIMEOUT_MS, '저장 기록 원문을 불러오는 시간이 길어지고 있어.')
  if (response.error) throw response.error
  const full = cloudRowToItem(response.data as Record<string, unknown>, fallback)
  if (!full) throw new Error('저장 기록 원문 형식을 읽지 못했어.')
  const hydrated: ArchiveItem = { ...full, cloudSource: table, hydrated: true }
  upsertLocal(hydrated)
  return hydrated
}

export async function deleteArchive(item: ArchiveItem) {
"""
rep('web/src/lib/archive.ts', hydrate_marker, hydrate_code, 'archive-hydrator')

# AppNext: direct authenticated reunion path + lazy archive hydration.
rep(
    'web/src/AppNext.tsx',
    """import { deleteArchive, importArchiveItems, listArchive, listLocalArchive, saveArchive, type ArchiveItem, type ArchiveSaveResult } from './lib/archive'
""",
    """import { deleteArchive, hydrateArchiveItem, importArchiveItems, listArchive, listLocalArchive, saveArchive, type ArchiveItem, type ArchiveSaveResult } from './lib/archive'
import { fetchAuthorizedReunionRelationship } from './lib/auth'
""",
    'app-imports',
)

rep(
    'web/src/AppNext.tsx',
    """      const response = await fetch(`${API_BASE}/v1/relationship/western`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
""",
    """      const relationshipInit = { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }
      const response = reunionRequest
        ? await fetchAuthorizedReunionRelationship(relationshipInit)
        : await fetch(`${API_BASE}/v1/relationship/western`, relationshipInit)
""",
    'app-direct-reunion',
)

rep(
    'web/src/AppNext.tsx',
    """  function restoreArchive(item: ArchiveItem) {
    const currentPeriodArchive = item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16'
""",
    """  async function restoreArchive(item: ArchiveItem) {
    try {
      item = await hydrateArchiveItem(item)
      setArchiveItems((rows)=>rows.map((row)=>row.id === item.id ? item : row))
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : '저장 기록 원문을 불러오지 못했어.')
      return
    }
    const currentPeriodArchive = item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16'
""",
    'app-restore-hydrate',
)

rep(
    'web/src/AppNext.tsx',
    """  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16') {
""",
    """  async function copyArchiveResult(item: ArchiveItem) {
    try {
      item = await hydrateArchiveItem(item)
      setArchiveItems((rows)=>rows.map((row)=>row.id === item.id ? item : row))
    } catch (error) {
      setArchiveStatus(error instanceof Error ? error.message : '저장 기록 원문을 불러오지 못했어.')
      return
    }
    if (item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16') {
""",
    'app-copy-hydrate',
)

rep(
    'web/src/AppNext.tsx',
    """  function exportArchive() {
    try {
      const backup = createArchiveBackup(archiveItems)
      downloadArchiveBackup(backup)
      setArchiveStatus(`전체 기록 ${backup.summary.total}건 백업 완료 · 로컬 전용 ${backup.summary.localOnly}건 · 클라우드 연결 ${backup.summary.cloudBacked}건`)
    } catch (error) {
      setArchiveStatus(error instanceof Error ? error.message : '기록 백업 파일을 만들지 못했어.')
    }
  }
""",
    """  async function exportArchive() {
    try {
      setArchiveStatus('전체 기록 백업 준비 중…')
      const resolved: ArchiveItem[] = []
      for (let index = 0; index < archiveItems.length; index += 4) {
        resolved.push(...await Promise.all(archiveItems.slice(index, index + 4).map(hydrateArchiveItem)))
      }
      setArchiveItems(resolved)
      const backup = createArchiveBackup(resolved)
      downloadArchiveBackup(backup)
      setArchiveStatus(`전체 기록 ${backup.summary.total}건 백업 완료 · 로컬 전용 ${backup.summary.localOnly}건 · 클라우드 연결 ${backup.summary.cloudBacked}건`)
    } catch (error) {
      setArchiveStatus(error instanceof Error ? error.message : '기록 백업 파일을 만들지 못했어.')
    }
  }
""",
    'app-export-hydrate',
)

print('archive index + direct reunion patch applied')
