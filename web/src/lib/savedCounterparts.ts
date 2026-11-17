import type { CounterpartProfile } from '../appTypes'

// People the user reads compatibility/reunion/marriage with. Stored only on
// this device, next to the user's own birth profile.
export const SAVED_COUNTERPARTS_KEY = 'starlight-destiny.saved-counterparts.v1'
const MAX_SAVED = 20

export type SavedCounterpart = CounterpartProfile & { id: string; savedAt: string }

function storage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function counterpartId(profile: Pick<CounterpartProfile, 'name' | 'birthDate'>) {
  return `${profile.name.trim() || '상대'}|${profile.birthDate}`
}

export function readSavedCounterparts(store: Storage | null = storage()): SavedCounterpart[] {
  try {
    const parsed = JSON.parse(store?.getItem(SAVED_COUNTERPARTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(row => row && typeof row.birthDate === 'string' && row.birthDate) : []
  } catch { return [] }
}

function write(rows: SavedCounterpart[], store: Storage | null) {
  try { store?.setItem(SAVED_COUNTERPARTS_KEY, JSON.stringify(rows.slice(0, MAX_SAVED))) } catch { /* storage full or blocked */ }
}

/** Insert or update by name + birth date; the most recent comes first. */
export function saveCounterpart(profile: CounterpartProfile, store: Storage | null = storage(), now = new Date()): SavedCounterpart[] {
  if (!profile.birthDate) return readSavedCounterparts(store)
  const id = counterpartId(profile)
  const row: SavedCounterpart = { ...profile, name: profile.name.trim(), id, savedAt: now.toISOString() }
  const rows = [row, ...readSavedCounterparts(store).filter(saved => saved.id !== id)]
  write(rows, store)
  return rows.slice(0, MAX_SAVED)
}

export function removeCounterpart(id: string, store: Storage | null = storage()): SavedCounterpart[] {
  const rows = readSavedCounterparts(store).filter(saved => saved.id !== id)
  write(rows, store)
  return rows
}

export function toCounterpartProfile({ id: _id, savedAt: _savedAt, ...profile }: SavedCounterpart): CounterpartProfile {
  return profile
}
