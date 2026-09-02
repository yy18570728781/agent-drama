import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import type { Subject } from '@/api/subjects'
import { useSubjectCategories, type CategoryOption } from '@/composables/subjects/useSubjectCategories'
import { useSubjectList } from '@/composables/subjects/useSubjectList'
import type {
  SubjectCategoryRenamePayload,
  UseSubjectLibraryReturn,
} from '@/composables/subjects/subjectLibrary.types'
import { useSubjectCanvasStore } from '@/stores/subjectCanvas.store'

function filterCategoryTree(categories: CategoryOption[], keyword: string): CategoryOption[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return categories
  return categories.flatMap((category) => {
    const children = filterCategoryTree(category.children || [], normalizedKeyword)
    const matches = category.name.toLocaleLowerCase().includes(normalizedKeyword)
    return matches || children.length ? [{ ...category, children }] : []
  })
}

function readPromptValue(result: unknown): string {
  if (!result || typeof result !== 'object' || !('value' in result)) return ''
  const value = (result as { value?: unknown }).value
  return typeof value === 'string' ? value.trim() : ''
}

async function promptForName(title: string, initialValue = ''): Promise<string | null> {
  try {
    const result = await ElMessageBox.prompt('请输入名称', title, {
      inputValue: initialValue,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    return readPromptValue(result) || null
  } catch {
    return null
  }
}

/**
 * 编排主体库目录、列表、弹窗与跨页面投放交互。
 * @returns 主体库页面所需的响应式状态和操作。
 */
export function useSubjectLibrary(): UseSubjectLibraryReturn {
  const router = useRouter()
  const canvasStore = useSubjectCanvasStore()
  const categories = useSubjectCategories()
  const selectedCategoryId = ref<number | null>(null)
  const selectedCategory = computed(() => selectedCategoryId.value)
  const list = useSubjectList(selectedCategory)
  const folderSearchKeyword = ref('')
  const dialogVisible = ref(false)
  const createCategoryId = ref<number | null>(null)
  const editDialogVisible = ref(false)
  const editingSubjectId = ref<string | null>(null)
  const categoryTree = categories.firstLevelCategories
  const visibleCategoryTree = computed(() =>
    filterCategoryTree(categoryTree.value, folderSearchKeyword.value),
  )
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  function selectCategory(categoryId: number | null): void {
    selectedCategoryId.value = categoryId
  }

  function openCreateDialog(categoryId: number | null = selectedCategoryId.value): void {
    createCategoryId.value = categoryId
    dialogVisible.value = true
  }

  async function refreshLibrary(): Promise<void> {
    await Promise.all([categories.loadCategories(true), list.loadList()])
  }

  async function createCategory(parentId?: number): Promise<void> {
    const name = await promptForName(parentId ? '新建子文件夹' : '新建文件夹')
    if (!name) return
    const createdId = await categories.createCategory(name, parentId)
    if (!createdId) return
    selectedCategoryId.value = createdId
    ElMessage.success('文件夹创建成功')
  }

  async function deleteCategory(category: CategoryOption): Promise<void> {
    if (category.children?.length) {
      ElMessage.warning('请先删除该文件夹下的子文件夹')
      return
    }
    const deleted = await categories.deleteCategory(category.id)
    if (!deleted) return
    if (selectedCategoryId.value === category.id) selectedCategoryId.value = null
    ElMessage.success('文件夹已删除')
  }

  async function renameCategory(payload: SubjectCategoryRenamePayload): Promise<void> {
    const renamed = await categories.renameCategory(payload.categoryId, payload.name)
    if (renamed) ElMessage.success('文件夹已重命名')
  }

  function openSubjectEditor(subject: Subject): void {
    editingSubjectId.value = subject.id
    editDialogVisible.value = true
  }

  async function addSubjectToCanvas(subject: Subject): Promise<void> {
    if (!canvasStore.queueSubject(subject)) {
      ElMessage.warning('该主体暂无可添加到画布的封面')
      return
    }
    ElMessage.success('主体将在画布中添加')
    await router.push({ name: 'flow', query: { new: '1' } })
  }

  async function renameSubject(subject: Subject): Promise<void> {
    const name = await promptForName('重命名主体', subject.name)
    if (!name || name === subject.name) return
    try {
      await list.renameSubject(subject, name)
      ElMessage.success('主体已重命名')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '主体重命名失败')
    }
  }

  async function removeSubject(subject: Subject): Promise<void> {
    try {
      await ElMessageBox.confirm(`确定删除主体「${subject.name}」吗？`, '删除主体', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
      })
      await list.removeSubject(subject.id)
      ElMessage.success('主体已删除')
    } catch (error) {
      if (error !== 'cancel') ElMessage.error('主体删除失败')
    }
  }

  async function handleSaved(): Promise<void> {
    await list.loadList()
  }

  watch(selectedCategoryId, () => { void list.loadList() })
  watch(list.searchName, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { void list.loadList() }, 300)
  })
  onMounted(() => { void refreshLibrary() })
  onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })

  return {
    categoryTree, visibleCategoryTree, selectedCategoryId, folderSearchKeyword,
    categoryLoading: categories.categoryLoading,
    subjects: list.subjects, totalCount: list.totalCount, loading: list.loading,
    loadingMore: list.loadingMore, hasMore: list.hasMore, errorMessage: list.errorMessage,
    searchName: list.searchName, dialogVisible, createCategoryId,
    editDialogVisible, editingSubjectId, selectCategory,
    refreshLibrary, createRootCategory: () => createCategory(), createChildCategory: createCategory,
    renameCategory, deleteCategory, openCreateDialog, handleSaved,
    openSubjectEditor, addSubjectToCanvas,
    renameSubject, removeSubject, loadMore: list.loadMore,
  }
}
