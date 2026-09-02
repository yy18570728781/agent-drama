/**
 * 对话平台配置 API
 * 管理工具平台和第三方平台的对话切换配置
 */
import client from './client'

export type PlatformType = 'local' | 'external'
export type VendorStrategy = 'specified' | 'round_robin'

export interface ChatPlatform {
  id: string
  name: string
  type: PlatformType
  model: string | null
  vendor_strategy: VendorStrategy
  vendor: string | null
  identifier: string | null  // 自动生成的唯一标识符
  created: string
  updated: string
}

export interface PlatformsResponse {
  platforms: Record<string, ChatPlatform>
}

export interface CreatePlatformRequest {
  name: string
  type?: PlatformType
  model?: string | null
  vendor_strategy?: VendorStrategy
  vendor?: string | null
}

export interface UpdatePlatformRequest {
  name?: string
  model?: string | null
  vendor_strategy?: VendorStrategy
  vendor?: string | null
}

export interface PlatformResponse {
  status: string
  platform?: ChatPlatform
  platform_id?: string
  identifier?: string
  message?: string
}

/**
 * 获取所有平台配置
 */
export async function getChatPlatforms(): Promise<PlatformsResponse> {
  const res = await client.get('/admin/platforms')
  return res.data
}

/**
 * 获取单个平台配置
 */
export async function getChatPlatform(platformId: string): Promise<ChatPlatform> {
  const res = await client.get(`/admin/platforms/${platformId}`)
  return res.data
}

/**
 * 创建平台
 */
export async function createChatPlatform(request: CreatePlatformRequest): Promise<PlatformResponse> {
  const res = await client.post('/admin/platforms', request)
  return res.data
}

/**
 * 更新平台配置
 */
export async function updateChatPlatform(platformId: string, request: UpdatePlatformRequest): Promise<PlatformResponse> {
  const res = await client.put(`/admin/platforms/${platformId}`, request)
  return res.data
}

/**
 * 删除平台
 */
export async function deleteChatPlatform(platformId: string): Promise<PlatformResponse> {
  const res = await client.delete(`/admin/platforms/${platformId}`)
  return res.data
}

/**
 * 重新生成标识符
 */
export async function regeneratePlatformIdentifier(platformId: string): Promise<{ status: string; identifier: string }> {
  const res = await client.post(`/admin/platforms/${platformId}/regenerate-identifier`)
  return res.data
}
