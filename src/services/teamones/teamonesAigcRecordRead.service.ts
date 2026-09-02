import type { AssetItem } from '@/api/assets'
import { TEAMONES_AIGC_RECORD_FIELDS, TEAMONES_AIGC_RECORD_PATHS } from '@/api/aigcRecord.constants'
import client from '@/api/teamonesClient'
import { createAigcRecordDetailCache } from '@/services/teamones/aigcRecordDetailCache.service'
import {
  assertTeamonesResponseSuccess,
  extractTeamonesRecord,
  extractTeamonesRecordItems,
  normalizeTeamonesAigcRecord,
} from '@/utils/teamonesAigcRecordNormalize'

const detailCache = createAigcRecordDetailCache<AssetItem>(30_000)

async function fetchTeamonesAigcRecordDetail(recordId: number): Promise<AssetItem | null> {
  const response = await client.post(TEAMONES_AIGC_RECORD_PATHS.detail, {
    param: { filter: { id: recordId }, fields: TEAMONES_AIGC_RECORD_FIELDS },
  })
  assertTeamonesResponseSuccess(response.data)
  const record = extractTeamonesRecord(response.data)
  const item = record ? normalizeTeamonesAigcRecord(record) : null
  detailCache.write(recordId, item)
  return item
}

/**
 * 按记录 ID 查询一条 AIGC 记录。
 * @param recordId Teamones 记录 ID。
 * @returns 规范化记录；未找到时返回 null。
 * @throws Teamones 请求失败时抛出异常。
 */
export async function findTeamonesAigcRecord(recordId: string | number): Promise<AssetItem | null> {
  const parsedRecordId = Number(recordId)
  if (!Number.isFinite(parsedRecordId)) return null
  const cached = detailCache.read(parsedRecordId)
  if (cached !== undefined) return cached
  const pending = detailCache.getRequest(parsedRecordId)
  if (pending) return pending
  const request = fetchTeamonesAigcRecordDetail(parsedRecordId)
    .finally(() => detailCache.deleteRequest(parsedRecordId))
  detailCache.setRequest(parsedRecordId, request)
  return request
}

/**
 * 按记录 ID 列表批量查询 AIGC 记录。
 * @param recordIds Teamones 记录 ID 列表。
 * @returns 找到的规范化记录。
 * @throws Teamones 请求失败时抛出异常。
 */
export async function findTeamonesAigcRecordsByIds(recordIds: number[]): Promise<AssetItem[]> {
  if (!recordIds.length) return []
  const response = await client.post(TEAMONES_AIGC_RECORD_PATHS.list, {
    param: {
      filter: { id: ['-in', recordIds] },
      fields: TEAMONES_AIGC_RECORD_FIELDS,
      page: [1, Math.min(recordIds.length, 50)],
    },
  })
  assertTeamonesResponseSuccess(response.data)
  const items = extractTeamonesRecordItems(response.data)
    .map(normalizeTeamonesAigcRecord)
    .filter((item): item is AssetItem => Boolean(item))
  items.forEach((item) => {
    const id = Number(item.record_id || item.id)
    if (Number.isFinite(id)) detailCache.write(id, item)
  })
  return items
}
