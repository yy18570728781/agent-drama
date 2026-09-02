import client, { authFetch, getApiBase } from './client'

export interface SkillInfo {
  id: string
  name: string
  description: string
  category: string
  trigger: { keywords: string[]; description: string }
  params: Record<string, any>
}

export interface AgentRunRequest {
  input: string
  skill_id?: string | null
  history?: Array<{ role: string; content: string }>
  stream?: boolean
  chat_model?: string
}

export interface AgentSSECallbacks {
  onIntent?: (data: any) => void
  onProgress?: (step: number, total: number, message: string) => void
  onThinking?: (data: { iteration: number }) => void
  onToolCall?: (data: { tool: string; params: Record<string, any>; iteration: number }) => void
  onToolResult?: (data: { tool: string; result_preview: string; iteration: number }) => void
  onResult?: (data: any) => void
  onError?: (message: string) => void
  onDone?: () => void
}

function unwrapResponse<T = any>(response: any): T {
  return response?.data?.data ?? response?.data ?? response
}

async function postWithFallback(urls: string[], payload: Record<string, any>) {
  let lastError: unknown

  for (const url of urls) {
    try {
      return await client.post(url, payload)
    } catch (error: any) {
      lastError = error
      if (error?.response?.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

export async function listSkills(): Promise<{ skills: SkillInfo[]; count: number }> {
  const response = await client.get('/api/skills')
  const payload = unwrapResponse<any>(response) || {}
  const skills = payload.skills || []
  return { skills, count: payload.count ?? skills.length }
}

export async function getSkill(skillId: string): Promise<SkillInfo> {
  const response = await client.get(`/api/skills/${skillId}`)
  return unwrapResponse<SkillInfo>(response)
}

export async function reloadSkills(): Promise<{ status: string; count: number; skill_ids: string[] }> {
  const response = await client.post('/api/skills/reload')
  const payload = unwrapResponse<any>(response) || {}
  return {
    status: payload.status || 'ok',
    count: payload.count || 0,
    skill_ids: payload.skill_ids || [],
  }
}

export async function runAgent(request: AgentRunRequest): Promise<any> {
  const response = await postWithFallback([
    '/api/skills/run',
    '/api/agent/run',
  ], request)
  return unwrapResponse(response)
}

function dispatchStreamEvent(payload: any, callbacks: AgentSSECallbacks) {
  const type = payload?.type || payload?.event

  if (type === 'intent') {
    callbacks.onIntent?.(payload)
    return
  }

  if (type === 'progress') {
    callbacks.onProgress?.(
      Number(payload?.step || 0),
      Number(payload?.total || 0),
      payload?.message || '',
    )
    return
  }

  if (type === 'thinking') {
    callbacks.onThinking?.(payload)
    return
  }

  if (type === 'tool_call') {
    callbacks.onToolCall?.(payload)
    return
  }

  if (type === 'tool_result') {
    callbacks.onToolResult?.(payload)
    return
  }

  if (type === 'result' || type === 'final_result' || payload?.result_type || payload?.items || payload?.data) {
    callbacks.onResult?.(payload)
    return
  }

  if (type === 'error') {
    callbacks.onError?.(payload?.message || 'Agent stream error')
    return
  }

  if (type === 'done') {
    callbacks.onDone?.()
  }
}

export function runAgentStream(request: AgentRunRequest, callbacks: AgentSSECallbacks): () => void {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await authFetch(`${getApiBase()}/api/skills/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`Agent stream request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''

        for (const chunk of chunks) {
          const dataLines = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())

          if (!dataLines.length) continue

          const rawData = dataLines.join('\n')
          if (!rawData) continue

          try {
            const payload = JSON.parse(rawData)
            dispatchStreamEvent(payload, callbacks)
          } catch (error) {
            callbacks.onError?.((error as Error)?.message || 'Failed to parse agent stream event')
          }
        }
      }

      callbacks.onDone?.()
    } catch (error: any) {
      if (error?.name === 'AbortError') return

      if (error?.message?.includes('404')) {
        callbacks.onError?.('Agent streaming endpoint not found')
        return
      }

      callbacks.onError?.(error?.message || 'Agent stream failed')
    }
  })()

  return () => controller.abort()
}