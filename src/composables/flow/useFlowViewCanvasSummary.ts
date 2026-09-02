import { computed, type ComputedRef, type Ref } from 'vue'
import { countGraphTotalNodes } from './flowSubgraphCreation.utils'
import { filterPersistedNodes } from './useFlowCore'
import type { FlowNode, WorkflowTab } from './flowCore.types'

interface FlowViewCanvasSummaryOptions {
  activeGraphId: Ref<string>
  getActiveTab: () => WorkflowTab | null
  hasUnsavedChanges: (tab: WorkflowTab) => boolean
  nodes: Ref<FlowNode[]>
}

interface UseFlowViewCanvasSummaryReturn {
  currentCanvasNodeCount: ComputedRef<number>
  currentHasUnsavedChanges: ComputedRef<boolean>
  currentTab: ComputedRef<WorkflowTab | null>
}

/**
 * 汇总 FlowView 顶部状态与跨子图节点计数，避免页面组件承载派生业务规则。
 * @param options 当前图、标签页和根画布节点依赖。
 * @returns 当前标签、未保存状态与当前子树节点总数。
 */
export function useFlowViewCanvasSummary(
  options: FlowViewCanvasSummaryOptions,
): UseFlowViewCanvasSummaryReturn {
  const currentTab = computed(() => options.getActiveTab())
  const currentHasUnsavedChanges = computed(() => {
    const tab = currentTab.value
    return !!tab && options.hasUnsavedChanges(tab)
  })
  const currentCanvasNodeCount = computed(() => {
    const liveNodeCount = filterPersistedNodes(options.nodes.value)
      .filter((node) => node?.type !== 'subgraph')
      .length
    const tab = currentTab.value
    if (!tab) return liveNodeCount
    return countGraphTotalNodes(tab.subgraphs, options.activeGraphId.value, liveNodeCount)
  })
  return { currentCanvasNodeCount, currentHasUnsavedChanges, currentTab }
}
