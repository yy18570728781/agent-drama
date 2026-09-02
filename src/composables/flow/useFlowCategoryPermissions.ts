import { ref, watch, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteFlowCategoryPermission,
  listFlowCategoryPermissions,
  saveFlowCategoryPermission,
  type FlowCategoryPermissionMember,
} from '@/api/flowCategoryPermissions'

interface UseFlowCategoryPermissionsOptions {
  categoryId: Ref<string>
  lockedUserIds: Ref<string[]>
  onUpdated: () => void
  visible: Ref<boolean>
}

interface UseFlowCategoryPermissionsReturn {
  addMembers: (
    members: FlowCategoryPermissionMember[],
    inherit: boolean,
  ) => Promise<FlowCategoryPermissionMember[]>
  inheritToChildren: Ref<boolean>
  isLocked: (member: FlowCategoryPermissionMember) => boolean
  isLoading: Ref<boolean>
  members: Ref<FlowCategoryPermissionMember[]>
  removeMember: (member: FlowCategoryPermissionMember) => Promise<void>
  removeMembers: (members: FlowCategoryPermissionMember[]) => Promise<void>
  updateMember: (member: FlowCategoryPermissionMember, permission: number) => Promise<void>
  updateMembers: (members: FlowCategoryPermissionMember[], permission: number) => Promise<void>
}

/**
 * 管理画布分类的成员权限列表、搜索与修改流程。
 * @param options 弹窗可见状态、分类 ID 与锁定成员。
 * @returns 权限弹窗所需的响应式状态与操作。
 */
export function useFlowCategoryPermissions(
  options: UseFlowCategoryPermissionsOptions,
): UseFlowCategoryPermissionsReturn {
  const members = ref<FlowCategoryPermissionMember[]>([])
  const inheritToChildren = ref(true)
  const isLoading = ref(false)

  async function loadMembers(): Promise<void> {
    if (!options.categoryId.value) return
    isLoading.value = true
    try {
      members.value = await listFlowCategoryPermissions(options.categoryId.value)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '权限加载失败')
    } finally {
      isLoading.value = false
    }
  }

  function isLocked(member: FlowCategoryPermissionMember): boolean {
    return member.type === 'user' && options.lockedUserIds.value.includes(member.id)
  }

  async function addMembers(
    nextMembers: FlowCategoryPermissionMember[],
    inherit: boolean,
  ): Promise<FlowCategoryPermissionMember[]> {
    if (!options.categoryId.value || !nextMembers.length) return nextMembers
    const results = await Promise.allSettled(nextMembers.map((member) =>
      saveFlowCategoryPermission({
        categoryId: options.categoryId.value,
        inherit,
        member,
        permission: member.permission,
      })))
    const failedCount = results.filter((result) => result.status === 'rejected').length
    const failedMembers = nextMembers.filter((_, index) => results[index].status === 'rejected')
    await loadMembers()
    options.onUpdated()
    if (failedCount) ElMessage.warning(`${failedCount} 个协作者添加失败`)
    if (failedCount < results.length) ElMessage.success('协作者已添加')
    return failedMembers
  }

  async function updateMember(
    member: FlowCategoryPermissionMember,
    permission: number,
  ): Promise<void> {
    if (isLocked(member) || !options.categoryId.value) return
    try {
      await saveFlowCategoryPermission({
        categoryId: options.categoryId.value,
        inherit: inheritToChildren.value,
        member,
        permission,
      })
      member.permission = permission
      options.onUpdated()
      ElMessage.success('权限更新成功')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '权限更新失败')
    }
  }

  async function updateMembers(
    selectedMembers: FlowCategoryPermissionMember[],
    permission: number,
  ): Promise<void> {
    const editableMembers = selectedMembers.filter((member) => !isLocked(member))
    if (!options.categoryId.value || !editableMembers.length) return
    const results = await Promise.allSettled(editableMembers.map((member) =>
      saveFlowCategoryPermission({
        categoryId: options.categoryId.value,
        inherit: inheritToChildren.value,
        member,
        permission,
      })))
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') editableMembers[index].permission = permission
    })
    const failedCount = results.filter((result) => result.status === 'rejected').length
    options.onUpdated()
    if (failedCount) ElMessage.warning(`${failedCount} 个权限更新失败`)
    else ElMessage.success('批量更新权限成功')
  }

  async function removeMember(member: FlowCategoryPermissionMember): Promise<void> {
    if (isLocked(member) || !options.categoryId.value) return
    try {
      await ElMessageBox.confirm(`确认移除【${member.name}】的分类权限吗？`, '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      })
      await deleteFlowCategoryPermission(options.categoryId.value, member)
      members.value = members.value.filter((item) => item !== member)
      options.onUpdated()
      ElMessage.success('权限已移除')
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error(error instanceof Error ? error.message : '权限删除失败')
    }
  }

  async function removeMembers(selectedMembers: FlowCategoryPermissionMember[]): Promise<void> {
    const removableMembers = selectedMembers.filter((member) => !isLocked(member))
    if (!options.categoryId.value || !removableMembers.length) return
    try {
      await ElMessageBox.confirm(
        `确认移除已勾选的 ${removableMembers.length} 个协作者权限吗？`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
      )
      const results = await Promise.allSettled(removableMembers.map((member) =>
        deleteFlowCategoryPermission(options.categoryId.value, member)))
      const failedCount = results.filter((result) => result.status === 'rejected').length
      await loadMembers()
      options.onUpdated()
      if (failedCount) ElMessage.warning(`${failedCount} 个协作者移除失败`)
      if (failedCount < results.length) ElMessage.success('已批量移除协作者')
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error(error instanceof Error ? error.message : '批量移除失败')
    }
  }

  watch(
    [options.visible, options.categoryId],
    ([visible]) => {
      if (visible) void loadMembers()
      else members.value = []
    },
    { immediate: true },
  )

  return {
    addMembers, inheritToChildren, isLocked, isLoading, members, removeMember, removeMembers,
    updateMember, updateMembers,
  }
}
