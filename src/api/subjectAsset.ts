import teamonesClient from './teamonesClient'

const SUBJECT_CATEGORY_TYPE = 9
const ASSET_API_PREFIX = '/api_assets/asset'

export interface RawAssetMediaMeta { cover?: string | number | null; [key: string]: unknown }
export interface RawAsset {
  id: number | string
  name: string
  code: string
  content: Record<string, unknown> | string
  category_id?: number | string
  user_id?: number | string
  created?: string
  updated?: string
  media?: RawAssetMediaMeta
  thumb?: string | null
  cover_media_type?: string
  cover_media_url?: string
  [key: string]: unknown
}
export interface RawMedia {
  id: number | string
  type?: string
  thumb?: string
  path?: string
  is_cover?: string | number
  width?: number
  height?: number
  md5?: string
  md5_name?: string
  ext?: string
  file_size?: number
  duration?: string
}
export interface RawThumbEntry {
  thumb?: string
  type?: string
  media_type?: string
  path?: string
  url?: string
  [key: string]: unknown
}
export interface AssetFilter { [key: string]: unknown }

type SubjectQueryResponse = { items: RawAsset[]; total: number | null; page: number; page_size: number }
type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  const axiosData = isRecord(value.data) ? value.data : value
  return isRecord(axiosData) && 'data' in axiosData ? axiosData.data : axiosData
}

function rows(value: unknown): RawAsset[] {
  const payload = unwrap(value)
  if (Array.isArray(payload)) return payload as RawAsset[]
  if (!isRecord(payload)) return []
  const valueRows = payload.items ?? payload.data
  return Array.isArray(valueRows) ? valueRows as RawAsset[] : []
}

function genCode(group: string): string {
  return `${group || 'tongyong'}_${Math.random().toString(36).slice(2, 10)}`
}

function extractKeyword(filter?: AssetFilter): string | undefined {
  const candidate = filter?.['asset.name'] ?? filter?.name
  return Array.isArray(candidate) && typeof candidate[1] === 'string'
    ? candidate[1].replace(/^%+|%+$/g, '').trim() || undefined
    : undefined
}

async function querySubjects(page: number, pageSize: number, filter?: AssetFilter, categoryId?: number): Promise<SubjectQueryResponse> {
  const effectiveFilter: UnknownRecord = { ...(filter || {}) }
  const keyword = extractKeyword(filter)
  if (keyword) effectiveFilter['asset.name'] = ['-lk', `%${keyword}%`]
  const response = await teamonesClient.post(`${ASSET_API_PREFIX}/get_list`, {
    param: {
      filter: effectiveFilter,
      category_id: categoryId,
      category_type: SUBJECT_CATEGORY_TYPE,
      extend_fields: 'asset.content,asset.media',
      page: [page, pageSize],
    },
  })
  const items = rows(response)
  const payload = unwrap(response)
  const totalCandidate = isRecord(payload) ? payload.total ?? payload.count : undefined
  const parsedTotal = Number(totalCandidate)
  const total = totalCandidate !== undefined && Number.isFinite(parsedTotal) ? parsedTotal : null
  return { items, total, page, page_size: pageSize }
}

export const subjectAssetApi = {
  async getCount(filter?: AssetFilter, categoryId?: number): Promise<number> {
    const result = await querySubjects(1, 1, filter, categoryId)
    return result.total ?? result.items.length
  },

  /**
   * 查询一页主体及其总数。
   * @param page 页码。
   * @param pageSize 每页数量。
   * @param filter 主体过滤条件。
   * @param categoryId 分类 ID。
   * @returns 当前页主体和接口返回的总数。
   * @throws 列表请求失败时抛出异常。
   */
  async getPage(page: number, pageSize: number, filter?: AssetFilter, categoryId?: number): Promise<SubjectQueryResponse> {
    return querySubjects(page, pageSize, filter, categoryId)
  },

  async getList(page: number, pageSize: number, filter?: AssetFilter, categoryId?: number): Promise<RawAsset[]> {
    return (await querySubjects(page, pageSize, filter, categoryId)).items
  },

  async getDetail(id: number | string): Promise<RawAsset | null> {
    const response = await teamonesClient.post(`${ASSET_API_PREFIX}/get_detail`, {
      param: { filter: { id: Number(id) } },
    })
    const payload = unwrap(response)
    return isRecord(payload) ? payload as RawAsset : null
  },

  async getMedia(id: number | string): Promise<RawMedia[]> {
    const response = await teamonesClient.post(`${ASSET_API_PREFIX}/get_asset_media`, {
      param: { asset_id: Number(id) },
    })
    const payload = unwrap(response)
    if (Array.isArray(payload)) return payload as RawMedia[]
    if (!isRecord(payload)) return []
    const media = payload.items ?? payload.data
    return Array.isArray(media) ? media as RawMedia[] : []
  },

  async getThumbs(ids: (number | string)[]): Promise<Record<string, string | RawThumbEntry>> {
    if (!ids.length) return {}
    const response = await teamonesClient.post(`${ASSET_API_PREFIX}/get_asset_thumb`, {
      param: { asset_ids: ids.map(Number) },
    })
    return (unwrap(response) || {}) as Record<string, string | RawThumbEntry>
  },

  async create(name: string, code: string, content: UnknownRecord, categoryId?: number): Promise<{ id: string }> {
    const endpoint = categoryId
      ? `${ASSET_API_PREFIX}/create`
      : `${ASSET_API_PREFIX}/create_asset_and_category`
    const data = categoryId
      ? { asset: { name, code, content }, category_id: categoryId }
      : { asset: { name, code, content }, category_type: SUBJECT_CATEGORY_TYPE }
    const response = await teamonesClient.post(endpoint, { data })
    const payload = unwrap(response) as { id?: number | string }
    return { id: String(payload?.id ?? '') }
  },

  async update(id: number | string, name: string, content: UnknownRecord): Promise<void> {
    await teamonesClient.post(`${ASSET_API_PREFIX}/update`, {
      data: { asset: { id: Number(id), name, content } },
    })
  },

  async del(id: number | string): Promise<void> {
    await teamonesClient.post(`${ASSET_API_PREFIX}/delete`, {
      param: { filter: { id: ['in', [Number(id)]] } },
    })
  },

  async attachMedia(assetId: number | string, mediaItem: UnknownRecord): Promise<void> {
    await teamonesClient.post(`${ASSET_API_PREFIX}/add_asset_media`, {
      data: { asset_id: Number(assetId), media: [mediaItem] },
    })
  },

  async detachMedia(assetId: number | string, mediaId: number | string): Promise<void> {
    await teamonesClient.post(`${ASSET_API_PREFIX}/update_asset_media`, {
      data: { asset_id: Number(assetId), media: { add: [], delete: [Number(mediaId)] } },
    })
  },

  async changeCover(assetId: number | string, mediaId: number | string): Promise<void> {
    await teamonesClient.post(`${ASSET_API_PREFIX}/change_asset_cover`, {
      data: { asset_id: Number(assetId), media_id: Number(mediaId) },
    })
  },

  genCode,

}
