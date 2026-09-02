const H3_MODEL_NAME = 'minimax-h3'
const SOURCE_MEDIA_HOST = 'aigc-cos.teamones.cn'
const TARGET_MEDIA_HOST = 'aigc-1302667593.cos.ap-shanghai.myqcloud.com'
const MEDIA_PARAM_KEYS = [
  'file_urls',
  'reference_files',
  'image_first_frame',
  'first_frame_image',
  'image_last_frame',
  'last_frame_image',
  'last_frame_url',
  'video_url',
  'audio_url',
] as const
const MEDIA_BLOCK_TYPES = ['image_url', 'video_url', 'audio_url'] as const
const URL_VALUE_KEYS = ['url', 'origin_url', 'proxy_url', 'file_url', 'file', 'src', 'path'] as const

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function collectMediaUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectMediaUrls)
  const record = asRecord(value)
  if (!record) return []
  for (const key of URL_VALUE_KEYS) {
    if (typeof record[key] === 'string') return [record[key]]
  }
  return []
}

function collectContentUrls(content: unknown): string[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((item) => {
    const block = asRecord(item)
    const blockType = typeof block?.type === 'string' ? block.type : ''
    if (!block || !MEDIA_BLOCK_TYPES.includes(blockType as typeof MEDIA_BLOCK_TYPES[number])) return []
    return collectMediaUrls(block[blockType])
  })
}

function collectRequestMediaUrls(params: UnknownRecord): string[] {
  const urls = MEDIA_PARAM_KEYS.flatMap((key) => collectMediaUrls(params[key]))
  urls.push(...collectContentUrls(params.content))
  return Array.from(new Set(urls))
}

function rewriteH3MediaUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== SOURCE_MEDIA_HOST) return null
    parsed.host = TARGET_MEDIA_HOST
    return parsed.toString()
  } catch {
    return null
  }
}

function logRequestMediaRewrites(request: unknown): void {
  const payload = asRecord(request)
  const params = asRecord(payload?.params)
  const model = String(params?.model || params?.model_id || '').trim().toLowerCase()
  if (!params || model !== H3_MODEL_NAME) return

  const rewritten = collectRequestMediaUrls(params).some(
    (sourceUrl) => rewriteH3MediaUrl(sourceUrl) !== null,
  )
  console.info(`[MiniMax-H3] media URL converted: ${rewritten}`)
}

/**
 * Logs the MiniMax-H3 media URL rewrite that the backend will apply.
 * @param request A single generation request or a batch of generation requests.
 * @returns Nothing; logs only matching H3 media URLs.
 */
export function logMinimaxH3MediaUrlRewrites(request: unknown): void {
  if (Array.isArray(request)) {
    request.forEach(logRequestMediaRewrites)
    return
  }
  logRequestMediaRewrites(request)
}
