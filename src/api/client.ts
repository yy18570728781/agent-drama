import axios from 'axios'
import { clearToken, getStoredToken } from './tokenStorage'
import { getSidecarBase, resolveSidecarBase, setSidecarBase } from './sidecarBase'
import { logMinimaxH3MediaUrlRewrites } from '@/utils/minimaxH3MediaUrlLog'

const client = axios.create({ timeout: 30000, headers: { 'Content-Type': 'application/json' } })
let authBootstrapPending = false
let bootstrapWaiters: Array<() => void> = []
let handling401 = false

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function requestPath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

function resolveWaiters(): void {
  const pending = bootstrapWaiters
  bootstrapWaiters = []
  pending.forEach((resolve) => resolve())
}

async function waitForBootstrap(): Promise<void> {
  if (!authBootstrapPending) return
  await new Promise<void>((resolve) => bootstrapWaiters.push(resolve))
}

function handle401(): void {
  if (handling401) return
  handling401 = true
  clearToken()
  window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  window.setTimeout(() => { handling401 = false }, 3000)
}

client.interceptors.request.use(async (config) => {
  await Promise.all([waitForBootstrap(), resolveSidecarBase()])
  config.baseURL = getSidecarBase()
  if (config.url === '/api/generations' || config.url === '/api/batch_generations') {
    logMinimaxH3MediaUrlRewrites(config.data)
  }
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) handle401()
    return Promise.reject(error)
  },
)

export function resetAuth401Lock(): void {
  handling401 = false
}

export function setAuthBootstrapPending(pending: boolean): void {
  authBootstrapPending = pending
  if (!pending) resolveWaiters()
}

export const getApiBase = getSidecarBase
export const getAIBase = getSidecarBase
export const setApiBase = setSidecarBase
export const setAIBase = setSidecarBase

export function buildApiUrl(path: string): string {
  return isAbsoluteUrl(path) ? path : `${getSidecarBase()}${requestPath(path)}`
}

export const buildProxiedUrl = buildApiUrl

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getStoredToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export async function authFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  await Promise.all([waitForBootstrap(), resolveSidecarBase()])
  const raw = input.toString()
  const url = isAbsoluteUrl(raw) ? raw : buildApiUrl(raw)
  const response = await fetch(url, { ...init, headers: getAuthHeaders(Object.fromEntries(new Headers(init?.headers))) })
  if (response.status === 401) handle401()
  return response
}

export default client
