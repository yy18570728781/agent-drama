import { changeSubjectCover } from '@/api/subjects'
import { subjectAssetApi, type RawMedia } from '@/api/subjectAsset'
import { uploadToCos, type UploadedMediaItem } from '@/utils/cosUpload'

export interface UploadSubjectMediaOptions {
  subjectId: string
  files: File[]
  hasCover: boolean
  onProgress?: (message: string) => void
}

function matchesUploadedMedia(media: RawMedia, uploaded: UploadedMediaItem): boolean {
  const md5Name = uploaded.md5_name.trim()
  const md5 = uploaded.md5.trim()
  return Boolean(
    (md5Name && media.md5_name === md5Name)
    || (md5 && media.md5 === md5),
  )
}

async function setUploadedMediaAsCover(
  subjectId: string,
  uploaded: UploadedMediaItem,
): Promise<void> {
  const mediaList = await subjectAssetApi.getMedia(subjectId)
  const coverMedia = mediaList.find(item => matchesUploadedMedia(item, uploaded))
  const mediaId = String(coverMedia?.id ?? '').trim()
  if (!mediaId) throw new Error('主体媒体上传成功，但未找到可设置的封面媒体')
  await changeSubjectCover(subjectId, mediaId)
}

/**
 * 上传并关联主体媒体，在主体没有封面时将首个上传媒体设为封面。
 * @param options 主体、文件、封面状态和进度回调。
 * @returns 全部媒体关联和封面设置完成后的 Promise。
 * @throws 上传、媒体关联、媒体查询或封面设置失败时抛出异常。
 */
export async function uploadSubjectMedia(options: UploadSubjectMediaOptions): Promise<void> {
  let firstUploaded: UploadedMediaItem | null = null
  for (let index = 0; index < options.files.length; index += 1) {
    options.onProgress?.(`上传 ${index + 1}/${options.files.length}...`)
    const mediaItem = await uploadToCos(options.files[index])
    if (!options.hasCover && index === 0) firstUploaded = mediaItem
    await subjectAssetApi.attachMedia(options.subjectId, mediaItem)
  }
  if (!firstUploaded) return
  options.onProgress?.('正在设置封面...')
  await setUploadedMediaAsCover(options.subjectId, firstUploaded)
}
