import type { ArchiveItem } from './archive'

export const ARCHIVE_BACKUP_FORMAT = 'archive-backup-v1' as const

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
