import type { Ref } from 'vue'
import type { AlignDirection, DistributeDirection } from '@/utils/nodeLayout'
import type {
  FlowEdge,
  FlowNode,
  WorkflowNodeTypeDefinition,
  WorkflowSubgraph,
} from '@/composables/flow/flowCore.types'

export interface FlowCanvasProps {
  activeGraphId: string
  allowSubgraphCreate: boolean
  modelEdges: FlowEdge[]
  modelNodes: FlowNode[]
  nodeTypes: WorkflowNodeTypeDefinition[]
  shortcuts: Record<string, unknown>
  subgraphDefinitions: Record<string, WorkflowSubgraph>
}

export type FlowCanvasEmit = (event: string, ...args: unknown[]) => void

export interface FlowCanvasLateBindings {
  arrangeNodes: () => void
  assignToGroupIfOverlapping: (node: FlowNode, x: number, y: number) => void
  buildUniquePastedSubgraphLabel: (label: string, occupiedNames?: Set<string>) => string
  clearMultiSelectionConnection: () => void
  clearSourceConnectionHighlight: () => void
  getExpandedSelectedNodes: () => FlowNode[]
  getGenerationCardHorizontalGap: (sourceNode?: unknown) => number
  handleAlign: (direction: AlignDirection) => void
  handleAutoLayout: () => void
  handleCompareSelected: () => void
  handleDistribute: (direction: DistributeDirection) => void
  handleGridDrop: (node: FlowNode, x: number, y: number) => boolean
  handleGroupSelected: () => void
  handleUngroupSelected: () => void
  hideGenerationPanel: () => void
  multiSelectionConnectorAnchor?: Ref<{ x: number; y: number } | null>
  normalizeSubgraphName: (value: string) => string
  openDetailModalForNodes: (nodes: unknown[]) => void
  refreshOpenGenerationPanelForNode: (nodeId: string) => void
  registerGridChildIfNeeded: (nodeId: string) => boolean
  revealManualGenerationPanel: (nodeId: string) => void
  stopPanelClickOutside: () => void
}
