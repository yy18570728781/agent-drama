import { canvasRef, cloneSerializable, filterPersistedNodes } from './useFlowCore'
import type { FlowEdgeLike, FlowNodeLike, FlowSubgraphRecord, Position, Viewport } from './flowSubgraphCreation.types'

export function buildViewport(): Viewport {
  return canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 }
}

export function countGraphVisibleItems(
  subgraphs: Record<string, FlowSubgraphRecord>,
  graphId: string,
): number {
  return countGraphTotalNodes(subgraphs, graphId)
}

export function countGraphTotalNodes(
  subgraphs: Record<string, FlowSubgraphRecord>,
  graphId: string,
  currentGraphNodeCount?: number,
  visited = new Set<string>(),
): number {
  if (visited.has(graphId)) return 0
  visited.add(graphId)

  const graphDefinition = graphId === 'root' ? null : subgraphs[graphId]
  const persistedNodeCount = typeof currentGraphNodeCount === 'number'
    ? currentGraphNodeCount
    : filterPersistedNodes(graphDefinition?.nodes || []).length

  const childNodeCount = Object.entries(subgraphs).reduce((total, [, definition]) => {
    const parentId = String(definition?.parentGraphId || '').trim() || 'root'
    if (parentId !== graphId || !definition?.id) return total
    return total + countGraphTotalNodes(subgraphs, definition.id, undefined, visited)
  }, 0)

  return persistedNodeCount + childNodeCount
}

export function buildSubgraphCardNode(
  subgraphs: Record<string, FlowSubgraphRecord>,
  subgraphId: string,
  definition: FlowSubgraphRecord,
): FlowNodeLike {
  const nodeCount = countGraphVisibleItems(subgraphs, subgraphId)
  const position = definition.cardPosition || { x: 0, y: 0 }
  return {
    id: `node_${subgraphId}`,
    type: 'subgraph',
    position: { x: position.x || 0, y: position.y || 0 },
    data: {
      label: definition.name || '子图',
      subgraphId,
      nodeCount,
    },
    style: {
      width: '240px',
      height: '88px',
    },
  }
}

export function stripSubgraphCards(nodeList: FlowNodeLike[]): FlowNodeLike[] {
  return nodeList.filter((node) => node?.type !== 'subgraph')
}

export function injectSubgraphCards(
  subgraphs: Record<string, FlowSubgraphRecord>,
  graphId: string,
): FlowNodeLike[] {
  return Object.entries(subgraphs)
    .filter(([, def]) => {
      const parentId = (def?.parentGraphId || '').trim()
      return parentId === graphId || (!parentId && graphId === 'root')
    })
    .map(([subgraphId, def]) => buildSubgraphCardNode(subgraphs, subgraphId, def))
}

export function syncSubgraphCardPositions(
  subgraphs: Record<string, FlowSubgraphRecord>,
  liveNodes: FlowNodeLike[],
): void {
  for (const node of liveNodes) {
    if (node?.type !== 'subgraph' || !node?.data?.subgraphId) continue
    const subgraphId = String(node.data.subgraphId).trim()
    if (!subgraphId) continue
    const def = subgraphs[subgraphId]
    if (!def) continue
    def.cardPosition = {
      x: node.position?.x ?? node.computedPosition?.x ?? 0,
      y: node.position?.y ?? node.computedPosition?.y ?? 0,
    }
    if (node.data?.label) {
      def.name = String(node.data.label).trim() || def.name || '子图'
    }
  }
}

export function validateSubgraphSelection(
  selectedNodes: FlowNodeLike[],
  selectedIdSet: Set<string>,
  liveEdges: FlowEdgeLike[],
): string {
  if (selectedNodes.length < 1) return '未找到可打成子图的节点'
  if (selectedNodes.some((node) => node.type === 'subgraph')) return '当前版本暂不支持把子图再次打成子图'
  if (selectedNodes.some((node) => node.parentNode && !selectedIdSet.has(node.parentNode))) {
    return '组内节点请直接选中整个分组后再打成子图'
  }

  const hasCrossingEdge = liveEdges.some((edge) => selectedIdSet.has(edge.source) !== selectedIdSet.has(edge.target))
  return hasCrossingEdge ? '子图暂不允许和外部节点交叉连线，请先整理选区' : ''
}

export function measureSelectedNodeBounds(selectedNodes: FlowNodeLike[]): { minX: number; minY: number } {
  let minX = Infinity
  let minY = Infinity

  selectedNodes.forEach((node) => {
    const x = node.computedPosition?.x ?? node.position?.x ?? 0
    const y = node.computedPosition?.y ?? node.position?.y ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
  })

  return {
    minX: Number.isFinite(minX) ? minX : 0,
    minY: Number.isFinite(minY) ? minY : 0,
  }
}

export function buildInnerNodes(
  selectedNodes: FlowNodeLike[],
  selectedIdSet: Set<string>,
  minX: number,
  minY: number,
  serializeNodes: (nodes: FlowNodeLike[]) => FlowNodeLike[],
): FlowNodeLike[] {
  const padding = 48
  const absolutePositionMap = new Map(
    selectedNodes.map((node) => [node.id, {
      x: node.computedPosition?.x ?? node.position?.x ?? 0,
      y: node.computedPosition?.y ?? node.position?.y ?? 0,
    }])
  )

  return serializeNodes(selectedNodes).map((node) => {
    const absolute = absolutePositionMap.get(node.id) || { x: node.position?.x || 0, y: node.position?.y || 0 }
    const nextNode = cloneSerializable(node)
    if (!node.parentNode || !selectedIdSet.has(node.parentNode)) {
      nextNode.position = {
        x: absolute.x - minX + padding,
        y: absolute.y - minY + padding,
      }
    }
    return nextNode
  })
}
