export const IMAGE_THUMBNAIL_FILE_SIZE_THRESHOLD = 2 * 1024 * 1024
export const IMAGE_THUMBNAIL_MAX_EDGE_THRESHOLD = 2048
export const IMAGE_THUMBNAIL_PIXEL_COUNT_THRESHOLD = 6_000_000
export const IMAGE_THUMBNAIL_TARGET_MAX_EDGE = 768
export const IMAGE_THUMBNAIL_QUALITY = 0.78
export const VIDEO_THUMBNAIL_TARGET_MAX_EDGE = 768
export const VIDEO_THUMBNAIL_QUALITY = 0.78

function getImageNameParts(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) return { baseName: fileName || `image_${Date.now()}` }
  return { baseName: fileName.slice(0, dotIndex) }
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('无法读取图片尺寸'))
      img.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return dimensions
    } catch {
      // fall back to Image element below
    }
  }

  const img = await loadImageElement(file)
  return {
    width: img.naturalWidth || img.width || 0,
    height: img.naturalHeight || img.height || 0,
  }
}

function shouldGenerateThumbnail(file: File, width: number, height: number) {
  const maxEdge = Math.max(width, height)
  const pixelCount = width * height
  return (
    file.size > IMAGE_THUMBNAIL_FILE_SIZE_THRESHOLD
    || maxEdge > IMAGE_THUMBNAIL_MAX_EDGE_THRESHOLD
    || pixelCount > IMAGE_THUMBNAIL_PIXEL_COUNT_THRESHOLD
  )
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

export async function createThumbnailFileIfNeeded(
  file: File,
  options: {
    maxEdge?: number
    quality?: number
  } = {}
): Promise<File | null> {
  if (!(file instanceof File) || !file.type.startsWith('image/')) return null

  const { width, height } = await getImageDimensions(file)
  if (!width || !height || !shouldGenerateThumbnail(file, width, height)) return null

  const targetMaxEdge = Math.max(64, Number(options.maxEdge || IMAGE_THUMBNAIL_TARGET_MAX_EDGE))
  const quality = Math.min(0.95, Math.max(0.4, Number(options.quality || IMAGE_THUMBNAIL_QUALITY)))
  const scale = Math.min(1, targetMaxEdge / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  let blob = await canvasToBlob(canvas, 'image/webp', quality)
  let extension = 'webp'
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    extension = 'jpg'
  }
  if (!blob) return null

  const { baseName } = getImageNameParts(file.name)
  return new File([blob], `${baseName}_thumb.${extension}`, { type: blob.type })
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onReady)
      video.removeEventListener('error', onError)
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('无法读取视频缩略图'))
    }
    video.addEventListener(eventName, onReady, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

function getVideoThumbnailSize(width: number, height: number, maxEdge: number) {
  if (!width || !height) return { width: 320, height: 180 }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function seekVideoFrame(video: HTMLVideoElement): Promise<void> {
  const duration = Number(video.duration || 0)
  const seekTime = duration > 0 ? Math.min(0.2, Math.max(duration - 0.05, 0)) : 0
  if (seekTime <= 0) {
    await waitForVideoEvent(video, 'loadeddata').catch(() => {})
    return
  }
  video.currentTime = seekTime
  await waitForVideoEvent(video, 'seeked')
}

export async function createVideoThumbnailFile(
  file: File,
  options: {
    maxEdge?: number
    quality?: number
  } = {}
): Promise<File | null> {
  if (!(file instanceof File) || !file.type.startsWith('video/')) return null

  const objectUrl = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = objectUrl
    await waitForVideoEvent(video, 'loadedmetadata')
    await seekVideoFrame(video)

    const targetMaxEdge = Math.max(64, Number(options.maxEdge || VIDEO_THUMBNAIL_TARGET_MAX_EDGE))
    const quality = Math.min(0.95, Math.max(0.4, Number(options.quality || VIDEO_THUMBNAIL_QUALITY)))
    const size = getVideoThumbnailSize(video.videoWidth, video.videoHeight, targetMaxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, size.width, size.height)

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!blob) return null
    const { baseName } = getImageNameParts(file.name)
    return new File([blob], `${baseName}_video_thumb.jpg`, { type: blob.type })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
