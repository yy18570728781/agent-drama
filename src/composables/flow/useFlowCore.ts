import { ref, computed } from 'vue'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { logPersistedEdgeFiltering } from './edgeDebug'
import type {
  FlowCanvasApi,
  FlowEdge,
  FlowNode,
  WorkflowNodeTypeDefinition,
  WorkflowTab,
} from './flowCore.types'

// ==================== 常量 ====================

export const DRAFT_STORAGE_KEY = 'workflow_draft'

export const BUILTIN_WORKFLOW_NODE_TYPES = [
  {
    type: 'annotation_note',
    label: '文字标注',
    params: [],
    inputs: [],
    outputs: [],
    disableInputPorts: true,
    disableOutputPorts: true,
    mediaType: 'text',
  },
]

export const ROOT_GRAPH_ID = 'root'

// ==================== 状态 ====================

export const nodes = ref<FlowNode[]>([])
export const edges = ref<FlowEdge[]>([])
export const selectedNode = ref<FlowNode | null>(null)
export const nodeTypes = ref<WorkflowNodeTypeDefinition[]>([])
export const capabilityPorts = ref<Record<string, unknown>>({})
export const isLoadingWorkflow = ref(false)
export const loadProgress = ref(0)
export const loadProgressText = ref('')
export let loadAbortController: AbortController | null = null

export function setLoadAbortController(val: AbortController | null): void {
  loadAbortController = val
}

export const showWorkflowPicker = ref(false)
export const activeWorkflowId = ref('')
export const activeWorkflowName = ref('')
export const canvasRef = ref<FlowCanvasApi | null>(null)
export const workflowTabs = ref<WorkflowTab[]>([])
export const activeTabId = ref('')
export const isWorkflowSwitching = ref(false)

export const director3DOverlayVisible = ref(false)
export const imageEditorVisible = ref(false)
export const editorKeyHandler = ref<((event: KeyboardEvent) => void) | null>(null)
export const director3DActiveNodeId = ref('')
export const director3DActiveNode = ref<FlowNode | null>(null)

export const { edgeStyle } = useTheme()

export const initialized = { value: false }
export function setInitialized(val: boolean): void {
  initialized.value = val
}

// ==================== Computed ====================

export const currentCanvasNodeCount = computed(() => filterPersistedNodes(nodes.value).length)

// ==================== 工具函数 ====================

export function mergeBuiltinWorkflowNodeTypes(
  remoteNodeTypes: WorkflowNodeTypeDefinition[] = [],
): WorkflowNodeTypeDefinition[] {
  const merged = Array.isArray(remoteNodeTypes) ? [...remoteNodeTypes] : []
  const existingTypes = new Set(merged.map((item) => String(item?.type || '').trim()).filter(Boolean))
  BUILTIN_WORKFLOW_NODE_TYPES.forEach((typeDef) => {
    if (!existingTypes.has(typeDef.type)) {
      merged.push({ ...typeDef })
    }
  })
  return merged
}

export function isTransientWorkflowNode(node: FlowNode): boolean {
  const data = node?.data || {}
  if (!data._multiResultForNodeId) return false
  return !data.recordId && !data.url && !data.thumb && data.status !== 'completed'
}

export function filterPersistedNodes(nodeList: FlowNode[] = []): FlowNode[] {
  return (nodeList || []).filter((node) => !isTransientWorkflowNode(node))
}

export function filterPersistedEdges(
  edgeList: FlowEdge[],
  nodeList: FlowNode[] = nodes.value,
): FlowEdge[] {
  const persistedNodeIds = new Set(filterPersistedNodes(nodeList).map((node) => node.id))
  const persistedEdges = (edgeList || []).filter((edge) => persistedNodeIds.has(edge.source) && persistedNodeIds.has(edge.target))
  logPersistedEdgeFiltering(edgeList || [], persistedEdges, nodeList)
  return persistedEdges
}

export function cloneSerializable<T>(value: T): T {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function getActiveCanvasNodesSnapshot(): FlowNode[] {
  const canvasNodes = canvasRef.value?.getNodes?.()
  return filterPersistedNodes(Array.isArray(canvasNodes) ? canvasNodes : nodes.value)
}

export function getActiveCanvasEdgesSnapshot(
  nodeList: FlowNode[] = getActiveCanvasNodesSnapshot(),
): FlowEdge[] {
  const canvasEdges = canvasRef.value?.getEdges?.()
  return filterPersistedEdges(Array.isArray(canvasEdges) ? canvasEdges : edges.value, nodeList)
}

export function getNodeBoxSize(node: FlowNode): { width: number; height: number } {
  const style = typeof node.style === 'object' ? node.style : undefined
  const styleWidth = parseFloat(String(style?.width || ''))
  const styleHeight = parseFloat(String(style?.height || ''))
  return {
    width: Number.isFinite(styleWidth) ? styleWidth : (node?.dimensions?.width || 320),
    height: Number.isFinite(styleHeight) ? styleHeight : (node?.dimensions?.height || 180),
  }
}

export function normalizeSubgraphName(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

export function getRootSubgraphNodes(nodeList: FlowNode[] = []): FlowNode[] {
  return (nodeList || []).filter((node) => node?.type === 'subgraph' && node?.data?.subgraphId)
}
