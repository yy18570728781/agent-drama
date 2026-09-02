import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  loginByPassword,
  refreshToken,
  type TeamonesUserInfo,
} from '@/api/auth'
import {
  clearToken,
  getStoredAuthUserInfo,
  getStoredToken,
} from '@/api/tokenStorage'
import { resetAuth401Lock } from '@/api/client'
import { getUserBalance } from '@/services/teamones/teamonesUserPoints.service'
import { logger } from '@/utils/logger'

export type UserAuthStatus = 'idle' | 'loading' | 'ready' | 'error'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTeamonesUserInfo(value: unknown): value is TeamonesUserInfo {
  return isRecord(value)
    && isRecord(value.user)
    && (typeof value.user.id === 'string' || typeof value.user.id === 'number')
    && typeof value.user.name === 'string'
    && isRecord(value.tenant)
    && (typeof value.tenant.id === 'string' || typeof value.tenant.id === 'number')
    && typeof value.tenant.name === 'string'
    && value.tenant.name.trim().length > 0
}

function resolveStoredUserInfo(): TeamonesUserInfo | null {
  const stored = getStoredAuthUserInfo()
  return isTeamonesUserInfo(stored) ? stored : null
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<TeamonesUserInfo | null>(null)
  const balance = ref<number | null>(null)
  const groupBalance = ref<number | null>(null)
  const loading = ref(false)
  const balanceLoading = ref(false)
  const error = ref<string | null>(null)
  const authStatus = ref<UserAuthStatus>('idle')

  // 登录锁：防止多个 401 同时触发重复登录
  let _loginPromise: Promise<TeamonesUserInfo | null> | null = null

  // 仅阻止当前页面在手动退出后再次触发自动恢复。
  const manualLogout = ref(false)

  function _setManualLogout(val: boolean) {
    manualLogout.value = val
  }

  const userId = computed(() => userInfo.value?.user?.id || null)
  const userName = computed(() => userInfo.value?.user?.name || null)
  const userAvatar = computed(() => userInfo.value?.user?.avatar || null)
  const userCompany = computed(() => userInfo.value?.tenant?.name || null)
  const avatarText = computed(() => {
    const name = userName.value
    return name ? name.charAt(0).toUpperCase() : '?'
  })
  const sidebarAvatarText = computed(() => {
    if (loading.value && !userAvatar.value && !userName.value) return '...'
    if (authStatus.value === 'error') {
      return '?'
    }
    return avatarText.value
  })
  const sidebarUserLabel = computed(() => {
    if (loading.value) return '正在连接 Teamones'
    if (userName.value) return userName.value
    if (authStatus.value === 'error') return 'Teamones 连接失败'
    return '未登录'
  })
  const sidebarStatusText = computed(() => {
    if (authStatus.value === 'loading') return '正在登录...'
    return userCompany.value || '未登录'
  })
  const isAuthenticated = computed(() => !!getStoredToken() && authStatus.value === 'ready')
  function _setAuthError(message: string, cause?: unknown) {
    userInfo.value = null
    balance.value = null
    groupBalance.value = null
    authStatus.value = 'error'
    error.value = message

    if (typeof cause !== 'undefined') {
      logger.warn('user', message, cause)
    } else {
      logger.warn('user', message)
    }

    return null
  }

  async function _restoreStoredTokenSession(): Promise<boolean> {
    if (!getStoredToken()) return false

    try {
      const refreshResponse = await refreshToken()
      if (!refreshResponse) return false
      const restoredUserInfo = resolveStoredUserInfo()
      if (!restoredUserInfo) {
        clearToken()
        return false
      }
      userInfo.value = restoredUserInfo
      authStatus.value = 'ready'
      error.value = null
      _setManualLogout(false)
      resetAuth401Lock()
      return true
    } catch {
      return false
    }
  }

  async function fetchUserInfo(force = false) {
    // 手动退出后拦截自动登录，用户需主动选账密/SSO
    if (manualLogout.value) {
      return null
    }

    // 非强制模式下，如果正在加载则直接返回
    if (loading.value && !force) {
      return _loginPromise || userInfo.value
    }

    // 已有一个登录流程在执行中 → 复用它的结果，不再发起新的
    if (_loginPromise) {
      return _loginPromise
    }

    _loginPromise = _doLogin()
    try {
      return await _loginPromise
    } finally {
      _loginPromise = null
    }
  }

  async function bootstrapSession(force = false): Promise<TeamonesUserInfo | null> {
    if (manualLogout.value) {
      loading.value = false
      authStatus.value = 'idle'
      return null
    }

    if (loading.value && !force) {
      return _loginPromise || userInfo.value
    }

    if (_loginPromise) {
      return _loginPromise
    }

    loading.value = true
    error.value = null
    authStatus.value = 'loading'

    try {
      const restoredFromToken = await _restoreStoredTokenSession()
      if (restoredFromToken) {
        return userInfo.value
      }

      authStatus.value = 'idle'
      return null
    } finally {
      _loginPromise = null
      loading.value = false
    }
  }

  async function _doLogin(): Promise<TeamonesUserInfo | null> {
    loading.value = true
    error.value = null
    authStatus.value = 'loading'
    try {
      const storedUserInfo = getStoredAuthUserInfo()
      if (!isTeamonesUserInfo(storedUserInfo)) {
        return _setAuthError('当前登录会话缺少用户信息')
      }
      userInfo.value = storedUserInfo
      authStatus.value = 'ready'
      return userInfo.value
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '获取用户信息失败'
      return _setAuthError(message, cause)
    } finally {
      loading.value = false
    }
  }

  async function fetchBalance(force = false) {
    const currentUserId = Number(userId.value)
    if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
      balance.value = null
      groupBalance.value = null
      return null
    }

    if (balanceLoading.value && !force) {
      return balance.value
    }

    balanceLoading.value = true
    try {
      const data = await getUserBalance(currentUserId, force)
      balance.value = typeof data.user?.balance === 'number' ? data.user.balance : null
      groupBalance.value = typeof data.group?.balance === 'number' ? data.group.balance : null
      return balance.value
    } catch (cause) {
      balance.value = null
      groupBalance.value = null
      logger.warn('user', '获取 Teamones 余额失败', cause)
      return null
    } finally {
      balanceLoading.value = false
    }
  }

  async function refreshProfile(force = true) {
    const data = await fetchUserInfo(force)
    if (data?.user?.id) {
      await fetchBalance(force)
    }
    return data
  }

  async function passwordLogin(username: string, password: string): Promise<TeamonesUserInfo | null> {
    loading.value = true
    error.value = null
    authStatus.value = 'loading'

    try {
      const loginResp = await loginByPassword(username, password)
      userInfo.value = loginResp.user_info as TeamonesUserInfo
      authStatus.value = 'ready'
      _setManualLogout(false)
      resetAuth401Lock()
      return userInfo.value
    } catch (cause) {
      userInfo.value = null
      balance.value = null
      groupBalance.value = null
      authStatus.value = 'error'
      error.value = cause instanceof Error ? cause.message : '密码登录失败'
      logger.warn('user', error.value, cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function clearManualLogout() {
    _setManualLogout(false)
  }

  function logout() {
    userInfo.value = null
    balance.value = null
    groupBalance.value = null
    authStatus.value = 'idle'
    error.value = null
    _setManualLogout(true)
    clearToken()
  }

  return {
    userInfo,
    balance,
    groupBalance,
    loading,
    balanceLoading,
    error,
    authStatus,
    userId,
    userName,
    userAvatar,
    userCompany,
    avatarText,
    sidebarAvatarText,
    sidebarUserLabel,
    sidebarStatusText,
    isAuthenticated,
    bootstrapSession,
    fetchUserInfo,
    fetchBalance,
    refreshProfile,
    manualLogout,
    clearManualLogout,
    passwordLogin,
    logout,
  }
})
