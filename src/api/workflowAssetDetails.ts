import teamonesClient from './teamonesClient'
import type { WorkflowAssetRecord } from './workflowAssets'

type UnknownRecord = Record<string, unknown>

const ASSET_DETAIL_CACHE_TTL_MS = 5_000
const assetDetailCache = new Map<string, { expiresAt: number; value: WorkflowAssetRecord | null }>()
const assetDetailRequests = new Map<string, Promise<WorkflowAssetRecord | null>>()

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  const axiosData = isRecord(value.data) ? value.data : value
  return isRecord(axiosData) && 'data' in axiosData ? axiosData.data : axiosData
}

function requestAssetDetail(
  cacheKey: string,
  filterId: number | string,
): Promise<WorkflowAssetRecord | null> {
  const request = teamonesClient.post('/api_assets/asset/get_detail', {
      _isNotCancel: true,
      isThrowError: 'yes',
      param: { filter: { id: filterId } },
    })
    .then((response) => {
      const payload = response.data as { code?: number }
      if (typeof payload?.code === 'number' && payload.code !== 0) {
        throw new Error(`画布详情加载失败（${payload.code}）`)
      }
      const detail = unwrap(response)
      const value = isRecord(detail) ? detail as WorkflowAssetRecord : null
      assetDetailCache.set(cacheKey, { expiresAt: Date.now() + ASSET_DETAIL_CACHE_TTL_MS, value })
      return value
    })
    .finally(() => {
      assetDetailRequests.delete(cacheKey)
    })
  assetDetailRequests.set(cacheKey, request)
  return request
}

/**
 * 获取单个画布资产详情，并合并同资产的并发与短时间重复请求。
 * @param assetId 画布资产 ID。
 * @returns 画布资产详情；接口未返回记录时为 null。
 * @throws 资产详情接口返回业务错误时抛出异常。
 */
export function getWorkflowAssetDetail(assetId: string): Promise<WorkflowAssetRecord | null> {
  const cacheKey = String(assetId).trim()
  const cached = assetDetailCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
  const pending = assetDetailRequests.get(cacheKey)
  if (pending) return pending

  const numericId = Number(assetId)
  const filterId = Number.isFinite(numericId) ? numericId : assetId
  return requestAssetDetail(cacheKey, filterId)
}

/**
 * 资产写入后清除详情短缓存，避免后续读取旧元数据。
 * @param assetId 已发生变更的画布资产 ID。
 * @returns 无返回值。
 */
export function invalidateWorkflowAssetDetail(assetId: string): void {
  assetDetailCache.delete(String(assetId).trim())
}
