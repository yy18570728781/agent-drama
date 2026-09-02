import client from './client'
import { getStoredAuthScope } from './tokenStorage'

export interface UserPreset {
  id: string
  name: string
  description: string
  capability: string
  params: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BuiltinPreset extends Omit<UserPreset, 'created_at' | 'updated_at'> {}

export interface ParamSchemaItem {
  type: string
  label?: string
  description?: string
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: unknown; label: string }>
  required?: boolean
}

export interface CapabilityParamsResponse {
  capability?: string
  mode?: string | null
  template?: string
  params?: Record<string, ParamSchemaItem>
  [key: string]: unknown
}

export interface ParamsTemplatesResponse {
  templates: Record<string, Record<string, ParamSchemaItem>>
}

export interface CreatePresetRequest {
  name: string
  description?: string
  capability: string
  params: Record<string, unknown>
}

export interface UpdatePresetRequest {
  name?: string
  description?: string
  params?: Record<string, unknown>
}

const STORAGE_PREFIX = 'infinite_canvas_presets'

function storageKey(): string {
  const scope = getStoredAuthScope()
  return `${STORAGE_PREFIX}:${scope?.tenantId || 'anonymous'}:${scope?.userId || 'anonymous'}`
}

function readPresets(): UserPreset[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey()) || '[]')
    return Array.isArray(parsed) ? parsed as UserPreset[] : []
  } catch {
    return []
  }
}

function writePresets(presets: UserPreset[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(presets))
  } catch {
    throw new Error('浏览器无法保存用户预设')
  }
}

/** List user presets stored for the current Teamones identity. */
export async function getUserPresets(capability?: string): Promise<{ presets: UserPreset[]; total: number }> {
  const presets = readPresets().filter((item) => !capability || item.capability === capability)
  return { presets, total: presets.length }
}

/** Read one user preset. */
export async function getUserPreset(presetId: string): Promise<UserPreset> {
  const preset = readPresets().find((item) => item.id === presetId)
  if (!preset) throw new Error('预设不存在')
  return preset
}

/** Create one user preset. */
export async function createUserPreset(request: CreatePresetRequest): Promise<UserPreset> {
  const now = new Date().toISOString()
  const preset: UserPreset = {
    ...request,
    id: crypto.randomUUID(),
    description: request.description || '',
    created_at: now,
    updated_at: now,
  }
  writePresets([...readPresets(), preset])
  return preset
}

/** Update one user preset. */
export async function updateUserPreset(presetId: string, request: UpdatePresetRequest): Promise<UserPreset> {
  const presets = readPresets()
  const index = presets.findIndex((item) => item.id === presetId)
  if (index < 0) throw new Error('预设不存在')
  const preset = { ...presets[index], ...request, updated_at: new Date().toISOString() }
  presets[index] = preset
  writePresets(presets)
  return preset
}

/** Delete one user preset. */
export async function deleteUserPreset(presetId: string): Promise<void> {
  writePresets(readPresets().filter((item) => item.id !== presetId))
}

/** Return bundled presets; the Node sidecar no longer persists user presets. */
export async function getBuiltinPresets(): Promise<{ presets: BuiltinPreset[] }> {
  return { presets: [] }
}

/** Read capability parameter metadata from the Node runtime catalog. */
export async function getCapabilityParams(capabilityId: string, mode?: string): Promise<CapabilityParamsResponse> {
  const { data } = await client.get(`/api/capabilities/${capabilityId}/param-schema`, {
    params: mode ? { mode } : undefined,
  })
  return data?.data || data
}

/** Return the compatibility template collection. */
export async function getParamsTemplates(): Promise<ParamsTemplatesResponse> {
  return { templates: {} }
}
