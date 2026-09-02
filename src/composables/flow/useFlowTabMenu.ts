import type { Ref } from 'vue'
import type { FlowTabsDeps } from './flowRuntime.types'
import { ElMessage } from 'element-plus'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { updateWorkflowAsset } from '@/api/workflowAssets'
import { activeTabId, activeWorkflowName, workflowTabs } from './useFlowCore'
import { normalizeFlowCanvasName } from './flowNameValidation'

export interface FlowTabContextMenuState {
  visible: boolean
  x: number
  y: number
  tabId: string | null
}

interface UseFlowTabMenuOptions {
  deps: FlowTabsDeps
  saveTabs: () => Promise<void>
}

interface FlowTabMenuContext extends UseFlowTabMenuOptions {
  pendingExportTabId: Ref<string | null>
  renamePending: Ref<boolean>
  renameValue: Ref<string>
  showExportSaveModal: Ref<boolean>
  showRenameModal: Ref<boolean>
  tabContextMenu: Ref<FlowTabContextMenuState>
  tabContextMenuRef: Ref<HTMLElement | null>
}

interface UseFlowTabMenuReturn {
  cancelExportSave: () => void
  clampTabContextMenuPosition: () => void
  confirmExportSave: () => Promise<void>
  confirmRename: () => Promise<void>
  exportWithoutSave: () => Promise<void>
  hideTabContextMenu: () => void
  onTabExport: () => Promise<void>
  onTabImport: () => void
  onTabRename: () => void
  pendingExportTabId: Ref<string | null>
  renameValue: Ref<string>
  requestExportSave: (tabId: string) => void
  showExportSaveModal: Ref<boolean>
  showRenameModal: Ref<boolean>
  showTabContextMenu: (event: MouseEvent, tabId: string) => void
  tabContextMenu: Ref<FlowTabContextMenuState>
  tabContextMenuRef: Ref<HTMLElement | null>
}

function clampMenuPosition(context: FlowTabMenuContext): void {
  const menuElement = context.tabContextMenuRef.value
  if (!(menuElement instanceof HTMLElement) || !context.tabContextMenu.value.visible) return
  const margin = 8
  const rect = menuElement.getBoundingClientRect()
  const { x, y } = context.tabContextMenu.value
  const preferredX = x + rect.width + margin > window.innerWidth ? x - rect.width : x
  const preferredY = y + rect.height + margin > window.innerHeight ? y - rect.height : y
  context.tabContextMenu.value = {
    ...context.tabContextMenu.value,
    x: Math.min(Math.max(preferredX, margin), Math.max(margin, window.innerWidth - rect.width - margin)),
    y: Math.min(Math.max(preferredY, margin), Math.max(margin, window.innerHeight - rect.height - margin)),
  }
}

function hideMenu(context: FlowTabMenuContext): void {
  context.tabContextMenu.value.visible = false
}

function showMenu(context: FlowTabMenuContext, event: MouseEvent, tabId: string): void {
  event.preventDefault()
  context.tabContextMenu.value = { visible: true, x: event.clientX, y: event.clientY, tabId }
  nextTick(() => clampMenuPosition(context))
}

function handlePointerDown(context: FlowTabMenuContext, event: PointerEvent): void {
  if (!context.tabContextMenu.value.visible) return
  const menuElement = context.tabContextMenuRef.value
  if (menuElement instanceof HTMLElement && event.target instanceof Node && menuElement.contains(event.target)) return
  hideMenu(context)
}

async function confirmRename(context: FlowTabMenuContext): Promise<void> {
  if (context.renamePending.value) return
  const tab = workflowTabs.value.find((item) => item.id === context.tabContextMenu.value.tabId)
  const name = normalizeFlowCanvasName(context.renameValue.value)
  if (!tab || !name) return
  const nameChanged = name !== tab.name
  if (nameChanged && tab.workflowId) {
    context.renamePending.value = true
    try {
      await updateWorkflowAsset(String(tab.workflowId), name)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '画布名称更新失败')
      return
    } finally {
      context.renamePending.value = false
    }
  }
  if (nameChanged) {
    tab.name = name
    if (tab.id === activeTabId.value) activeWorkflowName.value = name
    await context.saveTabs()
    ElMessage.success('画布名称更新成功')
  }
  context.showRenameModal.value = false
  context.renameValue.value = ''
}

