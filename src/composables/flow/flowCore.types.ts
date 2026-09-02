import type { ElementData } from '@vue-flow/core'
import type { WorkflowRecord } from '@/services/flow/workflow.service'

export interface FlowPosition {
  x: number
  y: number
}

export interface FlowNode {
  id: string
  type?: string
  position: FlowPosition
  computedPosition?: FlowPosition
  dimensions?: { width?: number; height?: number }
  data: ElementData
  parentNode?: string
  extent?: 'parent' | [[number, number], [number, number]]
  style?: Record<string, unknown>
  zIndex?: number
  hidden?: boolean
  selected?: boolean
  [key: string]: unknown
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  data?: ElementData
  [key: string]: unknown
}

export interface FlowViewport {
  x: number
  y: number
  zoom: number
}

export interface FlowTabLoadOptions {
  activate?: boolean
}

export interface FlowDefinitionLoadOptions {
  normalized?: boolean
}

export interface FlowCanvasApi {
  getNodes?: () => FlowNode[]
  getEdges?: () => FlowEdge[]
  getViewport?: () => FlowViewport
  isViewportReady?: () => boolean
  repairGeneratingNodes?: () => void | Promise<void>
  refreshNodeInternals?: () => void
  setViewport?: (viewport: FlowViewport) => void | Promise<void>
}

export interface FlowSidebarApi {
  closeAllPanels?: () => void
}

export interface WorkflowSubgraph {
  id?: string
  name?: string
  parentGraphId?: string
  cardPosition?: { x: number; y: number }
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport?: FlowViewport
}

export interface WorkflowDefinition {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: FlowViewport
  subgraphs: Record<string, WorkflowSubgraph>
  activeGraphId?: string
  activeWorkflowId?: string
  activeWorkflowName?: string
  name?: string
  shared?: Record<string, unknown>
  timestamp?: number
  [key: string]: unknown
}

export interface PersistedWorkflowSubgraph {
  cardPosition?: FlowPosition
  id?: string
  name?: string
  parentGraphId?: string
  viewport?: FlowViewport
  [key: string]: unknown
}

export interface PersistedWorkflowDefinition {
  activeGraphId?: string
  activeWorkflowId?: string
  activeWorkflowName?: string
  edges: FlowEdge[]
  nodes: FlowNode[]
  shared?: {
    requests?: Record<string, unknown>[]
    strings?: string[]
  }
  subgraphs?: PersistedWorkflowSubgraph[] | Record<string, PersistedWorkflowSubgraph>
  timestamp?: number
  viewport: FlowViewport
  [key: string]: unknown
}

export interface WorkflowTabHistorySnapshot {
  canvasCache?: {
    edges: FlowEdge[]
    graphId: string
    nodes: FlowNode[]
  }
  definition: PersistedWorkflowDefinition
  activeGraphId: string
  name: string
  workflowId: string | null
  signature?: string
}

export interface WorkflowTab {
  id: string
  name: string
  workflowId: string | null
  isDraft: boolean
  activeGraphId: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: FlowViewport
  subgraphs: Record<string, WorkflowSubgraph>
  savedNodes?: FlowNode[]
  savedEdges?: FlowEdge[]
  savedSubgraphs?: Record<string, WorkflowSubgraph>
  __history?: WorkflowTabHistorySnapshot[]
  __historyIndex?: number
}

export interface PersistedWorkflowTab {
  activeGraphId?: string
  definition: PersistedWorkflowDefinition
  id: string
  isDraft: boolean
  name: string
  savedDefinition: PersistedWorkflowDefinition
  workflowId: string | null
}

export interface PersistedWorkflowTabs {
  activeTabId?: string
  tabs?: PersistedWorkflowTab[]
  version?: string
}

export interface PendingWorkflowSave {
  definition: WorkflowDefinition
  existingId: string
  name: string
  normalizedDefinition: PersistedWorkflowDefinition
}

export interface WorkflowCollectionRef {
  value: WorkflowRecord[]
}

export type WorkflowTabWithHistory = WorkflowTab & {
  __history: WorkflowTabHistorySnapshot[]
  __historyIndex: number
}

export interface WorkflowNodeTypeDefinition {
  type: string
  label?: string
  params?: unknown[]
  inputs?: unknown[]
  outputs?: unknown[]
  disableInputPorts?: boolean
  disableOutputPorts?: boolean
  mediaType?: string
  [key: string]: unknown
}
