import teamonesClient from './teamonesClient'

type RawRecord = Record<string, unknown>

export const FLOW_CASE_CATEGORY_TYPE = 14

export interface FlowCaseCategory {
  id: string
  name: string
  permission: number
  pid: string
}

export interface FlowCaseAsset {
  code: string
  id: string
}

export type FlowCaseRecord = Record<string, unknown>

export interface FlowCaseListQuery {
  assetIds?: readonly string[]
  categoryId?: string
  keyword?: string
  page: number
  pageSize: number
}

function isRecord(value: unknown): value is RawRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function responseBody(response: unknown): RawRecord {
  if (!isRecord(response)) return {}
  return isRecord(response.data) ? response.data : response
}

function responseItems(response: unknown): RawRecord[] {
  const body = responseBody(response)
  const data = body.data
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  const items = data.items ?? data.rows ?? data.list
  return Array.isArray(items) ? items.filter(isRecord) : []
}

function assertSuccess(response: unknown, action: string): RawRecord {
  const body = responseBody(response)
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new Error(`${action}失败（${body.code}）`)
  }
  return body
}

function normalizeCategory(raw: RawRecord, fallbackPid = ''): FlowCaseCategory | null {
  const id = String(raw.id ?? '').trim()
  if (!id) return null
  const permission = Number(raw.permission ?? 0)
  return {
    id,
    name: String(raw.name ?? raw.label ?? '').trim() || '未命名目录',
    permission: Number.isFinite(permission) ? permission : 0,
    pid: String(raw.pid ?? fallbackPid).trim(),
  }
}

function normalizeCategoryTree(items: RawRecord[], fallbackPid = ''): FlowCaseCategory[] {
  return items.flatMap((raw) => {
    const category = normalizeCategory(raw, fallbackPid)
    if (!category) return []
    const children = Array.isArray(raw.children) ? raw.children.filter(isRecord) : []
    return [category, ...normalizeCategoryTree(children, category.id)]
  })
}

/**
 * 分页读取发现页使用的 AI 画布案例。
 * @param query 分页参数、可选案例 ID 集合及服务端分类 ID。
 * @returns category_type 为 14 的原始案例记录。
 * @throws 案例列表接口不可用或返回业务错误时抛出异常。
 */
export async function listFlowCases(query: FlowCaseListQuery): Promise<FlowCaseRecord[]> {
  const filter: RawRecord = {}
  const keyword = query.keyword?.trim() || ''
  if (query.assetIds?.length) filter['asset.id'] = ['-in', [...query.assetIds]]
  if (keyword) filter['asset.name'] = ['-lk', `%${keyword}%`]
  const categoryId = Number(query.categoryId)
  const param: RawRecord = {
    category_type: FLOW_CASE_CATEGORY_TYPE,
    extend_fields: 'asset.content,asset.media',
    fields: 'asset.id,asset.name,asset.code,asset.user_id,asset.created,asset.updated,asset.content,asset.category_id',
    filter,
    page: [query.page, query.pageSize],
  }
  if (query.categoryId) {
    param.category_id = Number.isFinite(categoryId) ? categoryId : query.categoryId
  }
  const response = await teamonesClient.post('/api_assets/asset/get_list', {
    _isNotCancel: true,
    isThrowError: 'yes',
    param,
  })
  assertSuccess(response, '案例列表加载')
  return responseItems(response)
}

/**
 * 批量读取案例封面缩略图。
 * @param assetIds 案例资产 ID。
 * @returns 以资产 ID 为键的缩略图响应映射。
 * @throws 缩略图接口不可用或返回业务错误时抛出异常。
 */
export async function getFlowCaseThumbnails(
  assetIds: readonly string[],
): Promise<Record<string, unknown>> {
  if (!assetIds.length) return {}
  const response = await teamonesClient.post('/api_assets/asset/get_asset_thumb', {
    _isNotCancel: true,
    isThrowError: 'yes',
    param: { asset_ids: [...assetIds] },
  })
  const body = assertSuccess(response, '案例封面加载')
  return isRecord(body.data) ? body.data : {}
}

/**
 * 读取资产后台配置的发现页推荐案例顺序。
 * @returns 推荐案例资产 ID，顺序与后台轮播配置一致。
 * @throws 推荐配置接口不可用或返回业务错误时抛出异常。
 */
export async function getFlowCaseCarouselIds(): Promise<string[]> {
  const response = await teamonesClient.post('/api_assets/asset/get_carousel_config', {
    _isNotCancel: true,
    param: { type: 'ai_cavans' },
  })
  const body = assertSuccess(response, '推荐案例加载')
  return Array.isArray(body.data)
    ? body.data.map((id) => String(id).trim()).filter(Boolean)
    : []
}

/**
 * 保存发现页推荐案例的完整顺序。
 * @param assetIds 推荐案例资产 ID，数组顺序即轮播展示顺序。
 * @returns 保存完成后无返回值。
 * @throws 推荐配置接口不可用或返回业务错误时抛出异常。
 */
export async function saveFlowCaseCarouselIds(assetIds: readonly string[]): Promise<void> {
  const config = assetIds.map((id) => {
    const numericId = Number(id)
    return Number.isFinite(numericId) ? numericId : id
  })
  const response = await teamonesClient.post('/api_assets/asset/save_carousel_config', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { type: 'ai_cavans', config },
  })
  assertSuccess(response, '推荐配置保存')
}

/**
 * 读取案例大分类下的目录，分类类型固定为 14。
 * @returns 当前用户可见的案例分类列表。
 * @throws 分类接口不可用或返回业务错误时抛出异常。
 */
export async function listFlowCaseCategories(): Promise<FlowCaseCategory[]> {
  const response = await teamonesClient.post('/api_assets/category/get_category_list', {
    _isNotCancel: true,
    param: { filter: { type: FLOW_CASE_CATEGORY_TYPE } },
  })
  assertSuccess(response, '案例目录加载')
  return normalizeCategoryTree(responseItems(response))
}

/**
 * 在案例目录中创建一个独立画布资产。
 * @param name 案例名称。
 * @param code 案例资产唯一编码。
 * @param categoryId category_type 为 14 的目标目录 ID。
 * @returns 新建案例资产的 ID 与编码。
 * @throws 创建接口失败或未返回资产 ID 时抛出异常。
 */
export async function createFlowCaseAsset(
  name: string,
  code: string,
  categoryId: string,
): Promise<FlowCaseAsset> {
  const response = await teamonesClient.post('/api_assets/asset/create', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: {
      asset: { name, code, content: { assetType: 'canvas' } },
      category_id: categoryId,
    },
  })
  const body = assertSuccess(response, '案例发布')
  const rawData = isRecord(body.data) ? body.data : {}
  const asset = isRecord(rawData.asset) ? rawData.asset : rawData
  const id = String(asset.id ?? '').trim()
  if (!id) throw new Error('案例资产创建成功但未返回资产 ID')
  return { code: String(asset.code ?? code).trim() || code, id }
}
