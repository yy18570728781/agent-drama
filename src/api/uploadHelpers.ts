import { uploadBlobDirect } from './cosDirect'

type UploadProgressHandler = (percent: number) => void

export interface UploadCosInfo {
  url?: string
  [key: string]: any
}

export interface UploadResult {
  url: string
  cos_info: UploadCosInfo | null
  [key: string]: any
}

function unwrapPayload(payload: any): any {
  return payload?.data?.data ?? payload?.data ?? payload
}

export function normalizeUploadResult(payload: any): UploadResult {
  const data = unwrapPayload(payload)
  const cosInfo = data?.cos_info && typeof data.cos_info === 'object' ? data.cos_info : null
  const url = [
    cosInfo?.url,
    data?.url,
    data?.cos_url,
    data?.file_url,
    data?.location,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0) || ''

  return {
    ...(data && typeof data === 'object' ? data : {}),
    url,
    cos_info: cosInfo ?? (url ? { url } : null),
  }
}

function ensureUploadedUrl(payload: any): string {
  const normalized = normalizeUploadResult(payload)
  if (normalized.url) return normalized.url
  throw new Error('上传成功但未返回 COS 地址')
}

export function getUploadErrorMessage(error: any): string {
  const status = error?.response?.status
  const data = error?.response?.data
  const detail = data?.detail || data?.message || data?.msg
  if (status && detail) return `上传接口返回 ${status}：${detail}`
  if (status) return `上传接口返回 ${status}`
  if (error?.message) return error.message
  return '上传失败'
}

export async function uploadFileToCos(
  file: Blob | File,
  filename?: string,
  onProgress?: UploadProgressHandler,
): Promise<UploadResult> {
  const resolvedName = filename || (file instanceof File ? file.name : `upload_${Date.now()}`)
  onProgress?.(5)
  const result = await uploadBlobDirect(file, resolvedName)
  onProgress?.(100)
  return normalizeUploadResult({ url: result.url, cos_info: {
    url: result.url,
    key: result.key,
    crc64: result.hash,
    file_type: result.fileType,
    extension: result.extension,
    size: result.size,
  } })
}

export async function uploadFileToCosUrl(
  file: Blob | File,
  filename?: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  return ensureUploadedUrl(await uploadFileToCos(file, filename, onProgress))
}

export async function uploadRemoteUrlToCos(url: string): Promise<UploadResult> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载远程文件失败：HTTP ${response.status}`)
  const blob = await response.blob()
  const filename = new URL(url).pathname.split('/').pop() || `remote_${Date.now()}`
  return uploadFileToCos(blob, filename)
}

export async function uploadRemoteUrlToCosUrl(url: string): Promise<string> {
  return ensureUploadedUrl(await uploadRemoteUrlToCos(url))
}
