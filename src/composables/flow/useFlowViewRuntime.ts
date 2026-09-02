import { ref } from 'vue'
import {
  ROOT_GRAPH_ID,
  getActiveCanvasEdgesSnapshot,
  getActiveCanvasNodesSnapshot,
  showWorkflowPicker,
} from './useFlowCore'
import { useFlowDragDrop } from './useFlowDragDrop'
import { useFlowNodeData } from './useFlowNodeData'
import { useFlowPersistence } from './useFlowPersistence'
import { useFlowSubgraph } from './useFlowSubgraph'
import { useFlowTabs } from './useFlowTabs'
import type { FlowPersistenceDeps, FlowSubgraphDeps, FlowTabsDeps } from './flowRuntime.types'
import type { FlowNode, WorkflowTab } from './flowCore.types'

type RuntimeDeps = FlowPersistenceDeps & FlowSubgraphDeps & FlowTabsDeps
type NodeDataRuntime = ReturnType<typeof useFlowNodeData>
type PersistenceRuntime = ReturnType<typeof useFlowPersistence>
type SubgraphRuntime = ReturnType<typeof useFlowSubgraph>
type TabsRuntime = ReturnType<typeof useFlowTabs>

interface FlowViewRuntimeReturn {
  deps: RuntimeDeps
  dragDrop: ReturnType<typeof useFlowDragDrop>
  nodeData: NodeDataRuntime
  persistence: PersistenceRuntime
  subgraph: SubgraphRuntime
  tabs: TabsRuntime
  bindShowWorkflowsPanel: (handler: (visible: boolean) => void) => void
}

function createRuntimeDeps(nodeData: NodeDataRuntime): RuntimeDeps {
  return {
    restoreNodesFromAigcRecordIds: nodeData.restoreNodesFromAigcRecordIds,
    activeGraphId: ref(ROOT_GRAPH_ID),
    renderedGraphId: ref(ROOT_GRAPH_ID),
  } as unknown as RuntimeDeps
}

function bindPersistenceDeps(
  deps: RuntimeDeps,
  persistence: PersistenceRuntime,
  getTabs: () => TabsRuntime,
  updateWorkflowsPanel: (visible: boolean) => void,
): void {
  Object.assign(deps, {
    clearDraft: persistence.clearDraft,
    saveDraft: persistence.saveDraft,
    saveTabs: () => getTabs().saveTabs(),
    serializeNodes: persistence.serializeNodes,
    serializeEdges: persistence.serializeEdges,
    loadDefinition: persistence.loadDefinition,
    sanitizeWorkflowDefinition: persistence.sanitizeWorkflowDefinition,
    normalizeWorkflowDefinition: persistence.normalizeWorkflowDefinition,
    hydrateWorkflowDefinition: persistence.hydrateWorkflowDefinition,
    workflows: persistence.workflows,
    getActiveTab: () => getTabs().getActiveTab(),
    buildTabDefinition: (tab: WorkflowTab) => getTabs().buildTabDefinition(tab),
    syncCurrentGraphToActiveTab: () => getTabs().syncCurrentGraphToActiveTab(),
    openGraphInTab: (tab: WorkflowTab, graphId?: string) => getTabs().openGraphInTab(tab, graphId),
    recordTabHistory: (tab?: WorkflowTab) => getTabs().recordTabHistory(tab),
    switchTab: (tabId: string) => getTabs().switchTab(tabId),
    hasUnsavedChanges: (tab: WorkflowTab) => getTabs().hasUnsavedChanges(tab),
    onUpdateShowWorkflowsPanel: updateWorkflowsPanel,
    onSave: persistence.onSave,
    exportJSON: persistence.exportJSON,
    triggerImport: persistence.triggerImport,
    refreshWorkflows: persistence.refreshWorkflows,
    showWorkflowPicker,
  })
}

function bindSubgraphDeps(deps: RuntimeDeps, subgraph: SubgraphRuntime): void {
  Object.assign(deps, {
    ensureSubgraphsMap: subgraph.ensureSubgraphsMap,
    getTabGraph: subgraph.getTabGraph,
    setTabGraph: subgraph.setTabGraph,
    injectSubgraphCards: subgraph.injectSubgraphCards,
    syncSubgraphCardPositions: subgraph.syncSubgraphCardPositions,
    stripSubgraphCards: subgraph.stripSubgraphCards,
    migrateSubgraphCards: subgraph.migrateSubgraphCards,
    getGraphViewport: subgraph.getGraphViewport,
    activeGraphId: subgraph.activeGraphId,
    renderedGraphId: subgraph.renderedGraphId,
    getActiveCanvasNodesSnapshot: () => getActiveCanvasNodesSnapshot(),
    getActiveCanvasEdgesSnapshot: (nodeList?: FlowNode[]) => getActiveCanvasEdgesSnapshot(nodeList),
  })
}

