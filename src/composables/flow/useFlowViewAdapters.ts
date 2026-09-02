import { ROOT_GRAPH_ID, workflowTabs } from './useFlowCore'
import { normalizePersistedSubgraphs } from './flowSubgraphPersistence.utils'
import { normalizeFlowCanvasName } from './flowNameValidation'
import type { useFlowPersistence } from './useFlowPersistence'
import type { useFlowSubgraph } from './useFlowSubgraph'
import type { useFlowTabs } from './useFlowTabs'

interface FlowViewAdaptersOptions {
  persistence: ReturnType<typeof useFlowPersistence>
  subgraph: ReturnType<typeof useFlowSubgraph>
  tabs: ReturnType<typeof useFlowTabs>
}

interface FlowViewAdaptersReturn {
  updateWfSortOrder: (value: string) => void
  onUpdateShowRenameModal: (value: boolean) => void
  onUpdateRenameValue: (value: string) => void
  onUpdateNewWfName: (value: string) => void
  onUpdateShowDuplicateModal: (value: boolean) => void
  handleOutlineSelect: (graphId: string) => unknown
  handleOutlineRefresh: () => void
}

/**
 * 汇总 FlowView 模板的轻量事件适配，避免页面组件承载状态修改细节。
 * @param options 标签、持久化和子图模块。
 * @returns 模板事件处理方法。
 */
export function useFlowViewAdapters(options: FlowViewAdaptersOptions): FlowViewAdaptersReturn {
  function updateWfSortOrder(value: string): void {
    options.tabs.wfSortOrder.value = value
  }

  function onUpdateShowRenameModal(value: boolean): void {
    options.tabs.showRenameModal.value = value
  }

  function onUpdateRenameValue(value: string): void {
    options.tabs.renameValue.value = normalizeFlowCanvasName(value)
  }

  function onUpdateNewWfName(value: string): void {
    options.tabs.newWfName.value = value
  }

  function onUpdateShowDuplicateModal(value: boolean): void {
    options.persistence.showDuplicateModal.value = value
  }

  function handleOutlineSelect(graphId: string): unknown {
    if (graphId === ROOT_GRAPH_ID) return options.subgraph.navigateToRootGraph()
    const subgraphs = normalizePersistedSubgraphs(options.tabs.getActiveTab()?.subgraphs)
    const definition = subgraphs[graphId]
    return options.subgraph.handleOpenSubgraph({
      subgraphId: graphId,
      label: String(definition?.name || '子图'),
    })
  }

  function handleOutlineRefresh(): void {
    const currentTab = options.tabs.getActiveTab()
    if (!currentTab) return
    options.tabs.syncCurrentGraphToActiveTab()
    workflowTabs.value = workflowTabs.value.map((tab) => tab.id === currentTab.id
      ? {
          ...tab,
          nodes: [...(tab.nodes || [])],
          edges: [...(tab.edges || [])],
          subgraphs: { ...(tab.subgraphs || {}) },
        }
      : tab)
  }

  return {
    updateWfSortOrder,
    onUpdateShowRenameModal,
    onUpdateRenameValue,
    onUpdateNewWfName,
    onUpdateShowDuplicateModal,
    handleOutlineSelect,
    handleOutlineRefresh,
  }
}
