export const REQUIRED_FLOW_FILE_NAME_MESSAGE = '必须传文件名'
export const FLOW_CANVAS_NAME_MAX_LENGTH = 128

/**
 * 统一清洗工作流/子图命名输入，避免不同入口出现空白字符差异。
 * @param value 原始输入值
 * @returns 去除首尾空白后的名称
 */
export function normalizeFlowFileName(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * 统一清洗画布名称并限制最大长度，防止不同编辑入口提交超长名称。
 * @param value 原始画布名称
 * @returns 去除首尾空白且不超过上限的画布名称
 */
export function normalizeFlowCanvasName(value: unknown): string {
  return normalizeFlowFileName(value).slice(0, FLOW_CANVAS_NAME_MAX_LENGTH)
}

/**
 * 工作流和子图都要求显式传入名称，避免默认占位名被误保存。
 * @param value 原始输入值
 * @returns 是否包含有效名称
 */
export function hasFlowFileName(value: unknown): boolean {
  return normalizeFlowFileName(value).length > 0
}
