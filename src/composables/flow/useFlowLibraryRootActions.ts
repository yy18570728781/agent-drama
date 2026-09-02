import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import type { FlowLibraryCategory } from '@/api/flowLibrary'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { useSuperAdminRole } from '@/composables/useSuperAdminRole'

interface UseFlowLibraryRootActionsOptions {
  categories: Ref<FlowLibraryCategory[]>
  createFolder: (parentId?: string) => Promise<void>
  folderSearchKeyword: Ref<string>
  openPermissionDialog: (categoryId: string) => void
  rootCategoryId: ComputedRef<string>
  selectCategory: (categoryId: string) => Promise<void>
}

interface UseFlowLibraryRootActionsReturn {
  canManageRootCategory: ComputedRef<boolean>
  canManageRootPermissions: ComputedRef<boolean>
  createRootFolder: () => Promise<void>
  openRootPermissionDialog: () => void
  selectRootCategory: () => Promise<void>
}

/**
 * 管理隐藏画布根节点对应的新建、权限和导航动作。
 * @param options 分类数据与资料库已有动作。
 * @returns 根目录工具栏所需的权限状态和动作。
 */
export function useFlowLibraryRootActions(
  options: UseFlowLibraryRootActionsOptions,
): UseFlowLibraryRootActionsReturn {
  const isSuperAdmin = useSuperAdminRole()
  const canManageRootCategory = computed(() => {
    const root = options.categories.value.find(
      (category) => category.id === options.rootCategoryId.value,
    )
    return (root?.permission ?? 0) >= FLOW_CATEGORY_PERMISSION.MANAGE
  })
  const canManageRootPermissions = computed(() => (
    isSuperAdmin.value && canManageRootCategory.value
  ))

  async function selectRootCategory(): Promise<void> {
    if (options.rootCategoryId.value) await options.selectCategory(options.rootCategoryId.value)
  }

  async function createRootFolder(): Promise<void> {
    options.folderSearchKeyword.value = ''
    if (options.rootCategoryId.value) await options.createFolder(options.rootCategoryId.value)
  }

  function openRootPermissionDialog(): void {
    if (!canManageRootPermissions.value || !options.rootCategoryId.value) return
    options.openPermissionDialog(options.rootCategoryId.value)
  }

  return {
    canManageRootCategory,
    canManageRootPermissions,
    createRootFolder,
    openRootPermissionDialog,
    selectRootCategory,
  }
}
