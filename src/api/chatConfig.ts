/**
 * 对话配置 API
 */
import client from './client'

export interface ChatConfig {
  id: string
  name: string
  model: string | null
  vendor_strategy: 'specified' | 'round_robin'
  vendor: string | null
  enable_tool_call: boolean
  tools: string[]
  is_default: boolean
  created: string
  updated: string
}

export interface ChatConfigListResponse {
  configs: ChatConfig[]
}

export interface ChatConfigCreateRequest {
  name: string
  model?: string
  vendor_strategy?: 'specified' | 'round_robin'
  vendor?: string
  enable_tool_call?: boolean
  tools?: string[]
}

export interface ChatConfigUpdateRequest {
  name?: string
  model?: string
  vendor_strategy?: 'specified' | 'round_robin'
  vendor?: string
  enable_tool_call?: boolean
  tools?: string[]
}

export interface ChatConfigVendorOption {
  name: string
  display_name: string
}

/**
 * 获取所有对话配置
 */
export async function getChatConfigs(): Promise<ChatConfigListResponse> {
  const { data } = await client.get('/api/chat_config/list')
    return data
}

/**
 * 获取单个配置
 */
export async function getChatConfig(configId: string): Promise<ChatConfig> {
    const { data } = await client.get(`/api/chat_config/${configId}`)
    return data
}

/**
 * 创建对话配置
 */
export async function createChatConfig(request: ChatConfigCreateRequest): Promise<{ status: string; config: ChatConfig }> {
    const { data } = await client.post('/api/chat_config/create', request)
    return data
}

/**
 * 更新对话配置
 */
export async function updateChatConfig(
    configId: string,
    request: ChatConfigUpdateRequest
): Promise<{ status: string; config: ChatConfig }> {
    const { data } = await client.put(`/api/chat_config/${configId}`, request)
    return data
}

/**
 * 删除对话配置
 */
export async function deleteChatConfig(configId: string): Promise<{ status: string; config_id: string }> {
    const { data } = await client.delete(`/api/chat_config/${configId}`)
    return data
}

/**
 * 设为默认配置
 */
export async function setDefaultConfig(configId: string): Promise<{ status: string; default_id: string }> {
    const { data } = await client.post(`/api/chat_config/${configId}/set-default`)
    return data
}

/**
 * 重新生成 API Key（config ID）
 */
export async function regenerateConfigKey(configId: string): Promise<{ status: string; old_id: string; config: ChatConfig }> {
    const { data } = await client.post(`/api/chat_config/${configId}/regenerate-key`)
    return data
}

/**
 * 获取指定聊天模型的真实供应商选项
 */
export async function getChatConfigVendorOptions(modelId: string): Promise<ChatConfigVendorOption[]> {
  const { data } = await client.get('/api/admin/switch-options', {
    params: { model_id: modelId },
  })
  return data?.vendors || []
}

// ==================== External API Key ====================

export interface ExternalApiKey {
  id: string
  user_id: string
  config_id: string
  name: string | null
  key_preview: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface ExternalApiKeyCreated extends ExternalApiKey {
  token: string
}

/**
 * 创建外部 API Key
 */
export async function createExternalKey(configId: string, name?: string): Promise<ExternalApiKeyCreated> {
  const { data } = await client.post(`/api/chat_config/${configId}/external-keys`, { name: name || null })
  return data
}

/**
 * 列出外部 API Key
 */
export async function listExternalKeys(configId: string): Promise<ExternalApiKey[]> {
  const { data } = await client.get(`/api/chat_config/${configId}/external-keys`)
  return data?.keys || []
}

/**
 * 撤销外部 API Key
 */
export async function revokeExternalKey(keyId: string): Promise<void> {
  await client.delete(`/api/chat_config/external-keys/${keyId}`)
}

// ==================== 端口绑定 API ====================

export interface PortBinding {
  port: number
  model: string
  vendor: string | null
  enabled: boolean
  created?: string
  updated?: string
}

export interface PortBindingCreateRequest {
  port: number
  model: string
  vendor?: string
  enabled?: boolean
}

export interface PortBindingUpdateRequest {
  model?: string
  vendor?: string
  enabled?: boolean
}

/**
 * 获取所有端口绑定
 */
export async function getPortBindings(): Promise<{ bindings: PortBinding[] }> {
  const { data } = await client.get('/api/chat_config/port-bindings')
  return data
}

/**
 * 创建端口绑定
 */
export async function createPortBinding(request: PortBindingCreateRequest): Promise<{ status: string; binding: PortBinding }> {
  const { data } = await client.post('/api/chat_config/port-bindings', request)
  return data
}

/**
 * 更新端口绑定
 */
export async function updatePortBinding(
  port: number,
  request: PortBindingUpdateRequest
): Promise<{ status: string; binding: PortBinding }> {
  const { data } = await client.put(`/api/chat_config/port-bindings/${port}`, request)
  return data
}

/**
 * 删除端口绑定
 */
export async function deletePortBinding(port: number): Promise<{ status: string; port: number }> {
  const { data } = await client.delete(`/api/chat_config/port-bindings/${port}`)
  return data
}
