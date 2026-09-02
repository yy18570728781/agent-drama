import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

export interface SubjectCanvasInput {
  id: string
  name: string
  thumb?: string | null
  media_type?: 'image' | 'video'
  source_url?: string | null
}

export interface PendingSubjectCanvasAsset {
  id: string
  url: string
  thumbnail_url: string
  thumb: string
  type: 'image' | 'video'
  model: string
  recordId: null
  subjectId: string
  subjectName: string
}

interface SubjectCanvasStoreReturn {
  pendingAsset: Ref<PendingSubjectCanvasAsset | null>
  queueSubject: (subject: SubjectCanvasInput) => boolean
  takePendingAsset: () => PendingSubjectCanvasAsset | null
}

/**
 * 保存从主体库跨路由投放到工作流画布的一次性封面资源。
 * @returns 待投放资源以及写入、消费方法
 */
export const useSubjectCanvasStore = defineStore('subjectCanvas', (): SubjectCanvasStoreReturn => {
  const pendingAsset = ref<PendingSubjectCanvasAsset | null>(null)

  function queueSubject(subject: SubjectCanvasInput): boolean {
    if (!subject.thumb) return false
    pendingAsset.value = {
      id: `subject-${subject.id}`,
      url: subject.source_url || subject.thumb,
      thumbnail_url: subject.thumb,
      thumb: subject.thumb,
      type: subject.media_type || 'image',
      model: '',
      recordId: null,
      subjectId: subject.id,
      subjectName: subject.name,
    }
    return true
  }

  function takePendingAsset(): PendingSubjectCanvasAsset | null {
    const asset = pendingAsset.value
    pendingAsset.value = null
    return asset
  }

  return { pendingAsset, queueSubject, takePendingAsset }
})
