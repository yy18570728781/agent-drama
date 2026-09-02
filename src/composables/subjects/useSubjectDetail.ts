import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteSubject, getSubjectDetail, type Subject, type SubjectMedia } from '@/api/subjects'
import { useSubjectCategories, type CategoryOption } from '@/composables/subjects/useSubjectCategories'
import { useSubjectMedia } from '@/composables/subjects/useSubjectMedia'

interface SubjectMediaController {
  uploading: Ref<boolean>
  uploadProgress: Ref<string>
  uploadFiles: (files: File[]) => Promise<void>
  setCover: (mediaId: string) => Promise<void>
  removeMedia: (mediaId: string) => Promise<void>
}
interface UseSubjectDetailReturn extends SubjectMediaController {
  subject: Ref<Subject | null>
  loading: Ref<boolean>
  coverThumb: ComputedRef<string | null>
  coverMedia: ComputedRef<SubjectMedia | null>
  categoryName: ComputedRef<string>
  loadDetail: () => Promise<void>
  removeSubject: () => Promise<boolean>
}

function createDetailLoader(subjectId: string, subject: Ref<Subject | null>, loading: Ref<boolean>): () => Promise<void> {
  return async (): Promise<void> => {
    loading.value = true
    try {
      subject.value = subjectId ? await getSubjectDetail(subjectId) : null
    } catch {
      subject.value = null
      ElMessage.error('主体详情加载失败')
    } finally {
      loading.value = false
    }
  }
}

function createMediaController(subject: Ref<Subject | null>, loadDetail: () => Promise<void>): SubjectMediaController {
  const media = useSubjectMedia()
  async function uploadFiles(files: File[]): Promise<void> {
    if (!subject.value || !files.length) return
    const hasCover = subject.value.media.some((item) => item.is_primary)
    try {
      await media.uploadMedia(subject.value.id, files, hasCover)
      await loadDetail()
      ElMessage.success('媒体上传成功')
    } catch {
      ElMessage.error('媒体上传失败')
    }
  }
  async function setCover(mediaId: string): Promise<void> {
    if (!subject.value) return
    try {
      await media.setCover(subject.value.id, mediaId)
      await loadDetail()
    } catch {
      ElMessage.error('设置封面失败')
    }
  }
  async function removeMedia(mediaId: string): Promise<void> {
    if (!subject.value) return
    const removedCover = subject.value.media.find((item) => item.id === mediaId)?.is_primary
    try {
      await ElMessageBox.confirm('确定移除这个媒体吗？', '移除媒体', { type: 'warning' })
      await media.removeMedia(subject.value.id, mediaId)
      await loadDetail()
      if (removedCover && subject.value?.media.length) await setCover(subject.value.media[0].id)
      ElMessage.success('媒体已移除')
    } catch (error) {
      if (error !== 'cancel') ElMessage.error('移除图片失败')
    }
  }
  return { uploading: media.uploading, uploadProgress: media.uploadProgress, uploadFiles, setCover, removeMedia }
}

function findCategoryName(categories: CategoryOption[], categoryId: string): string {
  for (const category of categories) {
    if (String(category.id) === categoryId) return category.name
    const childName = findCategoryName(category.children || [], categoryId)
    if (childName) return `${category.name} / ${childName}`
  }
  return ''
}

function createDeleteHandler(subject: Ref<Subject | null>): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    if (!subject.value) return false
    try {
      await ElMessageBox.confirm(`确定删除主体「${subject.value.name}」吗？`, '删除主体', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
      })
      await deleteSubject(subject.value.id)
      ElMessage.success('主体已删除')
      return true
    } catch (error) {
      if (error !== 'cancel') ElMessage.error('删除失败')
      return false
    }
  }
}

/**
 * 管理主体详情加载、删除与媒体操作流程。
 * @param subjectId 当前主体 ID。
 * @returns 详情状态和媒体操作。
 */
export function useSubjectDetail(subjectId: string): UseSubjectDetailReturn {
  const subject = ref<Subject | null>(null)
  const loading = ref(true)
  const categories = useSubjectCategories()
  const loadSubject = createDetailLoader(subjectId, subject, loading)
  const loadDetail = async (): Promise<void> => {
    await Promise.all([loadSubject(), categories.loadCategories()])
  }
  const media = createMediaController(subject, loadDetail)
  const coverMedia = computed(() => subject.value?.media[0] || null)
  const coverThumb = computed(() => coverMedia.value?.thumb || null)
  const categoryName = computed(() => {
    const categoryId = subject.value?.category_id || ''
    return findCategoryName(categories.firstLevelCategories.value, categoryId) || '未分类'
  })
  return {
    subject, loading, coverThumb, coverMedia, categoryName, loadDetail,
    removeSubject: createDeleteHandler(subject),
    ...media,
  }
}
