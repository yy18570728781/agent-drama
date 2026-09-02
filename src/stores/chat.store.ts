import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getAllModels, type BackendModelInfo } from '@/api/models'
import {
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  getConversation as getConversationApi,
  listConversations as listConversationsApi,
  addConversationMessage,
  consumeSSEStream,
  streamConversationMessage,
  updateConversation as updateConversationApi,
  type ConversationDetailPayload,
  type ConversationMessagePayload,
  type ConversationSummaryPayload,
} from '@/api/conversations'

export interface ChatFileAttachment {
  filename: string
  file_type: string
  file_size: number
  char_count: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  toolCall?: {
    name: string
    params: Record<string, any>
    status: string
  }
  toolCalls?: Record<string, any>[]
  images?: string[]
  videos?: string[]
  files?: ChatFileAttachment[]
  timestamp: number | string
}

export interface ChatSession {
  id: string
  title: string
  model: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

function extractErrorMessage(error: any): string {
  return error?.response?.data?.detail || error?.response?.data?.message || error?.message || '请求失败'
}

function mapSession(session: ConversationSummaryPayload | ConversationDetailPayload): ChatSession {
  return {
    id: session.id,
    title: session.title || '新对话',
    model: session.model,
    messageCount: 'message_count' in session ? session.message_count : session.messages?.length || 0,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }
}

function mapMessage(message: ConversationMessagePayload): ChatMessage {
  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'ai',
    content: message.content || '',
    images: message.images || undefined,
    files: message.files as unknown as ChatFileAttachment[] || undefined,
    toolCalls: message.tool_calls || undefined,
    timestamp: message.timestamp,
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const chatModels = ref<BackendModelInfo[]>([])
  const selectedModelId = ref('')
  const isInitializing = ref(false)
  const isCreatingSession = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)
  const isWaitingForResponse = ref(false)
  const error = ref('')
  const sendError = ref('')
  const loadedSessionId = ref<string | null>(null)
  const currentAbortController = ref<AbortController | null>(null)

  const currentSession = computed(() => sessions.value.find((session) => session.id === currentSessionId.value) || null)
  const currentModelId = computed(() => currentSession.value?.model || selectedModelId.value || chatModels.value[0]?.id || '')

  function upsertSession(session: ChatSession) {
    const index = sessions.value.findIndex((item) => item.id === session.id)
    if (index === -1) {
      sessions.value.unshift(session)
    } else {
      sessions.value[index] = session
    }
  }

  function getModelLabel(modelId: string) {
    const matched = chatModels.value.find((model) => model.id === modelId)
    return matched?.display_name || matched?.name || modelId
  }

  async function loadChatModels() {
    const response = await getAllModels('chat')
    chatModels.value = (response.models || []).filter((model) => {
      const capabilities = Array.isArray(model.capabilities) ? model.capabilities : []
      return capabilities.length === 0 || capabilities.some((capability) => ['chat', 'coding', 'agent', 'tool_use'].includes(capability))
    })

    const firstModelId = chatModels.value[0]?.id
    if (!selectedModelId.value && firstModelId) {
      selectedModelId.value = firstModelId
    }
  }

  async function refreshSessions() {
    const response = await listConversationsApi()
    sessions.value = (response.conversations || []).map(mapSession)

    if (currentSessionId.value && !sessions.value.some((session) => session.id === currentSessionId.value)) {
      currentSessionId.value = null
      loadedSessionId.value = null
      messages.value = []
    }
  }

