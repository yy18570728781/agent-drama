
export type MediaMetrics = {
  width: number
  height: number
  aspectRatio: number
}

function buildMetrics(width: number, height: number): MediaMetrics | null {
  if (!(width > 0) || !(height > 0)) return null
  return {
    width: Math.round(width),
    height: Math.round(height),
    aspectRatio: width / height,
  }
}

function loadImageMetrics(src: string): Promise<MediaMetrics | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(buildMetrics(image.naturalWidth, image.naturalHeight))
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function loadVideoMetrics(src: string): Promise<MediaMetrics | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }
    video.onloadedmetadata = () => {
      const metrics = buildMetrics(video.videoWidth, video.videoHeight)
      cleanup()
      resolve(metrics)
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
    video.src = src
  })
}

/**
 * 为什么读取文件元数据：上传节点需要在落卡时就尽量接近真实比例，避免先生成一个固定框再二次跳动。
 */
export async function getMediaFileMetrics(file: File, mediaType: string): Promise<MediaMetrics | null> {
  const objectUrl = URL.createObjectURL(file)
  try {
    if (mediaType === 'video') return await loadVideoMetrics(objectUrl)
    if (mediaType === 'image') return await loadImageMetrics(objectUrl)
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 为什么同时尝试代理和原始地址：现网媒体既可能跨域，也可能已经是本地 blob/data URL，两条路径都试更稳妥。
 */
export async function getMediaUrlMetrics(url: string, mediaType: string): Promise<MediaMetrics | null> {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) return null
  const candidates = [rawUrl].filter(Boolean)
  for (const candidate of candidates) {
    const metrics = mediaType === 'video'
      ? await loadVideoMetrics(candidate)
      : await loadImageMetrics(candidate)
    if (metrics) return metrics
  }
  return null
}
