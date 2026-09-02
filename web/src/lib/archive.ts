import { ensureSupabaseSession, supabase } from './supabase'

export type ArchiveKind = 'integrated' | 'compatibility' | 'marriage' | 'precision' | 'daily' | 'outcome'
export type ArchivePeriod = 'today' | 'week' | 'month' | 'year'

export type ArchiveItem = {
  id: string
  cloudId?: string
  kind: ArchiveKind
  periodKey: ArchivePeriod
  title: string
  periodStart: string
  periodEnd: string
  engine: string
  request: Record<string, unknown>
  result: Record<string, unknown>
  interpretation?: Record<string, unknown>
  createdAt: string
  syncState: 'local' | 'cloud'
}

export type ArchiveSaveResult = {
  item: ArchiveItem
  localSaved: boolean
  cloudSynced: boolean
  localError?: string
  cloudError?: string
}

export type ArchiveListResult = {
  items: ArchiveItem[]
  cloudAvailable: boolean
  cloudError?: string
}

export type ArchiveImportResult = {
  items: ArchiveItem[]
  imported: number
  skippedExisting: number
}

const STORAGE_KEY = 'starlight-destiny.archive.v1'
const CLOUD_PAGE_SIZE = 100

type LocalPersistResult = { ok: true } | { ok: false; error: string }
type UploadLocalItemResult = { item: ArchiveItem; local: LocalPersistResult }
type CloudArchiveTable = 'readings' | 'relationship_readings'
type CloudFetchResult = { items: ArchiveItem[]; warnings: string[] }
type SupabaseErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `archive-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function loadLocal(): ArchiveItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isQuotaExceeded(error: unknown) {
  return typeof DOMException !== 'undefined'
    && error instanceof DOMException
    && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
}

function localStorageErrorMessage(error: unknown) {
  return isQuotaExceeded(error)
    ? '브라우저 저장 공간이 부족해.'
    : '브라우저 저장소를 사용할 수 없어.'
}

function supabaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback
  if (!error || typeof error !== 'object') return String(error || fallback)

  const cloudError = error as SupabaseErrorLike
  const details = [cloudError.message, cloudError.details, cloudError.hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const code = typeof cloudError.code === 'string' && cloudError.code.trim()
    ? `[${cloudError.code}]`
    : ''
  const message = [...new Set(details)].join(' · ')
  return [code, message].filter(Boolean).join(' ') || fallback
}

function isRetryableCloudAuthError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const cloudError = error as SupabaseErrorLike
  const code = typeof cloudError.code === 'string' ? cloudError.code.toUpperCase() : ''
  return code === '42501' || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303'
}

function persistLocal(items: ArchiveItem[]): LocalPersistResult {
  if (typeof window === 'undefined') return { ok: false, error: '브라우저 저장소를 사용할 수 없어.' }
  const unsyncedCount = items.filter((item) => !item.cloudId).length
  let syncedBudget = Math.max(0, 200 - unsyncedCount)
  let next = items.filter((item) => {
    if (!item.cloudId) return true
    if (syncedBudget <= 0) return false
    syncedBudget -= 1
    return true
  })
  while (true) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return { ok: true }
    } catch (error) {
      if (!isQuotaExceeded(error)) return { ok: false, error: localStorageErrorMessage(error) }
      let evictIndex = next.length - 1
      while (evictIndex >= 0 && !next[evictIndex].cloudId) evictIndex -= 1
      if (evictIndex < 0) return { ok: false, error: localStorageErrorMessage(error) }
      next = next.filter((_, index) => index !== evictIndex)
    }
  }
}

function upsertLocal(item: ArchiveItem): LocalPersistResult {
  const items = loadLocal()
  const next = [item, ...items.filter((row) => row.id !== item.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return persistLocal(next)
}

export function importArchiveItems(candidates: ArchiveItem[], knownItems: ArchiveItem[] = []): ArchiveImportResult {
  const merged = new Map<string, ArchiveItem>()
  loadLocal().forEach((item) => merged.set(item.id, item))
  knownItems.forEach((item) => merged.set(item.id, item))

  let imported = 0
  let skippedExisting = 0
  for (const candidate of candidates) {
    if (merged.has(candidate.id)) {
      skippedExisting += 1
      continue
    }
    merged.set(candidate.id, { ...candidate, cloudId: undefined, syncState: 'local' })
    imported += 1
  }

  const items = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const persisted = persistLocal(items)
  if (!persisted.ok) throw new Error(`기록을 복원하지 못했어: ${persisted.error}`)
  return { items, imported, skippedExisting }
}

async function ensureArchiveUser() {
  try {
    const session = await ensureSupabaseSession()
    const userId = session.user?.id
    if (!userId) {
      return { userId: null as string | null, error: '익명 사용자 세션에 사용자 ID가 없어.' }
    }
    return { userId, error: null as string | null }
  } catch (error) {
    return { userId: null as string | null, error: error instanceof Error ? error.message : '클라우드 기록 세션을 확인하지 못했어.' }
  }
}

function calculationJson(item: ArchiveItem) {
  return {
    archive_v: 1,
    local_id: item.id,
    period_key: item.periodKey,
    request: item.request,
    result: item.result,
    interpretation: item.interpretation ?? null,
  }
}

async function uploadLocalItem(item: ArchiveItem, userId: string): Promise<UploadLocalItemResult> {
  const isFortune = item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome'
  const table = isFortune ? 'readings' : 'relationship_readings'
  let cloudId = item.cloudId
  let cloudCreatedAt: string | undefined

  if (!cloudId) {
    const existing = await supabase
      .from(table)
      .select('id, created_at')
      .eq('user_id', userId)
      .contains('calculation_json', { archive_v: 1, local_id: item.id })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing.error && existing.data?.id) {
      cloudId = String(existing.data.id)
      cloudCreatedAt = String(existing.data.created_at ?? item.createdAt)
    }
  }

  const common = {
    period_start: item.periodStart,
    period_end: item.periodEnd,
    engine_version: item.engine,
    calculation_json: calculationJson(item),
    interpretation_json: { archive_v: 1, ai: item.interpretation ?? null },
    summary: item.title,
  }
  const payload = isFortune
    ? { user_id: userId, profile_id: null, reading_type: item.kind, ...common }
    : { user_id: userId, profile_id: null, counterpart_id: null, reading_type: item.kind, relationship_status: String(item.request.relationship_status ?? ''), ...common }

  const response = cloudId
    ? await supabase.from(table).update(payload).eq('id', cloudId).eq('user_id', userId).select('id, created_at').single()
    : await supabase.from(table).insert(payload).select('id, created_at').single()
  if (response.error) throw response.error
  if (!response.data?.id) throw new Error('클라우드 저장 결과가 비어 있어.')

  const synced: ArchiveItem = {
    ...item,
    cloudId: String(response.data.id),
    createdAt: String(response.data.created_at ?? cloudCreatedAt ?? item.createdAt),
    syncState: 'cloud',
  }
  const local = upsertLocal(synced)
  return { item: synced, local }
}

export async function saveArchive(input: Omit<ArchiveItem, 'id' | 'createdAt' | 'syncState'>, stableId?: string): Promise<ArchiveSaveResult> {
  const previous = stableId ? loadLocal().find((row)=>row.id === stableId) : undefined
  let item: ArchiveItem = {
    ...input,
    id: stableId ?? newId(),
    cloudId: previous?.cloudId,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    syncState: previous?.syncState ?? 'local',
  }
  const initialLocal = upsertLocal(item)
  const initialLocalError = initialLocal.ok ? undefined : initialLocal.error

  const auth = await ensureArchiveUser()
  if (!auth.userId) {
    return {
      item,
      localSaved: initialLocal.ok,
      localError: initialLocalError,
      cloudSynced: false,
      cloudError: auth.error || undefined,
    }
  }

  try {
    const uploaded = await uploadLocalItem(item, auth.userId)
    item = uploaded.item
    const localSaved = initialLocal.ok || uploaded.local.ok
    const localError = localSaved
      ? undefined
      : (uploaded.local.ok ? initialLocalError : uploaded.local.error)
    return { item, localSaved, localError, cloudSynced: true }
  } catch (error) {
    return {
      item,
      localSaved: initialLocal.ok,
      localError: initialLocalError,
      cloudSynced: false,
      cloudError: error instanceof Error ? error.message : '클라우드 동기화에 실패했어.',
    }
  }
}

function cloudRowToItem(
  row: Record<string, unknown>,
  kindFallback: ArchiveKind,
): ArchiveItem | null {
  const calculation = row.calculation_json && typeof row.calculation_json === 'object'
    ? row.calculation_json as Record<string, unknown>
    : null
  if (!calculation || calculation.archive_v !== 1) return null

  const request = calculation.request && typeof calculation.request === 'object'
    ? calculation.request as Record<string, unknown>
    : {}
  const result = calculation.result && typeof calculation.result === 'object'
    ? calculation.result as Record<string, unknown>
    : {}
  const interpretationEnvelope = row.interpretation_json && typeof row.interpretation_json === 'object' ? row.interpretation_json as Record<string,unknown> : {}
  const interpretation = interpretationEnvelope.ai && typeof interpretationEnvelope.ai === 'object' ? interpretationEnvelope.ai as Record<string,unknown> : (calculation.interpretation && typeof calculation.interpretation === 'object' ? calculation.interpretation as Record<string,unknown> : undefined)
  const rawKind = String(row.reading_type || kindFallback)
  const kind: ArchiveKind = rawKind === 'marriage' || rawKind === 'compatibility' || rawKind === 'integrated' || rawKind === 'precision' || rawKind === 'daily' || rawKind === 'outcome'
    ? rawKind
    : kindFallback
  const rawPeriod = String(calculation.period_key || 'today')
  const periodKey: ArchivePeriod = rawPeriod === 'week' || rawPeriod === 'month' || rawPeriod === 'year'
    ? rawPeriod
    : 'today'
  const localId = String(calculation.local_id || `cloud-${row.id}`)

  return {
    id: localId,
    cloudId: String(row.id),
    kind,
    periodKey,
    title: String(row.summary || '저장된 분석'),
    periodStart: String(row.period_start || ''),
    periodEnd: String(row.period_end || ''),
    engine: String(row.engine_version || ''),
    request,
    result,
    interpretation,
    createdAt: String(row.created_at || new Date().toISOString()),
    syncState: 'cloud',
  }
}

const cloudColumns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, interpretation_json, summary, created_at'

async function fetchCloudTable(table: CloudArchiveTable, kindFallback: ArchiveKind, userId: string): Promise<ArchiveItem[]> {
  const items: ArchiveItem[] = []
  let from = 0

  while (true) {
    const fetchPage = () => supabase
      .from(table)
      .select(cloudColumns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + CLOUD_PAGE_SIZE - 1)
    let page = await fetchPage()
    if (page.error && isRetryableCloudAuthError(page.error)) {
      const session = await ensureSupabaseSession()
      if (session.user.id === userId) page = await fetchPage()
    }
    if (page.error) throw page.error

    const rows = page.data ?? []
    items.push(...rows
      .map((row) => cloudRowToItem(row as Record<string, unknown>, kindFallback))
      .filter((row): row is ArchiveItem => Boolean(row)))

    if (rows.length < CLOUD_PAGE_SIZE) break
    from += CLOUD_PAGE_SIZE
  }

  return items
}

function cloudFetchError(label: string, error: unknown) {
  const message = supabaseErrorMessage(error, '조회 실패')
  return `${label} 클라우드 조회 실패: ${message}`
}

async function fetchCloudItems(userId: string): Promise<CloudFetchResult> {
  const [fortune, relationship] = await Promise.allSettled([
    fetchCloudTable('readings', 'integrated', userId),
    fetchCloudTable('relationship_readings', 'compatibility', userId),
  ])

  const items: ArchiveItem[] = []
  const warnings: string[] = []
  let successfulTables = 0

  if (fortune.status === 'fulfilled') {
    successfulTables += 1
    items.push(...fortune.value)
  } else {
    warnings.push(cloudFetchError('운세 기록', fortune.reason))
  }

  if (relationship.status === 'fulfilled') {
    successfulTables += 1
    items.push(...relationship.value)
  } else {
    warnings.push(cloudFetchError('관계 기록', relationship.reason))
  }

  if (successfulTables === 0) throw new Error(warnings.join(' / ') || '클라우드 기록을 불러오지 못했어.')
  return { items, warnings }
}

export async function listArchive(): Promise<ArchiveListResult> {
  let local = loadLocal()
  const auth = await ensureArchiveUser()
  if (!auth.userId) {
    return {
      items: local.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      cloudAvailable: false,
      cloudError: auth.error || undefined,
    }
  }

  let syncError: string | undefined
  for (const item of local.filter((row) => !row.cloudId)) {
    try {
      await uploadLocalItem(item, auth.userId)
    } catch (error) {
      syncError = error instanceof Error ? error.message : '일부 기록 동기화에 실패했어.'
      continue
    }
  }
  local = loadLocal()

  try {
    const cloud = await fetchCloudItems(auth.userId)
    const merged = new Map<string, ArchiveItem>()
    local.forEach((item) => merged.set(item.id, item))
    cloud.items.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }))
    const items = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const cache = persistLocal(items)
    const warnings = [
      syncError,
      ...cloud.warnings,
      cache.ok ? undefined : `클라우드 기록은 불러왔지만 이 브라우저 캐시에는 저장하지 못했어: ${cache.error}`,
    ].filter(Boolean).join(' / ')
    return { items, cloudAvailable: true, cloudError: warnings || undefined }
  } catch (error) {
    return {
      items: local.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      cloudAvailable: false,
      cloudError: error instanceof Error ? error.message : '클라우드 기록을 불러오지 못했어.',
    }
  }
}

export async function deleteArchive(item: ArchiveItem) {
  if (item.cloudId) {
    const response = item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome'
      ? await supabase.from('readings').delete().eq('id', item.cloudId)
      : await supabase.from('relationship_readings').delete().eq('id', item.cloudId)
    if (response.error) throw new Error(supabaseErrorMessage(response.error, '클라우드 기록을 삭제하지 못했어.'))
  }

  const localDelete = persistLocal(loadLocal().filter((row) => row.id !== item.id))
  if (!localDelete.ok) throw new Error(localDelete.error)
}
