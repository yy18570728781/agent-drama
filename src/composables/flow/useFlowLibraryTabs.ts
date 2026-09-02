import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { removePersistedFlowTab } from '@/services/flow/flowTabSession.service'
import { dedupeWorkflowTabs, normalizeWorkflowTabId } from './flowTabIdentity'
import type { WorkflowTab } from './flowCore.types'
import { activeTabId, workflowTabs } from './useFlowCore'

interface UseFlowLibraryTabsReturn {
  cancelCloseWorkflowTab: () => void
  closeDialogVisible: Ref<boolean>
  closeWorkflowTab: (tabId: string) => void
  closingWorkflowName: ComputedRef<string>
  confirmCloseWorkflowTab: () => Promise<void>
  visibleWorkflowTabs: ComputedRef<WorkflowTab[]>
}

function normalizeName(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function removeRuntimeTab(target: WorkflowTab): string {
  const targetIndex = workflowTabs.value.findIndex((tab) => tab.id === target.id)
  const targetWorkflowId = normalizeWorkflowTabId(target.workflowId)
  const targetName = normalizeName(target.name)
  workflowTabs.value = workflowTabs.value.filter((tab) => {
    if (tab.id === target.id) return false
    if (!targetWorkflowId) return true
    const tabWorkflowId = normalizeWorkflowTabId(tab.workflowId)
    if (tabWorkflowId) return tabWorkflowId !== targetWorkflowId
    return !targetName || normalizeName(tab.name) !== targetName
  })
  if (activeTabId.value !== target.id && workflowTabs.value.some((tab) => tab.id === activeTabId.value)) {
    return activeTabId.value
  }
  const nextTab = workflowTabs.value[Math.min(targetIndex, workflowTabs.value.length - 1)]
  activeTabId.value = nextTab?.id || ''
  return activeTabId.value
}

/**
 * 管理画布列表页顶部标签的去重与关闭操作。
 * @returns 去重后的标签集合及安全关闭方法。
 */
export function useFlowLibraryTabs(): UseFlowLibraryTabsReturn {
  const closeDialogVisible = ref(false)
  const pendingCloseTabId = ref('')
  const visibleWorkflowTabs = computed(() => dedupeWorkflowTabs(workflowTabs.value))
  const closingWorkflowName = computed(() =>
    workflowTabs.value.find((tab) => tab.id === pendingCloseTabId.value)?.name || '未命名画布',
  )

  function cancelCloseWorkflowTab(): void {
    closeDialogVisible.value = false
    pendingCloseTabId.value = ''
  }

  function closeWorkflowTab(tabId: string): void {
    if (!workflowTabs.value.some((tab) => tab.id === tabId)) return
    pendingCloseTabId.value = tabId
    closeDialogVisible.value = true
  }

  async function confirmCloseWorkflowTab(): Promise<void> {
    const target = workflowTabs.value.find((tab) => tab.id === pendingCloseTabId.value)
    if (!target) {
      cancelCloseWorkflowTab()
      return
    }
    closeDialogVisible.value = false
    try {
      const nextActiveTabId = removeRuntimeTab(target)
      await removePersistedFlowTab(target, nextActiveTabId)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '关闭画布标签失败')
    } finally {
      pendingCloseTabId.value = ''
    }
  }

  return {
    cancelCloseWorkflowTab,
    closeDialogVisible,
    closeWorkflowTab,
    closingWorkflowName,
    confirmCloseWorkflowTab,
    visibleWorkflowTabs,
  }
}
