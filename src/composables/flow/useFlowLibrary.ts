import type {
  FlowFolderNode,
  UseFlowLibraryReturn,
} from '@/components/flow/library/flowLibrary.types'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  listFlowCategories,
  type FlowLibraryCanvas,
  type FlowLibraryCategory,
} from '@/api/flowLibrary'
import { resolveFlowAssetCategoryId } from '@/services/flow/flowAssetCategory.service'
import { isFlowVirtualRoot } from '@/services/flow/flowCategoryPath.service'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { useFlowCanvasCardActions } from './useFlowCanvasCardActions'
import { useFlowCategoryActions } from './useFlowCategoryActions'
import { useFlowCanvasList } from './useFlowCanvasList'
import { useFlowCanvasTreeCache } from './useFlowCanvasTreeCache'
import { useFlowFolderSearch } from './useFlowFolderSearch'
import { useFlowLibraryRootActions } from './useFlowLibraryRootActions'
import { useFlowLibraryCanvasCreation } from './useFlowLibraryCanvasCreation'
import { useFlowLibraryTreeScope } from './useFlowLibraryTreeScope'

function buildFolderTree(
  categories: FlowLibraryCategory[],
): FlowFolderNode[] {
  const nodeById = new Map<string, FlowFolderNode>()
  categories.forEach((category) => {
    nodeById.set(category.id, {
      ...category,
      children: [],
    })
  })
  const roots: FlowFolderNode[] = []
  categories.forEach((category) => {
    const node = nodeById.get(category.id)
    if (!node) return
    const parent = nodeById.get(category.pid)
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  })
  return roots
}

