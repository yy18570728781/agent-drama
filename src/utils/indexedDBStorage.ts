const DB_NAME = 'infinite_canvas'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null
let cacheReadyPromise: Promise<void> | null = null
const cache = new Map<string, unknown>()
const mutatedCacheKeys = new Set<string>()

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

function normalizeValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

async function ensureCacheReady(): Promise<void> {
  if (cacheReadyPromise) return cacheReadyPromise

  cacheReadyPromise = (async () => {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }
        const key = String(cursor.key)
        if (!mutatedCacheKeys.has(key)) cache.set(key, normalizeValue(cursor.value))
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  })()

  return cacheReadyPromise
}

export async function initIndexedDBStorage(): Promise<void> {
  await ensureCacheReady()
}

export function getIndexedDBCachedValue<T = unknown>(key: string): T | null {
  if (!cache.has(key)) return null
  return (cache.get(key) as T) ?? null
}

export function getIndexedDBCachedKeys(): string[] {
  return Array.from(cache.keys())
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  if (cache.has(key)) {
    return (cache.get(key) as T) ?? null
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result
      if (result === undefined) return resolve(null)
      const normalized = normalizeValue(result)
      cache.set(key, normalized)
      resolve((normalized as T) ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  cache.set(key, value)
  mutatedCacheKeys.add(key)
  const db = await openDB()
  const serialized = JSON.stringify(value)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(serialized, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function idbRemove(key: string): Promise<void> {
  cache.delete(key)
  mutatedCacheKeys.add(key)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function idbKeys(): Promise<string[]> {
  await ensureCacheReady()
  return Array.from(cache.keys())
}
