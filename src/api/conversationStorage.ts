import { getStoredAuthScope } from './tokenStorage'
import type {
  ConversationDetailPayload,
  ConversationMessagePayload,
  ConversationSummaryPayload,
  CreateConversationPayload,
  UpdateConversationPayload,
} from './conversations.types'

const STORAGE_PREFIX = 'infinite_canvas_conversations'

function storageKey(): string {
  const scope = getStoredAuthScope()
  return `${STORAGE_PREFIX}:${scope?.tenantId || 'anonymous'}:${scope?.userId || 'anonymous'}`
}

function readAll(): ConversationDetailPayload[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey()) || '[]')
    return Array.isArray(parsed) ? parsed as ConversationDetailPayload[] : []
  } catch {
    return []
  }
}

function writeAll(items: ConversationDetailPayload[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(items))
  } catch {
    throw new Error('浏览器无法保存会话记录')
  }
}

function summary(item: ConversationDetailPayload): ConversationSummaryPayload {
  return {
    id: item.id,
    title: item.title,
    model: item.model,
    message_count: item.messages.length,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

/** List locally persisted conversations for the current Teamones user. */
export function listStoredConversations(): ConversationSummaryPayload[] {
  return readAll().sort((left, right) => right.updated_at.localeCompare(left.updated_at)).map(summary)
}

/** Create a locally persisted conversation. */
export function createStoredConversation(payload: CreateConversationPayload): ConversationDetailPayload {
  const now = new Date().toISOString()
  const item: ConversationDetailPayload = {
    id: crypto.randomUUID(),
    title: payload.title?.trim() || '新对话',
    model: payload.model,
    created_at: now,
    updated_at: now,
    messages: [],
  }
  writeAll([item, ...readAll()])
  return item
}

/** Read one locally persisted conversation. */
export function getStoredConversation(id: string): ConversationDetailPayload {
  const item = readAll().find((candidate) => candidate.id === id)
  if (!item) throw new Error('会话不存在')
  return item
}

/** Update one locally persisted conversation. */
export function updateStoredConversation(id: string, payload: UpdateConversationPayload): void {
  const items = readAll()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('会话不存在')
  items[index] = { ...items[index], ...payload, updated_at: new Date().toISOString() }
  writeAll(items)
}

/** Delete one locally persisted conversation. */
export function deleteStoredConversation(id: string): void {
  writeAll(readAll().filter((item) => item.id !== id))
}

/** Append a message and update the derived conversation title/time. */
export function appendStoredMessage(
  conversationId: string,
  payload: Pick<ConversationMessagePayload, 'role' | 'content' | 'files' | 'tool_calls'>,
): ConversationMessagePayload {
  const items = readAll()
  const index = items.findIndex((item) => item.id === conversationId)
  if (index < 0) throw new Error('会话不存在')
  const message: ConversationMessagePayload = {
    ...payload,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const current = items[index]
  const title = current.title === '新对话' && payload.role === 'user'
    ? payload.content.trim().slice(0, 20) || current.title
    : current.title
  items[index] = { ...current, title, updated_at: message.timestamp, messages: [...current.messages, message] }
  writeAll(items)
  return message
}
