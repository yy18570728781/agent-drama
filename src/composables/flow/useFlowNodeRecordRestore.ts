import { findTeamonesAigcRecordsByIds, type AssetItem } from '@/api/assets'
import { queryTasks, type GenerationTask } from '@/api/generation'
import { useTaskQueueStore } from '@/stores/task-queue'
import { getWorkflowNodeTaskId } from './workflowTaskState'
import { nodes } from './useFlowCore'
import {
  applyTaskStates,
  restoreNodeFromRecord,
  shouldRestoreFromRecord,
} from './flowNodeRecordRestore.utils'
import type { FlowNode } from './flowCore.types'

export interface UseFlowNodeRecordRestoreReturn {
  restoreNodesFromAigcRecordIds: () => Promise<boolean>
}

function collectNodesByTaskId(): Map<string, FlowNode[]> {
  const result = new Map<string, FlowNode[]>()
  for (const node of nodes.value) {
    const taskId = getWorkflowNodeTaskId(node.data)
    if (!taskId) continue
    const data = node.data || {}
    const hasUrl = Boolean(String(data.url || data.preview || data.imageUrl || data.videoUrl || data.audioUrl || '').trim())
    if (hasUrl) continue
    const taskNodes = result.get(taskId) || []
    taskNodes.push(node)
    result.set(taskId, taskNodes)
  }
  return result
}

async function queryTaskMap(taskIds: string[]): Promise<Map<string, GenerationTask>> {
  const taskMap = new Map<string, GenerationTask>()
  for (let index = 0; index < taskIds.length; index += 50) {
    const batch = taskIds.slice(index, index + 50)
    try {
      const tasks = await queryTasks(batch)
      for (const task of tasks) {
        const taskId = String(task.task_id || '').trim()
        if (taskId) taskMap.set(taskId, task)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[flow-restore] queryTasks ERROR', { batch, error: message })
    }
  }
  return taskMap
}

async function queryRecordMap(recordIds: Set<string>): Promise<Map<string, AssetItem>> {
  const recordMap = new Map<string, AssetItem>()
  const numericIds = Array.from(recordIds).map(Number).filter(Number.isFinite)
  for (let index = 0; index < numericIds.length; index += 50) {
    const batchIds = numericIds.slice(index, index + 50)
    try {
      const records = await findTeamonesAigcRecordsByIds(batchIds)
      for (const record of records) {
        const key = String(record.record_id || record.id || '').trim()
        if (key) recordMap.set(key, record)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[flow-restore] findTeamonesAigcRecordsByIds ERROR', { batchIds, error: message })
    }
  }
  return recordMap
}

async function applyRecordRepairs(recordMap: Map<string, AssetItem>): Promise<boolean> {
  const repairTasks = nodes.value
    .filter(shouldRestoreFromRecord)
    .map((node) => restoreNodeFromRecord(node, recordMap).catch(() => false))
  const results = await Promise.all(repairTasks)
  return results.some(Boolean)
}

/**
 * 恢复只保存了任务或记录 ID 的 Flow 节点运行态数据。
 * @returns 记录恢复入口。
 */
export function useFlowNodeRecordRestore(): UseFlowNodeRecordRestoreReturn {
  const taskQueueStore = useTaskQueueStore()

  async function restoreNodesFromAigcRecordIds(): Promise<boolean> {
    await taskQueueStore.restoreRunningTasks()
    const nodesByTaskId = collectNodesByTaskId()
    const taskIds = Array.from(nodesByTaskId.keys())
    if (!taskIds.length) return false
    const taskMap = await queryTaskMap(taskIds)
    const taskState = applyTaskStates(nodesByTaskId, taskMap)
    const recordMap = await queryRecordMap(taskState.recordIds)
    const recordsChanged = await applyRecordRepairs(recordMap)
    const changed = taskState.changed || recordsChanged
    if (changed) nodes.value = [...nodes.value]
    return changed
  }

  return { restoreNodesFromAigcRecordIds }
}
