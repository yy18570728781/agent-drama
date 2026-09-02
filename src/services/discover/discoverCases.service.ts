import type { FlowCaseRecord } from '@/api/flowCases'
import type { DiscoverCase } from '@/components/discover/discover.types'
import { getFlowCaseThumbnails, listFlowCases } from '@/api/flowCases'
import { buildTeamonesUrl } from '@/api/teamonesClient'

type UnknownRecord = Record<string, unknown>

export interface LoadDiscoverCasesOptions {
  assetIds?: readonly string[]
  categoryId?: string
  categoryName?: string
  keyword?: string
  page?: number
  pageSize?: number
  permission?: number
}

export interface DiscoverCasePage {
  hasMore: boolean
  items: DiscoverCase[]
}

const DEFAULT_CASE_PAGE_SIZE = 24

/**
 * 将分页案例按 ID 合并，避免重复卡片。
 * @param current 已展示案例。
 * @param incoming 新加载案例。
 * @returns 保持分页顺序的去重案例列表。
 */
export function mergeDiscoverCasePages(
  current: DiscoverCase[],
  incoming: DiscoverCase[],
): DiscoverCase[] {
  const casesById = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => casesById.set(item.id, item))
  return [...casesById.values()]
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseRecord(value: unknown): UnknownRecord {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readText(source: unknown, keys: readonly string[]): string {
  if (!isRecord(source)) return ''
  for (const key of keys) {
    const value = source[key]
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ''
}

function assetRecord(raw: FlowCaseRecord): UnknownRecord {
  return isRecord(raw.asset) ? raw.asset : raw
}

function caseId(raw: FlowCaseRecord): string {
  const asset = assetRecord(raw)
  return readText(raw, ['id']) || readText(asset, ['id'])
}

function rawCategoryName(raw: FlowCaseRecord): string {
  const asset = assetRecord(raw)
  const source = Array.isArray(raw.category) ? raw.category : asset.category
  const categories = Array.isArray(source) ? source.filter(isRecord) : []
  return readText(categories[categories.length - 1], ['name', 'label'])
}

function rawCategoryId(raw: FlowCaseRecord): string {
  const asset = assetRecord(raw)
  return readText(raw, ['category_id', 'asset_category_id'])
    || readText(asset, ['category_id', 'asset_category_id'])
}

function thumbnailUrl(raw: FlowCaseRecord, thumbnails: UnknownRecord): string {
  const entry = thumbnails[caseId(raw)]
  const path = typeof entry === 'string'
    ? entry
    : readText(entry, ['thumb', 'url', 'path']) || readText(raw, ['thumb'])
  return path ? buildTeamonesUrl(path) : ''
}

function normalizeCase(
  raw: FlowCaseRecord,
  thumbnails: UnknownRecord,
  options: LoadDiscoverCasesOptions,
): DiscoverCase | null {
  const asset = assetRecord(raw)
  const id = caseId(raw)
  if (!id) return null
  const content = parseRecord(raw.content ?? asset.content)
  const title = readText(raw, ['name']) || readText(asset, ['name']) || '未命名案例'
  const cover = thumbnailUrl(raw, thumbnails)
  const isVideo = /\.(mp4|webm|ogg)(?:\?|$)/i.test(cover)
  return {
    categoryId: options.categoryId || rawCategoryId(raw),
    id,
    featured: false,
    image: isVideo ? '' : cover,
    imageAlt: `${title}案例封面`,
    video: isVideo ? cover : undefined,
    title,
    description: readText(content, ['description']) || '打开案例，查看完整创作过程',
    author: readText(content, ['author'])
      || readText(raw, ['user_name', 'created_by_name', 'creator_name'])
      || 'AI-Comic-Director-Canvas 用户',
    authorAvatar: readText(content, ['authorAvatar', 'author_avatar'])
      || readText(raw, ['user_avatar', 'avatar'])
      || undefined,
    category: options.categoryName || rawCategoryName(raw),
    likes: readText(content, ['likes', 'likeCount'])
      || readText(raw, ['favorites_count', 'like_count'])
      || undefined,
    permission: options.permission ?? 0,
    prompt: '',
  }
}

/**
 * 分页加载发现页案例，并补齐缩略图和展示字段。
 * @param options 分页参数、可选案例 ID、分类信息与当前用户权限。
 * @returns 当前页案例及是否可能存在下一页。
 * @throws 案例列表接口不可用时抛出异常；缩略图失败时保留空封面。
 */
export async function loadDiscoverCases(
  options: LoadDiscoverCasesOptions = {},
): Promise<DiscoverCasePage> {
  const pageSize = options.pageSize ?? DEFAULT_CASE_PAGE_SIZE
  const records = await listFlowCases({
    assetIds: options.assetIds,
    categoryId: options.categoryId,
    keyword: options.keyword,
    page: options.page ?? 1,
    pageSize,
  })
  const thumbnails = await getFlowCaseThumbnails(records.map(caseId).filter(Boolean))
    .catch(() => ({}))
  return {
    hasMore: records.length === pageSize,
    items: records
      .map((item) => normalizeCase(item, thumbnails, options))
      .filter((item): item is DiscoverCase => !!item),
  }
}
