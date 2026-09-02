import type {
  LocationQueryRaw,
  LocationQueryValue,
  RouteLocationNormalized,
  Router,
} from 'vue-router'
import { loginByQrCode } from '@/api/auth'
import { resetAuth401Lock } from '@/api/client'
import { resolveSidecarBase } from '@/api/sidecarBase'
import type { TeamonesUserInfo } from '@/api/auth'
import { useUserStore } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

const QR_CODE_QUERY_KEY = 'qr_code_id'
const QR_CODE_LOGIN_FAILED_TEXT = '二维码登录失败'

type UserStore = ReturnType<typeof useUserStore>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  if (Array.isArray(value)) {
    const item = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    return item?.trim() ?? ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

function readQrCodeId(route: RouteLocationNormalized): string {
  return readQueryValue(route.query[QR_CODE_QUERY_KEY])
}

function buildQueryWithoutQrCode(route: RouteLocationNormalized): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key !== QR_CODE_QUERY_KEY) {
      query[key] = value
    }
  }
  return query
}

function readMessage(value: unknown): string {
  if (!isRecord(value)) return ''
  if (typeof value.msg === 'string' && value.msg.trim()) return value.msg
  if (typeof value.message === 'string' && value.message.trim()) return value.message
  return readMessage(value.data)
}

function resolveLoginErrorMessage(cause: unknown): string {
  const response = isRecord(cause) && isRecord(cause.response) ? cause.response : null
  const responseMessage = response ? readMessage(response.data) : ''
  if (responseMessage) return responseMessage
  return cause instanceof Error ? cause.message : QR_CODE_LOGIN_FAILED_TEXT
}

function setQrCodeLoginError(userStore: UserStore, cause: unknown): void {
  userStore.userInfo = null
  userStore.balance = null
  userStore.authStatus = 'error'
  userStore.error = resolveLoginErrorMessage(cause)
  logger.warn('user', userStore.error || QR_CODE_LOGIN_FAILED_TEXT, cause)
}

async function applyQrCodeLogin(userStore: UserStore, qrCodeId: string): Promise<void> {
  userStore.clearManualLogout()
  userStore.loading = true
  userStore.error = null
  userStore.authStatus = 'loading'

  void resolveSidecarBase()
  const loginResp = await loginByQrCode(qrCodeId)
  userStore.userInfo = loginResp.user_info as TeamonesUserInfo
  userStore.balance = null
  userStore.authStatus = 'ready'
  resetAuth401Lock()
}

async function consumeQrCodeLogin(route: RouteLocationNormalized): Promise<void> {
  const userStore = useUserStore()
  const qrCodeId = readQrCodeId(route)
  try {
    await applyQrCodeLogin(userStore, qrCodeId)
  } catch (cause) {
    setQrCodeLoginError(userStore, cause)
  } finally {
    userStore.loading = false
  }
}

/**
 * 注册二维码登录路由守卫。
 * @param router - Vue Router 实例。
 * @returns 无返回值。
 * @throws 不向路由层抛出登录异常，失败信息写入用户 store。
 */
export function setupQrCodeLoginGuard(router: Router): void {
  router.beforeEach(async (to) => {
    if (!readQrCodeId(to)) return true
    await consumeQrCodeLogin(to)
    return {
      path: to.path,
      query: buildQueryWithoutQrCode(to),
      hash: to.hash,
      replace: true,
    }
  })
}
