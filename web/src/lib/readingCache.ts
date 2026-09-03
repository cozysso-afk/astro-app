export type CacheKind = 'fortune-calculation' | 'fortune-ai' | 'relationship-ai'

type CacheRecord<T = unknown> = {
  id: string
  kind: CacheKind
  savedAt: number
  expiresAt: number
  payload: T
}

const DB_NAME = 'starlight-destiny-reading-cache-v1'
const STORE_NAME = 'records'
const DB_VERSION = 1
const FORTUNE_CALC_CACHE_CONTRACT = 'full-daily-evidence-v3'
const FORTUNE_AI_CACHE_CONTRACT = 'daily-trajectory-evidence-ledger-v3'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const row = value as Record<string, unknown>
  return `{${Object.keys(row).sort().map((key)=>`${JSON.stringify(key)}:${stableStringify(row[key])}`).join(',')}}`
}

function hashText(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + ((i + 1) * 131)
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(16).padStart(8,'0')}${(h2 >>> 0).toString(16).padStart(8,'0')}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('reading cache db open failed'))
  })
}

async function transact<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const request = fn(tx.objectStore(STORE_NAME))
    const result = await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('reading cache request failed'))
    })
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('reading cache transaction failed'))
        tx.onabort = () => reject(tx.error ?? new Error('reading cache transaction aborted'))
      })
    }
    return result
  } finally {
    db.close()
  }
}

export async function readReadingCache<T>(id: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const record = await transact<CacheRecord<T> | undefined>('readonly', (store)=>store.get(id))
    if (!record) return null
    if (record.expiresAt <= Date.now()) {
      void deleteReadingCache(id)
      return null
    }
    return record.payload
  } catch {
    return null
  }
}

export async function writeReadingCache<T>(id: string, kind: CacheKind, payload: T, ttlDays: number): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const now = Date.now()
  const record: CacheRecord<T> = {
    id,
    kind,
    savedAt: now,
    expiresAt: now + Math.max(1, ttlDays) * 86400000,
    payload,
  }
  try {
    await transact<IDBValidKey>('readwrite', (store)=>store.put(record))
  } catch {
    // Cache failure must never block the reading itself.
  }
}

export async function deleteReadingCache(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    await transact<undefined>('readwrite', (store)=>store.delete(id) as IDBRequest<undefined>)
  } catch {
    // best effort
  }
}

export function fortuneCalculationCacheId(request: Record<string, unknown>): string {
  return `fortune-calc:${hashText(stableStringify({ contract: FORTUNE_CALC_CACHE_CONTRACT, request }))}`
}

export function fortuneAiCacheId(request: Record<string, unknown>, calculation: Record<string, unknown>, model: string): string {
  const period = calculation.period && typeof calculation.period === 'object' ? calculation.period as Record<string, unknown> : {}
  const western = calculation.western && typeof calculation.western === 'object' ? calculation.western as Record<string, unknown> : {}
  const saju = calculation.saju && typeof calculation.saju === 'object' ? calculation.saju as Record<string, unknown> : {}
  const thai = calculation.thai && typeof calculation.thai === 'object' ? calculation.thai as Record<string, unknown> : {}
  const signature = {
    interpretation_contract: FORTUNE_AI_CACHE_CONTRACT,
    model,
    request,
    api_version: calculation.api_version,
    engine: calculation.engine,
    period,
    western_engine: western.engine,
    overall: western.overall,
    relationship_signals: western.relationship_signals,
    western_months: western.months,
    western_detail_days: western.detail_days,
    western_key_dates: western.key_dates,
    western_daily_scores: western.daily_scores,
    saju_engine: saju.engine,
    saju_annual: saju.annual,
    saju_monthly: saju.monthly,
    thai_engine: thai.engine,
    thai_mahathaksa: thai.mahathaksa,
    thai_taksajorn: thai.taksajorn,
    thai_suriyayat: thai.suriyayat,
  }
  return `fortune-ai:${hashText(stableStringify(signature))}`
}

export function relationshipAiCacheId(calculation: Record<string, unknown>, purpose: string, model: string, context?: unknown): string {
  return `relationship-ai:${hashText(stableStringify({ model, purpose, calculation, context: context ?? null }))}`
}
