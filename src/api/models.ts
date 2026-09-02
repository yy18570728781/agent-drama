import client from './client'
import axios from 'axios'
import teamonesClient from './teamonesClient'

export function clearModelCache(_modelId?: string, _capability?: string) {
  // no-op: model caching removed
}

export interface PublisherInfo {
  id?: string
  name: string
  label?: string
  icon?: string | null
  vendor?: string | null
}

export type ModelPublisher = string | PublisherInfo | null

/** 后端返回的模型信息 */
export interface BackendModelInfo {
  id?: string
  teamones_model_id?: number | null
  name?: string | null
  display_name: string | null
  vendor: string | null
  protocol?: string | null
  publisher?: ModelPublisher
  capabilities: any[]
  vendors: string[]
  modes?: any[]
  params: Record<string, any> | null
  context_window_tokens?: number | null
}

/** GET /api/models 响应 */
export interface ModelListResponse {
  models: BackendModelInfo[]
  total: number
}

/** 模式信息（来自能力 API 返回） */
export interface CapabilityModeInfo {
  name: string
  label?: string | null
  description?: string | null
}

/** 能力信息 */
export interface CapabilityInfo {
  id: string
  name: string
  description: string
  type?: string | null
  icon?: string | null
  modes?: CapabilityModeInfo[]
}

/** GET /api/capabilities 响应 */
export interface CapabilityListResponse {
  capabilities: CapabilityInfo[]
}

const modelListCache = new Map<string, ModelListResponse>()
const modelListPromises = new Map<string, Promise<ModelListResponse>>()
const capabilityCache = new Map<string, CapabilityListResponse>()
const capabilityPromises = new Map<string, Promise<CapabilityListResponse>>()
const reservePointsPromises = new Map<string, Promise<ReservePointsResponse>>()

function getModelListCacheKey(type?: string, capabilities?: string[], mode?: string): string {
  return JSON.stringify({
    type: type || '',
    capabilities: [...(capabilities || [])].sort(),
    mode: mode || '',
  })
}

function requestModelList(
  cacheKey: string,
  params: Record<string, string>,
): Promise<ModelListResponse> {
  const pending = modelListPromises.get(cacheKey)
  if (pending) return pending

  const request = client.get('/api/models', { params })
    .then(({ data }) => {
      const result = data?.data || data
      modelListCache.set(cacheKey, result)
      return result
    })
    .finally(() => {
      modelListPromises.delete(cacheKey)
    })
  modelListPromises.set(cacheKey, request)
  return request
}

/**
 * 获取模型列表
 * @param type 模型类型，可选值: chat, generations
 * @param capabilities 能力列表，多个用逗号分割，如: image_generation,video_generation
 * @param mode 模式过滤，如: text2image, image2image, text2video, image2video
 */
export async function getAllModels(
  type?: string,
  capabilities?: string[],
  mode?: string
): Promise<ModelListResponse> {
  const cacheKey = getModelListCacheKey(type, capabilities, mode)
  const cached = modelListCache.get(cacheKey)
  if (cached) return cached

  const params: Record<string, string> = {}
  if (type) params.type = type
  if (capabilities && capabilities.length > 0) params.capabilities = capabilities.join(',')
  if (mode) params.mode = mode
  return requestModelList(cacheKey, params)
}

// ---- Cached generation models ----
let _generationModelsCache: any[] | null = null
let _generationModelsPromise: Promise<any[]> | null = null

export async function getCachedGenerationModels(): Promise<any[]> {
  if (_generationModelsCache) return _generationModelsCache
  if (!_generationModelsPromise) {
    _generationModelsPromise = getAllModels('generations')
      .then((res: any) => {
        const models = res.models || res || []
        _generationModelsCache = models
        return models
      })
      .finally(() => {
        _generationModelsPromise = null
      })
  }
  return _generationModelsPromise
}

export async function getCapabilities(): Promise<CapabilityListResponse> {
  const { data } = await client.get('/api/capabilities')
  const body = data?.data ?? data
  let result: CapabilityListResponse
  if (Array.isArray(body)) result = { capabilities: body }
  else if (body?.capabilities) result = body
  else result = { capabilities: [] }
  return result
}

/** 选项定义 - 支持简单字符串或带标签的对象 */
export type SelectOption = string | { value: string; label: string }

export interface SubParamDef {
  name: string
  label: string
  required?: boolean
}

/** 模型参数 schema */
export interface ModelParamSchema {
  name: string
  label: string
  type: 'select' | 'number' | 'images' | 'text' | 'boolean' | 'file' | 'files' | 'file_list' | 'float' | 'integer' | 'array'
  options?: SelectOption[]
  default?: any
  min?: number
  max?: number
  required?: boolean
  hidden?: boolean
  min_items?: number
  max_items?: number
  sub_params?: SubParamDef[]
  accept?: string[]
  items_type?: 'text' | 'number'
}

