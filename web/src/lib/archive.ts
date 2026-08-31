import { supabase } from './supabase'

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
  cloudSynced: boolean
  cloudError?: string
}

export type ArchiveListResult = {
  items: ArchiveItem[]
  cloudAvailable: boolean
  cloudError?: string
}

const STORAGE_KEY = 'starlight-destiny.archive.v1'

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

function persistLocal(items: ArchiveItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)))
}

function upsertLocal(item: ArchiveItem) {
  const items = loadLocal()
  const next = [item, ...items.filter((row) => row.id !== item.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  persistLocal(next)
  return item
}

async function ensureArchiveUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { userId: null as string | null, error: sessionError.message }
  if (sessionData.session?.user?.id) return { userId: sessionData.session.user.id, error: null as string | null }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user?.id) {
    return { userId: null as string | null, error: error?.message || '익명 사용자 세션을 만들지 못했어.' }
  }
  return { userId: data.user.id, error: null as string | null }
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

async function uploadLocalItem(item: ArchiveItem, userId: string): Promise<ArchiveItem> {
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
  if (!response.data?.id) throw new Error('Supabase 저장 결과가 비어 있어.')

  const synced: ArchiveItem = {
    ...item,
    cloudId: String(response.data.id),
    createdAt: String(response.data.created_at ?? cloudCreatedAt ?? item.createdAt),
    syncState: 'cloud',
  }
  upsertLocal(synced)
  return synced
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
  upsertLocal(item)

  const auth = await ensureArchiveUser()
  if (!auth.userId) return { item, cloudSynced: false, cloudError: auth.error || undefined }

  try {
    item = await uploadLocalItem(item, auth.userId)
    return { item, cloudSynced: true }
  } catch (error) {
    return { item, cloudSynced: false, cloudError: error instanceof Error ? error.message : 'Supabase 동기화에 실패했어.' }
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

async function fetchCloudItems(): Promise<ArchiveItem[]> {
  const columns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, interpretation_json, summary, created_at'
  const [fortune, relationship] = await Promise.all([
    supabase.from('readings').select(columns).order('created_at', { ascending: false }).limit(100),
    supabase.from('relationship_readings').select(columns).order('created_at', { ascending: false }).limit(100),
  ])
  if (fortune.error) throw fortune.error
  if (relationship.error) throw relationship.error

  return [
    ...(fortune.data ?? []).map((row) => cloudRowToItem(row as Record<string, unknown>, 'integrated')),
    ...(relationship.data ?? []).map((row) => cloudRowToItem(row as Record<string, unknown>, 'compatibility')),
  ].filter((row): row is ArchiveItem => Boolean(row))
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
      break
    }
  }
  local = loadLocal()

  try {
    const cloud = await fetchCloudItems()
    const merged = new Map<string, ArchiveItem>()
    local.forEach((item) => merged.set(item.id, item))
    cloud.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }))
    const items = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    persistLocal(items)
    return { items, cloudAvailable: true, cloudError: syncError }
  } catch (error) {
    return {
      items: local.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      cloudAvailable: false,
      cloudError: error instanceof Error ? error.message : '클라우드 기록을 불러오지 못했어.',
    }
  }
}

export async function deleteArchive(item: ArchiveItem) {
  persistLocal(loadLocal().filter((row) => row.id !== item.id))
  if (!item.cloudId) return
  const response = item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome'
    ? await supabase.from('readings').delete().eq('id', item.cloudId)
    : await supabase.from('relationship_readings').delete().eq('id', item.cloudId)
  if (response.error) throw response.error
}
