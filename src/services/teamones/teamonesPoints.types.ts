export const enum BillingMode {
  UserOnly = 1,
  GroupOnly = 2,
  UserFirst = 3,
  GroupFirst = 4,
}

export type BillingModeCode = 'user_only' | 'group_only' | 'user_first' | 'group_first'
export type BillingModeValue = BillingMode | BillingModeCode | number | null

export interface UserBalanceResult {
  user: {
    owner_id: number
    balance: number
    total_consumed: number
    status: number
  }
  group?: {
    owner_id: number
    balance: number
    total_consumed: number
    status: number
    billing_mode?: BillingModeValue
  } | null
}

export interface PointGroupSummary {
  id: number
  name: string
}
