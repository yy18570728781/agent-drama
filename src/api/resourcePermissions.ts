import teamonesClient from './teamonesClient'

interface TeamonesResourceResponse {
  code?: number
  data?: unknown
  msg?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读取当前 Teamones 角色在指定应用下拥有的资源码。
 * @param appCode Teamones 权限应用编码。
 * @returns 当前角色拥有的资源码列表。
 * @throws Teamones 权限接口失败或返回非零业务码时抛出异常。
 */
export async function listRoleResourceCodes(appCode: string): Promise<string[]> {
  const { data } = await teamonesClient.post<TeamonesResourceResponse>(
    '/api_oauth/resource/select_role_resource_codes',
    { param: { filter: { app_code: appCode } } },
  )
  if (typeof data.code === 'number' && data.code !== 0) {
    throw new Error(data.msg?.trim() || 'Teamones 权限资源加载失败')
  }
  return isRecord(data.data) ? Object.keys(data.data) : []
}
