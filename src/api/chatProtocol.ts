import client from './client'

export type ChatProtocolType = 'openai' | 'anthropic'

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<Record<string, any>> | null
  name?: string | null
  tool_call_id?: string | null
  tool_calls?: Array<Record<string, any>> | null
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
  context_compression?: Record<string, any>
  [key: string]: any
}

export interface AnthropicChatMessage {
  role: 'user' | 'assistant'
  content: string | Array<Record<string, any>>
}

export interface AnthropicMessagesRequest {
  model: string
  messages: AnthropicChatMessage[]
  max_tokens?: number
  system?: string | Array<Record<string, any>>
  temperature?: number
  top_p?: number
  stream?: boolean
  context_compression?: Record<string, any>
  [key: string]: any
}

export interface ChatProtocolInvokeOptions {
  vendor?: string | null
  anthropicVersion?: string | null
}

export interface ChatProtocolInvokeResult<T = any> {
  status: number
  headers: Record<string, string>
  data: T
}

function normalizeHeaders(headers: Record<string, any> | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value.join(', ')
      return
    }
    if (value !== undefined && value !== null) {
      result[key] = String(value)
    }
  })
  return result
}

export async function invokeOpenAIChatProtocol(
  request: OpenAIChatRequest,
  options: ChatProtocolInvokeOptions = {}
): Promise<ChatProtocolInvokeResult> {
  const response = await client.post('/api/openai/v1/chat/completions', request, {
    headers: {
      'x-use-request-model': '1',
      ...(options.vendor ? { 'x-model-vendor': options.vendor } : {}),
    },
  })
  return {
    status: response.status,
    headers: normalizeHeaders(response.headers as Record<string, any>),
    data: response.data,
  }
}

export async function invokeAnthropicChatProtocol(
  request: AnthropicMessagesRequest,
  options: ChatProtocolInvokeOptions = {}
): Promise<ChatProtocolInvokeResult> {
  const response = await client.post('/api/anthropic/v1/messages', request, {
    headers: {
      'x-use-request-model': '1',
      ...(options.vendor ? { 'x-model-vendor': options.vendor } : {}),
      ...(options.anthropicVersion ? { 'anthropic-version': options.anthropicVersion } : {}),
    },
  })
  return {
    status: response.status,
    headers: normalizeHeaders(response.headers as Record<string, any>),
    data: response.data,
  }
}