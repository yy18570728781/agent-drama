import { buildCosObjectUrl, uploadBlobToCosKey } from '@/api/cosDirect'
import { getStoredAuthScope, getStoredAuthUserInfo } from '@/api/tokenStorage'
import { getWorkflowAssetDetail } from '@/api/workflowAssets'
import type { TeamonesUserInfo } from '@/api/auth'
import type {
  FlowCanvasHistorySaveType,
  FlowCanvasHistoryVersion,
} from './flowCanvasHistory.types'

type UnknownRecord = Record<string, unknown>

interface FlowCanvasHistoryIndex {
  assetCode: string
  items: FlowCanvasHistoryVersion[]
  updatedAt: string
  version: 1
}

const NO_CACHE = 'no-cache, no-store, must-revalidate'
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeKeySegment(value: string): string {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function currentHistoryActor(): Pick<
  FlowCanvasHistoryVersion,
  'actorAvatar' | 'actorId' | 'actorName'
> {
  const authUserInfo = getStoredAuthUserInfo() as TeamonesUserInfo | null
  const user = authUserInfo?.user
  return {
    actorAvatar: String(user?.avatar || '').trim(),
    actorId: String(user?.id ?? getStoredAuthScope()?.userId ?? '').trim(),
    actorName: String(user?.name || '').trim(),
  }
}

function normalizeSaveType(value: unknown, label: string): FlowCanvasHistorySaveType {
  if (value === 'automatic' || value === 'create' || value === 'manual' || value === 'restore') {
    return value
  }
  if (label === '自动保存' || label === '切换子图时保存') return 'automatic'
  if (label.startsWith('还原自')) return 'restore'
  if (label === '创建' || label === '创建画布') return 'create'
  return 'unknown'
}

function historyRoot(assetCode: string): string {
  return `canvas/${safeKeySegment(assetCode)}/history`
}

function historyIndexKey(assetCode: string): string {
  return `${historyRoot(assetCode)}/index.json`
}

function noCacheUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_t=${Date.now()}`
}

function normalizeVersion(value: unknown): FlowCanvasHistoryVersion | null {
  if (!isRecord(value)) return null
  const revision = Number(value.revision)
  const id = String(value.id || '').trim()
  const objectKey = String(value.objectKey || '').trim()
  const label = String(value.label || '')
  if (!Number.isInteger(revision) || revision < 1 || !id || !objectKey) return null
  return {
    actorAvatar: String(value.actorAvatar ?? value.actor_avatar ?? ''),
    actorId: String(value.actorId ?? value.actor_id ?? ''),
    actorName: String(value.actorName ?? value.actor_name ?? ''),
    createdAt: String(value.createdAt || ''),
    id,
    label,
    objectKey,
    revision,
    saveType: normalizeSaveType(value.saveType ?? value.save_type, label),
  }
}

async function fetchJson(url: string): Promise<unknown | null> {
  const response = await fetch(noCacheUrl(url), { cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`画布历史记录加载失败（HTTP ${response.status}）`)
  return response.json()
}

async function loadHistoryIndex(assetCode: string): Promise<FlowCanvasHistoryVersion[]> {
  const raw = await fetchJson(buildCosObjectUrl(historyIndexKey(assetCode)))
  if (raw === null) return []
  if (!isRecord(raw) || !Array.isArray(raw.items)) throw new Error('画布历史索引格式无效')
  return raw.items
    .map(normalizeVersion)
    .filter((item): item is FlowCanvasHistoryVersion => item !== null)
    .sort((left, right) => right.revision - left.revision)
}

async function uploadJson(
  value: unknown,
  filename: string,
  objectKey: string,
  cacheControl: string,
): Promise<void> {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' })
  await uploadBlobToCosKey(blob, filename, objectKey, cacheControl)
}

/**
 * 解析画布资产对应的 COS 存储编码。
 * @param workflowId 画布资产 ID。
 * @returns 资产 code；历史资产缺失 code 时返回稳定兼容值。
 * @throws 画布资产不存在时抛出异常。
 */
export async function resolveFlowCanvasHistoryAssetCode(workflowId: string): Promise<string> {
  const raw = await getWorkflowAssetDetail(workflowId)
  if (!raw) throw new Error('工作流不存在')
  const asset = raw.asset || raw
  return String(raw.code ?? asset.code ?? '').trim() || `canvas_${workflowId}`
}

/**
 * 列出指定画布保存在 COS 的历史版本元数据。
 * @param assetCode 画布资产唯一编码。
 * @returns 按修订号倒序排列的版本列表。
 * @throws COS 历史索引不可读取或格式无效时抛出异常。
 */
export async function listFlowCanvasHistoryVersions(
  assetCode: string,
): Promise<FlowCanvasHistoryVersion[]> {
  return loadHistoryIndex(assetCode)
}

/**
 * 将新的画布历史版本及其索引写入 COS。
 * @param assetCode 画布资产唯一编码。
 * @param definition 当前已保存的画布 definition。
 * @param label 历史记录说明。
 * @param saveType 保存来源类型。
 * @returns 新创建的版本元数据。
 * @throws COS 历史读取或上传失败时抛出异常。
 */
export async function saveFlowCanvasHistoryVersion(
  assetCode: string,
  definition: UnknownRecord,
  label: string,
  saveType: FlowCanvasHistorySaveType = 'manual',
): Promise<FlowCanvasHistoryVersion> {
  const previous = await loadHistoryIndex(assetCode)
  const revision = (previous[0]?.revision || 0) + 1
  const createdAt = new Date().toISOString()
  const id = `r${revision}-${Date.now()}`
  const objectKey = `${historyRoot(assetCode)}/${id}.json`
  const entry: FlowCanvasHistoryVersion = {
    ...currentHistoryActor(),
    createdAt,
    id,
    label,
    objectKey,
    revision,
    saveType,
  }
  await uploadJson(
    { assetCode, ...entry, version: 1, workflowData: definition },
    `${id}.json`,
    objectKey,
    IMMUTABLE_CACHE,
  )
  const index: FlowCanvasHistoryIndex = {
    assetCode,
    items: [entry, ...previous],
    updatedAt: createdAt,
    version: 1,
  }
  await uploadJson(index, 'index.json', historyIndexKey(assetCode), NO_CACHE)
  return entry
}

/**
 * 读取指定 COS 历史版本中的画布 definition。
 * @param version 待读取的历史版本元数据。
 * @returns 历史版本保存的画布 definition。
 * @throws 版本文件缺失或内容无效时抛出异常。
 */
export async function loadFlowCanvasHistoryVersion(
  version: FlowCanvasHistoryVersion,
): Promise<UnknownRecord> {
  const raw = await fetchJson(buildCosObjectUrl(version.objectKey))
  if (!isRecord(raw) || !isRecord(raw.workflowData)) throw new Error('画布历史版本内容无效')
  return raw.workflowData
}
