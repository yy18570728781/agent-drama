import teamonesClient from './teamonesClient'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap<T>(value: unknown): T {
  if (!isRecord(value)) return value as T
  const responseData = isRecord(value.data) ? value.data : value
  if (isRecord(responseData) && typeof responseData.code === 'number' && responseData.code !== 0) {
    const message = typeof responseData.msg === 'string' ? responseData.msg : 'Teamones 积分接口请求失败'
    throw new Error(message)
  }
  return (isRecord(responseData) && 'data' in responseData ? responseData.data : responseData) as T
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  return unwrap<T>(await teamonesClient.post(path, payload))
}

/**
 * 查询 Teamones 用户积分余额及其所属组余额。
 * @param ownerId 用户 ID。
 * @returns 用户及所属组的积分摘要。
 * @throws Teamones 拒绝请求或返回业务错误时抛出异常。
 */
export function getNativeUserBalance<T>(ownerId: number): Promise<T> {
  return post('/api_assets/balance/get', { owner_id: String(ownerId), owner_type: 'user' })
}

/**
 * 查询 Teamones 积分组基础信息。
 * @param groupId 积分组 ID。
 * @returns 积分组基础信息。
 * @throws Teamones 拒绝请求或返回业务错误时抛出异常。
 */
export function getNativeGroup<T>(groupId: number): Promise<T> {
  return post('/api_assets/accounts/get_group', { id: groupId })
}
