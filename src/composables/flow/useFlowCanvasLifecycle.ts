import type { Ref } from 'vue'
import type { BackendModelInfo } from '@/api/models'
import type { TaskQueueConsumerDeps } from '@/composables/flow/useTaskQueueConsumer'
import type { FlowProvidesDeps } from '@/composables/flow/useFlowProvides'
import type { FlowExposeDeps } from '@/composables/flow/useFlowExpose'
import type { FlowWatchersDeps } from '@/composables/flow/useFlowWatchers'
import { onMounted, onUnmounted } from 'vue'
import { getAllModels } from '@/api/models'
import { useTaskQueueConsumer } from '@/composables/flow/useTaskQueueConsumer'
import { useFlowProvides } from '@/composables/flow/useFlowProvides'
import { useFlowExpose } from '@/composables/flow/useFlowExpose'
import { useFlowWatchers } from '@/composables/flow/useFlowWatchers'

type FlowCanvasLifecycleDeps = TaskQueueConsumerDeps
  & Pick<FlowWatchersDeps,
    | 'isDraggingNode'
    | 'isResizing'
    | 'syncCollapsedGroupVisibility'
    | 'selectedPanelNode'
    | 'panelVisible'
    | 'startPanelClickOutside'
    | 'stopPanelClickOutside'
    | 'clearGenerationPanel'
    | 'hideGenerationPanel'
    | 'generationStore'
    | 'handleCanvasPaste'
  >
  & {
    models: Ref<BackendModelInfo[]>
    clearTimers: () => void
    props: {
      modelNodes: ReturnType<FlowWatchersDeps['propsModelNodes']>
      modelEdges: ReturnType<FlowWatchersDeps['propsModelEdges']>
    }
    skipNodesChangeRef: FlowWatchersDeps['skipNodesChange']
    skipEdgesChangeRef: FlowWatchersDeps['skipEdgesChange']
    provided: FlowProvidesDeps
    exposed: FlowExposeDeps
  }

type FlowCanvasLifecycleReturn = ReturnType<typeof useFlowExpose> & {
  consumedQueueResultKeys: Set<string>
}

/**
 * 装配画布挂载、卸载、任务消费和依赖注入生命周期。
 * @param deps 画布运行态依赖。
 * @returns 队列消费状态与画布对外方法。
 */
export function useFlowCanvasLifecycle(deps: FlowCanvasLifecycleDeps): FlowCanvasLifecycleReturn {
  let disposed = false
  let initialHistoryTimer: ReturnType<typeof setTimeout> | null = null
  const {
    models,
    saveHistory,
    clearTimers,
    props,
    nodes,
    edges,
    findNode,
    emit,
    isDraggingNode,
    isResizing,
    syncCollapsedGroupVisibility,
    skipNodesChangeRef,
    skipEdgesChangeRef,
    selectedPanelNode,
    panelVisible,
    startPanelClickOutside,
    stopPanelClickOutside,
    clearGenerationPanel,
    hideGenerationPanel,
    generationStore,
    handleCanvasPaste,
    addNodes,
    addEdges,
    applyCompleteResult,
    provided,
    exposed,
  } = deps
  onMounted(async () => {
    try {
      const response = await getAllModels()
      if (!disposed) {
        models.value = Array.isArray(response) ? response : response.models || []
      }
    } catch {
      // ignore
    }

    if (!disposed) {
      initialHistoryTimer = setTimeout(saveHistory, 100)
    }
  })

  onUnmounted(() => {
    disposed = true
    if (initialHistoryTimer) {
      clearTimeout(initialHistoryTimer)
      initialHistoryTimer = null
    }
    stopPanelClickOutside()
    clearTimers()
  })

  useFlowWatchers({
    nodes,
    edges,
    propsModelNodes: () => props.modelNodes,
    propsModelEdges: () => props.modelEdges,
    isDraggingNode,
    isResizing,
    syncCollapsedGroupVisibility,
    skipNodesChange: skipNodesChangeRef,
    skipEdgesChange: skipEdgesChangeRef,
    selectedPanelNode,
    panelVisible,
    startPanelClickOutside,
    stopPanelClickOutside,
    clearGenerationPanel,
    hideGenerationPanel,
    generationStore,
    handleCanvasPaste,
  })

  const { consumedQueueResultKeys } = useTaskQueueConsumer({
    nodes,
    edges,
    emit,
    saveHistory,
    findNode,
    addNodes,
    addEdges,
    applyCompleteResult,
  })

  useFlowProvides(provided)

  const exposeApi = useFlowExpose(exposed)

  return {
    consumedQueueResultKeys,
    ...exposeApi,
  }
}
