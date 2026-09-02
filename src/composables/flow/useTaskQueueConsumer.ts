import { watch } from 'vue'
import type { Ref } from 'vue'
import { useTaskQueueStore } from '@/stores/task-queue'
import { applyQueueTaskToNodeData, getWorkflowNodeTaskId } from '@/composables/flow/workflowTaskState'

export interface TaskQueueConsumerDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
  }
  saveHistory: () => void
  findNode: (id: string) => any
  addNodes: (nodes: any[]) => void
  addEdges: (edges: any[]) => void
  applyCompleteResult: (nodeId: string, result: any) => Promise<void>
}

export function useTaskQueueConsumer(deps: TaskQueueConsumerDeps) {
  const { nodes, edges, emit, saveHistory, findNode, addNodes, addEdges, applyCompleteResult } = deps
  const taskQueueStore = useTaskQueueStore()

  const consumedQueueResultKeys = new Set<string>()

  function isContainerNode(node: any): boolean {
    return node?.type === 'batch_grid' || node?.type === 'texture_material'
  }

  function applyTaskToContainerItem(task: {
    id: number
    taskId?: string
    status: string
    progress?: number
    statusText?: string
  }): boolean {
    const taskId = String(task.taskId || '').trim()
    if (!taskId) return false
    for (let nodeIndex = 0; nodeIndex < nodes.value.length; nodeIndex += 1) {
      const node = nodes.value[nodeIndex]
      if (!isContainerNode(node)) continue
      const items = Array.isArray(node.data?.items) ? node.data.items : []
      const itemIndex = items.findIndex((item: any) => {
        const data = item?.data || {}
        const itemTaskId = String(data.taskId || data._activeTaskId || '').trim()
        return itemTaskId === taskId
      })
      if (itemIndex < 0) continue
      const item = items[itemIndex]
      const itemData = item?.data || {}
      const nextItems = [...items]
      nextItems[itemIndex] = {
        ...item,
        data: {
          ...itemData,
          ...(taskId ? { taskId, _activeTaskId: taskId } : {}),
          status: task.status,
          isGenerating: task.status === 'waiting_submit' || task.status === 'queued' || task.status === 'running',
          progress: typeof task.progress === 'number' ? task.progress : itemData.progress,
          statusText: task.statusText || itemData.statusText,
        },
      }
      nodes.value[nodeIndex] = {
        ...node,
        data: {
          ...(node.data || {}),
          items: nextItems,
        },
      }
      emit('update:modelNodes', nodes.value)
      return true
    }
    return false
  }

  watch(
    () => taskQueueStore.tasks.map((task) => ({
      id: task.id,
      taskId: task.taskId,
      status: task.status,
      progress: task.progress,
      statusText: task.statusText,
      flowNodeId: task._flowNodeId,
      requestIndex: task._requestIndex,
      completedResult: task._completedResult,
    })),
    async (queueTasks) => {
      for (const task of queueTasks) {
        if (applyTaskToContainerItem(task)) continue
        if (!task.flowNodeId) continue
        let matchedTaskNodeId = ''
        const flowRequestIndex = Number.isFinite(Number((task as any).requestIndex))
          ? Number((task as any).requestIndex)
          : -1
        const matchedNode = nodes.value.find((node) => {
          if (isContainerNode(node)) return false
          return !!task.taskId && getWorkflowNodeTaskId(node.data) === task.taskId
        }) || nodes.value.find((node) => {
          if (isContainerNode(node)) return false
          const data = node?.data || {}
          if (String(data._resultPlaceholderForNodeId || '').trim() !== String(task.flowNodeId || '').trim()) return false
          if (!Number.isFinite(flowRequestIndex) || flowRequestIndex < 0) return false
          return Number(data._requestIndex) === flowRequestIndex
        })
        if (!matchedNode) continue
        if (matchedNode) {
          matchedTaskNodeId = matchedNode.id
          const nextData = task.taskId
            ? applyQueueTaskToNodeData(matchedNode.data || {}, {
                taskId: task.taskId,
                status: task.status,
                progress: task.progress,
                statusText: task.statusText,
              })
            : {
                ...(matchedNode.data || {}),
                status: task.status,
                isGenerating: task.status === 'waiting_submit' || task.status === 'queued' || task.status === 'running',
                progress: typeof task.progress === 'number' ? task.progress : matchedNode.data?.progress,
                statusText: task.statusText || matchedNode.data?.statusText,
              }
          const targetIdx = nodes.value.findIndex((node) => node.id === matchedNode.id)
          if (targetIdx >= 0 && JSON.stringify(nextData) !== JSON.stringify(nodes.value[targetIdx].data || {})) {
            nodes.value[targetIdx] = {
              ...nodes.value[targetIdx],
              data: nextData,
            }
            emit('update:modelNodes', nodes.value)
          }
        }
        if (task.status !== 'completed' || !task.completedResult || !matchedTaskNodeId) continue
        const currentNode = nodes.value.find((node) => node.id === matchedTaskNodeId)
        if (!currentNode || isContainerNode(currentNode)) continue
        const currentData = currentNode?.data || {}
        const hasMediaUrl = !!(
          currentData.url || currentData.preview
          || currentData.imageUrl || currentData.videoUrl || currentData.audioUrl
        )
        const alreadyResolved = currentData.status === 'completed' && hasMediaUrl
        const consumeKey = `${task.id}:${matchedTaskNodeId}`
        if (alreadyResolved) continue
        if (consumedQueueResultKeys.has(consumeKey)) continue
        if (!nodes.value.some((node) => node.id === matchedTaskNodeId)) continue
        consumedQueueResultKeys.add(consumeKey)
        await applyCompleteResult(matchedTaskNodeId, task.completedResult)
      }
    },
    { deep: true, immediate: true }
  )

  return {
    consumedQueueResultKeys,
  }
}
