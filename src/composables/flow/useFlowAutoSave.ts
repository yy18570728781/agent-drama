import { ElMessage } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { updateWorkflow } from '@/services/flow/workflow.service'
import type { PersistedWorkflowDefinition } from './flowCore.types'

interface AutoSaveContext {
  requestedWorkflowId: string
  savedWorkflowId: string
}

interface UseFlowAutoSaveOptions {
  activeWorkflowId: Ref<string>
  buildDraftDefinition: () => unknown
  getChangeToken: () => unknown
  getDraftName: () => string
  getHasUnsavedChanges: () => boolean
  normalizeWorkflowDefinition: (definition: unknown) => PersistedWorkflowDefinition
  onSaved: (
    definition: PersistedWorkflowDefinition,
    context: AutoSaveContext,
  ) => Promise<void> | void
}

interface UseFlowAutoSaveReturn {
  resetRemoteDraftHash: () => void
  saveRemoteDraftNow: (showSuccess?: boolean) => Promise<boolean>
  saveState: Ref<FlowAutoSaveState>
}

interface RemoteDraftSnapshot {
  definition: PersistedWorkflowDefinition
  hash: string
  name: string
  workflowId: string
}

export type FlowAutoSaveState = 'error' | 'idle' | 'saving' | 'saved'

const AUTO_SAVE_IDLE_MS = 1_800
const AUTO_SAVE_IDLE_TIMEOUT_MS = 1_200
const AUTO_SAVE_INTERVAL_MS = 30 * 1000
const AUTO_SAVE_RETRY_MS = 2 * 1000

class FlowAutoSaveController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private idleCallbackId: number | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastDraftHash = ''
  private lastWorkflowId = ''
  private saveInFlight = false
  private saveQueued = false
  private disposed = false
  private hasShownError = false

  readonly saveState: Ref<FlowAutoSaveState>

  constructor(private readonly options: UseFlowAutoSaveOptions) {
    this.saveState = ref(options.getHasUnsavedChanges() ? 'idle' : 'saved')
  }

  resetRemoteDraftHash(): void {
    this.lastWorkflowId = ''
    this.lastDraftHash = ''
  }

  schedule(delay = AUTO_SAVE_IDLE_MS): void {
    this.clearScheduledSave()
    if (this.disposed || !this.options.activeWorkflowId.value) return
    if (!this.options.getHasUnsavedChanges()) return
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.runWhenIdle()
    }, delay)
  }

  async saveNow(showSuccess = false): Promise<boolean> {
    this.clearScheduledSave()
    if (this.saveInFlight) {
      this.saveQueued = true
      return false
    }
    const snapshot = this.buildSnapshot()
    if (!snapshot) return false
    if (snapshot.workflowId !== this.lastWorkflowId) this.resetRemoteDraftHash()
    if (snapshot.hash === this.lastDraftHash) return false

    this.saveInFlight = true
    this.saveState.value = 'saving'
    try {
      await this.persist(snapshot)
      this.hasShownError = false
      this.saveState.value = this.options.getHasUnsavedChanges() ? 'idle' : 'saved'
      if (showSuccess) ElMessage.success('画布已自动保存')
      return true
    } catch (error) {
      this.handleSaveError(error)
      if (!this.disposed) this.schedule(AUTO_SAVE_RETRY_MS)
      return false
    } finally {
      this.finishSaveAttempt()
    }
  }

  start(): void {
    this.intervalId = setInterval(() => void this.saveNow(), AUTO_SAVE_INTERVAL_MS)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('pagehide', this.handlePageHide)
  }

  dispose(): void {
    this.disposed = true
    this.clearScheduledSave()
    if (this.intervalId) clearInterval(this.intervalId)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('pagehide', this.handlePageHide)
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void this.saveNow()
  }

  private readonly handlePageHide = (): void => {
    void this.saveNow()
  }

  private buildSnapshot(): RemoteDraftSnapshot | null {
    const workflowId = String(this.options.activeWorkflowId.value || '').trim()
    if (!workflowId || !this.options.getHasUnsavedChanges()) return null
    const definition = this.options.normalizeWorkflowDefinition(
      this.options.buildDraftDefinition(),
    )
    const hash = JSON.stringify(definition)
    if (!hash) return null
    return {
      definition,
      hash,
      name: this.options.getDraftName() || '工作流',
      workflowId,
    }
  }

  private async persist(snapshot: RemoteDraftSnapshot): Promise<void> {
    const savedWorkflow = await updateWorkflow(snapshot.workflowId, {
      name: snapshot.name,
      definition: snapshot.definition,
      historyLabel: '自动保存',
      historyType: 'automatic',
    })
    const savedWorkflowId = String(savedWorkflow?.id || snapshot.workflowId).trim()
    if (String(this.options.activeWorkflowId.value).trim() === snapshot.workflowId) {
      this.options.activeWorkflowId.value = savedWorkflowId
    }
    await this.options.onSaved(snapshot.definition, {
      requestedWorkflowId: snapshot.workflowId,
      savedWorkflowId,
    })
    this.lastWorkflowId = savedWorkflowId
    this.lastDraftHash = snapshot.hash
  }

  private clearScheduledSave(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.idleCallbackId !== null) window.cancelIdleCallback(this.idleCallbackId)
    this.debounceTimer = null
    this.idleCallbackId = null
  }

  private runWhenIdle(): void {
    if (typeof window.requestIdleCallback !== 'function') {
      void this.saveNow()
      return
    }
    this.idleCallbackId = window.requestIdleCallback(() => {
      this.idleCallbackId = null
      void this.saveNow()
    }, { timeout: AUTO_SAVE_IDLE_TIMEOUT_MS })
  }

  private finishSaveAttempt(): void {
    this.saveInFlight = false
    if (!this.saveQueued || this.disposed) return
    this.saveQueued = false
    this.schedule(0)
  }

  private handleSaveError(error: unknown): void {
    console.error('自动保存画布失败:', error)
    this.saveState.value = 'error'
    if (this.hasShownError) return
    this.hasShownError = true
    ElMessage.warning('自动保存画布失败，请稍后重试')
  }
}

/**
 * 在编辑停顿、定时兜底、页面隐藏和路由离开时保存未提交的画布。
 * @param options 自动保存所需的画布状态与持久化回调。
 * @returns 可供外部主动保存或重置快照去重状态的方法。
 * @throws 不主动抛出异常，失败时通过返回值和提示反馈。
 */
export function useFlowAutoSave(options: UseFlowAutoSaveOptions): UseFlowAutoSaveReturn {
  const controller = new FlowAutoSaveController(options)

  watch(
    () => options.activeWorkflowId.value,
    () => {
      controller.resetRemoteDraftHash()
      controller.schedule()
    },
    { flush: 'sync' },
  )
  watch(
    [() => options.getChangeToken(), () => options.getHasUnsavedChanges()],
    ([, hasUnsavedChanges]) => {
      if (!hasUnsavedChanges) controller.resetRemoteDraftHash()
      if (controller.saveState.value !== 'saving') {
        controller.saveState.value = hasUnsavedChanges ? 'idle' : 'saved'
      }
      controller.schedule()
    },
    { flush: 'post' },
  )

  onBeforeRouteLeave(async () => {
    await controller.saveNow()
  })
  onMounted(() => controller.start())
  onUnmounted(() => controller.dispose())

  return {
    resetRemoteDraftHash: () => controller.resetRemoteDraftHash(),
    saveRemoteDraftNow: (showSuccess) => controller.saveNow(showSuccess),
    saveState: controller.saveState,
  }
}
