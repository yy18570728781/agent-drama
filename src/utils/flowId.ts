let counter = 0
const NODE_ID_PREFIX = 'node_'
const EDGE_ID_PREFIX = 'edge_'

/**
 * 生成固定长度的流程图元素 ID
 *
 * 格式: {prefix}_{ttttttttt}{ccc}{rrrr}
 *   - t: 9 位 base36 时间戳 (补零)
 *   - c: 3 位 base36 计数器 (补零)
 *   - r: 4 位 base36 随机数
 *
 * 示例:
 *   createFlowId('node') → node_m1xyz1abc12de  (21 chars)
 *   createFlowId('edge') → edge_m1xyz1abc12de  (21 chars)
 *   createFlowId('tab')  → tab_m1xyz1abc12de   (20 chars)
 */
export function createFlowId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, '0')
  const count = (++counter).toString(36).padStart(3, '0')
  const random = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${time}${count}${random}`
}

export function createFlowNodeId(): string {
  return createFlowId('node')
}

export function createFlowEdgeId(): string {
  return createFlowId('edge')
}

export function normalizeFlowNodeId(id: unknown): string {
  const rawId = String(id || '').trim()
  return rawId.startsWith(NODE_ID_PREFIX) ? rawId : createFlowNodeId()
}

export function normalizeFlowEdgeId(id: unknown): string {
  const rawId = String(id || '').trim()
  return rawId.startsWith(EDGE_ID_PREFIX) ? rawId : createFlowEdgeId()
}
