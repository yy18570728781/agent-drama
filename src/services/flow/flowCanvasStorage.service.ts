import { buildCosObjectUrl, uploadBlobToCosKey } from '@/api/cosDirect'

type UnknownRecord = Record<string, unknown>

interface FlowCanvasSnapshot extends UnknownRecord {
  assetCode: string
  updatedAt: number
  version: 1
  workflowData: UnknownRecord
}

export interface FlowCanvasDefinitionLoadResult {
  definition: UnknownRecord
  needsCosMigration: boolean
  shouldCleanAssetContent: boolean
}

const NO_CACHE = 'no-cache, no-store, must-revalidate'

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

function safeKeySegment(value: string): string {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function snapshotKey(assetCode: string): string {
  return `canvas/${safeKeySegment(assetCode)}/snapshot.json`
}

function storageOf(content: UnknownRecord): UnknownRecord | null {
  return isRecord(content.storage) ? content.storage : null
}

function isInlineDefinition(content: UnknownRecord): boolean {
  return Array.isArray(content.nodes) && Array.isArray(content.edges)
}

function inlineDefinitionOf(content: UnknownRecord): UnknownRecord | null {
  if (isInlineDefinition(content)) return content
  if (isRecord(content.workflowData) && isInlineDefinition(content.workflowData)) {
    return content.workflowData
  }
  if (isRecord(content.definition) && isInlineDefinition(content.definition)) {
    return content.definition
  }
  return null
}

function noCacheUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_t=${Date.now()}`
}

/**
 * 将画布 definition 写入 AIGC COS 的稳定快照文件。
 * @param assetCode 画布资产唯一编码。
 * @param definition 规范化后的画布 definition。
 * @returns 快照上传完成后无返回值。
 * @throws COS 凭证获取或上传失败时抛出异常。
 */
export async function saveFlowCanvasDefinition(
  assetCode: string,
  definition: UnknownRecord,
): Promise<void> {
  const key = snapshotKey(assetCode)
  const snapshot: FlowCanvasSnapshot = {
    assetCode,
    updatedAt: Date.now(),
    version: 1,
    workflowData: definition,
  }
  const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' })
  await uploadBlobToCosKey(blob, 'snapshot.json', key, NO_CACHE)
}

function definitionFromSnapshot(snapshot: unknown): UnknownRecord | null {
  if (!isRecord(snapshot)) return null
  if (isRecord(snapshot.workflowData)) return snapshot.workflowData
  if (isRecord(snapshot.definition)) return snapshot.definition
  return snapshot
}

async function fetchSnapshotDefinition(url: string): Promise<UnknownRecord | null> {
  const response = await fetch(noCacheUrl(url), { cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`画布 COS 文件加载失败（HTTP ${response.status}）`)
  return definitionFromSnapshot(await response.json())
}

/**
 * 优先从固定 COS 地址读取画布 definition，并识别需要迁移的旧存储格式。
 * @param content get_detail 返回的资产内容；支持旧版内联 definition 和历史 COS 指针。
 * @param assetCode 资产编码，用于按固定规则推导 COS 快照地址。
 * @returns definition、是否需要迁移到固定 COS、是否需要清理资产 content。
 * @throws COS 文件缺失、鉴权失败或 JSON 无效时抛出异常。
 */
export async function loadFlowCanvasDefinition(
  content: unknown,
  assetCode = '',
): Promise<FlowCanvasDefinitionLoadResult> {
  const normalized = parseRecord(content)
  const storage = storageOf(normalized)
  const inlineDefinition = inlineDefinitionOf(normalized)
  const derivedUrl = assetCode ? buildCosObjectUrl(snapshotKey(assetCode)) : ''
  if (derivedUrl) {
    const definition = await fetchSnapshotDefinition(derivedUrl)
    if (definition) {
      return {
        definition,
        needsCosMigration: false,
        shouldCleanAssetContent: !!inlineDefinition || !!storage,
      }
    }
  }

  const legacyUrl = String(storage?.url || '').trim()
  if (legacyUrl && legacyUrl !== derivedUrl) {
    const definition = await fetchSnapshotDefinition(legacyUrl)
    if (definition) {
      return { definition, needsCosMigration: !!assetCode, shouldCleanAssetContent: true }
    }
  }

  if (inlineDefinition) {
    return { definition: inlineDefinition, needsCosMigration: !!assetCode, shouldCleanAssetContent: true }
  }
  if (assetCode) throw new Error('画布 COS 快照不存在，且资产详情中没有可迁移数据')
  return { definition: normalized, needsCosMigration: false, shouldCleanAssetContent: false }
}
