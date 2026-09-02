import type { WorkflowImportDefinition } from './flowRuntime.types'

export type WorkflowImportPayload = Record<string, unknown>

const WORKFLOW_WRAPPER_KEYS = ['definition', 'data', 'workflow', 'content'] as const

function toWorkflowPayload(value: unknown): WorkflowImportPayload | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value.replace(/^\uFEFF/, '').trim())
      return toWorkflowPayload(parsed)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as WorkflowImportPayload
}

/**
 * 兼容工作流历史版本导出的外壳结构，导入器实际需要的是 definition 本体。
 *
 * @param payload 解析后的 JSON 内容
 * @returns 可导入的工作流 definition；无法识别时返回原对象
 */
export function unwrapWorkflowImportDefinition(payload: WorkflowImportPayload): WorkflowImportPayload {
  let current = payload
  for (let depth = 0; depth < 4; depth += 1) {
    if (isWorkflowImportDefinition(current)) return current
    const nested = WORKFLOW_WRAPPER_KEYS
      .map((key) => toWorkflowPayload(current[key]))
      .find((candidate) => candidate !== null)
    if (!nested || nested === current) break
    current = nested
  }
  return current
}

/**
 * 判断 JSON 是否具备工作流导入所需的基本结构。
 *
 * @param payload 待校验的工作流 definition
 * @returns `true` 表示存在 nodes 与 edges 数组
 */
export function isWorkflowImportDefinition(
  payload: WorkflowImportPayload,
): payload is WorkflowImportPayload & WorkflowImportDefinition {
  return Array.isArray(payload?.nodes) && Array.isArray(payload?.edges)
}
