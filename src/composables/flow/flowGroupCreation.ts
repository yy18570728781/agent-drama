import { createFlowId } from '@/utils/flowId'

interface Position {
  x: number
  y: number
}

interface GroupableNode {
  id: string
  position?: Partial<Position>
  computedPosition?: Partial<Position>
  dimensions?: { width?: number; height?: number }
  width?: number
  height?: number
}

export interface GroupCreationPlan {
  groupId: string
  groupNode: Record<string, unknown>
  childPositions: Map<string, Position>
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getAbsolutePosition(node: GroupableNode): Position {
  return {
    x: toFiniteNumber(node.computedPosition?.x, toFiniteNumber(node.position?.x, 0)),
    y: toFiniteNumber(node.computedPosition?.y, toFiniteNumber(node.position?.y, 0)),
  }
}

function getNodeSize(node: GroupableNode): { width: number; height: number } {
  return {
    width: toFiniteNumber(node.dimensions?.width, toFiniteNumber(node.width, 256)),
    height: toFiniteNumber(node.dimensions?.height, toFiniteNumber(node.height, 100)),
  }
}

function isGroupableNode(node: unknown): node is GroupableNode {
  return Boolean(node && typeof node === 'object' && typeof (node as { id?: unknown }).id === 'string')
}

/**
 * 创建保留节点绝对位置的画布分组计划。
 * @param selectedNodes 待打组的顶层节点
 * @returns 分组节点及每个子节点的组内相对坐标；无有效节点时返回 null
 */
export function buildGroupCreationPlan(selectedNodes: unknown[]): GroupCreationPlan | null {
  const nodes = selectedNodes.filter(isGroupableNode)
  if (!nodes.length) return null

  const bounds = nodes.map(node => ({ node, position: getAbsolutePosition(node), size: getNodeSize(node) }))
  const minX = Math.min(...bounds.map(item => item.position.x))
  const minY = Math.min(...bounds.map(item => item.position.y))
  const maxX = Math.max(...bounds.map(item => item.position.x + item.size.width))
  const maxY = Math.max(...bounds.map(item => item.position.y + item.size.height))
  const padding = 40
  const groupId = createFlowId('grp')
  const groupPosition = { x: minX - padding, y: minY - padding * 1.5 }
  return {
    groupId,
    childPositions: new Map(bounds.map(({ node, position }) => [
      node.id,
      { x: position.x - groupPosition.x, y: position.y - groupPosition.y },
    ])),
    groupNode: {
      id: groupId,
      type: 'groupNode',
      position: groupPosition,
      style: {
        width: `${maxX - minX + padding * 2}px`,
        height: `${maxY - minY + padding * 2.5}px`,
      },
      data: {
        label: '新分组',
        layoutMode: 'free',
      },
      zIndex: -1,
    },
  }
}
