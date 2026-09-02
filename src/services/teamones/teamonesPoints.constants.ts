import { BillingMode } from '@/services/teamones/teamonesPoints.types'
import type { BillingModeCode } from '@/services/teamones/teamonesPoints.types'

const BILLING_MODE_CODE_MAP: Record<BillingModeCode, BillingMode> = {
  user_only: BillingMode.UserOnly,
  group_only: BillingMode.GroupOnly,
  user_first: BillingMode.UserFirst,
  group_first: BillingMode.GroupFirst,
}
const BILLING_MODE_VALUES = new Set<number>(Object.values(BILLING_MODE_CODE_MAP))

/**
 * 将 Teamones 的数字或字符串计费模式归一化为前端枚举。
 * @param value Teamones 返回的计费模式。
 * @returns 可识别的计费模式；无法识别时返回 null。
 */
export function normalizeBillingModeValue(value: unknown): BillingMode | null {
  if (typeof value === 'string') {
    const normalized = BILLING_MODE_CODE_MAP[value as BillingModeCode]
    if (normalized) return normalized
  }
  const numeric = Number(value)
  return BILLING_MODE_VALUES.has(numeric) ? numeric as BillingMode : null
}
