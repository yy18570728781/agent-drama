import { idbGet, idbSet } from '@/utils/indexedDBStorage'
import { hasDefinitionChanges } from './flowDirtyCheck'
import { hasFlowTabUnsavedChanges } from './flowTabDirtyState'
import { normalizeWorkflowTabName, pickWorkflowTab } from './flowTabCollection'
import { dedupeWorkflowTabs, normalizeWorkflowTabId } from './flowTabIdentity'
import type {
  FlowTabLoadOptions,
  PersistedWorkflowTabs,
  WorkflowDefinition,
  WorkflowTab,
} from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  cloneSerializable,
  initialized,
  workflowTabs,
} from './useFlowCore'

interface UseFlowTabSessionOptions {
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  deps: FlowTabsDeps
  getActiveTab: () => WorkflowTab | null
  getGraphIdToSync: () => string
  normalizeOpenWorkflowTabs: () => void
  openGraphInTab: (tab: WorkflowTab, graphId?: string) => Promise<boolean>
  prunePlaceholderDraftTabs: () => void
  syncCurrentGraphToActiveTab: () => void
}

interface UseFlowTabSessionReturn {
  handleBeforeUnload: () => void
  hasUnsavedChanges: (tab: WorkflowTab | null) => boolean
  loadTabs: (loadOptions?: FlowTabLoadOptions) => Promise<boolean>
  saveTabs: () => Promise<void>
}

const TABS_STORAGE_KEY = 'workflow_tabs'

async function saveTabs(options: UseFlowTabSessionOptions): Promise<void> {
  try {
    if (options.getActiveTab()) options.syncCurrentGraphToActiveTab()
    if (!initialized.value) return
    options.prunePlaceholderDraftTabs()
    const tabs = [...workflowTabs.value]
    const activeTab = pickWorkflowTab(tabs, activeTabId.value)
    const tabsData: PersistedWorkflowTabs = {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        name: tab.name,
        workflowId: normalizeWorkflowTabId(tab.workflowId),
        isDraft: tab.isDraft,
        definition: options.deps.normalizeWorkflowDefinition(options.buildTabDefinition(tab)),
        savedDefinition: options.deps.normalizeWorkflowDefinition({
          nodes: tab.savedNodes || [],
          edges: tab.savedEdges || [],
          viewport: tab.viewport || { zoom: 1, x: 0, y: 0 },
          subgraphs: cloneSerializable(tab.savedSubgraphs || {}),
        }),
      })),
      activeTabId: activeTab?.id || '',
      version: '1.0',
    }
    await idbSet(TABS_STORAGE_KEY, tabsData)
  } catch (error) {
    console.error('保存标签页失败:', error)
  }
}

function restoreTabs(data: PersistedWorkflowTabs, options: UseFlowTabSessionOptions): WorkflowTab[] {
  return dedupeWorkflowTabs((data.tabs || []).map((tab) => {
    const definition = options.deps.hydrateWorkflowDefinition(tab.definition || {})
    const savedDefinition = options.deps.hydrateWorkflowDefinition(tab.savedDefinition || {})
    return {
      id: tab.id,
      name: normalizeWorkflowTabName(tab.name, tab.workflowId, tab.isDraft),
      workflowId: normalizeWorkflowTabId(tab.workflowId),
      isDraft: !!tab.isDraft,
      nodes: definition.nodes || [],
      edges: definition.edges || [],
      viewport: definition.viewport || { zoom: 1, x: 0, y: 0 },
      subgraphs: definition.subgraphs || {},
      activeGraphId: definition.activeGraphId || tab.activeGraphId || ROOT_GRAPH_ID,
      savedNodes: savedDefinition.nodes || [],
      savedEdges: savedDefinition.edges || [],
      savedSubgraphs: savedDefinition.subgraphs || {},
    }
  }))
}

function migrateTabDefinitions(tab: WorkflowTab, deps: FlowTabsDeps): void {
  deps.migrateSubgraphCards(tab)
  const savedTab = cloneSerializable({
    ...tab,
    nodes: tab.savedNodes || [],
    edges: tab.savedEdges || [],
    subgraphs: tab.savedSubgraphs || {},
  })
  deps.migrateSubgraphCards(savedTab)
  tab.savedNodes = cloneSerializable(savedTab.nodes)
  tab.savedEdges = cloneSerializable(savedTab.edges)
  tab.savedSubgraphs = cloneSerializable(savedTab.subgraphs || {})
}

function hasCleanStoredBaseline(options: UseFlowTabSessionOptions, tab: WorkflowTab): boolean {
  return !hasDefinitionChanges(
    options.deps.normalizeWorkflowDefinition,
    { nodes: tab.nodes, edges: tab.edges, subgraphs: tab.subgraphs },
    {
      nodes: tab.savedNodes || [],
      edges: tab.savedEdges || [],
      subgraphs: tab.savedSubgraphs || {},
    },
  )
}

function rebaseHydratedTab(options: UseFlowTabSessionOptions, tab: WorkflowTab): void {
  options.syncCurrentGraphToActiveTab()
  tab.savedNodes = cloneSerializable(tab.nodes)
  tab.savedEdges = cloneSerializable(tab.edges)
  tab.savedSubgraphs = cloneSerializable(tab.subgraphs || {})
}

async function loadTabs(
  options: UseFlowTabSessionOptions,
  loadOptions: FlowTabLoadOptions = {},
): Promise<boolean> {
  try {
    const data = await idbGet<PersistedWorkflowTabs>(TABS_STORAGE_KEY)
    if (!data?.tabs?.length) {
      workflowTabs.value = []
      activeTabId.value = ''
      activeWorkflowId.value = ''
      activeWorkflowName.value = ''
      return false
    }
    workflowTabs.value = restoreTabs(data, options)
    activeTabId.value = data.activeTabId || workflowTabs.value[0]?.id || ''
    options.normalizeOpenWorkflowTabs()
    workflowTabs.value.forEach((tab) => migrateTabDefinitions(tab, options.deps))
    if (loadOptions.activate === false) {
      activeTabId.value = ''
      activeWorkflowId.value = ''
      activeWorkflowName.value = ''
      return true
    }
    const activeTab = options.getActiveTab()
    if (activeTab) {
      const shouldRebaseHydratedTab = hasCleanStoredBaseline(options, activeTab)
      await options.openGraphInTab(activeTab, activeTab.activeGraphId || ROOT_GRAPH_ID)
      activeWorkflowId.value = activeTab.workflowId || ''
      activeWorkflowName.value = activeTab.name || ''
      if (shouldRebaseHydratedTab) rebaseHydratedTab(options, activeTab)
    }
    return true
  } catch (error) {
    console.error('加载标签页失败:', error)
    return false
  }
}

/**
 * 管理多工作流标签的本地恢复、持久化与未保存状态检测。
 * @param options 标签会话依赖
 * @returns 会话状态操作
 */
export function useFlowTabSession(options: UseFlowTabSessionOptions): UseFlowTabSessionReturn {
  return {
    handleBeforeUnload: () => {
      if (workflowTabs.value.length) void options.deps.saveDraft()
      void saveTabs(options)
    },
    hasUnsavedChanges: (tab) => hasFlowTabUnsavedChanges(options, tab),
    loadTabs: (loadOptions) => loadTabs(options, loadOptions),
    saveTabs: () => saveTabs(options),
  }
}
