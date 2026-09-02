import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import teamonesClient from './teamonesClient'

type UnknownRecord = Record<string, unknown>

export interface DirectCosUploadResult {
  url: string
  key: string
  hash: string
  fileType: string
  extension: string
  size: number
}

let cachedCredentials: { value: UnknownRecord; expiresAt: number } | null = null

function isProduction(): boolean {
  try {
    return /(^|\.)api\.teamones\.cn$/i.test(new URL(String(import.meta.env.VITE_TEAMONES_BASE_URL)).hostname)
  } catch {
    return false
  }
}

function cosConfig(): { bucketName: string; bucket: string; region: string; domain: string } {
  return isProduction()
    ? { bucketName: 'aigcCos', bucket: 'aigc-1302667593', region: 'ap-shanghai', domain: 'https://aigc-cos.teamones.cn' }
    : { bucketName: 'cos', bucket: 'test-1302852381', region: 'ap-shanghai', domain: 'https://test-1302852381.cos.ap-shanghai.myqcloud.com' }
}

/**
 * 根据当前环境 COS 域名和对象键构造公开访问地址。
 * @param objectKey COS 桶内对象键。
 * @returns 当前环境对应的完整 COS URL。
 */
export function buildCosObjectUrl(objectKey: string): string {
  return `${cosConfig().domain}/${String(objectKey || '').replace(/^\/+/, '')}`
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {}
  const root = isRecord(value.data) ? value.data : value
  return isRecord(root.data) ? root.data : root
}

async function credentials(): Promise<UnknownRecord> {
  if (cachedCredentials && cachedCredentials.expiresAt > Date.now() + 300_000) return cachedCredentials.value
  const config = cosConfig()
  const response = await teamonesClient.post('/api_media/cos/generate_temp_secret_key', { buck_name: config.bucketName })
  const value = unwrap(response)
  const cr = isRecord(value.cr) ? value.cr : {}
  const expiresAt = Date.parse(String(cr.Expiration || ''))
  cachedCredentials = { value, expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 1_800_000 }
  return value
}

function crc64(bytes: ArrayBuffer): string {
  const polynomial = 0xc96c5795d7870f42n
  const mask = 0xffffffffffffffffn
  let crc = 0n
  for (const byte of new Uint8Array(bytes)) {
    crc ^= BigInt(byte)
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >> 1n) ^ (crc & 1n ? polynomial : 0n)
  }
  return ((crc ^ mask) & mask).toString(16).padStart(16, '0')
}

function extension(filename: string, mimeType: string): string {
  const fromName = filename.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 8 && fromName !== filename.toLowerCase()) return fromName
  const subtype = mimeType.split('/')[1]?.split(';')[0]
  return subtype === 'jpeg' ? 'jpg' : subtype || 'bin'
}

function fileType(mimeType: string, ext: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return ['glb', 'gltf', 'obj', 'fbx', 'stl', 'usdz'].includes(ext) ? 'model' : 'file'
}

async function uploadBlob(
  blob: Blob,
  filename: string,
  objectKey?: string,
  cacheControl?: string,
): Promise<DirectCosUploadResult> {
  const config = cosConfig()
  const bytes = await blob.arrayBuffer()
  const hash = crc64(bytes)
  const ext = extension(filename, blob.type)
  const type = fileType(blob.type, ext)
  const key = objectKey || `sm_ai_server/${type}/${ext}/${hash}.${ext}`
  const temporary = await credentials()
  const cr = isRecord(temporary.cr) ? temporary.cr : {}
  const values = isRecord(cr.Credentials) ? cr.Credentials : {}
  const client = new S3Client({
    region: config.region,
    endpoint: `https://cos.${config.region}.myqcloud.com`,
    credentials: {
      accessKeyId: String(values.TmpSecretId || ''),
      secretAccessKey: String(values.TmpSecretKey || ''),
      sessionToken: String(values.Token || ''),
    },
  })
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: new Uint8Array(bytes),
    ContentType: blob.type || 'application/octet-stream',
    ContentLength: blob.size,
    ...(cacheControl ? { CacheControl: cacheControl } : {}),
  }))
  return { url: buildCosObjectUrl(key), key, hash, fileType: type, extension: ext, size: blob.size }
}

/**
 * 按媒体内容哈希生成对象键并上传到当前环境的 COS 桶。
 * @param blob 待上传的二进制内容。
 * @param filename 用于推断扩展名和媒体类型的文件名。
 * @returns COS 地址、对象键和文件元数据。
 * @throws 临时凭证获取或 COS 上传失败时抛出异常。
 */
export async function uploadBlobDirect(blob: Blob, filename: string): Promise<DirectCosUploadResult> {
  return uploadBlob(blob, filename)
}

/**
 * 将内容上传到指定的 COS 对象键。
 * @param blob 待上传的二进制内容。
 * @param filename 用于推断扩展名和媒体类型的文件名。
 * @param objectKey COS 桶内的稳定对象键。
 * @param cacheControl 可选的 Cache-Control 元数据。
 * @returns COS 地址、对象键和文件元数据。
 * @throws 临时凭证获取或 COS 上传失败时抛出异常。
 */
export async function uploadBlobToCosKey(
  blob: Blob,
  filename: string,
  objectKey: string,
  cacheControl?: string,
): Promise<DirectCosUploadResult> {
  return uploadBlob(blob, filename, objectKey.replace(/^\/+/, ''), cacheControl)
}
