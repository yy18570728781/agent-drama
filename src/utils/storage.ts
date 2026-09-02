import {
  getIndexedDBCachedKeys,
  getIndexedDBCachedValue,
  idbRemove,
  idbSet,
  initIndexedDBStorage,
} from './indexedDBStorage'

const DEPRECATED_STORAGE_KEYS = [
  'saved_login_creds',
  'auth_prefs',
  'preferred_login_method',
  'auth_token',
  'manual_logout',
  'user',
  'api_base_url',
  'custom_api_base_url',
  'model_cache_models_generations__',
  'deepseek_api_key',
  'shenshu_main_tabs_state',
  'taskQueue_flowTaskMeta',
  'taskQueue_pendingSubmissions',
] as const

const DEPRECATED_STORAGE_PREFIXES = [
  'model_cache_params_',
] as const

interface DeferredStorageWrite {
  timer: ReturnType<typeof setTimeout>
  value: unknown
}

const deferredWrites = new Map<string, DeferredStorageWrite>()
let pagehideListenerBound = false

function cancelDeferredStorageWrite(key: string): void {
  const pending = deferredWrites.get(key)
  if (!pending) return
  clearTimeout(pending.timer)
  deferredWrites.delete(key)
}

function flushDeferredStorage(): void {
  const writes = Array.from(deferredWrites.entries())
  deferredWrites.clear()
  writes.forEach(([key, pending]) => {
    clearTimeout(pending.timer)
    setStorage(key, pending.value)
  })
}

function ensurePagehideFlush(): void {
  if (pagehideListenerBound || typeof window === 'undefined') return
  pagehideListenerBound = true
  window.addEventListener('pagehide', flushDeferredStorage)
}

function getDeprecatedStorageKeys(): string[] {
  const keys = new Set<string>(DEPRECATED_STORAGE_KEYS)
  for (const key of getIndexedDBCachedKeys()) {
    if (DEPRECATED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.add(key)
    }
  }
  return Array.from(keys)
}

/**
 * 初始化 IndexedDB 存储，并删除历史版本遗留的明文凭据和已下线功能状态。
 * @returns 清理完成时解决的 Promise。
 * @throws IndexedDB 初始化或删除操作失败时抛出异常。
 */
export async function initStorage(): Promise<void> {
  await initIndexedDBStorage()
  await Promise.all(getDeprecatedStorageKeys().map((key) => idbRemove(key)))
}

export function getStorage<T>(key: string): T | null {
  const pending = deferredWrites.get(key)
  if (pending) return pending.value as T
  return getIndexedDBCachedValue<T>(key)
}

export function setStorage<T>(key: string, value: T): void {
  cancelDeferredStorageWrite(key)
  void idbSet(key, value).catch((error) => {
    console.warn(`[storage] Failed to persist "${key}"`, error)
  })
}

export function removeStorage(key: string): void {
  cancelDeferredStorageWrite(key)
  void idbRemove(key).catch((error) => {
    console.warn(`[storage] Failed to remove "${key}"`, error)
  })
}

export function getStorageKeys(): string[] {
  return getIndexedDBCachedKeys()
}

export const indexedDbStorageLike = {
  getItem(key: string): string | null {
    const stored = getStorage<{ pinia: string }>(key)
    return typeof stored?.pinia === 'string' ? stored.pinia : null
  },
  setItem(key: string, value: string): void {
    setStorage(key, { pinia: value })
  },
  removeItem(key: string): void {
    removeStorage(key)
  },
}

/**
 * 合并同一键的高频存储请求，并在页面离开前提交最后一次状态。
 * @param key 存储键。
 * @param value 待保存值。
 * @param delay 合并等待时间。
 */
export function setStorageDeferred<T>(key: string, value: T, delay = 180): void {
  ensurePagehideFlush()
  const previous = deferredWrites.get(key)
  if (previous) clearTimeout(previous.timer)
  const timer = setTimeout(() => {
    deferredWrites.delete(key)
    setStorage(key, value)
  }, delay)
  deferredWrites.set(key, { timer, value })
}
