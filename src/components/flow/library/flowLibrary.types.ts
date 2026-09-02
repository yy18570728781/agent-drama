import type { FlowLibraryCanvas, FlowLibraryCategory } from '@/api/flowLibrary'
import type { ComputedRef, Ref } from 'vue'

export interface FlowCanvasCreateDraft {
  categoryId?: string
  name: string
  coverFile: File | null
  removeCover?: boolean
}

export interface FlowCanvasCategoryOption {
  disabled: boolean
  id: string
  label: string
  pid: string
}

export interface FlowFolderNode extends FlowLibraryCategory {
  children: FlowFolderNode[]
}

export interface UseFlowLibraryReturn {
  cancelFolderCreation: (categoryId: string) => void
  canCreateCanvas: ComputedRef<boolean>
  canCreateFolder: ComputedRef<boolean>
  canDeleteCanvas: ComputedRef<boolean>
  canEditCanvas: ComputedRef<boolean>
  canManageRootCategory: ComputedRef<boolean>
  canManageRootPermissions: ComputedRef<boolean>
  canvases: ComputedRef<FlowLibraryCanvas[]>
  confirmCreateCanvas: (draft: FlowCanvasCreateDraft) => Promise<void>
  confirmEditCanvas: (draft: FlowCanvasCreateDraft) => Promise<void>
  createCategoryOptions: ComputedRef<FlowCanvasCategoryOption[]>
  createCanvas: () => void
  createDialogVisible: Ref<boolean>
  createFolder: (parentId?: string) => Promise<void>
  createRootFolder: () => Promise<void>
  deleteCanvas: (canvas: FlowLibraryCanvas) => Promise<void>
  deleteFolder: (categoryId: string) => Promise<void>
  editCanvas: (canvas: FlowLibraryCanvas) => Promise<void>
  editDialogVisible: Ref<boolean>
  editingCanvas: Ref<FlowLibraryCanvas | null>
  errorMessage: Ref<string>
  favoritePendingIds: Ref<Set<string>>
  folderTree: ComputedRef<FlowFolderNode[]>
  folderSearchKeyword: Ref<string>
  hasMoreCanvases: Ref<boolean>
  isLoading: Ref<boolean>
  isLoadingMoreCanvases: Ref<boolean>
  isCreatingCanvas: Ref<boolean>
  isEditingCanvas: Ref<boolean>
  lockedPermissionUserIds: ComputedRef<string[]>
  loadMoreCanvases: () => Promise<void>
  loadedTreeCategoryIds: Ref<Set<string>>
  openPermissionDialog: (categoryId: string) => void
  openRootPermissionDialog: () => void
  permissionCategory: Ref<FlowLibraryCategory | null>
  permissionDialogVisible: Ref<boolean>
  refreshCategoryPermissions: () => void
  refreshLibrary: () => Promise<void>
  renameFolder: (categoryId: string, name: string) => Promise<void>
  rootCategoryId: ComputedRef<string>
  requiresCreateCategory: ComputedRef<boolean>
  searchKeyword: Ref<string>
  selectCategory: (categoryId: string) => Promise<void>
  selectRootCategory: () => Promise<void>
  selectedCategoryId: Ref<string>
  selectedFolderName: ComputedRef<string>
  toggleCanvasFavorite: (canvas: FlowLibraryCanvas) => Promise<void>
  treeCanvasesByCategory: Ref<Record<string, FlowLibraryCanvas[]>>
  treeLoadingCategoryId: ComputedRef<string>
  visibleFolderTree: ComputedRef<FlowFolderNode[]>
}
