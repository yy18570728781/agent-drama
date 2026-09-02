interface BackendErrorPayload {
  msg?: unknown
  detail?: unknown
  message?: unknown
  error?: unknown
  data?: unknown
}

interface ErrorWithResponse {
  response?: {
    data?: BackendErrorPayload | string | null
  }
  message?: unknown
  backendDetail?: unknown
}

function normalizeMessage(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value).trim()
}

function extractFromPayload(payload: BackendErrorPayload | string | null | undefined): string {
  if (typeof payload === 'string') return payload.trim()
  if (!payload || typeof payload !== 'object') return ''
  return (
    normalizeMessage(payload.msg) ||
    normalizeMessage(payload.detail) ||
    normalizeMessage(payload.message) ||
    normalizeMessage(payload.error) ||
    normalizeMessage(payload.data)
  )
}

export function extractRequestErrorMessage(error: unknown, fallback = '请求失败'): string {
  const normalizedError = error as ErrorWithResponse | null | undefined
  return (
    normalizeMessage(normalizedError?.backendDetail) ||
    extractFromPayload(normalizedError?.response?.data) ||
    normalizeMessage(normalizedError?.message) ||
    fallback
  )
}
