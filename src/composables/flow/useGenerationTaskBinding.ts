import type { GenerationOrchestrationDeps } from './useGenerationOrchestration.types'

export interface GenerationTaskBindingApi {
  resolveGenerateTargetNodeId: (payload: Record<string, any>) => string
  resolveOriginalNodeId: (nodeId: string) => string
  getGenerationSourceKey: (eventSourceNodeId: string, targetNodeId: string) => string
  markGenerationTaskCompleted: (sourceKey: string, eventSourceNodeId: string) => void
  bindGenerationTaskToSlot: (taskId: string, slotId: string) => void
  resolveGenerationSlotByTaskId: (taskId: string) => string
  nodeOwnsGenerationTask: (nodeId: string, taskId: string) => boolean
  clearGenerationTaskBinding: (taskId: string, slotId: string) => void
  attachTaskIdToGenerationState: (data: any, taskId?: string) => any
  getActiveGenerationTargetNodeId: (nodeId: string) => string
  getGenerationCardHorizontalGap: (sourceNode: any) => number
}

/**
 * Centralizes task-slot bookkeeping so generation results resolve to a stable target node.
 */
export function useGenerationTaskBinding(deps: GenerationOrchestrationDeps): GenerationTaskBindingApi {
  function getNodeActiveTaskId(node: any): string {
    const data = node?.data || {}
    return String(data.taskId || data._activeTaskId || '').trim()
  }

  function resolveGenerateTargetNodeId(payload: Record<string, any>): string {
    const directNodeId = payload?.nodeId
    if (directNodeId) return directNodeId
    const taskId = String(payload?.taskId || payload?.result?.taskId || payload?.result?.task_id || '').trim()
    if (!taskId) return ''
    const slotId = deps._generationSlotByTaskId.get(taskId)
    if (slotId && deps.nodes.value.some((node: any) => node.id === slotId)) return slotId
    if (slotId) deps._generationSlotByTaskId.delete(taskId)
    const matchedNode = deps.nodes.value.find((node: any) => {
      return getNodeActiveTaskId(node) === taskId
    })
    return matchedNode?.id || ''
  }

  function resolveOriginalNodeId(nodeId: string): string {
    let current = deps.nodes.value.find((node: any) => node.id === nodeId)
    const visited = new Set<string>()
    while (current?.data?._generatedFromNodeId || current?.data?._resultPlaceholderForNodeId) {
      const parentId = current.data._generatedFromNodeId || current.data._resultPlaceholderForNodeId
      if (!parentId || visited.has(parentId)) break
      visited.add(parentId)
      const parent = deps.nodes.value.find((node: any) => node.id === parentId)
      if (!parent) break
      current = parent
    }
    return current?.id || nodeId
  }

  function getGenerationSourceKey(eventSourceNodeId: string, targetNodeId: string): string {
    if (deps._activeGenerationSessionBySource.has(eventSourceNodeId)) return eventSourceNodeId
    for (const [sourceId, session] of deps._activeGenerationSessionBySource.entries()) {
      if (session?.targetNodeId === targetNodeId || session?.targetNodeId === eventSourceNodeId) {
        return sourceId
      }
    }
    return eventSourceNodeId
  }

  function markGenerationTaskCompleted(sourceKey: string, eventSourceNodeId: string): void {
    const session = deps._activeGenerationSessionBySource.get(sourceKey)
    if (!session) {
      deps._activeGenerationTargetBySource.delete(eventSourceNodeId)
      return
    }
    session.completedCount = (session.completedCount || 0) + 1
    const totalExpected = Number(session.totalExpectedItems || 1) || 1
    if (session.completedCount >= totalExpected) {
      deps._activeGenerationSessionBySource.delete(sourceKey)
      deps._activeGenerationTargetBySource.delete(sourceKey)
      return
    }
    deps._activeGenerationSessionBySource.set(sourceKey, session)
  }

  function bindGenerationTaskToSlot(taskId: string, slotId: string): void {
    const normalizedTaskId = String(taskId || '').trim()
    const normalizedSlotId = String(slotId || '').trim()
    if (!normalizedTaskId || !normalizedSlotId) return
    deps._generationSlotByTaskId.set(normalizedTaskId, normalizedSlotId)
  }

  function resolveGenerationSlotByTaskId(taskId: string): string {
    const normalizedTaskId = String(taskId || '').trim()
    if (!normalizedTaskId) return ''
    const slotId = deps._generationSlotByTaskId.get(normalizedTaskId)
    if (slotId && deps.nodes.value.some((node: any) => node.id === slotId)) return slotId
    if (slotId) deps._generationSlotByTaskId.delete(normalizedTaskId)
    const matchedNode = deps.nodes.value.find((node: any) => {
      return getNodeActiveTaskId(node) === normalizedTaskId
    })
    return matchedNode?.id || ''
  }

  function nodeOwnsGenerationTask(nodeId: string, taskId: string): boolean {
    const normalizedTaskId = String(taskId || '').trim()
    if (!nodeId || !normalizedTaskId) return false
    const node = deps.nodes.value.find((item: any) => item.id === nodeId)
    return getNodeActiveTaskId(node) === normalizedTaskId
  }

  function clearGenerationTaskBinding(taskId: string, slotId: string): void {
    const normalizedTaskId = String(taskId || '').trim()
    if (normalizedTaskId) {
      deps._generationSlotByTaskId.delete(normalizedTaskId)
      return
    }
    const normalizedSlotId = String(slotId || '').trim()
    if (!normalizedSlotId) return
    for (const [mappedTaskId, mappedSlotId] of deps._generationSlotByTaskId.entries()) {
      if (mappedSlotId === normalizedSlotId) {
        deps._generationSlotByTaskId.delete(mappedTaskId)
      }
    }
  }

  function attachTaskIdToGenerationState(data: any, taskId?: string): any {
    const normalizedTaskId = String(taskId || '').trim()
    if (!normalizedTaskId) return { ...(data || {}) }
    const nextData = { ...(data || {}) }
    const nextGenState = deps.cloneGenerationState(nextData._genState) || {}
    nextGenState.taskId = normalizedTaskId
    nextGenState.task_id = normalizedTaskId
    nextData._genState = nextGenState
    return nextData
  }

  function getActiveGenerationTargetNodeId(nodeId: string): string {
    if (!nodeId) return ''
    const directTargetId = deps._activeGenerationTargetBySource.get(nodeId)
    if (directTargetId && deps.nodes.value.some((node: any) => node.id === directTargetId)) {
      return directTargetId
    }
    for (const [sourceId, session] of deps._activeGenerationSessionBySource.entries()) {
      const targetNodeId = session?.targetNodeId
      if (!targetNodeId || !deps.nodes.value.some((node: any) => node.id === targetNodeId)) continue
      if (sourceId === nodeId || targetNodeId === nodeId) return targetNodeId
    }
    return ''
  }

  function getGenerationCardHorizontalGap(sourceNode: any): number {
    const sourceWidth = sourceNode?.dimensions?.width || parseInt(sourceNode?.style?.width) || 320
    return Math.max(64, Math.min(112, Math.round(sourceWidth * 0.22)))
  }

  return {
    resolveGenerateTargetNodeId,
    resolveOriginalNodeId,
    getGenerationSourceKey,
    markGenerationTaskCompleted,
    bindGenerationTaskToSlot,
    resolveGenerationSlotByTaskId,
    nodeOwnsGenerationTask,
    clearGenerationTaskBinding,
    attachTaskIdToGenerationState,
    getActiveGenerationTargetNodeId,
    getGenerationCardHorizontalGap,
  }
}
