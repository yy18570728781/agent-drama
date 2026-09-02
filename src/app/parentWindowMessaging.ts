const CONFIGURED_PARENT_ORIGINS = import.meta.env.VITE_PARENT_ORIGINS
const WILDCARD_ORIGIN = '*'

function normalizeWebOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

function resolveDefaultOrigin(): string[] {
  if (typeof window === 'undefined') return []
  const origin = normalizeWebOrigin(window.location.origin)
  return origin ? [origin] : []
}

function resolveConfiguredOrigins(): string[] {
  const values = String(CONFIGURED_PARENT_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (values.includes(WILDCARD_ORIGIN)) return [WILDCARD_ORIGIN]
  return values
    .map(normalizeWebOrigin)
    .filter((origin): origin is string => Boolean(origin))
}

/**
 * 返回允许与当前 iframe 通信的父窗口来源。
 * @returns 配置的来源白名单；未配置时仅包含当前页面同源地址。
 */
export function getAllowedParentOrigins(): readonly string[] {
  const configuredOrigins = resolveConfiguredOrigins()

  return configuredOrigins.length > 0
    ? [...new Set(configuredOrigins)]
    : resolveDefaultOrigin()
}

/**
 * 判断消息是否来自白名单中的父窗口。
 * @param event - 浏览器 message 事件。
 * @returns 来源窗口和 origin 均可信时返回 true。
 */
export function isAllowedParentMessage(event: MessageEvent): boolean {
  if (typeof window === 'undefined' || event.source !== window.parent) return false
  const allowedOrigins = getAllowedParentOrigins()
  return allowedOrigins.includes(WILDCARD_ORIGIN) || allowedOrigins.includes(event.origin)
}

/**
 * 向所有允许的父窗口来源发送消息。
 * @param message - 可由结构化克隆算法处理的消息体。
 * @returns 无返回值；没有有效白名单时不会发送。
 */
export function postMessageToAllowedParent(message: unknown): void {
  if (typeof window === 'undefined' || window.parent === window) return
  const allowedOrigins = getAllowedParentOrigins()
  if (allowedOrigins.includes(WILDCARD_ORIGIN)) {
    window.parent.postMessage(message, WILDCARD_ORIGIN)
    return
  }
  allowedOrigins.forEach((origin) => {
    window.parent.postMessage(message, origin)
  })
}
