import type { ComputedRef, Ref } from 'vue'
import type { Subject } from '@/api/subjects'
import type { CategoryOption } from '@/composables/subjects/useSubjectCategories'

export interface SubjectCategoryRenamePayload {
  categoryId: number
  name: string
}

export interface UseSubjectLibraryReturn {
  categoryTree: ComputedRef<CategoryOption[]>
  visibleCategoryTree: ComputedRef<CategoryOption[]>
  selectedCategoryId: Ref<number | null>
  folderSearchKeyword: Ref<string>
  categoryLoading: Ref<boolean>
  subjects: Ref<Subject[]>
  totalCount: Ref<number>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  hasMore: ComputedRef<boolean>
  errorMessage: Ref<string>
  searchName: Ref<string>
  dialogVisible: Ref<boolean>
  createCategoryId: Ref<number | null>
  editDialogVisible: Ref<boolean>
  editingSubjectId: Ref<string | null>
  selectCategory: (categoryId: number | null) => void
  refreshLibrary: () => Promise<void>
  createRootCategory: () => Promise<void>
  createChildCategory: (parentId: number) => Promise<void>
  renameCategory: (payload: SubjectCategoryRenamePayload) => Promise<void>
  deleteCategory: (category: CategoryOption) => Promise<void>
  openCreateDialog: (categoryId?: number | null) => void
  handleSaved: () => Promise<void>
  openSubjectEditor: (subject: Subject) => void
  addSubjectToCanvas: (subject: Subject) => Promise<void>
  renameSubject: (subject: Subject) => Promise<void>
  removeSubject: (subject: Subject) => Promise<void>
  loadMore: () => Promise<void>
}
