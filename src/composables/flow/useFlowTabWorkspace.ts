import { dedupeWorkflowTabs, normalizeWorkflowTabId } from './flowTabIdentity'
import {
  isPlaceholderWorkflowTab,
  normalizeWorkflowTabName,
  pickWorkflowTab,
} from './flowTabCollection'
import { createFlowTabGraphController } from './flowTabGraphController'
import { createFlowTabHistoryController } from './flowTabHistoryController'
import { useFlowTabSession } from './useFlowTabSession'
import type { FlowTabLoadOptions, WorkflowDefinition, WorkflowTab } from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  workflowTabs,
} from './useFlowCore'

export interface UseFlowTabWorkspaceReturn {
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  getActiveTab: () => WorkflowTab | null
  handleBeforeUnload: () => void
  handleCanvasRedoRequest: () => void
  handleCanvasUndoRequest: () => void
  hasUnsavedChanges: (tab: WorkflowTab | null) => boolean
  loadTabs: (loadOptions?: FlowTabLoadOptions) => Promise<boolean>
  normalizeOpenWorkflowTabs: () => void
  openGraphInTab: (tab: WorkflowTab, graphId?: string) => Promise<boolean>
  recordTabHistory: (tab?: WorkflowTab | null) => void
  saveTabs: () => Promise<void>
  switchTab: (tabId: string) => Promise<boolean>
  syncCurrentGraphToActiveTab: () => void
}

function prunePlaceholderTabs(): void {
  workflowTabs.value = workflowTabs.value.filter((tab) => !isPlaceholderWorkflowTab(tab))
}

function normalizeOpenTabs(): void {
  const previousActiveTab = workflowTabs.value.find((tab) => tab.id === activeTabId.value)
  prunePlaceholderTabs()
  workflowTabs.value = dedupeWorkflowTabs(workflowTabs.value.map((tab) => ({
    ...tab,
    name: normalizeWorkflowTabName(tab.name, tab.workflowId, tab.isDraft),
    workflowId: normalizeWorkflowTabId(tab.workflowId),
  })))
  const sameWorkflowTab = previousActiveTab?.workflowId
    ? workflowTabs.value.find((tab) => (
      normalizeWorkflowTabId(tab.workflowId) === normalizeWorkflowTabId(previousActiveTab.workflowId)
    ))
    : workflowTabs.value.find((tab) => (
      String(tab.name || '').trim() === String(previousActiveTab?.name || '').trim()
    ))
  activeTabId.value = workflowTabs.value.find((tab) => tab.id === activeTabId.value)?.id
    || sameWorkflowTab?.id
    || workflowTabs.value[0]?.id
    || ''
}

function getActiveTab(): WorkflowTab | null {
  return pickWorkflowTab(workflowTabs.value, activeTabId.value)
}

async function performTabSwitch(
  tabId: string,
  workspace: Pick<
    UseFlowTabWorkspaceReturn,
    'openGraphInTab' | 'recordTabHistory' | 'saveTabs' | 'syncCurrentGraphToActiveTab'
  >,
): Promise<boolean> {
  if (getActiveTab()) workspace.syncCurrentGraphToActiveTab()
  const nextTab = workflowTabs.value.find((tab) => tab.id === tabId)
  if (!nextTab) return false
  activeTabId.value = tabId
  activeWorkflowId.value = nextTab.workflowId || ''
  activeWorkflowName.value = nextTab.name || ''
  await workspace.openGraphInTab(nextTab, nextTab.activeGraphId || ROOT_GRAPH_ID)
  workspace.recordTabHistory(nextTab)
  await workspace.saveTabs()
  return true
}

/**
 * 装配多标签的画布状态、历史记录与本地会话。
 * @param deps Flow 页面现有依赖
 * @returns 多标签画布核心操作
 */
export function useFlowTabWorkspace(deps: FlowTabsDeps): UseFlowTabWorkspaceReturn {
  const late = { hasUnsavedChanges: (_tab: WorkflowTab | null): boolean => false }
  const graph = createFlowTabGraphController({
    deps,
    getActiveTab,
    hasUnsavedChanges: (tab) => late.hasUnsavedChanges(tab),
  })
  const history = createFlowTabHistoryController({
    deps,
    getActiveTab,
  })
  const session = useFlowTabSession({
    buildTabDefinition: graph.buildTabDefinition,
    deps,
    getActiveTab,
    getGraphIdToSync: graph.getGraphIdToSync,
    normalizeOpenWorkflowTabs: normalizeOpenTabs,
    openGraphInTab: graph.openGraphInTab,
    prunePlaceholderDraftTabs: prunePlaceholderTabs,
    syncCurrentGraphToActiveTab: graph.syncCurrentGraphToActiveTab,
  })
  late.hasUnsavedChanges = session.hasUnsavedChanges
  const workspace = { ...graph, ...history, ...session }
  return {
    ...workspace,
    getActiveTab,
    normalizeOpenWorkflowTabs: normalizeOpenTabs,
    switchTab: async (tabId) => {
      normalizeOpenTabs()
      if (!tabId || tabId === activeTabId.value) return true
      return performTabSwitch(tabId, workspace)
    },
  }
}
