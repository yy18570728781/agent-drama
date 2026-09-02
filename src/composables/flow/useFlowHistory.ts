import type { ComputedRef, Ref } from 'vue'
import type { FlowCanvasHistoryVersion } from '@/services/flow/flowCanvasHistory.types'
import type { WorkflowDefinition } from './flowCore.types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref, watch } from 'vue'
import {
  listFlowCanvasHistoryVersions,
  loadFlowCanvasHistoryVersion,
  resolveFlowCanvasHistoryAssetCode,
} from '@/services/flow/flowCanvasHistory.service'
import { updateWorkflow } from '@/services/flow/workflow.service'

interface UseFlowHistoryOptions {
  activeWorkflowId: Ref<string>
  activeWorkflowName: ComputedRef<string>
  hasUnsavedChanges: Ref<boolean>
  hydrateWorkflowDefinition: (definition: unknown) => WorkflowDefinition
}

interface UseFlowHistoryReturn {
  closeHistory: () => void
  historyLoading: Ref<boolean>
  historyVisible: Ref<boolean>
  historyVersions: Ref<FlowCanvasHistoryVersion[]>
  previewDefinition: Ref<WorkflowDefinition | null>
  previewError: Ref<string>
  previewLoading: Ref<boolean>
  previewVersion: Ref<FlowCanvasHistoryVersion | null>
  openHistory: () => Promise<void>
  refreshHistory: () => Promise<void>
  restoreHistory: (revision: number) => Promise<void>
  restoringRevision: Ref<number | null>
  selectedRevision: Ref<number | null>
  selectHistory: (revision: number) => Promise<void>
}

interface FlowHistoryState {
  historyLoading: Ref<boolean>
  historyVersions: Ref<FlowCanvasHistoryVersion[]>
  historyVisible: Ref<boolean>
  previewDefinition: Ref<WorkflowDefinition | null>
  previewError: Ref<string>
  previewLoading: Ref<boolean>
  previewVersion: Ref<FlowCanvasHistoryVersion | null>
  restoringRevision: Ref<number | null>
  selectedRevision: Ref<number | null>
}

function createHistoryState(): FlowHistoryState {
  return {
    historyLoading: ref(false),
    historyVersions: ref<FlowCanvasHistoryVersion[]>([]),
    historyVisible: ref(false),
    previewDefinition: ref<WorkflowDefinition | null>(null),
    previewError: ref(''),
    previewLoading: ref(false),
    previewVersion: ref<FlowCanvasHistoryVersion | null>(null),
    restoringRevision: ref<number | null>(null),
    selectedRevision: ref<number | null>(null),
  }
}

function createHistoryLoader(
  options: UseFlowHistoryOptions,
  state: FlowHistoryState,
): () => Promise<void> {
  return async () => {
    const workflowId = options.activeWorkflowId.value.trim()
    if (!workflowId) return
    state.historyLoading.value = true
    try {
      const assetCode = await resolveFlowCanvasHistoryAssetCode(workflowId)
      state.historyVersions.value = await listFlowCanvasHistoryVersions(assetCode)
      state.selectedRevision.value = null
    } catch (error) {
      state.historyVersions.value = []
      ElMessage.error(error instanceof Error ? error.message : '历史记录加载失败')
    } finally {
      state.historyLoading.value = false
    }
  }
}

function createHistoryPreviewController(
  options: UseFlowHistoryOptions,
  state: FlowHistoryState,
): { closePreview: () => void; selectHistory: (revision: number) => Promise<void> } {
  let requestId = 0
  const closePreview = (): void => {
    requestId += 1
    state.previewDefinition.value = null
    state.previewVersion.value = null
    state.previewError.value = ''
    state.previewLoading.value = false
    state.selectedRevision.value = null
  }
  const selectHistory = async (revision: number): Promise<void> => {
    const version = state.historyVersions.value.find((item) => item.revision === revision)
    if (!version) return
    const currentRequestId = ++requestId
    state.selectedRevision.value = revision
    state.previewError.value = ''
    state.previewLoading.value = true
    try {
      const rawDefinition = await loadFlowCanvasHistoryVersion(version)
      if (currentRequestId !== requestId) return
      state.previewDefinition.value = options.hydrateWorkflowDefinition(rawDefinition)
      state.previewVersion.value = version
    } catch (error) {
      if (currentRequestId !== requestId) return
      state.previewDefinition.value = null
      state.previewVersion.value = null
      state.previewError.value = error instanceof Error ? error.message : '版本预览加载失败'
    } finally {
      if (currentRequestId === requestId) state.previewLoading.value = false
    }
  }
  return { closePreview, selectHistory }
}

function createHistoryOpener(
  options: UseFlowHistoryOptions,
  state: FlowHistoryState,
  refreshHistory: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    if (!options.activeWorkflowId.value.trim()) {
      ElMessage.info('请先保存当前画布，再查看历史记录')
      return
    }
    if (state.historyVisible.value) return
    state.historyVisible.value = true
    await refreshHistory()
  }
}

function createHistoryRestorer(
  options: UseFlowHistoryOptions,
  state: FlowHistoryState,
): (revision: number) => Promise<void> {
  return async (revision: number) => {
    const workflowId = options.activeWorkflowId.value.trim()
    const version = state.historyVersions.value.find((item) => item.revision === revision)
    if (!workflowId || !version || revision === state.historyVersions.value[0]?.revision) return
    try {
      const unsavedNotice = options.hasUnsavedChanges.value ? '当前未保存更改将丢失；' : ''
      await ElMessageBox.confirm(
        `${unsavedNotice}确定还原到历史版本 r${revision} 吗？当前已保存版本仍会保留在历史记录中。`,
        '还原历史版本',
        { type: 'warning', confirmButtonText: '还原', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
    state.restoringRevision.value = revision
    try {
      const definition = await loadFlowCanvasHistoryVersion(version)
      await updateWorkflow(workflowId, {
        definition,
        historyLabel: `还原自 r${revision}`,
        historyType: 'restore',
        name: options.activeWorkflowName.value,
      })
      ElMessage.success('历史版本已还原')
      window.location.reload()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '历史版本还原失败')
    } finally {
      state.restoringRevision.value = null
    }
  }
}

/**
 * 管理画布历史记录抽屉，并将选中的 COS 快照还原到远端画布。
 * @param options 当前画布 ID 与显示名称。
 * @returns 历史列表、抽屉状态及还原操作。
 */
export function useFlowHistory(options: UseFlowHistoryOptions): UseFlowHistoryReturn {
  const state = createHistoryState()
  const refreshHistory = createHistoryLoader(options, state)
  const openHistory = createHistoryOpener(options, state, refreshHistory)
  const restoreHistory = createHistoryRestorer(options, state)
  const preview = createHistoryPreviewController(options, state)
  const closeHistory = (): void => {
    if (state.restoringRevision.value !== null) return
    state.historyVisible.value = false
    preview.closePreview()
  }

  watch(options.activeWorkflowId, () => {
    state.historyVisible.value = false
    state.historyVersions.value = []
    preview.closePreview()
  })

  return {
    closeHistory,
    historyLoading: state.historyLoading,
    historyVisible: state.historyVisible,
    historyVersions: state.historyVersions,
    previewDefinition: state.previewDefinition,
    previewError: state.previewError,
    previewLoading: state.previewLoading,
    previewVersion: state.previewVersion,
    openHistory,
    refreshHistory,
    restoreHistory,
    restoringRevision: state.restoringRevision,
    selectedRevision: state.selectedRevision,
    selectHistory: preview.selectHistory,
  }
}
