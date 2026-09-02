import axios from 'axios'
import { clearToken, getStoredToken } from './tokenStorage'

export const TEAMONES_CLIENT_ID = '818aeb54172a95a8073dbc56dd8ec675'
const TEAMONES_BASE_URL = String(import.meta.env.VITE_TEAMONES_BASE_URL || '').replace(/\/+$/, '')

const teamonesClient = axios.create({
  baseURL: TEAMONES_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

teamonesClient.interceptors.request.use((config) => {
  const token = getStoredToken()
  const isTokenRequest = String(config.url || '').startsWith('/api_oauth/oauth/get_token')
  if (token && !isTokenRequest && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data && typeof config.data === 'object' && !Array.isArray(config.data)) {
    delete (config.data as Record<string, unknown>)._isNotCancel
  }
  return config
})

teamonesClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

/** 返回 Teamones 服务根地址。 */
export function getTeamonesBase(): string {
  return TEAMONES_BASE_URL
}

/** 将 Teamones 返回的相对路径转换为可直接访问的 URL。 */
export function buildTeamonesUrl(path: string): string {
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  return `${TEAMONES_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export default teamonesClient
