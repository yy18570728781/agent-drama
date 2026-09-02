import { uploadBlobDirect } from '@/api/cosDirect'

export type UploadedMediaItem = {
  type: string
  md5_name: string
  md5: string
  folder: string
  path: string
  size: string
  file_size: number
  width: number
  height: number
  duration: string
  rate: string
  name_prefix: string
  ext: string
  thumb: string
  is_cover: string
  upload_type: string
}

async function getImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 0, height: 0 })
    }
    img.src = url
  })
}

export function buildThumbUrl(thumb: string): string {
  if (!thumb) return ''
  return thumb + '?imageView2/3/w/256/h/256/q/85'
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)$/i.test((url || '').split('?')[0])
}

function splitObjectKey(key: string): { folder: string; namePrefix: string; ext: string } {
  const parts = key.split('/')
  const filename = parts[parts.length - 1] || ''
  const dotIndex = filename.lastIndexOf('.')
  const namePrefix = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex >= 0 ? filename.slice(dotIndex + 1).toLowerCase() : 'bin'
  return {
    folder: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
    namePrefix,
    ext,
  }
}

export async function uploadToCos(file: File): Promise<UploadedMediaItem> {
  const direct = await uploadBlobDirect(file, file.name)
  const key = direct.key
  const url = direct.url
  const crc64 = direct.hash
  const fileType = direct.fileType
  const { folder, namePrefix, ext } = splitObjectKey(key || file.name)
  const { width, height } = fileType === 'image' ? await getImageSize(file) : { width: 0, height: 0 }

  return {
    type: fileType,
    md5_name: crc64 || namePrefix,
    md5: crc64 || namePrefix,
    folder: crc64 || folder || namePrefix,
    path: folder ? `${folder}/` : '',
    size: 'origin',
    file_size: direct.size,
    width,
    height,
    duration: '',
    rate: '',
    name_prefix: namePrefix,
    ext,
    thumb: url,
    is_cover: '0',
    upload_type: 'server',
  }
}