/** GET /api/models/{model_id} 响应 */
export interface ModelDetailResponse {
  id: string
  teamones_model_id?: number | null
  display_name: string | null
  protocol?: string | null
  publisher: ModelPublisher
  capabilities: any[]
  vendors: string[]
  params: Record<string, ModelParamSchema> | null
}

export async function getModelDetail(modelId: string): Promise<ModelDetailResponse> {
  const { data } = await client.get(`/api/models/${encodeURIComponent(modelId)}`)
  return data?.data || data
}

export interface VendorTestResult {
  vendor: string
  ok: boolean
  skipped?: boolean
  status_code?: number | null
  error?: string | null
  latency_ms?: number | null
  protocol?: string | null
  url?: string | null
  reply_text?: string | null
  request_url?: string | null
  request_headers?: Record<string, string> | null
  request_body?: Record<string, any> | null
  response_headers?: Record<string, string> | null
  response_body?: string | null
}

export interface ModelTestResponse {
  model_id: string
  message: string
  results: VendorTestResult[]
}

export interface ModelVendorTestOptions {
  anthropicVersion?: string
}

export async function testModelVendors(
  modelId: string,
  message: string,
  vendorNames?: string[],
  options?: ModelVendorTestOptions
): Promise<ModelTestResponse> {
  const { data } = await client.post(`/api/models/${encodeURIComponent(modelId)}/test`, {
    message,
    vendor_names: vendorNames,
    anthropic_version: options?.anthropicVersion,
  }, { timeout: 60000 })
  return data?.data || data
}

/** 创建新模型 */
export async function createModel(modelData: Partial<BackendModelInfo>): Promise<BackendModelInfo> {
  const { data } = await client.post('/api/models', modelData)
  return data?.data || data
}

/** 更新模型 */
export async function updateModel(modelId: string, modelData: Partial<BackendModelInfo>): Promise<BackendModelInfo> {
  const { data } = await client.put(`/api/models/${encodeURIComponent(modelId)}`, modelData)
  return data?.data || data
}

/** 删除模型 */
export async function deleteModel(modelId: string): Promise<void> {
  await client.delete(`/api/models/${encodeURIComponent(modelId)}`)
}

/** 获取模型列表 (简化版) */
export async function getModels(params?: { 
  type?: string
  capabilities?: string
  mode?: string
}): Promise<ModelListResponse> {
  const { data } = await client.get('/api/models', { params })
  return data?.data || data
}

// ========== 新增：能力筛选相关 API ==========

/**
 * 根据类型获取能力列表
 * @param type 类型，如 'generations'
 * @returns 能力列表
 */
export async function getCapabilitiesByType(type?: string): Promise<CapabilityListResponse> {
  const cacheKey = type || ''
  const cached = capabilityCache.get(cacheKey)
  if (cached) return cached

  const pending = capabilityPromises.get(cacheKey)
  if (pending) return pending

  const params: Record<string, string> = {}
  if (type) params.type = type
  const request = client.get('/api/capabilities', { params })
    .then(({ data }) => {
      const body = data?.data ?? data
      let result: CapabilityListResponse
      if (Array.isArray(body)) result = { capabilities: body }
      else if (body?.capabilities) result = body
      else result = { capabilities: [] }
      capabilityCache.set(cacheKey, result)
      return result
    })
    .finally(() => {
      capabilityPromises.delete(cacheKey)
    })
  capabilityPromises.set(cacheKey, request)
  return request
}

/**
 * 根据能力获取模型列表
 * @param capabilityId 能力ID
 * @returns 模型列表
 */
export async function getModelsByCapability(capabilityId: string): Promise<ModelListResponse> {
  const { data } = await client.get('/api/models', { params: { capabilities: capabilityId } })
  return data?.data || data
}

/**
 * 根据模式获取模型列表（推荐使用）
 * @param modeId 模式ID，如 text2image, image2image, text2video, image2video
 * @param type 可选的类型过滤，如 chat, generations
 * @returns 模型列表
 */
export async function getModelsByMode(modeId: string, type?: string): Promise<ModelListResponse> {
  const params: Record<string, string> = { mode: modeId }
  if (type) params.type = type
  const { data } = await client.get('/api/models', { params })
  return data?.data || data
}

/** 模型模式信息 */
export interface ModelModeInfo {
  id?: string
  name: string
  label?: string
  description?: string
}

/** GET /api/models/{model_id}/modes 响应 */
export interface ModelModesResponse {
  modes: ModelModeInfo[]
}

export interface ReservePointsRequestItem {
  model_id: number
  type?: string | number | null
  capability?: string | null
  mode?: string | null
  param: Record<string, any>
}

export type ReservePointsResponse = Record<string, number>
export interface TeamonesModelRecord {
  id: number
  name?: string | null
  display_name?: string | null
}
/** GET /api/models/{model_id}/params 完整返回 */
export interface ModelParamsPayload {
  model_id: string
  capability?: string | null
  mode?: string | null
  vendor?: string | null
  params: Record<string, ModelParamSchema>
  defaults: Record<string, any>
}