function readRouteQueryValue(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

async function resolveStandaloneScope(
  isStandalone: boolean,
  requestedCategoryId: string,
  workflowId: string,
  categories: FlowLibraryCategory[],
): Promise<string> {
  if (!isStandalone) return ''
  if (categories.some((category) => category.id === requestedCategoryId)) {
    return requestedCategoryId
  }
  if (!workflowId) return ''
  const assetCategoryId = await resolveFlowAssetCategoryId(workflowId)
  return categories.some((category) => category.id === assetCategoryId) ? assetCategoryId : ''
}

/**
 * 管理画布资料库的分类、检索、新建和进入编辑器流程。
 * @returns 资料库页面所需的响应式状态与动作。
 */
export function useFlowLibrary(): UseFlowLibraryReturn {
  const route = useRoute()
  const router = useRouter()
  const categories = ref<FlowLibraryCategory[]>([])
  const selectedCategoryId = ref('')
  const isCategoryLoading = ref(false)
  const flowRouteName = computed(() => route.meta.standalone === true ? 'flow-single' : 'flow')
  const {
    canvases, errorMessage, hasMore: hasMoreCanvases,
    insertCanvas, isInitialLoading: isCanvasLoading, isLoadingMore: isLoadingMoreCanvases,
    loadMore: loadMoreCanvases, patchCanvas, reload: reloadCanvases,
    removeCanvas, searchKeyword,
  } = useFlowCanvasList(selectedCategoryId)
  const {
    canvasesByCategory: treeCanvasesByCategory,
    loadedCategoryIds: loadedTreeCategoryIds,
    loadingCategoryId: treeLoadingCategoryId,
    reset: resetTreeCanvasCache,
    upsertCanvas: upsertTreeCanvas,
  } = useFlowCanvasTreeCache({
    canvases,
    errorMessage,
    isLoading: isCanvasLoading,
    searchKeyword,
    selectedCategoryId,
  })
  const isLoading = computed(() => isCategoryLoading.value || isCanvasLoading.value)

  const rawFolderTree = computed(() => buildFolderTree(categories.value))
  const { folderTree, rootCategoryId, setStandaloneScope } = useFlowLibraryTreeScope(
    categories,
    rawFolderTree,
  )
  const { folderSearchKeyword, visibleFolderTree } = useFlowFolderSearch(folderTree)
  const selectedCategory = computed(() =>
    categories.value.find((category) => category.id === selectedCategoryId.value),
  )
  const selectedFolderName = computed(() =>
    isFlowVirtualRoot(selectedCategory.value) ? '' : selectedCategory.value?.name || '',
  )
  const selectedPermission = computed(() => selectedCategory.value?.permission ?? 0)
  const canEditCanvas = computed(() =>
    selectedPermission.value >= FLOW_CATEGORY_PERMISSION.EDIT,
  )
  const canDeleteCanvas = computed(() =>
    selectedPermission.value >= FLOW_CATEGORY_PERMISSION.MANAGE,
  )
  const canCreateFolder = computed(() =>
    selectedPermission.value >= FLOW_CATEGORY_PERMISSION.MANAGE,
  )

  function registerCreatedCanvas(canvas: FlowLibraryCanvas): void {
    upsertTreeCanvas(canvas)
    const keyword = searchKeyword.value.trim().toLocaleLowerCase()
    const matchesSearch = !keyword || canvas.name.toLocaleLowerCase().includes(keyword)
    if (canvas.categoryId === selectedCategoryId.value && matchesSearch) insertCanvas(canvas)
  }

  const {
    canCreateCanvas,
    confirmCreateCanvas,
    createCategoryOptions,
    createCanvas,
    createDialogVisible,
    isCreatingCanvas,
    requiresCreateCategory,
  } = useFlowLibraryCanvasCreation({
    categories,
    onCreated: registerCreatedCanvas,
    rootCategoryId,
    selectedCategoryId,
  })
  const {
    confirmEditCanvas, deleteCanvas, editCanvas, editDialogVisible, editingCanvas,
    favoritePendingIds, isEditingCanvas, toggleCanvasFavorite,
  } = useFlowCanvasCardActions({
    canDelete: canDeleteCanvas,
    canEdit: canEditCanvas,
    patchCanvas,
    removeCanvas,
  })
  async function loadLibrary(): Promise<void> {
    isCategoryLoading.value = true
    errorMessage.value = ''
    resetTreeCanvasCache()
    try {
      const nextCategories = await listFlowCategories()
      categories.value = nextCategories
      const routeCategoryId = readRouteQueryValue(route.query.categoryId)
      const requestedScopeId = readRouteQueryValue(route.query.scopeCategoryId) || routeCategoryId
      const scopeCategoryId = await resolveStandaloneScope(
        route.meta.standalone === true,
        requestedScopeId,
        readRouteQueryValue(route.query.workflowId),
        nextCategories,
      )
      setStandaloneScope(scopeCategoryId)
      const preferredCategoryId = selectedCategoryId.value || routeCategoryId || scopeCategoryId
      const hasSelectedFolder = nextCategories.some((category) => category.id === preferredCategoryId)
      selectedCategoryId.value = hasSelectedFolder
        ? preferredCategoryId
        : rootCategoryId.value
      await reloadCanvases()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '画布资料库加载失败'
    } finally {
      isCategoryLoading.value = false
    }
  }

  const {
    cancelFolderCreation, createFolder, deleteFolder, lockedPermissionUserIds, openPermissionDialog,
    permissionCategory, permissionDialogVisible, refreshCategoryPermissions,
    renameFolder,
  } = useFlowCategoryActions({
    categories,
    reload: loadLibrary,
    rootCategoryId,
    selectedCategoryId,
  })

  async function selectCategory(categoryId: string): Promise<void> {
    if (!categoryId) return
    if (categoryId !== selectedCategoryId.value) {
      selectedCategoryId.value = categoryId
      await reloadCanvases()
      if (selectedCategoryId.value !== categoryId) return
    }
    const scopeQuery = route.meta.standalone === true && rootCategoryId.value
      ? { scopeCategoryId: rootCategoryId.value }
      : {}
    await router.replace({ name: flowRouteName.value, query: { categoryId, ...scopeQuery } })
  }

  const {
    canManageRootCategory, canManageRootPermissions, createRootFolder,
    openRootPermissionDialog, selectRootCategory,
  } = useFlowLibraryRootActions({
    categories,
    createFolder,
    folderSearchKeyword,
    openPermissionDialog,
    rootCategoryId,
    selectCategory,
  })

  onMounted(() => { void loadLibrary() })

  return {
    cancelFolderCreation, canCreateCanvas, canCreateFolder, canDeleteCanvas, canEditCanvas,
    canManageRootCategory, canManageRootPermissions, canvases,
    confirmCreateCanvas, confirmEditCanvas, createCanvas, createCategoryOptions, createDialogVisible,
    createFolder, createRootFolder,
    deleteCanvas, deleteFolder, editCanvas, editDialogVisible, editingCanvas,
    errorMessage, favoritePendingIds,
    folderSearchKeyword, folderTree, hasMoreCanvases,
    isCreatingCanvas, isEditingCanvas, isLoading, isLoadingMoreCanvases, loadMoreCanvases,
    loadedTreeCategoryIds, lockedPermissionUserIds, openPermissionDialog, openRootPermissionDialog,
    permissionCategory, permissionDialogVisible, refreshCategoryPermissions,
    refreshLibrary: loadLibrary, renameFolder, requiresCreateCategory, rootCategoryId, searchKeyword,
    selectCategory, selectedCategoryId, selectRootCategory, selectedFolderName,
    toggleCanvasFavorite, treeCanvasesByCategory, treeLoadingCategoryId, visibleFolderTree,
  }
}
