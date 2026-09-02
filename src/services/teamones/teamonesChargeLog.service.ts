import client from '@/api/teamonesClient'

const CHARGE_LOG_QUERY_PATH = '/api_assets/balance/get_charge_log_list'
const CHARGE_LOG_FIELDS = [
  'id',
  'account_id',
  'aigc_record_id',
  'cost',
  'biz_type',
  'direction',
  'billing_owner_type',
  'billing_owner_id',
  'created',
].join(',')

export interface TeamonesChargeLogRecord {
  id: number
  aigc_record_id?: number | null
  cost?: number | null
  biz_type?: number | null
  direction?: number | null
  billing_owner_type?: 'user' | 'group' | string | null
  billing_owner_id?: number | string | null
  billing_owner?: {
    id?: number | null
    name?: string | null
  } | null
  created?: string | null
  aigc_record?: Record<string, unknown> | null
}

export interface TeamonesChargeLogQueryPayload {
  filter?: {
    aigc_record_id?: number
    billing_owner_id?: number
    billing_owner_type?: 'user' | 'group'
    biz_type?: number
    direction?: number
  }
  fields?: string
  page: [number, number]
  order?: string
}

export interface TeamonesChargeLogQueryResult {
  items: TeamonesChargeLogRecord[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

function unwrap<T>(raw: unknown): T {
  const payload = raw as Record<string, unknown> | null
  return (payload && payload.data !== undefined ? payload.data : raw) as T
}

async function postUnwrap<T>(url: string, body: unknown): Promise<T> {
  const { data } = await client.post(url, body)
  return unwrap<T>(data)
}

function normalizeQueryResult(
  raw: unknown,
  payload: TeamonesChargeLogQueryPayload,
): TeamonesChargeLogQueryResult {
  if (Array.isArray(raw)) {
    return {
      items: raw as TeamonesChargeLogRecord[],
      total: raw.length,
      page: payload.page[0],
      page_size: payload.page[1],
      has_more: raw.length >= payload.page[1],
    }
  }
  const result = raw as Partial<TeamonesChargeLogQueryResult> & {
    data?: TeamonesChargeLogRecord[]
  }
  const items = result.items || result.data || []
  return {
    items,
    total: result.total ?? items.length,
    page: result.page ?? payload.page[0],
    page_size: result.page_size ?? payload.page[1],
    has_more: result.has_more ?? items.length >= payload.page[1],
  }
}

/**
 * 查询当前用户可见的积分消费记录。
 * @param payload 筛选、分页和排序参数。
 * @returns 规范化后的消费记录分页结果。
 * @throws Teamones 请求失败时抛出异常。
 */
export async function queryChargeLogs(
  payload: TeamonesChargeLogQueryPayload,
): Promise<TeamonesChargeLogQueryResult> {
  const raw = await postUnwrap<unknown>(CHARGE_LOG_QUERY_PATH, {
    param: {
      fields: payload.fields || CHARGE_LOG_FIELDS,
      filter: payload.filter,
      page: payload.page,
      order: payload.order || 'id DESC',
    },
  })
  return normalizeQueryResult(raw, payload)
}
