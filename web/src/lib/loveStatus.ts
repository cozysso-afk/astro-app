import { readLocalStorage, writeLocalStorage } from './browserStorage'

// The reader's own relationship situation. It decides which love scenario the
// daily reading writes in depth; it is never presented as a fact about anyone else.
export type LoveStatus = 'single' | 'crush' | 'flirting' | 'ambiguous' | 'couple' | 'reunion'

export const LOVE_STATUS_OPTIONS: Array<{ id: LoveStatus; label: string; section: string }> = [
  { id: 'single', label: '솔로 · 새 인연', section: 'relationship.love_single' },
  { id: 'crush', label: '짝사랑', section: 'relationship.love_crush' },
  { id: 'flirting', label: '썸', section: 'relationship.love_flirting' },
  { id: 'ambiguous', label: '애매한 관계', section: 'relationship.love_ambiguous' },
  { id: 'couple', label: '연애 중', section: 'relationship.love_couple' },
  { id: 'reunion', label: '재회 바람', section: 'relationship.love_reunion_interest' },
]

export const LOVE_STATUS_STORAGE_KEY = 'astro.love-status.v1'
export const LOVE_STATUS_EVENT = 'astro:love-status'

export function isLoveStatus(value: unknown): value is LoveStatus {
  return LOVE_STATUS_OPTIONS.some(option => option.id === value)
}

export function readLoveStatus(): LoveStatus | null {
  const value = readLocalStorage(LOVE_STATUS_STORAGE_KEY)
  return isLoveStatus(value) ? value : null
}

export function writeLoveStatus(value: LoveStatus): void {
  writeLocalStorage(LOVE_STATUS_STORAGE_KEY, value)
  try { window.dispatchEvent(new CustomEvent(LOVE_STATUS_EVENT, { detail: value })) } catch { /* storage still holds the choice */ }
}

export function loveStatusUserContext(): { relationship_status: LoveStatus } | undefined {
  const status = readLoveStatus()
  return status ? { relationship_status: status } : undefined
}
