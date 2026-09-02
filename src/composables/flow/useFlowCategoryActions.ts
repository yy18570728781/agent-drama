import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStoredAuthScope } from '@/api/tokenStorage'
import {
  createFlowCategory,
  deleteFlowCategory,
  updateFlowCategory,
  type FlowLibraryCategory,
} from '@/api/flowLibrary'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { useSuperAdminRole } from '@/composables/useSuperAdminRole'

interface UseFlowCategoryActionsOptions {
  categories: Ref<FlowLibraryCategory[]>
  reload: () => Promise<void>
  rootCategoryId: ComputedRef<string>
  selectedCategoryId: Ref<string>
}

interface UseFlowCategoryActionsReturn {
  cancelFolderCreation: (categoryId: string) => void
  createFolder: (parentId?: string) => Promise<void>
  deleteFolder: (categoryId: string) => Promise<void>
  lockedPermissionUserIds: ComputedRef<string[]>
  openPermissionDialog: (categoryId: string) => void
  permissionCategory: Ref<FlowLibraryCategory | null>
  permissionDialogVisible: Ref<boolean>
  refreshCategoryPermissions: () => void
  renameFolder: (categoryId: string, name: string) => Promise<void>
}

/**
 * 管理画布分类的重命名、删除与权限弹窗流程。
 * @param options 分类状态、当前选中项与刷新动作。
 * @returns 分类节点操作与权限弹窗状态。
 */
export function useFlowCategoryActions(
  options: UseFlowCategoryActionsOptions,
): UseFlowCategoryActionsReturn {
  const isSuperAdmin = useSuperAdminRole()
  const permissionCategory = ref<FlowLibraryCategory | null>(null)
  const permissionDialogVisible = ref(false)
  const lockedPermissionUserIds = computed(() => {
    const currentUserId = getStoredAuthScope()?.userId || ''
    return Array.from(new Set([
      currentUserId,
      permissionCategory.value?.createdBy || '',
    ].filter(Boolean)))
  })

  function findCategory(categoryId: string): FlowLibraryCategory | undefined {
    return options.categories.value.find((category) => category.id === categoryId)
  }

  async function createFolder(parentId = options.selectedCategoryId.value): Promise<void> {
    const parent = findCategory(parentId)
    if (!parent || parent.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
      ElMessage.warning('当前文件夹无管理权限')
      return
    }
    options.categories.value = options.categories.value.filter(
      (category) => !category.id.startsWith('add_'),
    )
    const id = `add_${Date.now()}`
    const temporary: FlowLibraryCategory = {
      createdBy: getStoredAuthScope()?.userId || '',
      id,
      name: '未命名',
      pathIds: [...parent.pathIds, parent.id],
      permission: FLOW_CATEGORY_PERMISSION.MANAGE,
      pid: parent.id,
    }
    const parentIndex = options.categories.value.findIndex((item) => item.id === parent.id)
    options.categories.value.splice(parentIndex + 1, 0, temporary)
    options.selectedCategoryId.value = id
  }

  function cancelFolderCreation(categoryId: string): void {
    const category = findCategory(categoryId)
    if (!category?.id.startsWith('add_')) return
    options.categories.value = options.categories.value.filter((item) => item.id !== categoryId)
    options.selectedCategoryId.value = category.pid
  }

  async function renameFolder(categoryId: string, name: string): Promise<void> {
    const category = findCategory(categoryId)
    const normalizedName = name.trim()
    if (!category || category.permission < FLOW_CATEGORY_PERMISSION.EDIT) {
      ElMessage.warning('当前文件夹无编辑权限')
      return
    }
    if (!normalizedName) return
    if (!category.id.startsWith('add_') && normalizedName === category.name) return
    try {
      if (category.id.startsWith('add_')) {
        const createdId = await createFlowCategory(
          normalizedName,
          category.pid,
          category.pid === options.rootCategoryId.value,
        )
        options.selectedCategoryId.value = createdId
        await options.reload()
        ElMessage.success('文件夹已创建')
        return
      }
      await updateFlowCategory(categoryId, normalizedName)
      await options.reload()
      ElMessage.success('更新成功')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '文件夹更新失败')
    }
  }

  async function deleteFolder(categoryId: string): Promise<void> {
    const category = findCategory(categoryId)
    if (!category || category.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
      ElMessage.warning('当前文件夹无管理权限')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确认要删除分类【${category.name}】以及下级所有分类吗？`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
      )
      options.selectedCategoryId.value = category.pid
      await deleteFlowCategory(categoryId)
      await options.reload()
      ElMessage.success('删除成功')
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error(error instanceof Error ? error.message : '文件夹删除失败')
    }
  }

  function openPermissionDialog(categoryId: string): void {
    if (!isSuperAdmin.value) return
    const category = findCategory(categoryId)
    if (!category || category.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
      ElMessage.warning('当前文件夹无管理权限')
      return
    }
    permissionCategory.value = category
    permissionDialogVisible.value = true
  }

  function refreshCategoryPermissions(): void {
    void options.reload()
  }

  return {
    cancelFolderCreation, createFolder, deleteFolder, lockedPermissionUserIds, openPermissionDialog,
    permissionCategory, permissionDialogVisible, refreshCategoryPermissions,
    renameFolder,
  }
}
