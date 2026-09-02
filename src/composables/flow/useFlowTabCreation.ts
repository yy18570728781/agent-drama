import type { Ref } from 'vue'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import { nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { WorkflowRecord } from '@/services/flow/workflow.service'
import {
  canvasRef,
  activeWorkflowId,
  activeWorkflowName,
  workflowTabs,
  activeTabId,
} from './useFlowCore'
import { upsertWorkflowTab } from './flowTabCollection'
import { buildDraftWorkflowTab, createCanvasTab } from './flowTabCreationController'
import {
  normalizeFlowCanvasName,
  normalizeFlowFileName,
  REQUIRED_FLOW_FILE_NAME_MESSAGE,
} from './flowNameValidation'
import type {
  UseFlowTabCreationDeps,
  UseFlowTabCreationReturn,
  WorkflowImportDefinition,
} from './flowRuntime.types'

function focusNewWorkflowInput(inputRef: Ref<{ focus?: () => void } | null>): void {
  nextTick(() => inputRef.value?.focus?.())
}

function ensureWorkflowName(name: string, inputRef: Ref<{ focus?: () => void } | null>): boolean {
  if (name) return true
  ElMessage.warning(REQUIRED_FLOW_FILE_NAME_MESSAGE)
  focusNewWorkflowInput(inputRef)
  return false
}

function findRemoteWorkflowByName(
  workflows: WorkflowRecord[] | undefined,
  name: string,
): WorkflowRecord | undefined {
  return (workflows || []).find((workflow) => normalizeFlowFileName(workflow.name) === name)
}

async function confirmOverwriteImport(name: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      `工作流"${name}"已存在，是否覆盖原工作流？`,
      '导入工作流',
      {
        type: 'warning',
        confirmButtonText: '覆盖',
        cancelButtonText: '取消',
        distinguishCancelAndClose: true,
      },
    )
    return true
  } catch {
    return false
  }
}

async function persistWorkflowImmediately(
  deps: UseFlowTabCreationDeps,
  modalVisible: Ref<boolean>,
): Promise<void> {
  await deps.saveDraft()
  await deps.saveTabs()
  const saveResult = await deps.onSave()
  if (saveResult === false) return
  modalVisible.value = false
}

/**
 * 把新建工作流弹窗与提交逻辑独立出去，避免继续膨胀标签页总控文件。
 * @param deps 新建工作流依赖集合
 * @returns 新建工作流弹窗状态与动作
 */
export function useFlowTabCreation(deps: UseFlowTabCreationDeps): UseFlowTabCreationReturn {
  const showNewWfModal = ref(false)
  const newWfName = ref('')
  const newWfInputRef = ref<{ focus?: () => void } | null>(null)
  const newWfModalTitle = ref('新建工作流')
  const pendingJsonImportData = ref<WorkflowImportDefinition | null>(null)
  const isCreatingCanvas = ref(false)

  function addNewTab(): void {
    newWfName.value = ''
    pendingJsonImportData.value = null
    newWfModalTitle.value = '新建工作流'
    showNewWfModal.value = true
    focusNewWorkflowInput(newWfInputRef)
  }

  function cancelNewWf(): void {
    showNewWfModal.value = false
    pendingJsonImportData.value = null
  }

  async function createTabAndImportJson(
    parsed: WorkflowImportDefinition,
    name: string,
    existingWorkflowId = '',
  ): Promise<void> {
    const newTab = buildDraftWorkflowTab(name)
    newTab.viewport = parsed.viewport || { zoom: 1, x: 0, y: 0 }
    await deps.saveTabs()
    workflowTabs.value = upsertWorkflowTab(workflowTabs.value, newTab)
    activeTabId.value = newTab.id
    activeWorkflowId.value = existingWorkflowId
    activeWorkflowName.value = name
    await deps.loadDefinition(parsed)

    if (parsed.viewport) {
      const viewport = parsed.viewport
      nextTick(() => {
        void canvasRef.value?.setViewport?.(viewport)
      })
    }

    await persistWorkflowImmediately(deps, showNewWfModal)
  }

  async function confirmNewWf(draft?: FlowCanvasCreateDraft): Promise<void> {
    const name = normalizeFlowCanvasName(draft?.name ?? newWfName.value)
    if (!ensureWorkflowName(name, newWfInputRef)) return

    if (pendingJsonImportData.value) {
      const parsed = pendingJsonImportData.value
      const existingRemoteWorkflow = findRemoteWorkflowByName(deps.workflows?.value, name)
      if (existingRemoteWorkflow) {
        const shouldOverwrite = await confirmOverwriteImport(name)
        if (!shouldOverwrite) {
          focusNewWorkflowInput(newWfInputRef)
          return
        }
        pendingJsonImportData.value = null
        void createTabAndImportJson(parsed, name, String(existingRemoteWorkflow.id || ''))
        return
      }
      pendingJsonImportData.value = null
      void createTabAndImportJson(parsed, name)
      return
    }

    const existingRemoteWorkflow = findRemoteWorkflowByName(deps.workflows?.value, name)
    if (existingRemoteWorkflow) {
      ElMessage.warning(`工作流"${name}"已存在，请换一个名称`)
      focusNewWorkflowInput(newWfInputRef)
      return
    }

    const existing = workflowTabs.value.find((tab) => tab.name === name)
    if (existing) {
      await deps.switchTab(existing.id)
      showNewWfModal.value = false
      return
    }

    if (draft) {
      if (isCreatingCanvas.value) return
      isCreatingCanvas.value = true
      try {
        await createCanvasTab(deps, draft, name)
        showNewWfModal.value = false
        ElMessage.success('画布创建成功')
      } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '画布创建失败')
      } finally {
        isCreatingCanvas.value = false
      }
      return
    }

    const newTab = buildDraftWorkflowTab(name)
    await deps.saveTabs()
    workflowTabs.value = upsertWorkflowTab(workflowTabs.value, newTab)
    activeTabId.value = newTab.id
    activeWorkflowId.value = ''
    activeWorkflowName.value = name
    await deps.loadDefinition({
      nodes: [],
      edges: [],
      viewport: { zoom: 1, x: 0, y: 0 },
      subgraphs: {},
    })
    await persistWorkflowImmediately(deps, showNewWfModal)
  }

  return {
    showNewWfModal,
    newWfName,
    newWfInputRef,
    newWfModalTitle,
    pendingJsonImportData,
    addNewTab,
    cancelNewWf,
    confirmNewWf,
    createTabAndImportJson,
  }
}
