import teamonesClient from './teamonesClient'
import { invalidateWorkflowAssetDetail } from './workflowAssetDetails'
import {
  deleteLocalWorkflow,
  isLocalWorkflowId,
  toggleLocalWorkflowFavorite,
  updateLocalWorkflow,
} from '@/services/flow/localFlowLibrary.service'

export { getWorkflowAssetDetail } from './workflowAssetDetails'
export {
  changeWorkflowAssetCover,
  removeWorkflowAssetMedia,
  updateWorkflowAssetMedia,
} from './workflowAssetMediaMutations'

type UnknownRecord = Record<string, unknown>

export interface WorkflowAssetRecord {
  id?: number | string
  name?: string
  code?: string
  cover?: number | string | null
  category_id?: number | string
  categoryId?: number | string
  asset_category_id?: number | string
  category?: Array<{ id?: number | string; name?: string }>
  content?: unknown
  fields?: { content?: unknown }
  media?: unknown
  updated?: string
  updated_at?: string
  created?: string
  created_at?: string
  asset?: WorkflowAssetRecord
}

export interface WorkflowAssetMediaRecord extends UnknownRecord {
  id?: number | string
  is_cover?: number | string
  media_id?: number | string
  md5_name?: string
  thumb?: string
}

const CANVAS_CATEGORY_TYPE = 11
const PAGE_SIZE = 200

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  const axiosData = isRecord(value.data) ? value.data : value
  return isRecord(axiosData) && 'data' in axiosData ? axiosData.data : axiosData
}

function unwrapItems(value: unknown): WorkflowAssetRecord[] {
  const payload = unwrap(value)
  if (Array.isArray(payload)) return payload as WorkflowAssetRecord[]
  if (!isRecord(payload)) return []
  const items = payload.items ?? payload.data
  return Array.isArray(items) ? items as WorkflowAssetRecord[] : []
}

/**
 * 查询画布资产记录。
 * @param filter Teamones 资产筛选条件。
 * @returns 匹配的画布资产列表。
 * @throws 资产服务不可用时抛出请求异常。
 */
export async function queryWorkflowAssets(
  filter: UnknownRecord = {},
): Promise<WorkflowAssetRecord[]> {
  const response = await teamonesClient.post('/api_assets/asset/get_list', {
    param: {
      filter,
      category_type: CANVAS_CATEGORY_TYPE,
      extend_fields: 'asset.content,asset.media',
      page: [1, PAGE_SIZE],
    },
  })
  return unwrapItems(response)
}

/**
 * 在指定资料库文件夹中创建画布资产元数据。
 * @param name 画布名称。
 * @param code 画布唯一编码。
 * @param categoryId 目标文件夹 ID；为空时兼容旧的自动分类入口。
 * @param content 资产内容元数据。
 * @returns 创建后的原始资产记录。
 * @throws 创建失败或响应中缺少资产 ID 时抛出异常。
 */
export async function createWorkflowAsset(
  name: string,
  code: string,
  categoryId: string,
  content: UnknownRecord,
): Promise<WorkflowAssetRecord> {
  const endpoint = categoryId
    ? '/api_assets/asset/create'
    : '/api_assets/asset/create_asset_and_category'
  const data = categoryId
    ? { asset: { name, code, content }, category_id: categoryId }
    : { asset: { name, code, content }, category_type: CANVAS_CATEGORY_TYPE }
  const response = await teamonesClient.post(endpoint, { _isNotCancel: true, isThrowError: 'yes', data })
  const created = unwrap(response)
  if (!isRecord(created) || !String(created.id ?? '').trim()) {
    throw new Error('画布资产创建成功但未返回资产 ID')
  }
  return created as WorkflowAssetRecord
}

/**
 * 更新画布资产名称，并在迁移场景下清理旧的内联 content。
 * @param assetId 画布资产 ID。
 * @param name 画布名称。
 * @param content 可选的资产类型元数据；普通更新不传，避免重复覆盖 content。
 * @returns 无返回值。
 * @throws 更新接口失败时抛出请求异常。
 */
export async function updateWorkflowAsset(
  assetId: string,
  name: string,
  content?: UnknownRecord,
): Promise<void> {
  if (isLocalWorkflowId(assetId)) {
    void content
    updateLocalWorkflow(assetId, { name })
    return
  }

  const asset: UnknownRecord = { id: Number(assetId), name }
  if (content) asset.content = content
  await teamonesClient.post('/api_assets/asset/update', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { asset },
  })
  invalidateWorkflowAssetDetail(assetId)
}

/**
 * 查询画布资产已绑定的媒体列表。
 * @param assetId 画布资产 ID。
 * @returns 资产媒体记录。
 * @throws 媒体查询接口失败时抛出请求异常。
 */
export async function queryWorkflowAssetMedia(assetId: string): Promise<WorkflowAssetMediaRecord[]> {
  const response = await teamonesClient.post('/api_assets/asset/get_asset_media', {
    _isNotCancel: true,
    isThrowError: 'yes',
    param: { asset_id: Number(assetId) },
  })
  return unwrapItems(response) as WorkflowAssetMediaRecord[]
}

/**
 * 删除画布资产。
 * @param assetId 画布资产 ID。
 * @returns 删除接口的业务数据。
 * @throws 删除接口失败时抛出请求异常。
 */
export async function deleteWorkflowAsset(assetId: string): Promise<unknown> {
  if (isLocalWorkflowId(assetId)) {
    deleteLocalWorkflow(assetId)
    return null
  }

  const response = await teamonesClient.post('/api_assets/asset/delete', {
    isThrowError: 'yes',
    param: { filter: { id: ['in', [Number(assetId)]] } },
  })
  invalidateWorkflowAssetDetail(assetId)
  return unwrap(response)
}

/**
 * 切换画布资产的收藏状态。
 * @param assetId 画布资产 ID。
 * @returns 无返回值。
 * @throws 收藏接口返回业务错误时抛出异常。
 */
export async function toggleWorkflowAssetFavorite(assetId: string): Promise<void> {
  if (isLocalWorkflowId(assetId)) {
    toggleLocalWorkflowFavorite(assetId)
    return
  }

  const response = await teamonesClient.post('/api_assets/favorites/change', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { asset_id: Number(assetId) },
  })
  const payload = response.data as { code?: number }
  if (typeof payload?.code === 'number' && payload.code !== 0) {
    throw new Error(`收藏操作失败（${payload.code}）`)
  }
  invalidateWorkflowAssetDetail(assetId)
}