function extractDefaultsFromParams(params: Record<string, any>): Record<string, any> {
  const defaults: Record<string, any> = {}
  Object.entries(params || {}).forEach(([name, schema]: [string, any]) => {
    if (schema && typeof schema === 'object' && Object.prototype.hasOwnProperty.call(schema, 'default')) {
      defaults[name] = schema.default
    }
  })
  return defaults
}

function normalizeModelParamsPayload(modelId: string, raw: any): ModelParamsPayload {
  const payload = raw?.data || raw || {}
  const isStructured = typeof payload === 'object' && payload !== null && (
    Object.prototype.hasOwnProperty.call(payload, 'params') ||
    Object.prototype.hasOwnProperty.call(payload, 'defaults') ||
    Object.prototype.hasOwnProperty.call(payload, 'model_id')
  )

  if (isStructured) {
    const params = (payload.params && typeof payload.params === 'object') ? payload.params : {}
    const defaults = (payload.defaults && typeof payload.defaults === 'object')
      ? payload.defaults
      : extractDefaultsFromParams(params)
    return {
      model_id: payload.model_id || modelId,
      capability: payload.capability ?? null,
      mode: payload.mode ?? null,
      vendor: payload.vendor ?? null,
      params,
      defaults,
    }
  }

  const params = (payload && typeof payload === 'object') ? payload : {}
  return {
    model_id: modelId,
    capability: null,
    mode: null,
    vendor: null,
    params,
    defaults: extractDefaultsFromParams(params),
  }
}

/**
 * 获取模型的所有模式
 * @param modelId 模型ID
 * @returns 模式列表
 */
export async function getModelModes(modelId: string, capability?: string): Promise<ModelModesResponse> {
  const params: Record<string, string> = {}
  if (capability) params.capability = capability
  try {
    const { data } = await client.get(`/api/models/${encodeURIComponent(modelId)}/modes`, { params, timeout: 60000 })
    const result = data?.data || data
    return result
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { modes: [] }
    }
    throw error
  }
}

/**
 * 根据模式获取模型参数
 * @param modelId 模型ID
 * @param modeId 模式ID
 * @returns 模型参数
 */
export async function getModelParamsByMode(
  modelId: string,
  modeId: string,
  capability?: string,
  vendor?: string | null
): Promise<Record<string, ModelParamSchema>> {
  const payload = await getModelParamsPayloadByMode(modelId, modeId, capability, vendor)
  return payload.params
}

export async function getModelParamsPayloadByMode(
  modelId: string,
  modeId: string,
  capability?: string,
  vendor?: string | null
): Promise<ModelParamsPayload> {
  const params: Record<string, string> = { mode: modeId }
  if (capability) params.capability = capability
  if (vendor) params.vendor = vendor
  try {
    const { data } = await client.get(`/api/models/${encodeURIComponent(modelId)}/params`, { params, timeout: 60000 })
    const result = normalizeModelParamsPayload(modelId, data)
    return result
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        model_id: modelId,
        capability: capability || null,
        mode: modeId || null,
        vendor: vendor || null,
        params: {},
        defaults: {},
      }
    }
    throw error
  }
}

export async function getModelReservePoints(items: ReservePointsRequestItem[]): Promise<ReservePointsResponse> {
  const cacheKey = JSON.stringify(items)
  const pending = reservePointsPromises.get(cacheKey)
  if (pending) return pending

  const request = teamonesClient.post('/api_assets/models/get_reserve_points', {
    param: items,
  }).then(({ data }) => data?.data || data || {})
    .finally(() => {
      reservePointsPromises.delete(cacheKey)
    })
  reservePointsPromises.set(cacheKey, request)
  return request
}

let _teamonesModelsPromise: Promise<TeamonesModelRecord[]> | null = null
let _teamonesModelsCache: TeamonesModelRecord[] | null = null

export async function getTeamonesModels(): Promise<TeamonesModelRecord[]> {
  if (_teamonesModelsCache) return _teamonesModelsCache
  if (!_teamonesModelsPromise) {
    _teamonesModelsPromise = teamonesClient.post('/api_assets/models/list', {
      param: { page: 1, per_page: 500, filter: { status: 1 } },
    }).then(({ data }) => {
      const payload = data?.data || data || {}
      const rows = Array.isArray(payload?.data) ? payload.data : []
      _teamonesModelsCache = rows as TeamonesModelRecord[]
      return _teamonesModelsCache
    }).finally(() => {
      _teamonesModelsPromise = null
    })
  }
  return _teamonesModelsPromise
}
/** 发布者列表响应 */
export interface PublisherListResponse {
  publishers: PublisherInfo[]
}

/**
 * 获取发布者列表
 * @returns 发布者列表
 */
export async function getPublishers(): Promise<PublisherListResponse> {
  const { data } = await client.get('/api/publishers')
  return data?.data || data
}