function cancelExport(context: FlowTabMenuContext): void {
  context.showExportSaveModal.value = false
  context.pendingExportTabId.value = null
}

async function confirmExport(context: FlowTabMenuContext): Promise<void> {
  const tabId = context.pendingExportTabId.value || activeTabId.value
  const tab = workflowTabs.value.find((item) => item.id === tabId)
    || workflowTabs.value.find((item) => item.id === activeTabId.value)
  if (!tab) return cancelExport(context)
  cancelExport(context)
  if (tab.id === activeTabId.value) {
    const saved = await context.deps.onSave()
    if (!saved) return
  } else {
    await context.saveTabs()
  }
  await context.deps.exportJSON(tab.id, { skipUnsavedPrompt: true })
}

/**
 * 管理工作流标签右键菜单、重命名与导出弹窗。
 * @param options 标签菜单依赖
 * @returns 菜单状态与操作
 */
export function useFlowTabMenu(options: UseFlowTabMenuOptions): UseFlowTabMenuReturn {
  const context: FlowTabMenuContext = {
    ...options,
    pendingExportTabId: ref<string | null>(null),
    renamePending: ref(false),
    renameValue: ref(''),
    showExportSaveModal: ref(false),
    showRenameModal: ref(false),
    tabContextMenu: ref({ visible: false, x: 0, y: 0, tabId: null }),
    tabContextMenuRef: ref<HTMLElement | null>(null),
  }
  const handleResize = (): void => clampMenuPosition(context)
  const handleGlobalPointerDown = (event: PointerEvent): void => handlePointerDown(context, event)
  onMounted(() => {
    window.addEventListener('pointerdown', handleGlobalPointerDown, true)
    window.addEventListener('resize', handleResize)
  })
  onUnmounted(() => {
    window.removeEventListener('pointerdown', handleGlobalPointerDown, true)
    window.removeEventListener('resize', handleResize)
  })
  return {
    cancelExportSave: () => cancelExport(context),
    clampTabContextMenuPosition: () => clampMenuPosition(context),
    confirmExportSave: () => confirmExport(context),
    confirmRename: () => confirmRename(context),
    exportWithoutSave: async () => {
      const tabId = context.pendingExportTabId.value || activeTabId.value
      cancelExport(context)
      await options.deps.exportJSON(tabId, { skipUnsavedPrompt: true })
    },
    hideTabContextMenu: () => hideMenu(context),
    onTabExport: async () => {
      const tabId = context.tabContextMenu.value.tabId || activeTabId.value
      hideMenu(context)
      await options.deps.exportJSON(tabId)
    },
    onTabImport: () => { hideMenu(context); options.deps.triggerImport() },
    onTabRename: () => {
      hideMenu(context)
      const tabId = context.tabContextMenu.value.tabId || activeTabId.value
      context.tabContextMenu.value.tabId = tabId
      const tab = workflowTabs.value.find((item) => item.id === tabId)
      if (!tab) return
      context.renameValue.value = tab.name
      context.showRenameModal.value = true
    },
    pendingExportTabId: context.pendingExportTabId,
    renameValue: context.renameValue,
    requestExportSave: (tabId) => {
      context.pendingExportTabId.value = tabId
      context.showExportSaveModal.value = true
    },
    showExportSaveModal: context.showExportSaveModal,
    showRenameModal: context.showRenameModal,
    showTabContextMenu: (event, tabId) => showMenu(context, event, tabId),
    tabContextMenu: context.tabContextMenu,
    tabContextMenuRef: context.tabContextMenuRef,
  }
}
