import client, { authFetch, buildApiUrl, getAuthHeaders } from './client'
import {
  appendStoredMessage,
  createStoredConversation,
  deleteStoredConversation,
  getStoredConversation,
  listStoredConversations,
  updateStoredConversation,
} from './conversationStorage'
import type {
  ConversationChatResponse,
  ConversationDetailPayload,
  ConversationMessagePayload,
  ConversationSummaryPayload,
  CreateConversationPayload,
  SendConversationMessagePayload,
  SSEStreamCallbacks,
  UpdateConversationPayload,
} from './conversations.types'

export type {
  ConversationChatResponse,
  ConversationDetailPayload,
  ConversationMessagePayload,
  ConversationSummaryPayload,
  CreateConversationPayload,
  SendConversationMessagePayload,
  SSEStreamCallbacks,
  UpdateConversationPayload,
} from './conversations.types'

export async function listConversations(): Promise<{ conversations: ConversationSummaryPayload[] }> {
  return { conversations: listStoredConversations() }
}

export async function createConversation(payload: CreateConversationPayload): Promise<{ id: string; title: string; model: string }> {
  const item = createStoredConversation(payload)
  return { id: item.id, title: item.title, model: item.model }
}

export async function getConversation(conversationId: string): Promise<ConversationDetailPayload> {
  return getStoredConversation(conversationId)
}

export async function updateConversation(
  conversationId: string,
  payload: UpdateConversationPayload,
): Promise<{ success: boolean }> {
  updateStoredConversation(conversationId, payload)
  return { success: true }
}

export async function deleteConversation(conversationId: string): Promise<{ success: boolean }> {
  deleteStoredConversation(conversationId)
  return { success: true }
}

function chatMessages(conversation: ConversationDetailPayload): Array<{ role: string; content: string }> {
  return conversation.messages.map((message) => ({
    role: message.role === 'ai' ? 'assistant' : message.role,
    content: message.content,
  }))
}

export async function sendConversationMessage(
  conversationId: string,
  payload: SendConversationMessagePayload,
): Promise<ConversationChatResponse> {
  const userMessage = appendStoredMessage(conversationId, { role: 'user', content: payload.content })
  const conversation = getStoredConversation(conversationId)
  const { data } = await client.post('/api/openai/v1/chat/completions', {
    model: conversation.model,
    messages: chatMessages(conversation),
    temperature: payload.temperature,
    top_p: payload.top_p,
    max_tokens: payload.max_tokens,
    tools: payload.tools,
    tool_choice: payload.tool_choice,
  }, { timeout: 120000 })
  const content = String(data?.choices?.[0]?.message?.content || '')
  const assistantMessage = appendStoredMessage(conversationId, { role: 'assistant', content })
  return {
    conversation: { id: conversation.id, title: conversation.title, model: conversation.model },
    user_message: userMessage,
    assistant_message: assistantMessage,
    raw: data,
  }
}

export async function streamConversationMessage(
  conversationId: string,
  payload: SendConversationMessagePayload,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  appendStoredMessage(conversationId, { role: 'user', content: payload.content })
  const conversation = getStoredConversation(conversationId)
  return authFetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: conversation.model,
      messages: chatMessages(conversation),
      stream: true,
      tools: payload.tools,
      tool_choice: payload.tool_choice,
    }),
    signal: options?.signal,
  })
}

export async function addConversationMessage(
  conversationId: string,
  payload: { role: string; content: string; files?: Record<string, unknown>[] },
): Promise<{ id: string; timestamp: string }> {
  const message = appendStoredMessage(conversationId, payload)
  return { id: message.id, timestamp: message.timestamp }
}

export async function streamChatCompletion(
  model: string,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; signal?: AbortSignal },
): Promise<Response> {
  return fetch(buildApiUrl('/api/openai/v1/chat/completions'), {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-use-request-model': '1' }),
    body: JSON.stringify({ model, messages, stream: true, temperature: options?.temperature }),
    signal: options?.signal,
  })
}

export async function consumeSSEStream(
  response: Response,
  onTokenOrCallbacks: ((token: string) => void) | SSEStreamCallbacks,
): Promise<string> {
  if (!response.ok || !response.body) throw new Error(`Chat streaming failed (${response.status})`)
  const callbacks = typeof onTokenOrCallbacks === 'function' ? { onToken: onTokenOrCallbacks } : onTokenOrCallbacks
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolCalls: Record<number, { name: string; arguments: string }> = {}
  let buffer = ''
  let content = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim().startsWith('data: ')) continue
      const raw = line.trim().slice(6)
      if (!raw || raw === '[DONE]') continue
      const delta = JSON.parse(raw)?.choices?.[0]?.delta
      if (delta?.content) {
        content += delta.content
        callbacks.onToken(delta.content)
      }
      for (const call of delta?.tool_calls || []) {
        const entry = toolCalls[call.index || 0] ||= { name: '', arguments: '' }
        entry.name ||= call.function?.name || ''
        entry.arguments += call.function?.arguments || ''
      }
    }
  }
  Object.values(toolCalls).forEach((call) => call.name && callbacks.onToolCall?.(call))
  return content
}
