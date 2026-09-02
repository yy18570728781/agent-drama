import { getStoredAuthScope } from './tokenStorage'

export interface MediaCacheEntry {
  url: string
  thumb: string | null
  aigc_record_id: number | string | null
}

const STORAGE_PREFIX = 'infinite_canvas_media_cache'

function storageKey(): string {
  const scope = getStoredAuthScope()
  return `${STORAGE_PREFIX}:${scope?.tenantId || 'anonymous'}:${scope?.userId || 'anonymous'}`
}

function readEntries(): MediaCacheEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey()) || '[]')
    return Array.isArray(parsed) ? parsed as MediaCacheEntry[] : []
  } catch {
    return []
  }
}

function writeEntries(entries: MediaCacheEntry[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(entries.slice(-2000)))
  } catch {
    // Cache writes are best effort and must not block generation.
  }
}

/** Upsert a URL-to-thumbnail mapping in the current user's browser cache. */
export async function postMediaCache(payload: { url: string; thumb?: string | null }): Promise<MediaCacheEntry | null> {
  if (!payload.url) return null
  const entries = readEntries()
  const index = entries.findIndex((entry) => entry.url === payload.url)
  const previous = index >= 0 ? entries[index] : null
  const value: MediaCacheEntry = {
    url: payload.url,
    thumb: payload.thumb ?? previous?.thumb ?? null,
    aigc_record_id: previous?.aigc_record_id ?? null,
  }
  if (index >= 0) entries[index] = value
  else entries.push(value)
  writeEntries(entries)
  return value
}

/** Keep compatibility with the old server refresh action; direct reads need no warm-up. */
export async function refreshMediaCache(): Promise<{
  pages: number
  total: number
  inserted: number
  updated: number
  skipped_no_media: number
}> {
  return { pages: 0, total: readEntries().length, inserted: 0, updated: 0, skipped_no_media: 0 }
}

/** Read a cached media mapping by source URL. */
export async function getMediaCacheByUrl(url: string): Promise<MediaCacheEntry | null> {
  return readEntries().find((entry) => entry.url === url) || null
}

/** Read a cached media mapping by Teamones AIGC record ID. */
export async function getMediaCacheByRecordId(recordId: string | number): Promise<MediaCacheEntry | null> {
  return readEntries().find((entry) => String(entry.aigc_record_id || '') === String(recordId)) || null
}
