import type { FlowEdge, FlowNode } from './flowCore.types'
import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'
import { isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'
import { prepareFlowRuntime } from './flowDefinitionRuntime'

interface FlowReadonlyRuntimeOptions {
  sourceEdges: Readonly<Ref<FlowEdge[]>>
  sourceNodes: Readonly<Ref<FlowNode[]>>
}

export interface FlowReadonlyRuntimeState {
  closeInspector: () => void
  openInspector: (node: FlowNode) => void
  runtimeEdges: Ref<FlowEdge[]>
  runtimeNodes: Ref<FlowNode[]>
  selectedNode: Ref<FlowNode | null>
}

type NodePortRecord = { id?: unknown; visible?: unknown }

function readPorts(node: FlowNode, direction: 'input' | 'output'): NodePortRecord[] {
  const ports = node.data?.ports as { inputs?: unknown; outputs?: unknown } | undefined
  const value = direction === 'input' ? ports?.inputs : ports?.outputs
  return Array.isArray(value) ? value as NodePortRecord[] : []
}

function resolveHandle(node: FlowNode | undefined, direction: 'input' | 'output', current?: string | null): string | null | undefined {
  if (!node) return current
  const ports = readPorts(node, direction)
  if (!ports.length) return current
  const validIds = new Set(ports.map((port) => String(port.id || '')).filter(Boolean))
  if (current && validIds.has(current)) return current
  const primary = ports.find((port) => port.visible !== false) || ports[0]
  return primary?.id === undefined ? current : String(primary.id)
}

function restoreReadonlyEdges(edges: FlowEdge[], nodes: FlowNode[]): FlowEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  return edges
    .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
    .map((edge) => ({
      ...edge,
      sourceHandle: resolveHandle(nodeById.get(edge.source), 'output', edge.sourceHandle),
      targetHandle: resolveHandle(nodeById.get(edge.target), 'input', edge.targetHandle),
    }))
}

function isInspectableNode(node: FlowNode): boolean {
  const data = node.data || {}
  return isWorkflowGenerationResultNode(node)
    || Boolean(data.recordId || data.request || data._genState || data.defaultCapability)
    || ['text_generation', 'image_generation', 'video_generation', 'model_generation', 'audio_generation', 'camera_input', 'director_3d'].includes(node.type || '')
}

/**
 * Restores persisted workflow nodes for read-only rendering and loads inspection records on demand.
 * @param options Reactive persisted nodes and edges for the active graph
 * @returns Read-only runtime collections and inspector state
 */
export function useFlowReadonlyRuntime(options: FlowReadonlyRuntimeOptions): FlowReadonlyRuntimeState {
  const runtimeNodes = ref<FlowNode[]>([])
  const runtimeEdges = ref<FlowEdge[]>([])
  const selectedNode = ref<FlowNode | null>(null)
  let prepareController: AbortController | null = null

  async function rebuildRuntime(): Promise<void> {
    prepareController?.abort()
    const controller = new AbortController()
    prepareController = controller
    const prepared = await prepareFlowRuntime({
      nodes: options.sourceNodes.value,
      edges: options.sourceEdges.value,
      edgeStyle: 'default',
      nodeTypes: [],
      signal: controller.signal,
    })
    if (!prepared || controller.signal.aborted) return
    runtimeNodes.value = prepared.nodes
    runtimeEdges.value = restoreReadonlyEdges(options.sourceEdges.value, prepared.nodes)
    if (selectedNode.value) {
      selectedNode.value = prepared.nodes.find((node) => node.id === selectedNode.value?.id) || null
    }
  }

  function openInspector(node: FlowNode): void {
    if (!isInspectableNode(node)) return
    selectedNode.value = runtimeNodes.value.find((item) => item.id === node.id) || node
  }

  function closeInspector(): void {
    selectedNode.value = null
  }

  watch([options.sourceNodes, options.sourceEdges], () => void rebuildRuntime(), { immediate: true })
  onScopeDispose(() => prepareController?.abort())

  return {
    closeInspector,
    openInspector,
    runtimeEdges,
    runtimeNodes,
    selectedNode,
  }
}
