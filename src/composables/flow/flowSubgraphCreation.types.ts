import type { Ref } from 'vue'
import type {
  FlowEdge,
  FlowNode,
  FlowPosition,
  FlowViewport,
  WorkflowSubgraph,
  WorkflowTab,
} from './flowCore.types'

export type Position = FlowPosition
export type Viewport = FlowViewport
export type FlowNodeLike = FlowNode
export type FlowEdgeLike = FlowEdge
export type FlowSubgraphRecord = WorkflowSubgraph
export type WorkflowTabLike = WorkflowTab

export type ActiveGraphSnapshot = WorkflowSubgraph

export type CreateSubgraphPayload = {
  nodeIds?: string[]
  position?: Position
}

export type UseFlowSubgraphCreationDeps = {
  activeGraphId: Ref<string>
  getActiveTab: () => WorkflowTabLike | null
  ensureSubgraphsMap: (tab: WorkflowTabLike) => Record<string, FlowSubgraphRecord>
  hasDuplicateSubgraphName: (tab: WorkflowTabLike, name: string, excludeSubgraphId?: string) => boolean
  setTabGraph: (tab: WorkflowTabLike, graphId: string, graph: ActiveGraphSnapshot) => void
  expandSelectedGroupNodeIds: (nodeIds: string[], liveNodes: FlowNodeLike[]) => Set<string>
  serializeNodes: (nodes: FlowNodeLike[]) => FlowNodeLike[]
  serializeEdges: (edges: FlowEdgeLike[], nodes: FlowNodeLike[]) => FlowEdgeLike[]
  openGraphInTab: (tab: WorkflowTabLike, graphId?: string) => boolean | Promise<boolean>
  recordTabHistory: (tab?: WorkflowTabLike) => void
  saveDraft: () => void
  saveTabs: () => Promise<void> | void
}

export type UseFlowSubgraphCreationReturn = {
  promptSubgraphName: () => Promise<string>
  handleCreateSubgraph: (payload?: CreateSubgraphPayload) => Promise<void>
}
