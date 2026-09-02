import {
  disableVendor as disableTeamonesVendor,
  enableVendor as enableTeamonesVendor,
  getVendorDetail as loadVendorDetail,
  getVendorModels as loadVendorModels,
  getVendors as loadVendors,
  saveVendorApiKey as saveTeamonesVendorApiKey,
} from './vendors'

export interface Vendor {
  name: string
  display_name: string
  has_api_key: boolean
  enabled: boolean
  api_key?: string
  base_url?: Record<string, string> | string
  icon?: string
  fields?: VendorField[]
  keys?: Record<string, string>
  models?: unknown[]
}

export interface VendorField {
  key: string
  name: string
  label: string
  required: boolean
  field_type: string
  placeholder?: string
  help_text?: string
}

function normalizeVendor(value: Awaited<ReturnType<typeof loadVendors>>[number]): Vendor {
  return {
    name: value.vendor,
    display_name: value.name,
    has_api_key: Boolean(value.api_key),
    enabled: value.status === 1,
    api_key: value.api_key,
    base_url: value.base_url,
    icon: value.icon,
  }
}

export async function getVendors(): Promise<Vendor[]> {
  return (await loadVendors({ page: 1, per_page: 1000 })).map(normalizeVendor)
}

export async function getVendorDetail(name: string): Promise<Vendor> {
  return normalizeVendor(await loadVendorDetail(name))
}

export function saveVendorApiKey(name: string, apiKey: string): Promise<void> {
  return saveTeamonesVendorApiKey(name, apiKey)
}

export async function enableVendor(name: string): Promise<void> {
  const vendor = await loadVendorDetail(name)
  await enableTeamonesVendor(vendor.id)
}

export async function disableVendor(name: string): Promise<void> {
  const vendor = await loadVendorDetail(name)
  await disableTeamonesVendor(vendor.id)
}

export function getVendorModels(name: string) {
  return loadVendorModels(name)
}
