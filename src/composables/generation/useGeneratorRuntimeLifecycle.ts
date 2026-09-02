import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { useClipboardPaste } from '@/composables/useClipboardPaste'
import type { useGeneratorExternalActions } from './useGeneratorExternalActions'
import type { useGeneratorPoints } from './useGeneratorPoints'
import type { useGeneratorSubmissionController } from './useGeneratorSubmissionController'
import type { useGeneratorWorkspaceController } from './useGeneratorWorkspaceController'
import type { useModeManager } from './useModeManager'
import type { GeneratorInputProps } from '@/components/generation/generatorInput.types'

interface UseGeneratorRuntimeLifecycleOptions {
  actions: ReturnType<typeof useGeneratorExternalActions>
  clipboard: ReturnType<typeof useClipboardPaste>
  mode: ReturnType<typeof useModeManager>
  points: ReturnType<typeof useGeneratorPoints>
  props: GeneratorInputProps
  submission: ReturnType<typeof useGeneratorSubmissionController>
  workspace: ReturnType<typeof useGeneratorWorkspaceController>
}

interface UseGeneratorRuntimeLifecycleReturn {
  resetForRestore: (capability?: string | null) => void
  restoreState: (data: Record<string, unknown>) => Promise<void>
}

/**
 * 装配生成器的挂载清理、恢复流程与展开聚焦行为。
 * @param options 已初始化的运行时能力。
 * @returns 对外恢复与重置动作。
 */
export function useGeneratorRuntimeLifecycle(
  options: UseGeneratorRuntimeLifecycleOptions,
): UseGeneratorRuntimeLifecycleReturn {
  async function restoreState(data: Record<string, unknown>): Promise<void> {
    options.points.setUiRememberRestoring(true)
    try {
      await options.workspace.persistence.restoreState(data)
    } finally {
      options.points.setUiRememberRestoring(false)
    }
  }

  function resetForRestore(capability?: string | null): void {
    options.mode.resetForRestore(capability)
    options.workspace.reference.manager.refImages.value = []
    options.actions.setPrompt('')
  }

  onMounted(() => {
    options.clipboard.attach()
    if (options.props.skipUIRemember) return
    options.points.setUiRememberRestoring(true)
    void options.workspace.persistence.loadRememberedState()
      .finally(() => options.points.setUiRememberRestoring(false))
  })

  onUnmounted(() => {
    options.clipboard.detach()
    options.actions.closeFloatingOverlays()
    options.submission.dispatch.destroySSE()
  })

  watch(options.workspace.isExpanded, async (expanded) => {
    if (!expanded) return
    await nextTick()
    options.workspace.workspaceRef.value?.focusPrompt()
  })

  return { resetForRestore, restoreState }
}
