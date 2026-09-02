import { computed, onUnmounted, reactive, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createSubject } from '@/api/subjects'
import { useSubjectCategories, type CategoryOption } from '@/composables/subjects/useSubjectCategories'
import { useSubjectMedia } from '@/composables/subjects/useSubjectMedia'

const MAX_MEDIA_COUNT = 12
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 200 * 1024 * 1024

interface SubjectCreateForm { name: string; categoryId: string; description: string }
interface CategorySelectOption { id: number; name: string }
interface FileSelection {
  selectedFiles: Ref<File[]>
  clearFiles: () => void
  addFiles: (files: File[]) => void
  removeFile: (index: number) => void
  getFileUrl: (file: File) => string
}
interface SaveHandlerDeps {
  form: SubjectCreateForm
  files: Ref<File[]>
  saving: Ref<boolean>
  canSubmit: ComputedRef<boolean>
  uploadMedia: (subjectId: string, files: File[], hasCover: boolean) => Promise<void>
}
interface UseSubjectCreateReturn {
  form: SubjectCreateForm
  categoryOptions: ComputedRef<CategorySelectOption[]>
  selectedFiles: Ref<File[]>
  saving: Ref<boolean>
  uploading: Ref<boolean>
  uploadProgress: Ref<string>
  canSubmit: ComputedRef<boolean>
  reset: (categoryId?: number | null) => void
  addFiles: FileSelection['addFiles']
  removeFile: FileSelection['removeFile']
  getFileUrl: FileSelection['getFileUrl']
  save: () => Promise<boolean>
}

function isSameFile(left: File, right: File): boolean {
  return left.name === right.name && left.size === right.size && left.lastModified === right.lastModified
}

function flattenCategoryOptions(
  categories: CategoryOption[],
  parents: string[] = [],
): CategorySelectOption[] {
  return categories.flatMap((category) => {
    const path = [...parents, category.name]
    return [
      { id: category.id, name: path.join(' / ') },
      ...flattenCategoryOptions(category.children || [], path),
    ]
  })
}

function createFileSelection(): FileSelection {
  const selectedFiles = ref<File[]>([])
  const urlCache = new Map<File, string>()
  function revokeUrl(file: File): void {
    const url = urlCache.get(file)
    if (!url) return
    URL.revokeObjectURL(url)
    urlCache.delete(file)
  }
  function clearFiles(): void {
    selectedFiles.value.forEach(revokeUrl)
    selectedFiles.value = []
  }
  function addFiles(files: File[]): void {
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
    const valid = mediaFiles.filter((file) => file.size <= (file.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE))
    const unique = valid.filter((file) => !selectedFiles.value.some((item) => isSameFile(item, file)))
    const slots = MAX_MEDIA_COUNT - selectedFiles.value.length
    selectedFiles.value.push(...unique.slice(0, slots))
    if (valid.length !== mediaFiles.length) ElMessage.warning('图片不能超过 10MB，视频不能超过 200MB')
    if (unique.length > slots) ElMessage.warning(`最多添加 ${MAX_MEDIA_COUNT} 个媒体文件`)
  }
  function removeFile(index: number): void {
    const removed = selectedFiles.value.splice(index, 1)[0]
    if (removed) revokeUrl(removed)
  }
  function getFileUrl(file: File): string {
    const cached = urlCache.get(file)
    if (cached) return cached
    const url = URL.createObjectURL(file)
    urlCache.set(file, url)
    return url
  }
  return { selectedFiles, clearFiles, addFiles, removeFile, getFileUrl }
}

function createSaveHandler(deps: SaveHandlerDeps): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    if (!deps.canSubmit.value) return false
    deps.saving.value = true
    try {
      const created = await createSubject({
        name: deps.form.name.trim(),
        description: deps.form.description.trim(),
        category_id: deps.form.categoryId,
      })
      if (created.id && deps.files.value.length) {
        await deps.uploadMedia(created.id, deps.files.value, false)
      }
      ElMessage.success('主体创建成功')
      return true
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '创建失败')
      return false
    } finally {
      deps.saving.value = false
    }
  }
}

/**
 * 管理主体创建表单、媒体校验与创建后的媒体上传。
 * @returns 创建弹窗所需的状态与操作。
 */
export function useSubjectCreate(): UseSubjectCreateReturn {
  const categories = useSubjectCategories()
  const media = useSubjectMedia()
  const files = createFileSelection()
  const saving = ref(false)
  const form = reactive<SubjectCreateForm>({ name: '', categoryId: '', description: '' })
  const categoryOptions = computed<CategorySelectOption[]>(() =>
    flattenCategoryOptions(categories.firstLevelCategories.value),
  )
  const canSubmit = computed(() => Boolean(form.name.trim() && form.categoryId && !saving.value))
  const save = createSaveHandler({ form, files: files.selectedFiles, saving, canSubmit, uploadMedia: media.uploadMedia })
  function reset(categoryId?: number | null): void {
    files.clearFiles()
    Object.assign(form, { name: '', description: '', categoryId: categoryId ? String(categoryId) : '' })
    if (!categories.firstLevelCategories.value.length) void categories.loadCategories()
  }
  onUnmounted(files.clearFiles)
  return {
    form, categoryOptions, selectedFiles: files.selectedFiles, saving,
    uploading: media.uploading, uploadProgress: media.uploadProgress, canSubmit,
    reset, addFiles: files.addFiles, removeFile: files.removeFile, getFileUrl: files.getFileUrl, save,
  }
}