function bindTabsDeps(
  deps: RuntimeDeps,
  tabs: TabsRuntime,
  persistence: PersistenceRuntime,
  subgraph: SubgraphRuntime,
  nodeData: NodeDataRuntime,
): void {
  Object.assign(deps, {
    saveTabs: tabs.saveTabs,
    getActiveTab: tabs.getActiveTab,
    buildTabDefinition: tabs.buildTabDefinition,
    syncCurrentGraphToActiveTab: tabs.syncCurrentGraphToActiveTab,
    openGraphInTab: (tab: WorkflowTab, graphId?: string) => tabs.openGraphInTab(tab, graphId),
    recordTabHistory: tabs.recordTabHistory,
    switchTab: tabs.switchTab,
    hasUnsavedChanges: tabs.hasUnsavedChanges,
    normalizeOpenWorkflowTabs: tabs.normalizeOpenWorkflowTabs,
    normalizeWorkflowDefinition: persistence.normalizeWorkflowDefinition,
    hydrateWorkflowDefinition: persistence.hydrateWorkflowDefinition,
    restoreNodesFromAigcRecordIds: nodeData.restoreNodesFromAigcRecordIds,
    loadDefinition: persistence.loadDefinition,
    onSave: persistence.onSave,
    exportJSON: persistence.exportJSON,
    triggerImport: persistence.triggerImport,
    refreshWorkflows: persistence.refreshWorkflows,
    ensureSubgraphsMap: subgraph.ensureSubgraphsMap,
    getTabGraph: subgraph.getTabGraph,
    setTabGraph: subgraph.setTabGraph,
    getGraphViewport: subgraph.getGraphViewport,
    injectSubgraphCards: subgraph.injectSubgraphCards,
    syncSubgraphCardPositions: subgraph.syncSubgraphCardPositions,
    stripSubgraphCards: subgraph.stripSubgraphCards,
    migrateSubgraphCards: subgraph.migrateSubgraphCards,
    renderedGraphId: subgraph.renderedGraphId,
    activeGraphId: subgraph.activeGraphId,
    serializeNodes: persistence.serializeNodes,
    serializeEdges: persistence.serializeEdges,
    saveDraft: persistence.saveDraft,
    showWorkflowPicker,
    requestExportSave: (tabId: string) => tabs.requestExportSave(tabId),
  })
}

function createDragDrop(tabs: TabsRuntime): ReturnType<typeof useFlowDragDrop> {
  return useFlowDragDrop({
    pendingJsonImportData: tabs.pendingJsonImportData,
    newWfName: tabs.newWfName,
    newWfInputRef: tabs.newWfInputRef,
    newWfModalTitle: tabs.newWfModalTitle,
    showNewWfModal: tabs.showNewWfModal,
  })
}

/**
 * 按依赖顺序装配 FlowView 的持久化、子图、标签页和拖放运行时。
 * @returns FlowView 子模块与延迟绑定入口。
 */
export function useFlowViewRuntime(): FlowViewRuntimeReturn {
  const nodeData = useFlowNodeData()
  const deps = createRuntimeDeps(nodeData)
  let updateWorkflowsPanel = (_visible: boolean): void => undefined
  let tabsRuntime: TabsRuntime | null = null
  const getTabs = (): TabsRuntime => {
    if (!tabsRuntime) throw new Error('Flow tabs runtime is not initialized')
    return tabsRuntime
  }

  const persistence = useFlowPersistence(deps)
  bindPersistenceDeps(deps, persistence, getTabs, (visible) => updateWorkflowsPanel(visible))
  const subgraph = useFlowSubgraph(deps)
  bindSubgraphDeps(deps, subgraph)
  const tabs = useFlowTabs(deps)
  tabsRuntime = tabs
  bindTabsDeps(deps, tabs, persistence, subgraph, nodeData)

  return {
    deps,
    dragDrop: createDragDrop(tabs),
    nodeData,
    persistence,
    subgraph,
    tabs,
    bindShowWorkflowsPanel: (handler) => { updateWorkflowsPanel = handler },
  }
}
