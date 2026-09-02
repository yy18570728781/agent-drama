import { buildRuntimeWorkflowNodeData } from '@/utils/workflowNodeData'
import { applyPersistedWorkflowTaskData } from './workflowTaskState'
import { canvasRef } from './useFlowCore'
import {
  ANIMATED_EDGE_RENDER_LIMIT,
  FLOW_PREPARE_BATCH_SIZE,
  VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD,
} from './flowPerformance.constants'
import type {
  FlowEdge,
  FlowNode,
  WorkflowNodeTypeDefinition,
} from './flowCore.types'

interface PrepareFlowRuntimeOptions {
  edges: FlowEdge[]
  edgeStyle: string
  nodes: FlowNode[]
  nodeTypes: WorkflowNodeTypeDefinition[]
  onProgress?: (loaded: number, total: number) => void
  signal: AbortSignal
}

export interface PreparedFlowRuntime {
  edges: FlowEdge[]
  nodes: FlowNode[]
}

function readNodeDimension(node: FlowNode, key: 'width' | 'height', fallback: number): number {
  const dimension = Number(node.dimensions?.[key])
  if (dimension > 0) return dimension
  const styled = Number.parseFloat(String(node.style?.[key] || ''))
  return styled > 0 ? styled : fallback
}

function restoreRuntimeNode(
  node: FlowNode,
  typeDefinition: WorkflowNodeTypeDefinition,
): FlowNode {
  const restored: FlowNode = {
    id: node.id,
    type: node.type,
    position: node.position || { x: 0, y: 0 },
    dimensions: {
      width: readNodeDimension(node, 'width', 320),
      height: readNodeDimension(node, 'height', 180),
    },
    data: applyPersistedWorkflowTaskData(
      node.data,
      buildRuntimeWorkflowNodeData(node.data, node.type || '', typeDefinition),
    ),
  }
  if (node.parentNode) restored.parentNode = node.parentNode
  if (node.extent !== undefined) restored.extent = node.extent
  if (node.style) restored.style = node.style
  if (node.zIndex !== undefined) restored.zIndex = node.zIndex
  return restored
}

function waitForRenderFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function yieldRuntimePreparation(): Promise<void> {
  const scheduler = (globalThis as {
    scheduler?: { yield?: () => Promise<void> }
  }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      resolve()
    }
    channel.port2.postMessage(undefined)
  })
}

function readVisibleFlowGeometry(): string {
  const canvas = document.querySelector('.flow-canvas-wrapper')
  if (!(canvas instanceof HTMLElement)) return ''
  const nodeGeometry = Array.from(canvas.querySelectorAll<HTMLElement>('.vue-flow__node[data-id]'))
    .map((node) => {
      const rect = node.getBoundingClientRect()
      return `${node.dataset.id}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`
    })
  const edgeGeometry = Array.from(canvas.querySelectorAll<SVGPathElement>('.vue-flow__edge path'))
    .map((path) => path.getAttribute('d') || '')
  return JSON.stringify([nodeGeometry, edgeGeometry])
}

/**
 * 等待 Vue Flow 完成首轮 DOM 挂载和路径计算，避免遮罩消失时连线仍在跳动。
 * @param signal 工作流加载取消信号
 * @returns 可见元素几何连续稳定后完成的 Promise
 */
export async function waitForFlowRenderSettled(signal?: AbortSignal): Promise<void> {
  const startedAt = performance.now()
  let lastChangedAt = startedAt
  let previousSignature = ''
  while (performance.now() - startedAt < 1_200) {
    await waitForRenderFrame()
    if (signal?.aborted) return
    const signature = readVisibleFlowGeometry()
    if (!signature || signature !== previousSignature) {
      previousSignature = signature
      lastChangedAt = performance.now()
      continue
    }
    if (performance.now() - lastChangedAt >= 180) return
  }
}

/**
 * 完成节点运行态修复并等待 Vue Flow 几何稳定。
 * @param restoreNodes 节点媒体与任务数据修复函数
 * @param hasNodes 当前定义是否包含节点
 * @param showProgress 是否需要等待大画布渲染稳定
 * @param signal 工作流加载取消信号
 * @returns 修复和渲染稳定后完成的 Promise
 */
export async function restoreAndSettleFlowRuntime(
  restoreNodes: () => void | Promise<void>,
  hasNodes: boolean,
  showProgress: boolean,
  signal: AbortSignal,
): Promise<void> {
  if (hasNodes) await restoreNodes()
  if (signal.aborted || !hasNodes) return
  await waitForRenderFrame()
  canvasRef.value?.refreshNodeInternals?.()
  await waitForRenderFrame()
  canvasRef.value?.refreshNodeInternals?.()
  if (showProgress) await waitForFlowRenderSettled(signal)
}

function prepareRuntimeEdges(
  edgeList: FlowEdge[],
  nodeList: FlowNode[],
  edgeStyle: string,
): FlowEdge[] {
  const nodeIds = new Set(nodeList.map((node) => node.id))
  const animateEdges = nodeList.length <= VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD
    && edgeList.length <= ANIMATED_EDGE_RENDER_LIMIT
  return edgeList
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({ ...edge, animated: animateEdges, type: edgeStyle }))
}

/**
 * 在普通数组中分片恢复运行时节点，避免每个分片都触发 Vue Flow 全量重渲染。
 * @param options 待恢复的节点、连线、节点类型及取消信号
 * @returns 完整运行时元素；任务取消时返回 null
 */
export async function prepareFlowRuntime(
  options: PrepareFlowRuntimeOptions,
): Promise<PreparedFlowRuntime | null> {
  const typeDefinitions = new Map(options.nodeTypes.map((item) => [item.type, item]))
  const runtimeNodes: FlowNode[] = []
  for (let index = 0; index < options.nodes.length; index += FLOW_PREPARE_BATCH_SIZE) {
    if (options.signal.aborted) return null
    const batch = options.nodes.slice(index, index + FLOW_PREPARE_BATCH_SIZE)
    batch.forEach((node) => {
      runtimeNodes.push(restoreRuntimeNode(node, typeDefinitions.get(node.type || '') || { type: node.type || '' }))
    })
    options.onProgress?.(runtimeNodes.length, options.nodes.length)
    if (runtimeNodes.length < options.nodes.length) await yieldRuntimePreparation()
  }
  if (options.signal.aborted) return null
  return {
    nodes: runtimeNodes,
    edges: prepareRuntimeEdges(options.edges, runtimeNodes, options.edgeStyle),
  }
}
