/**
 * useExposedActions — extracts defineExpose-visible operations from GeneratorInput.vue
 *
 * Moves ~103 lines of action helpers (setPrompt, setupFromToolCall, toggleTextExpanded,
 * collapsePanel, closeFloatingOverlays) into a composable so the .vue can simply
 * spread `...exposedActions` in defineExpose.
 */
import type { Ref } from 'vue'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'

// ── Options ───────────────────────────────────────────────────
export interface UseExposedActionsOptions {
  prompt: Ref<string>
  isExpanded: Ref<boolean>
  isTextExpanded: Ref<boolean>
  selectedCapability: Ref<string>
  promptInputRef: Ref<any>
  contextMenu: Ref<{ visible: boolean; x: number; y: number; index: number }>
  /** onModelSelect from useModeManager */
  onModelSelect: (data: {
    model: BackendModelInfo
    capability?: string
    mode?: string
    modes?: any[]
    params?: ModelParamSchema[]
  }) => Promise<void>
  /** getAllModels from api/models */
  getAllModels: typeof import('@/api/models').getAllModels
}

// ── Composable ────────────────────────────────────────────────
export function useExposedActions(options: UseExposedActionsOptions) {
  const {
    prompt,
    isExpanded,
    isTextExpanded,
    selectedCapability,
    promptInputRef,
    contextMenu,
    onModelSelect,
    getAllModels,
  } = options

  // ── Utility ────────────────────────────────────────────
  function decodeHTMLEntities(text: string): string {
    if (!text || !text.includes('&')) return text
    const el = document.createElement('textarea')
    el.innerHTML = text
    return el.value
  }

  // ── setPrompt ──────────────────────────────────────────
  const setPrompt = (newPrompt: string) => {
    prompt.value = decodeHTMLEntities(newPrompt)
    if (promptInputRef.value) {
      promptInputRef.value.setPrompt(newPrompt)
    }
  }

  // ── setupFromToolCall ─────────────────────────────────
  const setupFromToolCall = async (capability: string, mode: string, text: string) => {
    selectedCapability.value = capability
    isExpanded.value = true

    try {
      const res = await getAllModels('generations', [capability])
      const list: BackendModelInfo[] = res.models || []
      const modeModel = list.find(m => m.modes?.some((md: any) => md.id === mode))
      const picked = modeModel || list[0]
      if (picked) {
        await onModelSelect({ model: picked, capability, mode })
      }
    } catch (e) {
      console.warn('[setupFromToolCall] 加载模型失败', e)
    }

    setPrompt(text)
  }

  // ── UI toggles ─────────────────────────────────────────
  function toggleTextExpanded() {
    isTextExpanded.value = !isTextExpanded.value
  }

  function collapsePanel() {
    isExpanded.value = false
  }

  function closeFloatingOverlays() {
    contextMenu.value.visible = false
    promptInputRef.value?.closeReferenceMenu?.()
  }

  return {
    decodeHTMLEntities,
    setPrompt,
    setupFromToolCall,
    toggleTextExpanded,
    collapsePanel,
    closeFloatingOverlays,
  }
}
