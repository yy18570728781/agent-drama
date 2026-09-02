import { watch, type Ref } from 'vue'

const AUTO_EXPAND_ROW_THRESHOLD = 3

export interface UseMultilineBatchPanelOptions {
  multilineBatchMode: Ref<boolean>
  multilinePromptRows: Ref<Array<{ id: string }>>
  smartMultiFrameEnabled: Ref<boolean>
  isTextExpanded: Ref<boolean>
  setSmartMultiFrameEnabled: (enabled: boolean) => void
  resetMultilinePromptRows: () => void
}

/**
 * Manages multiline prompt panel interactions without growing GeneratorInput.vue further.
 *
 * @param options Reactive panel state and callbacks shared with GeneratorInput.
 * @returns Handlers for toggling multiline mode and clearing all multiline rows.
 * @throws Does not throw directly; downstream callbacks may enforce their own constraints.
 */
export function useMultilineBatchPanel(options: UseMultilineBatchPanelOptions): {
  toggleMultilineBatchMode: () => void
  clearAllMultilinePromptRows: () => void
} {
  const {
    multilineBatchMode,
    multilinePromptRows,
    smartMultiFrameEnabled,
    isTextExpanded,
    setSmartMultiFrameEnabled,
    resetMultilinePromptRows,
  } = options

  watch(smartMultiFrameEnabled, (enabled) => {
    if (enabled) multilineBatchMode.value = false
  })

  watch(multilineBatchMode, (enabled) => {
    if (enabled) setSmartMultiFrameEnabled(false)
  })

  watch(
    () => multilinePromptRows.value.length,
    (count) => {
      if (multilineBatchMode.value && count >= AUTO_EXPAND_ROW_THRESHOLD) {
        isTextExpanded.value = true
      }
    },
  )

  function toggleMultilineBatchMode(): void {
    const nextValue = !multilineBatchMode.value
    if (nextValue) setSmartMultiFrameEnabled(false)
    multilineBatchMode.value = nextValue
  }

  function clearAllMultilinePromptRows(): void {
    resetMultilinePromptRows()
  }

  return {
    toggleMultilineBatchMode,
    clearAllMultilinePromptRows,
  }
}
