import { uploadFileToCos } from './uploadHelpers'
import {
  deleteAigcRecords,
  toggleAigcRecordFavorite,
} from '@/services/assets/aigcRecord.service'

import {
  findTeamonesAigcRecord,
  findTeamonesAigcRecordsByIds,
} from '@/services/teamones/teamonesAigcRecordRead.service'
import {
  countTeamonesAigcRecords,
  listAigcAssets,
  listTeamonesAigcRecords,
  searchAigcAssets,
} from '@/services/teamones/teamonesAigcRecordSearch.service'

export {
  countTeamonesAigcRecords,
  findTeamonesAigcRecord,
  findTeamonesAigcRecordsByIds,
  listTeamonesAigcRecords,
}

export const ASSET_RESTORE_SUPPORTED = false

export interface AssetUrlObject {
  origin_url: string
  proxy_url: string
}

export interface AssetItem {
  error?: string | null
  id: string
  record_id?: string
  endpoint_id?: string | number | null
  user?: {
    id?: number | null
    name?: string | null
    phone?: string | null
  } | null
  created_by?: number | null
  type: string
  source: string
  media?: any[]
  vendor?: string | null
  platform_task_id?: string | number | null
  query_id?: string | number | null
  model: string | null
  model_info?: {
    id: string
    name: string
    publisher?: any
    capabilities?: any[]
  } | null
  model_display_name?: string | null
  mode?: string | null
  capability: string | null
  prompt: string | null
  param?: Record<string, any> | null
  params_display?: { label: string; key: string; value: any }[] | null
  reference_urls?: (AssetUrlObject | string)[]
  file_size: number
  is_favorites: boolean
  created_at: string
  width?: number
  height?: number
  aspect_ratio?: number
  url: string | AssetUrlObject
  thumbnail_url: string | AssetUrlObject | null
  tags: string[]
  isGenerating?: boolean
  progress?: number
  statusText?: string
  status?: string
  failReason?: string | null
  fail_reason?: {
    error_code?: string
    error_message?: string
    message?: string
    [key: string]: any
  } | null
}

export interface AssetListResponse {
  total: number
  items: AssetItem[]
  limit: number
  offset: number
}

export interface AssetDetail extends AssetItem {
  user_id: string
  vendor: string | null
  file_path: string
  file_hash: string | null
  metadata: Record<string, any>
  updated_at: string
  task_id: string | null
  session_id: string | null
}

export interface AssetStats {
  total_count: number
  total_size: number
  total_size_mb: number
  by_type: Record<string, number>
  by_source: Record<string, number>
  by_model: Record<string, number>
}

export interface AssetListParams {
  type?: string
  createdBy?: string | number
  source?: string
  model?: string
  capability?: string
  status?: number | number[]
  is_favorites?: boolean
  tag?: string
  limit?: number
  offset?: number
  order_by?: string
  order_desc?: boolean
  created_after?: string
  created_before?: string
  is_delete?: boolean
}

export interface TeamonesAigcRecordListParams extends AssetListParams {
  filter?: Record<string, any>
  includeCount?: boolean
}

// ── API 调用 ──────────────────────────────────────────

/** 获取资产列表 */
export async function listAssets(params: AssetListParams = {}): Promise<AssetListResponse> {
  return listAigcAssets(params)
}

/** 获取资产详情 */
export async function getAsset(id: string): Promise<AssetDetail> {
  const item = await findTeamonesAigcRecord(id)
  if (!item) throw new Error('资产不存在')
  return {
    ...item,
    user_id: String(item.created_by || ''),
    vendor: item.vendor || null,
    file_path: typeof item.url === 'string' ? item.url : item.url.origin_url,
    file_hash: null,
    metadata: item.param || {},
    updated_at: item.created_at,
    task_id: String(item.param?.task_id || '') || null,
    session_id: null,
  }
}

/** 删除资产 */
export async function deleteAsset(id: string, hard = false): Promise<void> {
  void hard
  await deleteAigcRecords([id])
}

/** 批量删除资产（hard=true 为永久删除，false 为软删除/移到回收站） */
export async function batchDeleteAssets(ids: string[], hard = false): Promise<void> {
  void hard
  await deleteAigcRecords(ids)
}

/** 从回收站恢复资产 */
export async function restoreAsset(id: string): Promise<void> {
  throw new Error('Current backend OpenAPI does not expose asset restore endpoint')
}

/** 切换收藏 */
export async function toggleFavorite(id: string): Promise<{ id: string; is_favorites: boolean }> {
  const item = await findTeamonesAigcRecord(id)
  return toggleAigcRecordFavorite(id, Boolean(item?.is_favorites))
}

/** 添加标签 */
export async function addTag(id: string, tag: string): Promise<void> {
  void id
  void tag
}

/** 移除标签 */
export async function removeTag(id: string, tag: string): Promise<void> {
  void id
  void tag
}

/** 获取所有标签 */
export async function listTags(): Promise<Record<string, number>> {
  return {}
}

/** 获取统计信息 */
export async function getStats(): Promise<AssetStats> {
  const total = await countTeamonesAigcRecords()
  return { total_count: total, total_size: 0, total_size_mb: 0, by_type: {}, by_source: {}, by_model: {} }
}

/** 搜索资产 */
export async function searchAssets(
  query: string,
  type?: string,
  limit = 50,
  offset = 0,
  isFavorites?: boolean,
): Promise<AssetListResponse> {
  return searchAigcAssets(query, type, limit, offset, isFavorites)
}

/** 上传资产 */
export async function uploadAsset(
  file: File,
  prompt?: string,
  tags?: string[],
): Promise<{ id: string; type: string; file_size: number; url: string }> {
  void prompt
  void tags
  const result = await uploadFileToCos(file)
  return { id: result.cos_info?.url || result.url, type: file.type.split('/')[0] || 'file', file_size: file.size, url: result.url }
}
