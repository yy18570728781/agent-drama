import { computed, ref } from 'vue'
import { selectedNode } from './useFlowCore'
import { useFlowTabClosing } from './useFlowTabClosing'
import { useFlowTabCreation } from './useFlowTabCreation'
import { useFlowTabMenu } from './useFlowTabMenu'
import { useFlowTabWorkspace } from './useFlowTabWorkspace'
import type { FlowSidebarApi } from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'

function createFlowTabs(deps: FlowTabsDeps) {
  const wfSortOrder = ref('desc')
  const flowSidebarRef = ref<FlowSidebarApi | null>(null)
  const shortcuts = ref<Record<string, unknown>>({})
  const sortedWorkflows = computed(() => {
    const list = [...(deps.workflows?.value || [])]
    list.sort((first, second) => {
      const firstTime = new Date(first.updated_at || 0).getTime()
      const secondTime = new Date(second.updated_at || 0).getTime()
      return wfSortOrder.value === 'desc' ? secondTime - firstTime : firstTime - secondTime
    })
    return list
  })
  const workspace = useFlowTabWorkspace(deps)
  const tabMenu = useFlowTabMenu({ deps, saveTabs: workspace.saveTabs })
  const closing = useFlowTabClosing({
    buildTabDefinition: workspace.buildTabDefinition,
    deps,
    hasUnsavedChanges: workspace.hasUnsavedChanges,
    hideTabContextMenu: tabMenu.hideTabContextMenu,
    saveTabs: workspace.saveTabs,
    switchTab: workspace.switchTab,
    syncCurrentGraphToActiveTab: workspace.syncCurrentGraphToActiveTab,
    tabContextMenu: tabMenu.tabContextMenu,
  })
  const creation = useFlowTabCreation({
    getActiveTab: workspace.getActiveTab,
    workflows: deps.workflows,
    switchTab: workspace.switchTab,
    serializeNodes: deps.serializeNodes,
    serializeEdges: deps.serializeEdges,
    getActiveCanvasNodesSnapshot: deps.getActiveCanvasNodesSnapshot,
    getActiveCanvasEdgesSnapshot: deps.getActiveCanvasEdgesSnapshot,
    loadDefinition: deps.loadDefinition,
    restoreNodesFromAigcRecordIds: deps.restoreNodesFromAigcRecordIds,
    onSave: deps.onSave,
    saveDraft: deps.saveDraft,
    saveTabs: workspace.saveTabs,
  })
  return {
    ...workspace,
    ...tabMenu,
    ...closing,
    ...creation,
    flowSidebarRef,
    shortcuts,
    sortedWorkflows,
    wfSortOrder,
    handlePaneClick: (): void => {
      selectedNode.value = null
      flowSidebarRef.value?.closeAllPanels?.()
    },
    onUpdateShortcuts: (value: Record<string, unknown>): void => { shortcuts.value = value },
  }
}

/**
 * 装配 Flow 页面多标签的状态、持久化、菜单和新建流程。
 * @param deps Flow 页面现有依赖
 * @returns Flow 标签页公开状态与操作
 */
export function useFlowTabs(deps: FlowTabsDeps): ReturnType<typeof createFlowTabs> {
  return createFlowTabs(deps)
}