  async function loadConversation(conversationId: string, force = false) {
    if (!force && loadedSessionId.value === conversationId) {
      currentSessionId.value = conversationId
      return currentSession.value
    }

    isLoadingMessages.value = true
    error.value = ''

    try {
      const detail = await getConversationApi(conversationId)
      currentSessionId.value = conversationId
      loadedSessionId.value = conversationId
      selectedModelId.value = detail.model || selectedModelId.value
      messages.value = (detail.messages || []).map(mapMessage)
      upsertSession(mapSession(detail))
      return detail
    } catch (requestError) {
      error.value = extractErrorMessage(requestError)
      throw requestError
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function initialize() {
    if (isInitializing.value) {
      return
    }

    isInitializing.value = true
    error.value = ''

    try {
      await Promise.all([loadChatModels(), refreshSessions()])

      if (sessions.value.length) {
        await loadConversation(currentSessionId.value || sessions.value[0].id)
      }
    } catch (requestError) {
      error.value = extractErrorMessage(requestError)
      throw requestError
    } finally {
      isInitializing.value = false
    }
  }

  async function createSession(modelId = currentModelId.value) {
    if (!chatModels.value.length) {
      await loadChatModels()
    }

    const resolvedModelId = modelId || selectedModelId.value || chatModels.value[0]?.id
    if (!resolvedModelId) {
      throw new Error('暂无可用的 chat 模型')
    }

    isCreatingSession.value = true
    error.value = ''

    try {
      const created = await createConversationApi({
        title: '新对话',
        model: resolvedModelId,
      })
      const now = new Date().toISOString()
      const session: ChatSession = {
        id: created.id,
        title: created.title || '新对话',
        model: created.model,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      upsertSession(session)
      currentSessionId.value = created.id
      loadedSessionId.value = created.id
      selectedModelId.value = created.model
      messages.value = []
      await refreshSessions()
      return session
    } catch (requestError) {
      error.value = extractErrorMessage(requestError)
      throw requestError
    } finally {
      isCreatingSession.value = false
    }
  }

  async function switchSession(id: string) {
    if (!id) {
      return
    }

    await loadConversation(id)
  }

  async function updateSessionModel(modelId: string) {
    if (!modelId) {
      return
    }

    selectedModelId.value = modelId

    if (!currentSessionId.value) {
      return
    }

    await updateConversationApi(currentSessionId.value, { model: modelId })

    if (currentSession.value) {
      upsertSession({
        ...currentSession.value,
        model: modelId,
      })
    }

    await refreshSessions()
  }

  async function deleteSession(id: string) {
    if (!id) return

    await deleteConversationApi(id)
    sessions.value = sessions.value.filter(s => s.id !== id)

    if (currentSessionId.value === id) {
      currentSessionId.value = null
      loadedSessionId.value = null
      messages.value = []

      // 自动切到第一个会话
      if (sessions.value.length) {
        await loadConversation(sessions.value[0].id)
      }
    }
  }

  const pendingToolCall = ref<{ name: string; arguments: Record<string, any> } | null>(null)

  async function sendMessage(content: string, options?: { modelId?: string; tools?: Record<string, any>[] }) {
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      return null
    }

    sendError.value = ''
    error.value = ''

    let conversationId = currentSessionId.value
    const targetModelId = options?.modelId || currentModelId.value

    if (!conversationId) {
      const session = await createSession(targetModelId)
      conversationId = session.id
    } else if (targetModelId && currentSession.value?.model !== targetModelId) {
      await updateSessionModel(targetModelId)
    }

    if (!conversationId) {
      throw new Error('创建会话失败')
    }

    isSending.value = true
    isWaitingForResponse.value = true
    pendingToolCall.value = null

    const userMsgId = `user-${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmedContent,
      timestamp: new Date().toISOString(),
    }
    messages.value = [...messages.value, userMsg]

    const aiMsgId = `ai-${Date.now()}`
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
    }
    messages.value = [...messages.value, aiMsg]

    try {
      const abortController = new AbortController()
      currentAbortController.value = abortController

      const response = await streamConversationMessage(
        conversationId,
        {
          content: trimmedContent,
          ...(options?.tools?.length ? { tools: options.tools } : {}),
        },
        { signal: abortController.signal },
      )

      const fullContent = await consumeSSEStream(response, {
        onToken: (token) => {
          const idx = messages.value.findIndex(m => m.id === aiMsgId)
          if (idx !== -1) {
            if (isWaitingForResponse.value) {
              isWaitingForResponse.value = false
            }
            const updated = { ...messages.value[idx], content: messages.value[idx].content + token }
            messages.value = [
              ...messages.value.slice(0, idx),
              updated,
              ...messages.value.slice(idx + 1),
            ]
          }
        },
        onToolCall: (tc) => {
          try {
            pendingToolCall.value = {
              name: tc.name,
              arguments: JSON.parse(tc.arguments || '{}'),
            }
          } catch {
            pendingToolCall.value = { name: tc.name, arguments: {} }
          }
          // Remove the empty AI placeholder when tool_call is detected
          messages.value = messages.value.filter(m => m.id !== aiMsgId || m.content)
        },
      })

      currentAbortController.value = null

      if (!fullContent) {
        messages.value = messages.value.filter(m => m.id !== aiMsgId)
      } else {
        await addConversationMessage(conversationId, { role: 'assistant', content: fullContent })
      }

      await reloadCurrentSession()
      await refreshSessions()
      return { content: fullContent }
    } catch (requestError: any) {
      isWaitingForResponse.value = false
      if (requestError?.name === 'AbortError') {
        return null
      }
      sendError.value = extractErrorMessage(requestError)
      messages.value = messages.value.filter(m => m.id !== aiMsgId || m.content)
      throw requestError
    } finally {
      isSending.value = false
      isWaitingForResponse.value = false
      currentAbortController.value = null
    }
  }

  function abortSending() {
    currentAbortController.value?.abort()
    currentAbortController.value = null
    isSending.value = false
    isWaitingForResponse.value = false
  }

  function addMessage(msg: ChatMessage) {
    messages.value = [...messages.value, msg]
    if (currentSession.value && msg.role === 'user' && currentSession.value.title === '新对话') {
      upsertSession({
        ...currentSession.value,
        title: msg.content.slice(0, 20) || '新对话',
      })
    }
  }

  function clearMessages() {
    messages.value = []
    loadedSessionId.value = null
  }

  async function reloadCurrentSession() {
    if (!currentSessionId.value) {
      return
    }
    await loadConversation(currentSessionId.value, true)
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    currentModelId,
    messages,
    chatModels,
    selectedModelId,
    isInitializing,
    isCreatingSession,
    isLoadingMessages,
    isSending,
    isWaitingForResponse,
    error,
    sendError,
    pendingToolCall,
    initialize,
    refreshSessions,
    createSession,
    switchSession,
    deleteSession,
    updateSessionModel,
    sendMessage,
    abortSending,
    addMessage,
    clearMessages,
    reloadCurrentSession,
    getModelLabel,
  }
})
