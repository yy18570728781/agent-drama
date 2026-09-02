import { ref } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { updateWorkflow } from '@/services/flow/workflow.service'
import { removePersistedFlowTab } from '@/services/flow/flowTabSession.service'
import { hasFlowFileName, normalizeFlowFileName } from './flowNameValidation'
import { normalizeWorkflowTabId } from './flowTabIdentity'
import type { WorkflowDefinition, WorkflowTab } from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import type { FlowTabContextMenuState } from './useFlowTabMenu'
import {
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  cloneSerializable,
  edges,
  nodes,
  selectedNode,
  workflowTabs,
} from './useFlowCore'

interface UseFlowTabClosingOptions {
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  deps: FlowTabsDeps
  hasUnsavedChanges: (tab: WorkflowTab | null) => boolean
  hideTabContextMenu: () => void
  saveTabs: () => Promise<void>
  switchTab: (tabId: string) => Promise<boolean>
  syncCurrentGraphToActiveTab: () => void
  tabContextMenu: Ref<FlowTabContextMenuState>
}

interface ClosingContext extends UseFlowTabClosingOptions {
  openLibrary: () => void
  pendingCloseTabId: Ref<string | null>
  showUnsavedModal: Ref<boolean>
}

interface UseFlowTabClosingReturn {
  cancelClose: () => void
  closeWithoutSave: () => void
  doCloseTab: (tabId: string) => void
  onTabClose: () => void
  onTabCloseDirect: (tabId: string) => void
  pendingCloseTabId: Ref<string | null>
  saveAndCloseTab: () => Promise<void>
  showUnsavedModal: Ref<boolean>
}

function requestClose(context: ClosingContext, tabId: string): void {
  const tab = workflowTabs.value.find((item) => item.id === tabId)
  if (!tab) return
  if (context.hasUnsavedChanges(tab)) {
    context.pendingCloseTabId.value = tabId
    context.showUnsavedModal.value = true
    return
  }
  void closeTab(context, tabId)
}

async function closeTab(context: ClosingContext, tabId: string): Promise<void> {
  const tabIndex = workflowTabs.value.findIndex((tab) => tab.id === tabId)
  if (tabIndex === -1) return
  const targetTab = workflowTabs.value[tabIndex]
  const isActiveTab = activeTabId.value === tabId
  const nextTab = isActiveTab && workflowTabs.value.length > 1
    ? workflowTabs.value[tabIndex + 1] || workflowTabs.value[tabIndex - 1]
    : null

  if (nextTab && !(await context.switchTab(nextTab.id))) return
  workflowTabs.value.splice(tabIndex, 1)
  if (!workflowTabs.value.length) {
    activeTabId.value = ''
    activeWorkflowId.value = ''
    activeWorkflowName.value = ''
    nodes.value = []
    edges.value = []
    selectedNode.value = null
    void context.deps.refreshWorkflows()
    await context.saveTabs()
    await removePersistedFlowTab(targetTab, '')
    await context.deps.clearDraft?.()
    context.openLibrary()
    return
  }
  await context.saveTabs()
  await removePersistedFlowTab(targetTab, activeTabId.value)
}

async function saveRemoteTab(
  context: ClosingContext,
  tab: WorkflowTab,
  workflowId: string,
): Promise<void> {
  const name = normalizeFlowFileName(tab.name)
  if (!hasFlowFileName(name)) return
  const definition = context.deps.normalizeWorkflowDefinition(context.buildTabDefinition(tab))
  const savedWorkflow = await updateWorkflow(workflowId, {
    definition,
    historyLabel: '关闭前保存',
    name,
  })
  tab.workflowId = String(savedWorkflow?.id || workflowId).trim() || tab.workflowId
  tab.savedNodes = cloneSerializable(tab.nodes)
  tab.savedEdges = cloneSerializable(tab.edges)
  tab.savedSubgraphs = cloneSerializable(tab.subgraphs || {})
}

async function saveThenClose(context: ClosingContext): Promise<void> {
  context.showUnsavedModal.value = false
  const tabId = context.pendingCloseTabId.value
  const tab = workflowTabs.value.find((item) => item.id === tabId)
  if (tab) {
    if (tab.id === activeTabId.value) context.syncCurrentGraphToActiveTab()
    const workflowId = normalizeWorkflowTabId(tab.workflowId)
    try {
      if (workflowId) await saveRemoteTab(context, tab, workflowId)
      else {
        if (tab.id !== activeTabId.value && !(await context.switchTab(tab.id))) return
        if (!(await context.deps.onSave())) return
      }
    } catch (error) {
      console.error('保存工作流失败:', error)
      return
    }
  }
  if (tabId) await closeTab(context, tabId)
  context.pendingCloseTabId.value = null
}

/**
 * 管理工作流标签关闭及未保存内容确认。
 * @param options 标签关闭依赖
 * @returns 关闭状态与操作
 */
export function useFlowTabClosing(options: UseFlowTabClosingOptions): UseFlowTabClosingReturn {
  const route = useRoute()
  const router = useRouter()
  const context: ClosingContext = {
    ...options,
    openLibrary: () => {
      const value = Array.isArray(route.query.categoryId)
        ? route.query.categoryId[0]
        : route.query.categoryId
      void router.push({ name: 'flow', query: value ? { categoryId: String(value) } : {} })
    },
    pendingCloseTabId: ref<string | null>(null),
    showUnsavedModal: ref(false),
  }
  return {
    cancelClose: () => {
      context.showUnsavedModal.value = false
      context.pendingCloseTabId.value = null
    },
    closeWithoutSave: () => {
      context.showUnsavedModal.value = false
      if (context.pendingCloseTabId.value) void closeTab(context, context.pendingCloseTabId.value)
      context.pendingCloseTabId.value = null
    },
    doCloseTab: (tabId) => { void closeTab(context, tabId) },
    onTabClose: () => {
      context.hideTabContextMenu()
      if (context.tabContextMenu.value.tabId) requestClose(context, context.tabContextMenu.value.tabId)
    },
    onTabCloseDirect: (tabId) => requestClose(context, tabId),
    pendingCloseTabId: context.pendingCloseTabId,
    saveAndCloseTab: () => saveThenClose(context),
    showUnsavedModal: context.showUnsavedModal,
  }
}
