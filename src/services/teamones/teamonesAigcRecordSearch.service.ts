import type {
  AssetItem,
  AssetListParams,
  AssetListResponse,
  TeamonesAigcRecordListParams,
} from '@/api/assets'
import { TEAMONES_AIGC_RECORD_FIELDS, TEAMONES_AIGC_RECORD_PATHS } from '@/api/aigcRecord.constants'
import client from '@/api/teamonesClient'
import {
  assertTeamonesResponseSuccess,
  extractTeamonesCount,
  extractTeamonesRecordItems,
  normalizeTeamonesAigcRecord,
} from '@/utils/teamonesAigcRecordNormalize'
import { normalizeBinaryFlag } from '@/utils/binaryFlag'

interface SearchOptions {
  query?: string
  type?: string
  status?: number | number[]
  is_favorites?: boolean
  limit: number
  offset: number
}

function normalizeFilterValue(value: unknown): unknown {
  if (typeof value === 'boolean') return normalizeBinaryFlag(value)
  if (Array.isArray(value)) return value.map(normalizeFilterValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, normalizeFilterValue(nestedValue)]),
  )
}

function normalizeFilter(filter: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, normalizeFilterValue(value)]),
  )
}

function buildFilter(
  params: Pick<TeamonesAigcRecordListParams, 'type' | 'status' | 'is_favorites' | 'createdBy' | 'filter' | 'is_delete'>,
): Record<string, unknown> {
  const favoriteFlag = normalizeBinaryFlag(params.is_favorites ?? params.filter?.is_favorites)
  const trashFlag = normalizeBinaryFlag(params.is_delete ?? params.filter?.is_delete)
  return normalizeFilter({
    ...(params.filter ?? {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(favoriteFlag !== undefined ? { is_favorites: favoriteFlag } : {}),
    ...(params.createdBy ? { created_by: params.createdBy } : {}),
    ...(trashFlag !== undefined ? { is_delete: trashFlag } : {}),
  })
}

function buildSearchRequest(limit: number, offset: number, filter: Record<string, unknown>): Record<string, unknown> {
  return {
    param: {
      filter,
      fields: TEAMONES_AIGC_RECORD_FIELDS,
      page: [Math.floor(offset / limit) + 1, limit],
    },
  }
}

function matchesQuery(item: AssetItem, query?: string): boolean {
  const normalizedQuery = String(query ?? '').trim().toLowerCase()
  if (!normalizedQuery) return true
  const haystacks = [
    item.id, item.prompt, item.model, item.model_display_name, item.vendor,
    item.query_id, item.capability, ...item.tags,
  ]
  return haystacks.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
}

function normalizeStatusValue(value: number | string): string {
  const statusMap: Record<string, string> = {
    0: 'pending', 1: 'running', 2: 'completed', 3: 'failed', 4: 'cancelled',
  }
  return statusMap[String(value)] ?? String(value)
}

function matchesStatus(item: AssetItem, status?: number | number[]): boolean {
  if (status === undefined) return true
  const values = Array.isArray(status) ? status : [status]
  return values.map(normalizeStatusValue).includes(String(item.status ?? ''))
}

async function fetchSearchPage(
  limit: number,
  offset: number,
  includeCount: boolean,
  filter: Record<string, unknown>,
): Promise<AssetListResponse> {
  const normalizedFilter = normalizeFilter(filter)
  const listResponse = await client.post(
    TEAMONES_AIGC_RECORD_PATHS.list,
    buildSearchRequest(limit, offset, normalizedFilter),
  )
  assertTeamonesResponseSuccess(listResponse.data)
  const rawItems = extractTeamonesRecordItems(listResponse.data)
  const items = rawItems.map(normalizeTeamonesAigcRecord).filter((item): item is AssetItem => Boolean(item))
  let total = extractTeamonesCount(listResponse.data)
  if (includeCount) {
    try {
      const countResponse = await client.post(TEAMONES_AIGC_RECORD_PATHS.count, { param: { filter: normalizedFilter } })
      assertTeamonesResponseSuccess(countResponse.data)
      total = extractTeamonesCount(countResponse.data) || total
    } catch (error: unknown) {
      console.warn('[teamones-aigc-record-search] count failed, falling back to list total.', error)
    }
  }
  if (total <= 0) total = rawItems.length < limit ? offset + rawItems.length : offset + rawItems.length + 1
  return { total, items, limit, offset }
}

async function collectSearchItems(
  options: SearchOptions & { filter?: Record<string, unknown> },
): Promise<AssetListResponse> {
  const limit = Math.max(1, Math.min(options.limit, 100))
  const offset = Math.max(0, options.offset)
  const pageSize = Math.min(Math.max(limit, 50), 100)
  const targetEnd = offset + limit
  const matched: AssetItem[] = []
  let rawOffset = 0
  let total = 0
  let iterations = 0
  while (iterations < 8) {
    const page = await fetchSearchPage(pageSize, rawOffset, rawOffset === 0, options.filter ?? {})
    total = rawOffset === 0 ? page.total : total
    matched.push(...page.items.filter((item) => (
      (!options.type || item.type === options.type)
      && matchesQuery(item, options.query)
      && (options.is_favorites === undefined || item.is_favorites === options.is_favorites)
      && matchesStatus(item, options.status)
    )))
    if (matched.length >= targetEnd || page.items.length < pageSize || rawOffset + page.items.length >= total) break
    rawOffset += page.items.length
    iterations += 1
  }
  const inferredTotal = rawOffset + pageSize >= total || matched.length < targetEnd
    ? matched.length
    : Math.max(matched.length, targetEnd + 1)
  return { total: inferredTotal, items: matched.slice(offset, targetEnd), limit, offset }
}

/**
 * 查询当前用户的 AIGC 记录总数。
 * @param filter Teamones 查询条件。
 * @returns 匹配记录数。
 * @throws Teamones 请求失败时抛出异常。
 */
export async function countTeamonesAigcRecords(filter: Record<string, unknown> = {}): Promise<number> {
  const response = await client.post(TEAMONES_AIGC_RECORD_PATHS.count, { param: { filter: normalizeFilter(filter) } })
  assertTeamonesResponseSuccess(response.data)
  return extractTeamonesCount(response.data)
}

/**
 * 查询当前用户的一页 AIGC 记录。
 * @param params 分页和筛选参数。
 * @returns 规范化后的记录分页。
 * @throws Teamones 请求失败时抛出异常。
 */
export function listTeamonesAigcRecords(
  params: TeamonesAigcRecordListParams = {},
): Promise<AssetListResponse> {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 100))
  const offset = Math.max(0, params.offset ?? 0)
  return fetchSearchPage(limit, offset, params.includeCount ?? offset === 0, buildFilter(params))
}

/**
 * 按资产列表参数查询 AIGC 记录。
 * @param params 资产列表筛选参数。
 * @returns 规范化后的记录分页。
 */
export function listAigcAssets(params: AssetListParams = {}): Promise<AssetListResponse> {
  return listTeamonesAigcRecords(params)
}

/**
 * 在分页 AIGC 记录上执行关键词筛选。
 * @param query 搜索关键词。
 * @param type 可选记录类型。
 * @param limit 页大小。
 * @param offset 结果偏移量。
 * @param isFavorites 可选收藏筛选。
 * @returns 规范化后的筛选结果。
 */
export function searchAigcAssets(
  query: string,
  type?: string,
  limit = 50,
  offset = 0,
  isFavorites?: boolean,
): Promise<AssetListResponse> {
  return collectSearchItems({
    query, type, limit, offset, is_favorites: isFavorites,
    filter: isFavorites === undefined ? undefined : { is_favorites: isFavorites },
  })
}
