import type { Ref } from 'vue'
import { getSubjectDetail } from '@/api/subjects'
import type { ReferenceImage } from '@/components/generation/referenceMedia.types'
import type { ReferenceMediaType } from '@/composables/useFileDrop'
import type { SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'

interface SubjectReferenceDeps {
  refImages: Ref<ReferenceImage[]>
  addReferenceMedia: (items: Array<{ url: string; referenceName?: string; isVideo?: boolean; mediaType?: ReferenceMediaType; nodeId?: string; uploaded?: boolean }>) => Promise<boolean>
  insertRefAtIndex: (index: number) => void
  saveSelection: () => void
  restoreSelection: () => void
  onMediaResolved?: (url: string, referenceName: string) => void
}

interface UseSubjectReferenceReturn {
  onSelectSubject: (payload: SubjectSelectPayload) => Promise<void>
}

function inferMediaTypeFromExt(url: string): ReferenceMediaType {
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase()
  if (/\.(mp4|webm|ogg|mov)$/.test(cleanUrl)) return 'video'
  if (/\.(mp3|wav|flac|aac|ogg)$/.test(cleanUrl)) return 'audio'
  if (/\.(glb|gltf|fbx|obj|usdz|blend)$/.test(cleanUrl)) return '3d_model'
  return 'image'
}

/**
 * 主体引用：从 @ 菜单选择主体后，添加指定媒体为参考图并插入 ref-tag。
 * mediaUrl 为空时引用主体第一张媒体（主图）。
 * addReferenceMedia 为异步操作，执行前后保存/恢复编辑器光标位置，
 * 确保 insertRef 能在正确的光标处插入 ref-tag。
 */
export function useSubjectReference(deps: SubjectReferenceDeps): UseSubjectReferenceReturn {
  async function onSelectSubject(payload: SubjectSelectPayload): Promise<void> {
    const { subjectId, mediaUrl, mediaType, multiSelect } = payload
    const skipRefTag = multiSelect === true
    const subject = await getSubjectDetail(subjectId)
    if (!subject || !subject.media.length) return
    const cover = subject.media.find(item => item.is_primary && item.thumb)
      ?? subject.media.find(item => item.thumb)
    const resolvedUrl = mediaUrl || cover?.thumb
    if (resolvedUrl) await addSingleReference(resolvedUrl, subject.name, skipRefTag, mediaType)
  }

  async function addSingleReference(
    url: string,
    referenceName: string,
    skipRefTag: boolean,
    overrideType?: 'image' | 'video',
  ): Promise<void> {
    if (!skipRefTag) deps.saveSelection()
    const beforeCount = deps.refImages.value.length
    const mediaType = overrideType ?? inferMediaTypeFromExt(url)
    const success = await deps.addReferenceMedia([{ url, referenceName, mediaType, uploaded: true }])
    if (!success) return
    renameAddedReferences(beforeCount, referenceName)
    if (!skipRefTag) {
      deps.restoreSelection()
      for (let i = beforeCount; i < deps.refImages.value.length; i += 1) {
        deps.insertRefAtIndex(i)
      }
    }
    deps.onMediaResolved?.(url, referenceName)
  }

  function renameAddedReferences(fromIndex: number, referenceName: string): void {
    const normalizedName = referenceName.trim()
    if (!normalizedName) return
    for (let index = fromIndex; index < deps.refImages.value.length; index += 1) {
      const item = deps.refImages.value[index]
      item.referenceName = normalizedName
      item.file = new File([item.file], normalizedName, {
        type: item.file.type,
        lastModified: item.file.lastModified,
      })
    }
  }

  return { onSelectSubject }
}
