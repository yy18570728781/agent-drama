import teamonesClient from './teamonesClient'

export type FlowPermissionPickerItemType = 'department' | 'tenant' | 'user'

export interface FlowPermissionPickerItem {
  avatar: string
  id: string
  name: string
  subCount: number
  type: FlowPermissionPickerItemType
}

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getBody(response: unknown): RawRecord {
  if (!isRecord(response)) return {}
  return isRecord(response.data) ? response.data : response
}

function assertSuccess(response: unknown, action: string): RawRecord {
  const body = getBody(response)
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new Error(`${action}失败（${body.code}）`)
  }
  return body
}

function readRecords(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  const rows = value.rows ?? value.items ?? value.list
  return Array.isArray(rows) ? rows.filter(isRecord) : []
}

function normalizeId(value: unknown): string {
  const id = String(value ?? '').trim()
  return id === '0' ? '' : id
}

function normalizeUser(raw: RawRecord): FlowPermissionPickerItem | null {
  const nested = isRecord(raw.saas_user) ? raw.saas_user : isRecord(raw.user) ? raw.user : raw
  const id = normalizeId(
    nested.union_id ?? nested.user_id ?? raw.union_id ?? raw.user_id ?? nested.id ?? raw.id,
  )
  const name = String(nested.name ?? raw.name ?? '').trim()
  if (!id || !name) return null
  return {
    avatar: String(nested.avatar ?? raw.avatar ?? ''),
    id,
    name,
    subCount: 0,
    type: 'user',
  }
}

/**
 * 读取参考权限组件中的集团租户列表。
 * @returns 可选租户列表。
 * @throws 租户接口失败时抛出异常。
 */
export async function listFlowPermissionTenants(): Promise<FlowPermissionPickerItem[]> {
  const response = await teamonesClient.post('/api_im/tenant_group_member/select', {
    _isNotCancel: true,
    param: { filter: { tenant_group_id: 16 }, page: [1, 500] },
  })
  const body = assertSuccess(response, '租户加载')
  return readRecords(body.data).map((item) => ({
    avatar: '',
    id: normalizeId(item.id),
    name: String(item.name ?? '').trim(),
    subCount: Number(item.user_count ?? 0),
    type: 'tenant' as const,
  })).filter((item) => !!item.id && !!item.name)
}

/**
 * 读取参考权限组件中的外部供应商租户列表。
 * @returns 可选供应商租户列表。
 * @throws 供应商接口失败时抛出异常。
 */
export async function listFlowPermissionSuppliers(): Promise<FlowPermissionPickerItem[]> {
  const response = await teamonesClient.post('/api_saas/supplier/select', {
    _isNotCancel: true,
    param: {
      filter: { type: 'outside', 'tenant.status': 'active' },
      page: [1, 500],
    },
  })
  const body = assertSuccess(response, '供应商加载')
  return readRecords(body.data).map((item) => ({
    avatar: '',
    id: normalizeId(item.from_tenant_id),
    name: String(item.from_tenant_name ?? '').trim(),
    subCount: 0,
    type: 'tenant' as const,
  })).filter((item) => !!item.id && !!item.name)
}

/**
 * 读取租户或部门的下级部门与成员。
 * @param tenantId 租户 ID。
 * @param departmentId 部门 ID，根层传空值。
 * @returns 可用于层级选择的部门与成员。
 * @throws 成员接口失败时抛出异常。
 */
export async function listFlowDepartmentSubjects(
  tenantId: string,
  departmentId = '',
): Promise<FlowPermissionPickerItem[]> {
  const response = await teamonesClient.post('/api_im/user/get_children_department_user', {
    _isNotCancel: true,
    param: { filter: { id: departmentId || 0, tenant_id: tenantId } },
  })
  const body = assertSuccess(response, '成员加载')
  const data = isRecord(body.data) ? body.data : {}
  const departments = readRecords(data.children).map((item) => ({
    avatar: '',
    id: normalizeId(item.id),
    name: String(item.name ?? '').trim(),
    subCount: Number(item.user_count ?? 0),
    type: 'department' as const,
  }))
  const users = readRecords(data.members)
    .map(normalizeUser)
    .filter((item): item is FlowPermissionPickerItem => !!item)
  return [...departments, ...users].filter((item) => !!item.id && !!item.name)
}

/**
 * 跨租户搜索可添加的 Teamones 成员。
 * @param keyword 成员名关键字。
 * @returns 去重后的成员列表。
 * @throws 搜索接口失败时抛出异常。
 */
export async function searchFlowPermissionSubjects(
  keyword: string,
): Promise<FlowPermissionPickerItem[]> {
  const response = await teamonesClient.post('/api_saas/user/get_tenant_group_user_list', {
    _isNotCancel: true,
    param: {
      filter: { 'user.name': ['-lk', `%${keyword}%`] },
      is_query_department: 'yes',
      page: [1, 300],
    },
  })
  const body = assertSuccess(response, '成员搜索')
  const byId = new Map<string, FlowPermissionPickerItem>()
  readRecords(body.data).forEach((record) => {
    const item = normalizeUser(record)
    if (item && !byId.has(item.id)) byId.set(item.id, item)
  })
  return Array.from(byId.values())
}
