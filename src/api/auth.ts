import SparkMD5 from 'spark-md5'
import teamonesClient, { TEAMONES_CLIENT_ID } from './teamonesClient'
import {
  clearToken,
  getDeviceCode,
  getStoredRefreshToken,
  getStoredToken,
  storeAuthScope,
  storeAuthUserInfo,
  storeRefreshToken,
  storeToken,
} from './tokenStorage'
import { logger } from '@/utils/logger'

export type TeamonesEntityId = string | number

export interface TeamonesUserInfo {
  user: { id: TeamonesEntityId; name: string; phone?: string; email?: string; avatar?: string; [key: string]: unknown }
  tenant: { id: TeamonesEntityId; name: string; [key: string]: unknown }
  role_info?: Array<{ id?: TeamonesEntityId; name: string; code: string; [key: string]: unknown }>
  department_info?: Array<{ id: TeamonesEntityId; name: string; [key: string]: unknown }>
  departments?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface AuthRefreshResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  user_id: TeamonesEntityId
  user_name: string
}

export interface AuthLoginResponse extends AuthRefreshResponse {
  user_info: TeamonesUserInfo
}

interface OAuthTokenPayload {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

type UnknownRecord = Record<string, unknown>

export { clearToken, getStoredToken, storeToken } from './tokenStorage'

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readAuthErrorMessage(cause: unknown): string {
  if (typeof cause === 'string') return cause.trim()
  if (!isRecord(cause)) return ''
  const response = isRecord(cause.response) ? cause.response : null
  const responseMessage = response ? readAuthErrorMessage(response.data) : ''
  if (responseMessage) return responseMessage
  const directMessage = [cause.msg, cause.message, cause.error_description, cause.error]
    .find((value): value is string => typeof value === 'string' && !!value.trim())
  if (directMessage) return directMessage.trim()
  return cause.data === cause ? '' : readAuthErrorMessage(cause.data)
}

function resolveAuthErrorMessage(cause: unknown, fallback: string): string {
  const message = readAuthErrorMessage(cause)
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid username and password combination')) {
    return '账号或密码错误'
  }
  if (/timeout|timed out/.test(normalized)) return '登录请求超时，请稍后重试'
  if (/network error|failed to fetch|err_network/.test(normalized)) {
    return '网络连接失败，请检查网络后重试'
  }
  return /[\u3400-\u9fff]/u.test(message) ? message : fallback
}

function unwrap<T>(response: unknown, action: string): T {
  const root = isRecord(response) && isRecord(response.data) ? response.data : response
  if (isRecord(root) && typeof root.code === 'number' && root.code !== 0) {
    throw new Error(resolveAuthErrorMessage(root.msg, `${action}失败`))
  }
  const payload = isRecord(root) && 'data' in root ? root.data : root
  return payload as T
}

function validateToken(payload: OAuthTokenPayload): OAuthTokenPayload {
  if (!payload || typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error('Teamones OAuth 未返回有效的 access_token')
  }
  return payload
}

async function fetchUserInfo(accessToken: string): Promise<TeamonesUserInfo> {
  const response = await teamonesClient.post('/api_im/user/get_my_user_info', {}, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const info = unwrap<TeamonesUserInfo>(response, '获取用户信息')
  if (!info?.user?.id || !info?.tenant?.id) throw new Error('Teamones 用户信息不完整')
  return info
}

function persistSession(token: OAuthTokenPayload, userInfo: TeamonesUserInfo): AuthLoginResponse {
  storeToken(token.access_token)
  if (token.refresh_token) storeRefreshToken(token.refresh_token)
  storeAuthUserInfo(userInfo)
  storeAuthScope({ tenantId: String(userInfo.tenant.id), userId: String(userInfo.user.id) })
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type || 'bearer',
    user_id: userInfo.user.id,
    user_name: userInfo.user.name,
    user_info: userInfo,
  }
}

async function completeLogin(token: OAuthTokenPayload): Promise<AuthLoginResponse> {
  const validated = validateToken(token)
  const userInfo = await fetchUserInfo(validated.access_token)
  return persistSession(validated, userInfo)
}

export async function refreshToken(): Promise<AuthRefreshResponse | null> {
  const current = getStoredToken()
  if (!current) return null
  const refresh = getStoredRefreshToken()
  try {
    if (!refresh) {
      const userInfo = await fetchUserInfo(current)
      storeAuthUserInfo(userInfo)
      storeAuthScope({ tenantId: String(userInfo.tenant.id), userId: String(userInfo.user.id) })
      return { access_token: current, token_type: 'bearer', user_id: userInfo.user.id, user_name: userInfo.user.name }
    }
    const response = await teamonesClient.post('/api_oauth/oauth/get_token', {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      device_unique_code: getDeviceCode(),
      client_id: TEAMONES_CLIENT_ID,
    })
    const token = validateToken(unwrap<OAuthTokenPayload>(response, '刷新登录'))
    const userInfo = await fetchUserInfo(token.access_token)
    return persistSession(token, userInfo)
  } catch {
    clearToken()
    return null
  }
}

/**
 * 使用账号密码登录并将认证错误转换为中文提示。
 * @param username 登录账号。
 * @param password 登录密码。
 * @returns 登录令牌和当前用户信息。
 * @throws 登录失败时抛出中文错误信息。
 */
export async function loginByPassword(username: string, password: string): Promise<AuthLoginResponse> {
  try {
    const response = await teamonesClient.post('/api_oauth/oauth/get_token', {
      grant_type: 'password',
      username,
      password,
      device_unique_code: getDeviceCode(),
      client_id: TEAMONES_CLIENT_ID,
    })
    const result = await completeLogin(unwrap<OAuthTokenPayload>(response, '密码登录'))
    logger.info('auth', `密码登录成功: ${result.user_name}`)
    return result
  } catch (cause) {
    throw Object.assign(
      new Error(resolveAuthErrorMessage(cause, '密码登录失败，请稍后重试')),
      { cause },
    )
  }
}

export async function loginByQrCode(qrCodeId: string): Promise<AuthLoginResponse> {
  const normalized = qrCodeId.trim()
  if (!normalized) throw new Error('二维码登录参数为空')
  const response = await teamonesClient.post('/api_oauth/oauth/get_token_by_qr_code', {
    qr_code_id: normalized,
    device_unique_code: SparkMD5.hash(normalized),
    client_id: TEAMONES_CLIENT_ID,
  })
  const result = await completeLogin(unwrap<OAuthTokenPayload>(response, '二维码登录'))
  logger.info('auth', `二维码登录成功: ${result.user_name}`)
  return result
}

export function logout(): void {
  clearToken()
  window.location.reload()
}
