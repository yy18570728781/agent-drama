import type { FlowEdge, FlowNode, FlowViewport } from './flowCore.types'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 将不可信持久化值收敛为画布视口。
 * @param value 待转换的持久化值
 * @param fallback 无法读取字段时使用的默认视口
 * @returns 字段完整且数值有限的视口
 */
export function toFlowViewport(
  value: unknown,
  fallback: FlowViewport = { zoom: 1, x: 0, y: 0 },
): FlowViewport {
  const source = isRecord(value) ? value : {}
  return {
    x: toFiniteNumber(source.x, fallback.x),
    y: toFiniteNumber(source.y, fallback.y),
    zoom: toFiniteNumber(source.zoom, fallback.zoom),
  }
}

/**
 * 将未知对象转换为具备必需字段的 Flow 节点。
 * @param value 待转换的节点值
 * @returns 合法节点；缺少 id 时返回 null
 */
export function toFlowNode(value: unknown): FlowNode | null {
  if (!isRecord(value)) return null
  const id = String(value.id || '').trim()
  if (!id) return null
  const rawPosition = isRecord(value.position) ? value.position : {}
  const data = isRecord(value.data) ? { ...value.data } : {}
  return {
    ...value,
    id,
    position: {
      x: toFiniteNumber(rawPosition.x, 0),
      y: toFiniteNumber(rawPosition.y, 0),
    },
    data,
  }
}

/**
 * 将未知对象转换为具备必需字段的 Flow 连线。
 * @param value 待转换的连线值
 * @returns 合法连线；缺少 id、source 或 target 时返回 null
 */
export function toFlowEdge(value: unknown): FlowEdge | null {
  if (!isRecord(value)) return null
  const id = String(value.id || '').trim()
  const source = String(value.source || '').trim()
  const target = String(value.target || '').trim()
  if (!id || !source || !target) return null
  return { ...value, id, source, target }
}

/**
 * 读取可用于共享资源数组的整数索引。
 * @param value 待校验的索引
 * @returns 非负整数索引；无效时返回 null
 */
export function toArrayIndex(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null
}
