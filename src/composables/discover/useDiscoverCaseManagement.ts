import type { DiscoverCase, DiscoverCaseDetail } from '@/components/discover/discover.types'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import type { ComputedRef, Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import {
  deleteManagedDiscoverCase,
  setManagedDiscoverCaseCover,
  updateManagedDiscoverCase,
} from '@/services/discover/discoverCaseManagement.service'

interface UseDiscoverCaseManagementOptions {
  canReleaseCase: Ref<boolean>
  detail: Ref<DiscoverCaseDetail | null>
  onCaseChanged: (item: DiscoverCase) => void
  onDeleted: (caseId: string) => void
}

export interface UseDiscoverCaseManagementReturn {
  canEditOrDeleteCase: ComputedRef<boolean>
  canManageCase: ComputedRef<boolean>
  coverPending: Ref<boolean>
  deleteCase: () => Promise<void>
  deletePending: Ref<boolean>
  editDialogVisible: Ref<boolean>
  editPending: Ref<boolean>
  managementError: Ref<string>
  managementPending: ComputedRef<boolean>
  openEditDialog: () => void
  saveCaseChanges: (draft: FlowCanvasCreateDraft) => Promise<void>
  setCaseCover: (file: File) => Promise<void>
}

async function confirmCaseDeletion(detail: DiscoverCaseDetail): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      `确定删除案例「${detail.title}」吗？删除后无法恢复。`,
      '删除案例',
      {
        cancelButtonText: '取消',
        confirmButtonText: '删除',
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}

/**
 * Manage case editing, direct cover setup, and confirmed deletion.
 * @param options Current detail and parent synchronization callbacks.
 * @returns Permission-gated management state and actions for the detail dialog.
 */
export function useDiscoverCaseManagement(
  options: UseDiscoverCaseManagementOptions,
): UseDiscoverCaseManagementReturn {
  const editDialogVisible = ref(false)
  const editPending = ref(false)
  const coverPending = ref(false)
  const deletePending = ref(false)
  const managementError = ref('')
  const canManageCase = computed(() => options.canReleaseCase.value)
  const canEditOrDeleteCase = canManageCase
  const managementPending = computed(() => (
    editPending.value || coverPending.value || deletePending.value
  ))

  function applyUpdatedDetail(updated: DiscoverCaseDetail): void {
    options.detail.value = updated
    options.onCaseChanged(updated)
  }

  function openEditDialog(): void {
    if (!canEditOrDeleteCase.value || managementPending.value) return
    managementError.value = ''
    editDialogVisible.value = true
  }

  async function saveCaseChanges(draft: FlowCanvasCreateDraft): Promise<void> {
    const current = options.detail.value
    if (!current || !canEditOrDeleteCase.value || editPending.value) return
    editPending.value = true
    managementError.value = ''
    try {
      applyUpdatedDetail(await updateManagedDiscoverCase(current, draft))
      editDialogVisible.value = false
      ElMessage.success('案例已更新')
    } catch (error) {
      managementError.value = error instanceof Error ? error.message : '案例更新失败'
    } finally {
      editPending.value = false
    }
  }

  async function setCaseCover(file: File): Promise<void> {
    const current = options.detail.value
    if (!current || !canManageCase.value || coverPending.value) return
    coverPending.value = true
    managementError.value = ''
    try {
      applyUpdatedDetail(await setManagedDiscoverCaseCover(current, file))
      ElMessage.success('案例封面已设置')
    } catch (error) {
      managementError.value = error instanceof Error ? error.message : '案例封面设置失败'
    } finally {
      coverPending.value = false
    }
  }

  async function deleteCase(): Promise<void> {
    const current = options.detail.value
    if (!current || !canEditOrDeleteCase.value || managementPending.value) return
    if (!await confirmCaseDeletion(current)) return
    deletePending.value = true
    managementError.value = ''
    try {
      await deleteManagedDiscoverCase(current)
      options.onDeleted(current.id)
      ElMessage.success('案例已删除')
    } catch (error) {
      managementError.value = error instanceof Error ? error.message : '案例删除失败'
    } finally {
      deletePending.value = false
    }
  }

  watch(() => options.detail.value?.id, () => {
    editDialogVisible.value = false
    managementError.value = ''
  })

  return {
    canEditOrDeleteCase,
    canManageCase,
    coverPending,
    deleteCase,
    deletePending,
    editDialogVisible,
    editPending,
    managementError,
    managementPending,
    openEditDialog,
    saveCaseChanges,
    setCaseCover,
  }
}
