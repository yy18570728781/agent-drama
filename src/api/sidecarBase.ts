import { isAllowedParentMessage, postMessageToAllowedParent } from '@/app/parentWindowMessaging'

const DEFAULT_SIDECAR_PORT = '8000'
const PARENT_TIMEOUT_MS = 1500

let runtimeBase = ''
let pendingResolution: Promise<string> | null = null

function normalizeLoopbackUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`)
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) return ''
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.origin
  } catch {
    return ''
  }
}

function fallbackBase(): string {
  const configured = String(import.meta.env.VITE_SIDECAR_API_PORT || '').trim()
  const port = /^\d+$/.test(configured) ? configured : DEFAULT_SIDECAR_PORT
  return `http://127.0.0.1:${port}`
}

function isIframeWindow(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function setSidecarBase(value: string): string {
  runtimeBase = normalizeLoopbackUrl(value)
  return getSidecarBase()
}

export function getSidecarBase(): string {
  return runtimeBase || fallbackBase()
}

async function requestParentBase(): Promise<string> {
  if (!isIframeWindow()) return getSidecarBase()
  return new Promise((resolve) => {
    let settled = false
    const finish = (value = ''): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener('message', handleMessage)
      if (value) setSidecarBase(value)
      resolve(getSidecarBase())
    }
    const handleMessage = (event: MessageEvent): void => {
      if (!isAllowedParentMessage(event)) return
      const data = event.data as { type?: string; payload?: unknown } | undefined
      if (data?.type !== 'get-ai-base-url') return
      finish(typeof data.payload === 'string' ? data.payload : '')
    }
    const timer = window.setTimeout(() => finish(), PARENT_TIMEOUT_MS)
    window.addEventListener('message', handleMessage)
    postMessageToAllowedParent({ type: 'get-ai-base-url' })
  })
}

export function resolveSidecarBase(): Promise<string> {
  if (runtimeBase) return Promise.resolve(runtimeBase)
  if (!pendingResolution) {
    pendingResolution = requestParentBase().finally(() => { pendingResolution = null })
  }
  return pendingResolution
}
