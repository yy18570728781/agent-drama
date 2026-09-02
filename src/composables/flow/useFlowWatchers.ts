import { watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface FlowWatchersDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  propsModelNodes: () => any[]
  propsModelEdges: () => any[]
  isDraggingNode: Ref<boolean>
  isResizing: Ref<boolean>
  syncCollapsedGroupVisibility: () => void
  skipNodesChange: { value: boolean }
  skipEdgesChange: { value: boolean }
  selectedPanelNode: Ref<any>
  panelVisible: Ref<boolean>
  startPanelClickOutside: () => void
  stopPanelClickOutside: () => void
  clearGenerationPanel: (nodeId?: string) => void
  hideGenerationPanel: () => void
  generationStore: { isGenerating: boolean }
  handleCanvasPaste: (e: ClipboardEvent) => void
}

export function useFlowWatchers(deps: FlowWatchersDeps) {
  let collapsedVisibilitySyncPending = false
  let disposed = false

  function scheduleCollapsedVisibilitySync(): void {
    if (collapsedVisibilitySyncPending) return
    collapsedVisibilitySyncPending = true
    nextTick(() => {
      collapsedVisibilitySyncPending = false
      if (disposed) return
      deps.syncCollapsedGroupVisibility()
    })
  }

  // 面板打开时启动点击外部检测
  watch([deps.selectedPanelNode, deps.panelVisible], ([node, visible], _previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    if (node && visible) {
      nextTick(() => {
        if (cancelled || disposed) return
        deps.startPanelClickOutside()
      })
    } else {
      deps.stopPanelClickOutside()
    }
  })

  // 面板对应的节点被删除时清理
  watch(
    () => {
      const panelNodeId = deps.selectedPanelNode.value?.id
      return !panelNodeId || deps.nodes.value.some((node: any) => node.id === panelNodeId)
    },
    (panelNodeExists) => {
      if (panelNodeExists) return
      const panelNodeId = deps.selectedPanelNode.value?.id
      if (deps.generationStore.isGenerating) {
        deps.hideGenerationPanel()
      } else {
        deps.clearGenerationPanel(panelNodeId)
      }
    }
  )

  // 双向同步节点 - 从 props 初始化
  watch(() => deps.propsModelNodes(), (val) => {
    if (!deps.isDraggingNode.value && !deps.isResizing.value) {
      deps.skipNodesChange.value = true
      deps.nodes.value = val
      scheduleCollapsedVisibilitySync()
      nextTick(() => {
        deps.skipNodesChange.value = false
      })
    }
  }, { immediate: true })

  // 双向同步边 - 从 props 初始化
  watch(() => deps.propsModelEdges(), (val) => {
    deps.skipEdgesChange.value = true
    deps.edges.value = val
    scheduleCollapsedVisibilitySync()
    nextTick(() => {
      deps.skipEdgesChange.value = false
    })
  }, { immediate: true })

  // 节点/边变化时同步折叠组可见性
  watch([deps.nodes, deps.edges], () => {
    scheduleCollapsedVisibilitySync()
  })

  // 全局粘贴事件
  onMounted(() => {
    document.addEventListener('paste', deps.handleCanvasPaste, true)
  })

  onUnmounted(() => {
    disposed = true
    deps.stopPanelClickOutside()
    document.removeEventListener('paste', deps.handleCanvasPaste, true)
  })
}
