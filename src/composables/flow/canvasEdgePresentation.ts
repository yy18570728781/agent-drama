import type { FlowEdge, FlowNode } from './flowCore.types'

interface CanvasEdgePresentationOptions {
  clearSelection: boolean
  edges: FlowEdge[]
  hidden: boolean
  largeCanvas: boolean
  nodes: FlowNode[]
  selectedNodes: FlowNode[]
}

interface NodeRelations {
  downstream: Set<string>
  related: Set<string>
  upstream: Set<string>
}

interface EdgePresentationStyle {
  filter: string
  opacity: number
  stroke: string
  strokeWidth: number
}

const HIDDEN_EDGE_STYLE: EdgePresentationStyle = {
  filter: 'none',
  opacity: 0,
  stroke: 'transparent',
  strokeWidth: 1,
}

function applyEdgePresentation(
  edge: FlowEdge,
  animated: boolean,
  style: EdgePresentationStyle,
): void {
  if (edge.animated !== animated) edge.animated = animated
  const current = edge.style
  if (
    current && typeof current === 'object'
    && (current as Record<string, unknown>).stroke === style.stroke
    && (current as Record<string, unknown>).strokeWidth === style.strokeWidth
    && (current as Record<string, unknown>).opacity === style.opacity
    && (current as Record<string, unknown>).filter === style.filter
  ) return
  edge.style = style
}

function applyNodeClass(node: FlowNode, tokens: Set<string>): void {
  const nextClass = Array.from(tokens).join(' ')
  if (node.class !== nextClass) node.class = nextClass
}

function classTokensOf(node: FlowNode): Set<string> {
  const tokens = String(node.class || '').split(/\s+/).filter(Boolean)
  const result = new Set(tokens)
  result.delete('is-selection-related')
  result.delete('is-selection-upstream')
  result.delete('is-selection-downstream')
  return result
}

function clearPresentation(options: CanvasEdgePresentationOptions): void {
  options.edges.forEach((edge) => {
    if (options.clearSelection) edge.selected = false
    applyEdgePresentation(edge, false, HIDDEN_EDGE_STYLE)
  })
  options.nodes.forEach((node) => applyNodeClass(node, classTokensOf(node)))
}

function updateEdgeAndCollectRelations(
  edge: FlowEdge,
  selectedNodeIds: Set<string>,
  relations: NodeRelations,
  largeCanvas: boolean,
): void {
  const connected = selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)
  const highlighted = Boolean(edge.selected) || connected
  const animated = !largeCanvas && !highlighted
  if (connected) {
    relations.related.add(edge.source)
    relations.related.add(edge.target)
    if (selectedNodeIds.has(edge.target)) relations.upstream.add(edge.source)
    if (selectedNodeIds.has(edge.source)) relations.downstream.add(edge.target)
  }
  applyEdgePresentation(edge, animated, {
    stroke: highlighted ? '#93c5fd' : '#52525b',
    strokeWidth: highlighted ? 3.6 : 2,
    opacity: highlighted ? 1 : 0.72,
    filter: highlighted
      ? 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.55)) drop-shadow(0 0 18px rgba(59, 130, 246, 0.32))'
      : 'none',
  })
}

function applyNodeRelations(
  node: FlowNode,
  selectedNodeIds: Set<string>,
  relations: NodeRelations,
): void {
  const tokens = classTokensOf(node)
  if (!selectedNodeIds.has(node.id) && relations.related.has(node.id)) {
    tokens.add('is-selection-related')
    if (relations.upstream.has(node.id)) tokens.add('is-selection-upstream')
    if (relations.downstream.has(node.id)) tokens.add('is-selection-downstream')
  }
  applyNodeClass(node, tokens)
}

/**
 * 以线性复杂度同步大画布的边动画和选中关系样式。
 * @param options 当前节点、连线、选中状态与渲染模式
 * @returns 无返回值，直接更新 Vue Flow 元素展示字段
 */
export function updateCanvasEdgePresentation(options: CanvasEdgePresentationOptions): void {
  if (options.hidden) {
    clearPresentation(options)
    return
  }
  const selectedNodeIds = new Set(options.selectedNodes.map((node) => node.id))
  const relations: NodeRelations = {
    downstream: new Set<string>(),
    related: new Set<string>(),
    upstream: new Set<string>(),
  }
  options.edges.forEach((edge) => {
    updateEdgeAndCollectRelations(edge, selectedNodeIds, relations, options.largeCanvas)
  })
  options.nodes.forEach((node) => applyNodeRelations(node, selectedNodeIds, relations))
}
