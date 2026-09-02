export interface ConversationSummaryPayload {
  id: string
  title: string
  model: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ConversationMessagePayload {
  id: string
  role: string
  content: string
  images?: string[] | null
  files?: Record<string, unknown>[] | null
  tool_calls?: Record<string, unknown>[] | null
  tool_call_id?: string | null
  timestamp: string
}

export interface ConversationDetailPayload {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  messages: ConversationMessagePayload[]
}

export interface CreateConversationPayload {
  title?: string
  model: string
}

export interface UpdateConversationPayload {
  title?: string
  model?: string
}

export interface SendConversationMessagePayload {
  content: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  tools?: Record<string, unknown>[]
  tool_choice?: string
}

export interface ConversationChatResponse {
  conversation: { id: string; title: string; model: string }
  user_message: ConversationMessagePayload
  assistant_message: ConversationMessagePayload
  raw?: Record<string, unknown>
}

export interface SSEStreamCallbacks {
  onToken: (token: string) => void
  onToolCall?: (toolCall: { name: string; arguments: string }) => void
}
