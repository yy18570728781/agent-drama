import { uploadFileToCosUrl } from '@/api/uploadHelpers'
import type { ReferenceImage } from './referenceMedia.types'

type ReferenceMediaKind = 'image' | 'video' | 'audio' | '3d_model' | ''

export function inferReferenceMediaKind(file: File): 'image' | 'video' | 'audio' | '3d_model' | '' {
  const mimeType = String(file?.type || '').toLowerCase()
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || ''
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (['glb', 'gltf', 'fbx', 'obj', 'usdz', 'blend', 'abc', 'dae', 'stl', 'ply'].includes(ext)) {
    return '3d_model'
  }
  return ''
}

/**
 * 根据引用地址兜底识别媒体类型，避免历史参数回显时把音频 URL 当图片渲染成坏图。
 * @param url 引用资源地址。
 * @returns 识别出的引用媒体类型。
 */
export function inferReferenceMediaKindFromUrl(url: string): ReferenceMediaKind {
  const cleanUrl = String(url || '').split(/[?#]/)[0].toLowerCase()
  const ext = cleanUrl.split('.').pop() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  if (['glb', 'gltf', 'fbx', 'obj', 'usdz', 'blend', 'abc', 'dae', 'stl', 'ply'].includes(ext)) return '3d_model'
  return ''
}

export function createEmptyReferenceImage(): ReferenceImage {
  return { url: '', file: new File([], 'empty'), isVideo: false }
}

export function createReferenceImageFromFile(file: File): ReferenceImage {
  const mediaType = inferReferenceMediaKind(file) || 'image'
  return {
    url: URL.createObjectURL(file),
    file,
    isVideo: mediaType === 'video',
    mediaType,
  }
}

export function compactReferenceImages(images: ReferenceImage[]): ReferenceImage[] {
  return images.map((item) => (item?.url ? item : createEmptyReferenceImage()))
}

export function ensureReferenceImageLength(images: ReferenceImage[], minLength: number): ReferenceImage[] {
  while (images.length < minLength) {
    images.push(createEmptyReferenceImage())
  }
  return images
}

export async function uploadReferenceImageAt(
  file: File,
  getCurrentImages: () => ReferenceImage[],
  targetIndex: number,
  blobUrl: string,
  onResolved: (nextImages: ReferenceImage[]) => void,
): Promise<void> {
  const uploadedUrl = await uploadFileToCosUrl(file, file.name)
  const nextImages = [...getCurrentImages()]
  if (!nextImages[targetIndex] || nextImages[targetIndex].url !== blobUrl) return
  if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
  nextImages[targetIndex] = {
    ...nextImages[targetIndex],
    url: uploadedUrl,
    sourceUrl: uploadedUrl,
    uploaded: true,
  }
  onResolved(nextImages)
}
