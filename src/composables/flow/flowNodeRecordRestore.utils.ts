import type { AssetItem } from '@/api/assets'
import type { GenerationTask } from '@/api/generation'
import { buildPortsForNode } from '@/utils/workflowNodeData'
import {
  applyBackendTaskToNodeData,
  applyRecordStatusToNodeData,
  getWorkflowNodeTaskId,
} from './workflowTaskState'
import {
  applyFlowRecordMediaSize,
  hasMissingFlowMediaThumb,
  hasSuspiciousFlowMediaSize,
  resolveFlowNodeMediaType,
  restoreLocalFlowFileInputThumb,
  shouldRefreshFlowMediaMetrics,
  type FlowMediaRecord,
} from './flowNodeMediaRepair'
import type { FlowNode } from './flowCore.types'

/**
 * 把已完成任务返回的记录 ID 标记到节点。
 * @param node 待更新节点。
 * @param recordId AIGC 记录 ID。
 * @returns 节点是否发生变化。
 */
export function applyCompletedTaskRecordId(node: FlowNode, recordId: string): boolean {
  if (!recordId) return false
  const previousRecordId = String(node.data?.recordId || '').trim()
  const hadPendingRestore = Boolean(node.data?._pendingAigcRestore)
  node.data.recordId = recordId
  node.data._pendingAigcRestore = true
  return previousRecordId !== recordId || !hadPendingRestore
}

/**
 * 从不同版本的任务响应中读取记录 ID。
 * @param task 后端生成任务。
 * @returns 规范化记录 ID。
 */
export function resolveTaskRecordId(task: GenerationTask): string {
  return String(
    task.aigc_record_id
    || task.data?.record_id
    || task.data?.aigc_record_id
    || task.result?.record_id
    || task.result?.aigc_record_id
    || '',
  ).trim()
}

/**
 * 将后端任务状态应用到关联节点并收集待拉取记录。
 * @param nodesByTaskId 任务与节点映射。
 * @param taskMap 已查询的后端任务。
 * @returns 变化状态和待查询记录 ID。
 */
export function applyTaskStates(
  nodesByTaskId: Map<string, FlowNode[]>,
  taskMap: Map<string, GenerationTask>,
): { changed: boolean; recordIds: Set<string> } {
  let changed = false
  const recordIds = new Set<string>()
  for (const [taskId, nodeList] of nodesByTaskId) {
    const task = taskMap.get(taskId)
    if (!task) continue
    const recordId = resolveTaskRecordId(task)
    for (const node of nodeList) {
      const before = JSON.stringify(node.data || {})
      node.data = applyBackendTaskToNodeData(node.data || {}, task)
      if (JSON.stringify(node.data || {}) !== before) changed = true
      if (recordId && applyCompletedTaskRecordId(node, recordId)) {
        recordIds.add(recordId)
        changed = true
      }
    }
  }
  return { changed, recordIds }
}

/**
 * 判断节点是否需要用 AIGC 记录修复运行态数据。
 * @param node 待检查节点。
 * @returns 是否需要记录修复。
 */
export function shouldRestoreFromRecord(node: FlowNode): boolean {
  const data = node.data || {}
  const needsMediaSizeRepair = hasSuspiciousFlowMediaSize(node)
  const needsThumbRepair = hasMissingFlowMediaThumb(node)
  const needsMetricsFetch = shouldRefreshFlowMediaMetrics(node)
  if (!String(data.recordId || '').trim() && !needsMetricsFetch && !needsMediaSizeRepair && !needsThumbRepair) return false
  const taskId = getWorkflowNodeTaskId(data)
  const hasResolvedUrl = Boolean(String(data.url || data.preview || '').trim())
  const needsStatusRepair = ['waiting_submit', 'queued', 'running', 'failed', 'cancelled']
    .includes(String(data.status || '').trim())
  return Boolean(
    data._pendingAigcRestore
    || !hasResolvedUrl
    || needsThumbRepair
    || needsStatusRepair
    || !taskId
    || needsMediaSizeRepair
    || needsMetricsFetch,
  )
}

async function applyRecordResult(node: FlowNode, recordId: string, record: AssetItem): Promise<boolean> {
  const before = JSON.stringify({ type: node.type, data: node.data || {}, style: node.style || {} })
  const media = record.media?.[0] || {}
  const url = String(media.origin_url || media.url || record.url || media.thumb || '').trim()
  const thumb = String(media.thumb || '').trim()
  const flowRecord: FlowMediaRecord = {
    type: record.type,
    url: typeof record.url === 'string' ? record.url : record.url.origin_url || record.url.proxy_url,
    media: Array.isArray(record.media) ? record.media : [],
  }
  const mediaType = resolveFlowNodeMediaType(node, flowRecord)
  const modelName = String(record.model || node.data?.model || '').trim()
  node.type = 'aigc_result'
  node.data = applyRecordStatusToNodeData(node.data || {}, record.status || '', record.statusText || '')
  node.data.label = modelName ? `${modelName}_${recordId}` : `结果_${recordId}`
  node.data.preview = url || null
  node.data.url = url || undefined
  node.data.recordId = recordId
  node.data.mediaType = mediaType
  node.data.nodeKind = 'aigc_result'
  node.data.ports = buildPortsForNode('aigc_result', mediaType)
  node.data.thumb = thumb || undefined
  node.data.request = undefined
  node.data._genState = undefined
  node.data.capability = undefined
  node.data.mode = undefined
  node.data.model = undefined
  node.data.params = undefined
  if (mediaType === 'video') node.data.videoUrl = url || undefined
  else if (mediaType === 'audio') node.data.audioUrl = url || undefined
  else node.data.imageUrl = url || undefined
  if (record.status === 'completed') {
    node.data.status = 'completed'
    node.data.isGenerating = false
    delete node.data._activeTaskId
  }
  await applyFlowRecordMediaSize(node, flowRecord)
  delete node.data._pendingAigcRestore
  return before !== JSON.stringify({ type: node.type, data: node.data || {}, style: node.style || {} })
}

/**
 * 使用已查询的 AIGC 记录修复单个节点。
 * @param node 待修复节点。
 * @param recordMap 记录 ID 映射。
 * @returns 节点是否发生变化。
 */
export async function restoreNodeFromRecord(
  node: FlowNode,
  recordMap: Map<string, AssetItem>,
): Promise<boolean> {
  const recordId = String(node.data?.recordId || '').trim()
  if (!recordId) {
    const before = JSON.stringify({ data: node.data || {}, style: node.style || {} })
    const restoredThumb = restoreLocalFlowFileInputThumb(node)
    await applyFlowRecordMediaSize(node, null)
    return restoredThumb || before !== JSON.stringify({ data: node.data || {}, style: node.style || {} })
  }
  const record = recordMap.get(recordId)
  return record ? applyRecordResult(node, recordId, record) : false
}
