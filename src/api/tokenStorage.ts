const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'
const DEVICE_CODE_KEY = 'teamones_device_code'
const AUTH_SCOPE_KEY = 'auth_scope'
const AUTH_USER_INFO_KEY = 'auth_user_info'
const LEGACY_TOKEN_KEY = 'teamones_auth_token'
const AUTH_MIGRATION_KEYS = [
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  DEVICE_CODE_KEY,
  AUTH_SCOPE_KEY,
  AUTH_USER_INFO_KEY,
  LEGACY_TOKEN_KEY,
] as const
const AUTH_CLEAR_KEYS = [
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  AUTH_SCOPE_KEY,
  AUTH_USER_INFO_KEY,
  LEGACY_TOKEN_KEY,
] as const

export interface AuthSessionScope {
  tenantId: string
  userId: string
}

function read(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function write(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

function remove(key: string): void {
  try { window.localStorage.removeItem(key) } catch { /* storage unavailable */ }
  try { window.sessionStorage.removeItem(key) } catch { /* legacy storage unavailable */ }
}

function migrateLegacySessionStorage(): void {
  try {
    AUTH_MIGRATION_KEYS.forEach((key) => {
      const legacyValue = window.sessionStorage.getItem(key)
      if (!window.localStorage.getItem(key) && legacyValue) write(key, legacyValue)
      window.sessionStorage.removeItem(key)
    })
  } catch { /* legacy migration is best effort */ }
}

function parseScope(raw: string | null): AuthSessionScope | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<AuthSessionScope>
    const tenantId = String(value.tenantId || '').trim()
    const userId = String(value.userId || '').trim()
    return tenantId && userId ? { tenantId, userId } : null
  } catch { return null }
}

migrateLegacySessionStorage()

/** @returns 当前共享的访问令牌；不存在时返回 null。 */
export function getStoredToken(): string | null {
  return read(TOKEN_KEY)
}

/**
 * @param token 访问令牌。
 * @returns 无返回值。
 */
export function storeToken(token: string): void {
  write(TOKEN_KEY, token)
}

/** @returns 当前共享的 Teamones 访问令牌；不存在时返回 null。 */
export function getStoredTeamonesToken(): string | null {
  return getStoredToken()
}

/**
 * @param token Teamones 访问令牌。
 * @returns 无返回值。
 */
export function storeTeamonesToken(token: string): void {
  storeToken(token)
}

/** @returns 当前共享的刷新令牌；不存在时返回 null。 */
export function getStoredRefreshToken(): string | null {
  return read(REFRESH_TOKEN_KEY)
}

/**
 * @param token 刷新令牌。
 * @returns 无返回值。
 */
export function storeRefreshToken(token: string): void {
  write(REFRESH_TOKEN_KEY, token)
}

/** @returns 当前浏览器共享的设备标识。 */
export function getDeviceCode(): string {
  let value = read(DEVICE_CODE_KEY)
  if (!value) {
    value = `infinite_canvas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    write(DEVICE_CODE_KEY, value)
  }
  return value
}

/**
 * @param scope 当前租户及用户作用域。
 * @returns 无返回值。
 */
export function storeAuthScope(scope: AuthSessionScope): void {
  write(AUTH_SCOPE_KEY, JSON.stringify(scope))
}

/** @returns 已保存的认证作用域；数据无效时返回 null。 */
export function getStoredAuthScope(): AuthSessionScope | null {
  return parseScope(read(AUTH_SCOPE_KEY))
}

/**
 * @param userInfo 当前登录用户信息。
 * @returns 无返回值。
 * @throws 用户信息无法序列化时抛出异常。
 */
export function storeAuthUserInfo(userInfo: unknown): void {
  const serialized = JSON.stringify(userInfo)
  if (serialized) write(AUTH_USER_INFO_KEY, serialized)
}

/** @returns 已保存的用户信息；不存在或数据无效时返回 null。 */
export function getStoredAuthUserInfo(): unknown | null {
  const raw = read(AUTH_USER_INFO_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as unknown } catch { return null }
}

/** @returns 无返回值。 */
export function clearToken(): void {
  AUTH_CLEAR_KEYS.forEach(remove)
}
