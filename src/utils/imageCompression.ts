export const IMAGE_UPLOAD_SIZE_LIMIT = 10 * 1024 * 1024
export const IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH = 1920
export const IMAGE_UPLOAD_COMPRESS_DEFAULT_QUALITY = 92

export interface ImageFileMeta {
  width: number
  height: number
}

interface ImageFileWithOriginalName extends File {
  __originalImageFileName?: string
}

function preserveOriginalImageFileName(source: File, compressed: File): File {
  Object.defineProperty(compressed, '__originalImageFileName', {
    value: getOriginalImageFileName(source),
    configurable: true,
  })
  return compressed
}

/** Returns the pre-compression filename when the file was re-encoded for upload. */
export function getOriginalImageFileName(file: File): string {
  return (file as ImageFileWithOriginalName).__originalImageFileName || file.name
}

function getImageNameParts(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) return { baseName: fileName || `image_${Date.now()}` }
  return {
    baseName: fileName.slice(0, dotIndex),
  }
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('无法读取图片'))
      img.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function getImageFileMeta(file: File): Promise<ImageFileMeta> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const meta = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return meta
    } catch {
      // fall through
    }
  }

  const img = await loadImageElement(file)
  return {
    width: img.naturalWidth || img.width || 0,
    height: img.naturalHeight || img.height || 0,
  }
}

export function isOversizeImageFile(file: File, maxBytes = IMAGE_UPLOAD_SIZE_LIMIT) {
  return file instanceof File && file.type.startsWith('image/') && file.size > maxBytes
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

export async function compressImageFileToLimit(
  file: File,
  options: {
    maxBytes?: number
    targetWidth?: number
    targetHeight?: number
    lockRatio?: boolean
    fixedRatio?: number
    quality?: number
    minQuality?: number
    minWidth?: number
    /** 强制按设置的尺寸/质量重新编码，即使原文件已低于阈值（手动弹窗用） */
    force?: boolean
  } = {},
): Promise<File> {
  if (!(file instanceof File) || !file.type.startsWith('image/')) return file

  const maxBytes = Math.max(256 * 1024, Number(options.maxBytes || IMAGE_UPLOAD_SIZE_LIMIT))
  if (!options.force && file.size <= maxBytes) return file

  const meta = await getImageFileMeta(file)
  const originalWidth = Math.max(1, meta.width || 1)
  const originalHeight = Math.max(1, meta.height || 1)
  const originalRatio = originalWidth / originalHeight
  const requestedTargetWidth = Math.max(320, Number(options.targetWidth || IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH))
  const requestedTargetHeight = Math.max(0, Number(options.targetHeight || 0))
  const lockRatio = options.lockRatio !== false
  const fixedRatio = Number(options.fixedRatio || 0)
  const minWidth = Math.max(320, Number(options.minWidth || 640))
  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  let targetWidth = Math.min(originalWidth, requestedTargetWidth)
  let targetHeight = Math.max(1, Math.round((targetWidth / originalWidth) * originalHeight))

  if (fixedRatio > 0) {
    targetWidth = Math.min(originalWidth, requestedTargetWidth)
    targetHeight = Math.max(1, Math.round(targetWidth / fixedRatio))
  } else if (!lockRatio && requestedTargetHeight > 0) {
    targetWidth = Math.min(originalWidth, requestedTargetWidth)
    targetHeight = Math.min(originalHeight, requestedTargetHeight)
  } else if (lockRatio) {
    targetWidth = Math.min(originalWidth, requestedTargetWidth)
    targetHeight = Math.max(1, Math.round(targetWidth / originalRatio))
  }

  let bestBlob: Blob | null = null

  while (targetWidth >= minWidth) {
    canvas.width = targetWidth
    canvas.height = targetHeight
    ctx.clearRect(0, 0, targetWidth, targetHeight)
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    const blob = await canvasToBlob(canvas, 'image/png')
    if (blob) {
      bestBlob = blob
      if (blob.size <= maxBytes) {
        const { baseName } = getImageNameParts(file.name)
        return preserveOriginalImageFileName(file, new File([blob], `${baseName}_compressed.png`, {
          type: 'image/png',
          lastModified: Date.now(),
        }))
      }
    }

    const nextWidth = Math.max(minWidth, Math.floor(targetWidth * 0.85))
    if (nextWidth === targetWidth) break
    targetWidth = nextWidth
    if (fixedRatio > 0) {
      targetHeight = Math.max(1, Math.round(targetWidth / fixedRatio))
    } else if (!lockRatio && requestedTargetHeight > 0) {
      const scale = targetWidth / Math.max(1, requestedTargetWidth)
      targetHeight = Math.max(1, Math.round(Math.max(1, requestedTargetHeight) * scale))
    } else {
      targetHeight = Math.max(1, Math.round(targetWidth / originalRatio))
    }
  }

  if (!bestBlob) return file
  const { baseName } = getImageNameParts(file.name)
  return preserveOriginalImageFileName(file, new File([bestBlob], `${baseName}_compressed.png`, {
    type: 'image/png',
    lastModified: Date.now(),
  }))
}
