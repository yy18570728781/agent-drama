export type BinaryFlag = 0 | 1

/**
 * 将布尔值或兼容的数字值转换为数据库可接受的二进制标记。
 * @param value 待转换的值。
 * @returns 转换后的 0/1；无有效值时返回 undefined。
 */
export function normalizeBinaryFlag(value: unknown): BinaryFlag | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value ? 1 : 0
  const numeric = Number(value)
  return Number.isInteger(numeric) && (numeric === 0 || numeric === 1)
    ? numeric as BinaryFlag
    : undefined
}
