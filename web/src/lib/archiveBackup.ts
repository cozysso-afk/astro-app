import type { ArchiveItem } from './archive'

export const ARCHIVE_BACKUP_FORMAT = 'archive-backup-v1' as const
export const ARCHIVE_BACKUP_MAX_BYTES = 25 * 1024 * 1024
export const ARCHIVE_BACKUP_MAX_RECORDS = 5000

export type ArchiveBackupRecordV1 = {
  stableId: string
  cloudId: string | null
  storageState: 'local-only' | 'cloud-backed'
  kind: ArchiveItem['kind']
  periodKey: ArchiveItem['periodKey']
  title: string
  periodStart: string
  periodEnd: string
  engine: string
  request: Record<string, unknown>
  result: Record<string, unknown>
  interpretation: Record<string, unknown> | null
  createdAt: string
}

export type ArchiveBackupV1 = {
  format: typeof ARCHIVE_BACKUP_FORMAT
  version: 1
  app: 'starlight-destiny'
  exportedAt: string
  summary: {
    total: number
    localOnly: number
    cloudBacked: number
  }
  records: ArchiveBackupRecordV1[]
}

export type ParsedArchiveBackup = {
  items: ArchiveItem[]
  invalidRecords: number
  duplicateRecords: number
}

const archiveKinds = new Set<ArchiveItem['kind']>(['integrated', 'compatibility', 'marriage', 'precision', 'daily', 'outcome'])
const archivePeriods = new Set<ArchiveItem['periodKey']>(['today', 'week', 'month', 'year'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function backupRecordToArchiveItem(value: unknown): ArchiveItem | null {
  if (!isRecord(value)) return null

  const stableId = typeof value.stableId === 'string' ? value.stableId.trim() : ''
  const kind = typeof value.kind === 'string' ? value.kind as ArchiveItem['kind'] : null
  const periodKey = typeof value.periodKey === 'string' ? value.periodKey as ArchiveItem['periodKey'] : null
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : ''
  if (!stableId || stableId.length > 512 || !kind || !archiveKinds.has(kind) || !periodKey || !archivePeriods.has(periodKey)) return null
  if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) return null
  if (!isRecord(value.request) || !isRecord(value.result)) return null
  if (value.interpretation !== null && value.interpretation !== undefined && !isRecord(value.interpretation)) return null

  const stringFields = ['title', 'periodStart', 'periodEnd', 'engine'] as const
  if (stringFields.some((field) => typeof value[field] !== 'string')) return null

  return {
    id: stableId,
    kind,
    periodKey,
    title: value.title as string,
    periodStart: value.periodStart as string,
    periodEnd: value.periodEnd as string,
    engine: value.engine as string,
    request: value.request,
    result: value.result,
    interpretation: isRecord(value.interpretation) ? value.interpretation : undefined,
    createdAt,
    syncState: 'local',
  }
}

export function parseArchiveBackupText(text: string): ParsedArchiveBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('올바른 JSON 백업 파일이 아니야.')
  }
  if (!isRecord(parsed) || parsed.format !== ARCHIVE_BACKUP_FORMAT || parsed.version !== 1 || parsed.app !== 'starlight-destiny') {
    throw new Error('별빛의 운명 archive-backup-v1 파일만 가져올 수 있어.')
  }
  if (!Array.isArray(parsed.records)) throw new Error('백업 파일에 기록 목록이 없어.')
  if (parsed.records.length > ARCHIVE_BACKUP_MAX_RECORDS) {
    throw new Error(`한 번에 최대 ${ARCHIVE_BACKUP_MAX_RECORDS.toLocaleString('ko-KR')}건까지 가져올 수 있어.`)
  }

  const items: ArchiveItem[] = []
  const stableIds = new Set<string>()
  let invalidRecords = 0
  let duplicateRecords = 0
  for (const record of parsed.records) {
    const item = backupRecordToArchiveItem(record)
    if (!item) {
      invalidRecords += 1
      continue
    }
    if (stableIds.has(item.id)) {
      duplicateRecords += 1
      continue
    }
    stableIds.add(item.id)
    items.push(item)
  }
  if (parsed.records.length > 0 && items.length === 0) throw new Error('복원할 수 있는 정상 기록이 백업 파일에 없어.')
  return { items, invalidRecords, duplicateRecords }
}

export function createArchiveBackup(items: ArchiveItem[], exportedAt = new Date().toISOString()): ArchiveBackupV1 {
  const records = items.map((item): ArchiveBackupRecordV1 => ({
    stableId: item.id,
    cloudId: item.cloudId ?? null,
    storageState: item.cloudId ? 'cloud-backed' : 'local-only',
    kind: item.kind,
    periodKey: item.periodKey,
    title: item.title,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    engine: item.engine,
    request: item.request,
    result: item.result,
    interpretation: item.interpretation ?? null,
    createdAt: item.createdAt,
  }))
  const cloudBacked = records.filter((record) => record.storageState === 'cloud-backed').length

  return {
    format: ARCHIVE_BACKUP_FORMAT,
    version: 1,
    app: 'starlight-destiny',
    exportedAt,
    summary: {
      total: records.length,
      localOnly: records.length - cloudBacked,
      cloudBacked,
    },
    records,
  }
}

export function archiveBackupFilename(exportedAt: string) {
  const date = exportedAt.slice(0, 10) || 'backup'
  return `archive-backup-v1-${date}.json`
}

export function downloadArchiveBackup(backup: ArchiveBackupV1) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('이 브라우저에서는 백업 파일 다운로드를 사용할 수 없어.')
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = archiveBackupFilename(backup.exportedAt)
  anchor.hidden = true
  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
