/**
 * 别名配置 API
 * 用于管理模型别名（如 SmDefault、OpDefault、HkDefault 等）
 */
import client from './client'

export interface AliasConfig {
  model: string | null
  vendor: string | null
}

export interface AliasesResponse {
  aliases: Record<string, AliasConfig>
}

export interface SetAliasRequest {
  alias: string
  model: string
  vendor?: string | null
}

export interface CreateAliasRequest {
  alias: string
  model?: string | null
  vendor?: string | null
}

export interface AliasResponse {
  status: string
  alias: string
  model: string | null
  vendor: string | null
  message?: string
}

/**
 * 获取所有别名配置
 */
export async function getAliases(): Promise<AliasesResponse> {
  const res = await client.get('/admin/aliases')
  return res.data
}

/**
 * 设置别名配置
 */
export async function setAlias(request: SetAliasRequest): Promise<AliasResponse> {
  const res = await client.post('/admin/aliases', request)
  return res.data
}

/**
 * 创建新别名
 */
export async function createAlias(request: CreateAliasRequest): Promise<AliasResponse> {
  const res = await client.post('/admin/aliases/create', request)
  return res.data
}

/**
 * 删除别名
 */
export async function deleteAlias(alias: string): Promise<{ status: string; alias: string; message?: string }> {
  const res = await client.delete(`/admin/aliases/${encodeURIComponent(alias)}`)
  return res.data
}
