import type { Ref } from 'vue'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import type { WorkflowRecord } from '@/services/flow/workflow.service'
import type {
  FlowCanvasApi,
  FlowDefinitionLoadOptions,
  FlowEdge,
  FlowNode,
  FlowViewport,
  PersistedWorkflowDefinition,
  WorkflowDefinition,
  WorkflowNodeTypeDefinition,
  WorkflowSubgraph,
  WorkflowTab,
} from './flowCore.types'

export type MaybePromise<T> = T | Promise<T>

export interface SubgraphActionPayload {
  label?: string
  previousLabel?: string
  subgraphId: string
}

export interface SubgraphDeleteRequest {
  reason?: 'cut' | 'delete'
  subgraphs?: SubgraphActionPayload[]
}

export interface FlowRepairProgress {
  active?: boolean
  current?: number
  total?: number
}

export interface PastedSubgraphsPayload {
  subgraphs?: Record<string, WorkflowSubgraph>
}

export type WorkflowImportDefinition = Pick<WorkflowDefinition, 'nodes' | 'edges'> &
  Partial<Pick<WorkflowDefinition, 'viewport' | 'subgraphs' | 'activeGraphId' | 'shared'>> & {
    name?: string
    workflowId?: string
  }

export interface UseFlowTabCreationDeps {
  getActiveTab: () => WorkflowTab | null
  workflows?: Ref<WorkflowRecord[]>
  switchTab: (tabId: string) => MaybePromise<boolean>
  serializeNodes: (nodes: FlowNode[]) => FlowNode[]
  serializeEdges: (edges: FlowEdge[], nodes?: FlowNode[]) => FlowEdge[]
  getActiveCanvasNodesSnapshot: () => FlowNode[]
  getActiveCanvasEdgesSnapshot: (nodes?: FlowNode[]) => FlowEdge[]
  loadDefinition: (definition: unknown, options?: FlowDefinitionLoadOptions) => MaybePromise<void>
  restoreNodesFromAigcRecordIds: () => MaybePromise<void>
  onSave: () => Promise<boolean>
  saveDraft: () => Promise<void>
  saveTabs: () => MaybePromise<void>
}

export interface UseFlowTabCreationReturn {
  showNewWfModal: Ref<boolean>
  newWfName: Ref<string>
  newWfInputRef: Ref<{ focus?: () => void } | null>
  newWfModalTitle: Ref<string>
  pendingJsonImportData: Ref<WorkflowImportDefinition | null>
  addNewTab: () => void
  cancelNewWf: () => void
  confirmNewWf: (draft?: FlowCanvasCreateDraft) => Promise<void>
  createTabAndImportJson: (
    parsed: WorkflowImportDefinition,
    name: string,
    existingWorkflowId?: string,
  ) => Promise<void>
}

export interface UseSingleWorkflowLoaderOptions {
  activeGraphId: Ref<string>
  getGraphViewport: (
    graph: WorkflowDefinition | WorkflowSubgraph | null,
  ) => FlowViewport
  getHasUnsavedChanges: (tab: WorkflowTab | null) => boolean
  getTabGraph: (
    tab: WorkflowTab,
    graphId: string,
  ) => WorkflowDefinition | WorkflowSubgraph | null
  hydrateWorkflowDefinition: (definition: unknown) => WorkflowDefinition
  loadDefinition: (definition: unknown, options?: FlowDefinitionLoadOptions) => Promise<void>
  migrateSubgraphCards?: (tab: WorkflowTab) => boolean
  normalizeOpenWorkflowTabs?: () => void
  onSave: () => Promise<boolean>
  onUpdateShowWorkflowsPanel?: (value: boolean) => void
  renderedGraphId: Ref<string>
  restoreNodesFromAigcRecordIds: () => MaybePromise<void>
  saveTabs: () => MaybePromise<void>
}

