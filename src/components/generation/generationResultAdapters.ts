import type { AssetItem } from '@/api/assets'
import type { PendingEdit } from '@/stores/generation.store'

export type GenerationHistoryRecord = {
  capability?: string
  id: string
  layout: 'single'
  type: string
  prompt: string
  modelInfo: string
  model_info: AssetItem['model_info'] | null
  modelDisplayName: string
  modelVendor: string
  vendor: string
  queryId: string
  date: string
  genType: string
  opType: 'favorite' | 'normal'
  thumbnail_url: AssetItem['thumbnail_url'] | null
  images: string[]
  media: string[]
  mode?: string
  param: Record<string, any> | null
  reference_urls: string[]
  params_display: { label: string; key: string; value: any }[]
  isGenerating: false
  _asset: AssetItem
}

const MAX_VISIBLE_META_PARAMS = 2
const PARAM_EXCLUDE_KEYS = new Set([
  'prompt',
  'model',
  'model_id',
  'model_display_name',
  'vendor',
  'platform',
  'query_id',
  'queryId',
  'platform_task_id',
  'capability',
  'mode',
  'params',
  'file_urls',
  'reference_urls',
  'reference_files',
  'files',
  'file_url',
  'file',
  'image_urls',
  'image_first_frame',
  'image_last_frame',
  'task_id',
])

function appendReferenceValue(out: string[], value: any) {
  if (!value) return
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) out.push(trimmed)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) appendReferenceValue(out, item)
    return
  }
  if (typeof value === 'object') {
    if (typeof value.origin_url === 'string' && value.origin_url.trim()) {
      out.push(value.origin_url.trim())
      return
    }
    for (const key of ['url', 'file_url', 'file', 'src', 'path']) {
      const candidate = value[key]
      if (typeof candidate === 'string' && candidate.trim()) {
        out.push(candidate.trim())
        return
      }
    }
  }
}

export function getReferenceUrls(record: any): string[] {
  const sources = [record, record?._asset].filter(Boolean)
  const out: string[] = []

  for (const source of sources) {
    appendReferenceValue(out, source.reference_urls)
    appendReferenceValue(out, source.referenceUrls)
    appendReferenceValue(out, source.param?.file_urls)
    appendReferenceValue(out, source.param?.reference_files)
    appendReferenceValue(out, source.param?.reference_urls)
    appendReferenceValue(out, source.param?.files)
    appendReferenceValue(out, source.param?.file_url)
    appendReferenceValue(out, source.param?.file)
    appendReferenceValue(out, source.param?.params?.file_urls)
    appendReferenceValue(out, source.param?.params?.reference_files)
    appendReferenceValue(out, source.param?.params?.reference_urls)
    appendReferenceValue(out, source.param?.params?.files)
    appendReferenceValue(out, source.param?.params?.file_url)
    appendReferenceValue(out, source.param?.image_first_frame)
    appendReferenceValue(out, source.param?.image_last_frame)
    appendReferenceValue(out, source.param?.params?.image_first_frame)
    appendReferenceValue(out, source.param?.params?.image_last_frame)
  }

  return Array.from(new Set(out))
}

export function getAssetVendor(asset: any): string {
  return String(asset?.vendor ?? asset?.platform ?? asset?.param?.vendor ?? asset?.param?.params?.vendor ?? '').trim()
}

export function getAssetQueryId(asset: any): string {
  return String(asset?.platform_task_id ?? asset?.query_id ?? asset?.queryId
    ?? asset?.param?.platform_task_id ?? asset?.param?.params?.platform_task_id
    ?? asset?.param?.query_id ?? asset?.param?.params?.query_id ?? '').trim()
}

export function getAssetVendorLabel(asset: any, vendorDisplayNameMap: Record<string, string> = {}): string {
  const vendor = getAssetVendor(asset)
  return vendor ? (vendorDisplayNameMap[vendor] || vendorDisplayNameMap[vendor.toLowerCase()] || vendor) : ''
}

function getModelVendor(asset: any): string {
  const publisher = asset?.model_info?.publisher || asset?.model_info?.publisher_info
  if (typeof publisher === 'string') return publisher
  if (publisher && typeof publisher === 'object') return publisher.id || publisher.name || ''
  return asset?.modelVendor || asset?.model_vendor || ''
}

