type DetailCacheEntry<T> = {
  expiresAt: number
  item: T | null
}

type AigcRecordDetailCache<T> = {
  deleteRequest: (recordId: number) => void
  getRequest: (recordId: number) => Promise<T | null> | undefined
  read: (recordId: number) => T | null | undefined
  setRequest: (recordId: number, request: Promise<T | null>) => void
  write: (recordId: number, item: T | null) => void
}

/**
 * 创建带有效期和并发请求合并能力的记录详情缓存。
 * @param ttlMs 详情结果缓存时间
 * @returns 记录详情缓存操作集合
 */
export function createAigcRecordDetailCache<T>(ttlMs: number): AigcRecordDetailCache<T> {
  const requests = new Map<number, Promise<T | null>>()
  const results = new Map<number, DetailCacheEntry<T>>()

  const read = (recordId: number): T | null | undefined => {
    const cached = results.get(recordId)
    if (!cached) return undefined
    if (cached.expiresAt > Date.now()) return cached.item
    results.delete(recordId)
    return undefined
  }

  const write = (recordId: number, item: T | null): void => {
    results.set(recordId, { expiresAt: Date.now() + ttlMs, item })
  }

  return {
    deleteRequest: (recordId: number): void => { requests.delete(recordId) },
    getRequest: (recordId: number): Promise<T | null> | undefined => requests.get(recordId),
    read,
    setRequest: (recordId: number, request: Promise<T | null>): void => { requests.set(recordId, request) },
    write,
  }
}
