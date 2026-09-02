import teamonesClient from './teamonesClient'

export type FlowPermissionSubjectType = 'tenant' | 'user'

export interface FlowCategoryPermissionMember {
  id: string
  name: string
  permission: number
  permissionId: string
  type: FlowPermissionSubjectType
}

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getBody(response: unknown): RawRecord {
  if (!isRecord(response)) return {}
  return isRecord(response.data) ? response.data : response
}

function readRecords(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  const rows = value.rows ?? value.items ?? value.list
  return Array.isArray(rows) ? rows.filter(isRecord) : []
}

function assertSuccess(response: unknown, action: string): RawRecord {
  const body = getBody(response)
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new Error(`${action}失败（${body.code}）`)
  }
  return body
}

function normalizeEntityId(value: unknown): string {
  const id = String(value ?? '').trim()
  return id === '0' ? '' : id
}

function firstNonEmptyText(...values: unknown[]): string {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? ''
}

function normalizeMember(raw: RawRecord): FlowCategoryPermissionMember | null {
  const userId = normalizeEntityId(raw.user_id)
  const tenantId = normalizeEntityId(raw.tenant_id)
  const id = tenantId || userId
  if (!id) return null
  const type: FlowPermissionSubjectType = tenantId ? 'tenant' : 'user'
  const nested = type === 'tenant' && isRecord(raw.tenant)
    ? raw.tenant
    : isRecord(raw.user) ? raw.user : {}
  return {
    id,
    name: firstNonEmptyText(
      raw.name,
      type === 'tenant' ? raw.tenant_name : raw.user_name,
      nested.name,
    ) || (type === 'tenant' ? '未知租户' : '未知成员'),
    permission: Number(raw.permission ?? 0),
    permissionId: String(raw.id ?? '').trim(),
    type,
  }
}

async function resolveSubjectNames(
  members: FlowCategoryPermissionMember[],
  type: FlowPermissionSubjectType,
): Promise<Map<string, string>> {
  const ids = members.filter((item) => item.type === type).map((item) => item.id)
  if (!ids.length) return new Map()
  const isUser = type === 'user'
  const response = await teamonesClient.post(isUser ? '/api_im/user/select' : '/api_im/tenant/select', {
    _isNotCancel: true,
    param: {
      fields: isUser ? 'id,name,avatar' : 'tenant.id,tenant.name',
      filter: isUser ? { id: ['-in', ids.join(',')] } : { 'tenant.id': ['-in', ids] },
    },
  })
  const body = assertSuccess(response, '成员信息加载')
  const records = readRecords(body.data)
  return new Map(records.map((item) => {
    const nested = isUser ? item.user : item.tenant
    const subject = isRecord(nested) ? nested : item
    const id = firstNonEmptyText(
      subject.id,
      isUser ? item.user_id : item.tenant_id,
      item.id,
    )
    const name = firstNonEmptyText(
      subject.name,
      isUser ? item.user_name : item.tenant_name,
      item.name,
    )
    return [id, name] as const
  }).filter(([id, name]) => !!id && !!name))
}

/**
 * 读取分类的用户与租户权限列表。
 * @param categoryId 分类 ID。
 * @returns 已补齐成员名称的权限列表。
 * @throws 权限或成员接口失败时抛出异常。
 */
export async function listFlowCategoryPermissions(
  categoryId: string,
): Promise<FlowCategoryPermissionMember[]> {
  const response = await teamonesClient.post('/api_assets/category/get_user_permission_list', {
    _isNotCancel: true,
    param: { category_id: categoryId, page: [1, 200] },
  })
  const body = assertSuccess(response, '权限加载')
  const members = readRecords(body.data)
    .map(normalizeMember)
    .filter((item): item is FlowCategoryPermissionMember => !!item)
  const [userNames, tenantNames] = await Promise.all([
    resolveSubjectNames(members, 'user'),
    resolveSubjectNames(members, 'tenant'),
  ])
  return members.map((member) => ({
    ...member,
    name: (member.type === 'user' ? userNames : tenantNames).get(member.id) || member.name,
  })).sort((left, right) => right.permission - left.permission)
}

interface SavePermissionInput {
  categoryId: string
  inherit: boolean
  member: FlowCategoryPermissionMember
  permission: number
}

/**
 * 新增或更新分类成员权限。
 * @param input 权限对象、级别与继承选项。
 * @returns 无返回值。
 * @throws 权限保存失败时抛出异常。
 */
export async function saveFlowCategoryPermission(input: SavePermissionInput): Promise<void> {
  const isUpdate = !!input.member.permissionId
  const subjectKey = input.member.type === 'user' ? 'user_id' : 'tenant_id'
  const data: RawRecord = {
    category_id: input.categoryId,
    is_bind_to_child: input.inherit ? 'yes' : 'no',
    permission: input.permission,
    [subjectKey]: input.member.id,
  }
  if (isUpdate) data.id = input.member.permissionId
  const endpoint = isUpdate ? 'update_permission' : 'create_permission'
  const response = await teamonesClient.post(`/api_assets/category/${endpoint}`, {
    _isNotCancel: true,
    isThrowError: 'yes',
    data,
  })
  assertSuccess(response, '权限保存')
}

/**
 * 移除分类成员权限。
 * @param categoryId 分类 ID。
 * @param member 待移除的成员。
 * @returns 无返回值。
 * @throws 删除权限失败时抛出异常。
 */
export async function deleteFlowCategoryPermission(
  categoryId: string,
  member: FlowCategoryPermissionMember,
): Promise<void> {
  const subjectKey = member.type === 'user' ? 'user_id' : 'tenant_id'
  const response = await teamonesClient.post('/api_assets/category/delete_permission', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { category_id: categoryId, [subjectKey]: member.id },
  })
  assertSuccess(response, '权限删除')
}
