import client from '@/api/teamonesClient'
import { TEAMONES_AIGC_RECORD_PATHS } from '@/api/aigcRecord.constants'
import { normalizeBinaryFlag } from '@/utils/binaryFlag'

type AigcRecordId = string | number

export interface UpdateAigcRecordPayload {
  id: AigcRecordId
  status?: string | number
  link_id?: number
  link_type?: string
  project_id?: number
  fail_reason?: Record<string, unknown>
  media?: Record<string, unknown>
  is_favorites?: boolean
  is_delete?: boolean
}

function toRecordId(id: AigcRecordId): number {
  const recordId = Number(id)
  if (!Number.isFinite(recordId)) {
    throw new Error(`Invalid AIGC record id: ${String(id)}`)
  }
  return recordId
}

function normalizeUpdatePayload(payload: UpdateAigcRecordPayload): Record<string, unknown> {
  const { is_favorites: favorite, is_delete: deleted, ...fields } = payload
  const favoriteFlag = normalizeBinaryFlag(favorite)
  const deletedFlag = normalizeBinaryFlag(deleted)
  return {
    ...fields,
    id: toRecordId(payload.id),
    ...(favoriteFlag !== undefined ? { is_favorites: favoriteFlag } : {}),
    ...(deletedFlag !== undefined ? { is_delete: deletedFlag } : {}),
  }
}

/**
 * 统一走 Teamones 记录删除接口，避免资产页继续落回旧资产删除接口。
 * @param ids AIGC 记录 id 列表
 * @returns 服务端返回的删除数量
 */
export async function deleteAigcRecords(ids: AigcRecordId[]): Promise<number> {
  const payload = { data: { ids: ids.map(toRecordId) } }
  const { data } = await client.post(TEAMONES_AIGC_RECORD_PATHS.delete, payload)
  return Number(data?.data ?? 0)
}

/**
 * 收藏等轻量字段统一走 Teamones 更新接口，保持和服务端字段口径一致。
 * @param payload 更新请求体
 * @returns 服务端原始 data 字段
 */
export async function updateAigcRecord(payload: UpdateAigcRecordPayload): Promise<unknown> {
  const requestData = normalizeUpdatePayload(payload)
  const { data } = await client.post(TEAMONES_AIGC_RECORD_PATHS.update, { data: requestData })
  return data?.data
}

/**
 * 收藏态不依赖服务端回读，直接按当前值反转后返回给 UI，避免多一次请求。
 * @param id AIGC 记录 id
 * @param isFavorited 当前收藏状态
 * @returns 前端可直接消费的新收藏状态
 */
export async function toggleAigcRecordFavorite(
  id: AigcRecordId,
  isFavorited: boolean,
): Promise<{ id: string; is_favorites: boolean }> {
  const nextFavorite = !isFavorited
  await updateAigcRecord({ id, is_favorites: nextFavorite })
  return {
    id: String(id),
    is_favorites: nextFavorite,
  }
}

/**
 * 批量收藏/取消收藏统一走用户态批量接口。
 * @param ids AIGC 记录 id 列表
 * @param isFavorited 目标收藏状态
 */
export async function setAigcRecordsFavorite(
  ids: AigcRecordId[],
  isFavorited: boolean,
): Promise<void> {
  const payload = {
    data: {
      ids: ids.map(toRecordId),
      is_favorites: isFavorited,
    },
  }
  await Promise.all(payload.data.ids.map((id) => updateAigcRecord({ id, is_favorites: isFavorited })))
}

/**
 * Restores a soft-deleted AIGC record from the trash view.
 * @param id AIGC record id
 */
export async function restoreAigcRecord(id: AigcRecordId): Promise<void> {
  const recordId = toRecordId(id)
  await updateAigcRecord({ id: recordId, is_delete: false })
}