export interface FlowPersistenceDeps {
  activeGraphId: Ref<string>
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  getActiveTab: () => WorkflowTab | null
  getGraphViewport: (graph: WorkflowDefinition | WorkflowSubgraph) => FlowViewport
  getTabGraph: (tab: WorkflowTab, graphId?: string) => WorkflowDefinition | WorkflowSubgraph | null
  hasUnsavedChanges: (tab: WorkflowTab) => boolean
  migrateSubgraphCards: (tab: WorkflowTab) => boolean
  normalizeOpenWorkflowTabs: () => void
  onUpdateShowWorkflowsPanel: (visible: boolean) => void
  openGraphInTab: (tab: WorkflowTab, graphId?: string) => MaybePromise<boolean>
  recordTabHistory: (tab?: WorkflowTab) => void
  renderedGraphId: Ref<string>
  requestExportSave?: (tabId: string) => void
  restoreNodesFromAigcRecordIds: () => MaybePromise<void>
  saveTabs: () => MaybePromise<void>
  syncCurrentGraphToActiveTab: () => void
}

export interface FlowSubgraphDeps {
  activeGraphId: Ref<string>
  getActiveTab: () => WorkflowTab | null
  getCanvasApi: () => FlowCanvasApi | null
  openGraphInTab: (tab: WorkflowTab, graphId?: string) => MaybePromise<boolean>
  recordTabHistory: (tab?: WorkflowTab) => void
  renderedGraphId: Ref<string>
  saveDraft: () => MaybePromise<void>
  saveTabs: () => MaybePromise<void>
  serializeEdges: (edgeList: FlowEdge[], nodeList?: FlowNode[]) => FlowEdge[]
  serializeNodes: (nodeList: FlowNode[]) => FlowNode[]
  syncCurrentGraphToActiveTab: () => void
}

export interface FlowTabsDeps {
  activeGraphId: Ref<string>
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  clearDraft?: () => MaybePromise<void>
  edgeStyle: Ref<string>
  ensureSubgraphsMap: (tab: WorkflowTab) => Record<string, WorkflowSubgraph>
  exportJSON: (tabId?: string, options?: { skipUnsavedPrompt?: boolean }) => MaybePromise<void>
  getActiveCanvasEdgesSnapshot: (nodes?: FlowNode[]) => FlowEdge[]
  getActiveCanvasNodesSnapshot: () => FlowNode[]
  getGraphViewport: (graph: WorkflowDefinition | WorkflowSubgraph) => FlowViewport
  getTabGraph: (tab: WorkflowTab, graphId?: string) => WorkflowDefinition | WorkflowSubgraph | null
  hydrateWorkflowDefinition: (definition: unknown) => WorkflowDefinition
  injectSubgraphCards: (tab: WorkflowTab, graphId?: string) => FlowNode[]
  loadDefinition: (definition: unknown, options?: FlowDefinitionLoadOptions) => MaybePromise<void>
  migrateSubgraphCards: (tab: WorkflowTab) => boolean
  nodeTypes: Ref<WorkflowNodeTypeDefinition[]>
  normalizeWorkflowDefinition: (definition: unknown) => PersistedWorkflowDefinition
  onSave: () => Promise<boolean>
  refreshWorkflows: () => MaybePromise<void>
  renderedGraphId: Ref<string>
  restoreNodesFromAigcRecordIds: () => MaybePromise<void>
  saveDraft: () => Promise<void>
  saveTabs: () => MaybePromise<void>
  serializeEdges: (edgeList: FlowEdge[], nodeList?: FlowNode[]) => FlowEdge[]
  serializeNodes: (nodeList: FlowNode[]) => FlowNode[]
  setTabGraph: (tab: WorkflowTab, graphId: string, graph: WorkflowDefinition | WorkflowSubgraph) => void
  showWorkflowPicker: Ref<boolean>
  stripSubgraphCards: (nodes: FlowNode[]) => FlowNode[]
  syncCurrentGraphToActiveTab: () => void
  syncSubgraphCardPositions: (tab: WorkflowTab, graphId: string, liveNodes: FlowNode[]) => void
  triggerImport: () => void
  workflows: Ref<WorkflowRecord[]>
}