function getRecordParamValues(asset: any): Record<string, any> {
  const generateParams = asset?.param || asset?.generateParams
  if (!generateParams || typeof generateParams !== 'object' || Array.isArray(generateParams)) return {}
  const nested = generateParams.params
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...generateParams, ...nested }
  }
  return generateParams
}

function getGenerateParamObject(asset: any): Record<string, any> {
  const generateParams = asset?.param || asset?.generateParams || asset?.data?.param
  if (generateParams && typeof generateParams === 'object' && !Array.isArray(generateParams)) return generateParams
  return {}
}

function getNestedGenerateParams(asset: any): Record<string, any> {
  const generateParams = getGenerateParamObject(asset)
  const nested = generateParams.params
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested
  return {}
}

function getEditParamValues(asset: any): Record<string, any> {
  const generateParams = getGenerateParamObject(asset)
  const nested = getNestedGenerateParams(asset)
  const { params: _params, capability: _capability, mode: _mode, ...outerParams } = generateParams
  return {
    ...outerParams,
    ...nested,
  }
}

export function getAssetDisplayParams(asset: any) {
  const paramsDisplay = (asset?.params_display || []).filter((param: any) => param?.key && param.key !== 'prompt')
  if (paramsDisplay.length) return paramsDisplay

  return Object.entries(getRecordParamValues(asset))
    .filter(([key, value]) => !PARAM_EXCLUDE_KEYS.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      key,
      label: key,
      value,
    }))
}

export function assetToHistoryRecord(asset: AssetItem, fullUrl?: string): GenerationHistoryRecord {
  const isVideo = asset.type === 'video'
  const rawUrl = asset.url
  const displayUrl = fullUrl
    || (typeof rawUrl === 'object' ? (rawUrl.proxy_url || rawUrl.origin_url || '') : (rawUrl || ''))

  return {
    id: asset.id,
    layout: 'single',
    type: asset.type,
    prompt: asset.prompt || '',
    modelInfo: asset.model || (asset.param as any)?.params?.model || '',
    model_info: asset.model_info || null,
    modelDisplayName: (asset as any).model_display_name || (asset as any).model_info?.display_name || asset.model_info?.name || asset.model || (asset.param as any)?.params?.model || '',
    modelVendor: getModelVendor(asset),
    vendor: getAssetVendor(asset),
    queryId: getAssetQueryId(asset),
    date: asset.created_at,
    genType: asset.type,
    opType: asset.is_favorites ? 'favorite' : 'normal',
    thumbnail_url: asset.thumbnail_url || null,
    images: isVideo ? [] : [displayUrl],
    media: isVideo ? [displayUrl] : [],
    param: asset.param || null,
    reference_urls: getReferenceUrls(asset),
    params_display: ((asset as any).params_display || []).filter((param: any) => param.key !== 'prompt'),
    isGenerating: false,
    _asset: asset,
  }
}

export function buildPendingEditFromAsset(asset: AssetItem | null | undefined, autoSend: boolean): PendingEdit {
  const generateParams = getGenerateParamObject(asset)
  const nestedParams = getNestedGenerateParams(asset)
  const editParams = getEditParamValues(asset)
  const modelId = nestedParams.model
    || generateParams.model
    || asset?.model
    || asset?.model_info?.id
    || ''
  const capability = generateParams.capability
    || nestedParams.capability
    || asset?.capability
    || ''
  const prompt = asset?.prompt
    || nestedParams.prompt
    || generateParams.prompt
    || ''
  return {
    prompt,
    modelId,
    capability,
    mode: generateParams.mode || nestedParams.mode || (asset as any)?.mode || undefined,
    generateParams: Object.keys(editParams).length ? editParams : undefined,
    referenceUrls: getReferenceUrls(asset),
    autoSend,
  }
}

export function getAssetModelLabel(asset: any): string {
  return asset?.modelDisplayName || asset?.model_display_name || asset?.model_info?.display_name || asset?.model_info?.name || asset?.model || asset?.param?.params?.model || ''
}

export function getVisibleAssetParams(asset: any) {
  return getAssetDisplayParams(asset).slice(0, MAX_VISIBLE_META_PARAMS)
}

export function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${String(d.getDate()).padStart(2, '0')}日`
}

export function isFirstGroupOfDay(groups: Array<Array<{ created_at: string }>>, index: number): boolean {
  if (index === 0) return true
  const prevDate = getDateLabel(groups[index - 1][0].created_at)
  const currDate = getDateLabel(groups[index][0].created_at)
  return currDate !== prevDate
}
