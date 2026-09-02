import teamonesClient from './teamonesClient'

// ================== 类型定义 ==================

export interface Vendor {
  id: number | string
  name: string           // 厂商名称
  vendor: string         // 厂商代码
  protocol?: string      // 协议 ID（如 openai-compatible）
  plan?: string          // 计划版本（如 'plan'），用于区分标准版和 Plan 版
  type?: 'standard' | 'comfyui'  // 类型：标准或 ComfyUI
  base_url?: Record<string, string>  // 基础地址
  api_key?: string       // 密钥
  icon?: string          // 图标
  status: number         // 状态。0-禁用，1-启用
  created?: string
  updated?: string
  created_by?: number
  models?: string[]      // 关联的模型列表
  // 以下是计算属性或可选的 UI 属性
  display_name?: string  // 显示名称
  enabled?: boolean      // 是否启用（UI层计算属性）
  has_api_key?: boolean  // 是否配置了API密钥（UI层计算属性）
  sourceType?: 'local' | 'teamones'  // 数据来源类型
  uniqueKey?: string     // 唯一标识符（用于区分不同来源的相同ID）
}

export interface VendorListParams {
  page?: number
  per_page?: number
  filter?: {
    name?: string
    status?: number
  }
}

export interface VendorListResponse {
  total: number
  per_page: number
  current_page: number
  last_page: number
  vendors: Vendor[]
}

export interface CreateVendorParams {
  name: string           // 厂商名称
  vendor: string         // 厂商代码
  protocol?: string      // 协议 ID
  base_url?: Record<string, string>  // 基础地址
  api_key: string        // 密钥
  icon?: string          // 图标
  models?: string[]      // 关联模型
}

export interface UpdateVendorParams {
  id: number | string
  name?: string
  vendor?: string
  protocol?: string
  base_url?: Record<string, string>
  api_key?: string
  icon?: string
  status?: number
  models?: string[]
}

// ================== 厂商列表 ==================

// 本地版本
export async function getLocalVendors(params?: VendorListParams): Promise<Vendor[]> {
  return getVendors(params)
}

function vendorRows(payload: unknown): Vendor[] {
  const root = payload as { data?: unknown; vendors?: unknown }
  const nested = root?.data as { data?: unknown; vendors?: unknown } | Vendor[] | undefined
  const rows = Array.isArray(nested) ? nested : nested?.data ?? nested?.vendors ?? root?.vendors
  return Array.isArray(rows) ? rows as Vendor[] : []
}

function vendorOptions(protocol: string, baseUrl?: Record<string, string>): Record<string, unknown> | undefined {
  if (!baseUrl) return undefined
  const value = baseUrl[protocol] || baseUrl.base_url || Object.values(baseUrl)[0]
  return value ? { [protocol]: { base_url: value } } : undefined
}

function normalizeVendor(vendor: Vendor & { options?: Record<string, unknown> }): Vendor {
  const protocol = vendor.protocol || 'openai-compatible'
  const protocolOptions = vendor.options?.[protocol]
  const baseUrl = protocolOptions && typeof protocolOptions === 'object'
    ? String((protocolOptions as Record<string, unknown>).base_url || '')
    : ''
  return { ...vendor, protocol, base_url: baseUrl ? { [protocol]: baseUrl } : vendor.base_url }
}

// Teamones 版本
export async function getVendors(params?: VendorListParams): Promise<Vendor[]> {
  const { data } = await teamonesClient.post('/api_assets/vendors/list', {
    param: {
      filter: params?.filter,
      page: params?.page || 1,
      per_page: params?.per_page || 20
    }
  })

  // 响应格式: { code: 0, msg: "success", data: { data: { vendors: [...] } } }
  return vendorRows(data).map(normalizeVendor)
}

// ================== 创建厂商 ==================

// 本地版本
export async function createLocalVendor(params: CreateVendorParams): Promise<{ id: number | string }> {
  return createVendor(params)
}

// Teamones 版本
export async function createVendor(params: CreateVendorParams): Promise<{ id: number | string }> {
  const { data } = await teamonesClient.post('/api_assets/vendors/create', {
    data: {
      name: params.name,
      vendor: params.vendor,
      protocol: params.protocol,
      options: vendorOptions(params.protocol || 'openai-compatible', params.base_url),
      api_key: params.api_key,
      icon: params.icon,
    },
  })
  return data.data || data
}

// ================== 更新厂商 ==================

// 本地版本
export async function updateLocalVendor(params: UpdateVendorParams): Promise<{ id: number | string }> {
  return updateVendor(params)
}

// Teamones 版本
export async function updateVendor(params: UpdateVendorParams): Promise<{ id: number | string }> {
  const { data } = await teamonesClient.post('/api_assets/vendors/update', {
    data: {
      id: params.id,
      name: params.name,
      vendor: params.vendor,
      protocol: params.protocol,
      options: vendorOptions(params.protocol || 'openai-compatible', params.base_url),
      api_key: params.api_key,
      icon: params.icon,
      status: params.status,
      models: params.models
    }
  })
  return data.data || data
}

// ================== 删除厂商 ==================

// ================== 删除本地厂商 ==================

export async function deleteLocalVendor(id: number | string): Promise<void> {
  await deleteVendor(id)
}

export async function deleteVendor(id: number | string): Promise<void> {
  await teamonesClient.post('/api_assets/vendors/delete', { id })
}

// ================== 启用/禁用厂商 ==================

export async function enableVendor(id: number | string): Promise<void> {
  await updateVendor({ id, status: 1 })
}

export async function disableVendor(id: number | string): Promise<void> {
  await updateVendor({ id, status: 0 })
}

// ================== 获取单个厂商详情（通过名称） ==================

export async function getVendorDetail(name: string): Promise<Vendor> {
  // 先获取所有厂商，然后找到匹配的
  const { data } = await teamonesClient.post('/api_assets/vendors/list', {
    param: {
      filter: { name },
      page: 1,
      per_page: 1
    }
  })
  // 响应格式: { code: 0, msg: "success", data: { data: { vendors: [...] } } }
  const vendors = vendorRows(data).map(normalizeVendor)
  if (vendors.length > 0) {
    return vendors[0]
  }
  throw new Error(`Vendor ${name} not found`)
}

// ================== 保存厂商 API Key ==================

export async function saveVendorApiKey(name: string, apiKey: string): Promise<void> {
  // 通过名称查找 vendor，然后更新
  const { data } = await teamonesClient.post('/api_assets/vendors/list', {
    param: {
      filter: { name },
      page: 1,
      per_page: 1
    }
  })
  // 响应格式: { code: 0, msg: "success", data: { data: { vendors: [...] } } }
  const vendors = vendorRows(data).map(normalizeVendor)
  if (vendors.length > 0) {
    const vendor = vendors[0]
    await updateVendor({ id: vendor.id, api_key: apiKey })
  } else {
    throw new Error(`Vendor ${name} not found`)
  }
}

// ================== 获取厂商支持的模型列表 ==================

export async function getVendorModels(name: string): Promise<Record<string, any>> {
  const { data } = await teamonesClient.post('/api_assets/endpoints/list', {
    param: { page: 1, per_page: 1000, filter: { vendor: name, status: 1 } },
  })
  const rows = data?.data?.data || data?.data || []
  return Object.fromEntries((Array.isArray(rows) ? rows : []).map((item: Record<string, any>) => [item.model_name || item.name, item]))
}


