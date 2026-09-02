import type { Ref } from 'vue'
import type GeneratorPromptWorkspace from '@/components/generation/GeneratorPromptWorkspace.vue'
import { getAllModels, type BackendModelInfo } from '@/api/models'
import { getModeId } from '@/utils/modeLabels'
import type { useModeManager } from './useModeManager'
import type { useReferenceManager } from './useReferenceManager'

type PromptWorkspaceInstance = InstanceType<typeof GeneratorPromptWorkspace>

interface UseGeneratorExternalActionsOptions {
  contextMenu: ReturnType<typeof useReferenceManager>['contextMenu']
  isExpanded: Ref<boolean>
  isTextExpanded: Ref<boolean>
  mode: ReturnType<typeof useModeManager>
  prompt: Ref<string>
  workspaceRef: Ref<PromptWorkspaceInstance | null>
}

interface UseGeneratorExternalActionsReturn {
  closeFloatingOverlays: () => void
  collapsePanel: () => void
  decodeHTMLEntities: (text: string) => string
  setPrompt: (text: string) => void
  setupFromToolCall: (capability: string, modeId: string, text: string) => Promise<void>
  toggleTextExpanded: () => void
}

function supportsMode(model: BackendModelInfo, modeId: string): boolean {
  return Array.isArray(model.modes)
    && model.modes.some((candidate: unknown) => getModeId(candidate) === modeId)
}

/**
 * 提供 GeneratorInput 对外公开的文本、面板与工具调用动作。
 * @param options 模型控制器、提示词工作区和浮层状态。
 * @returns 可安全暴露给父组件的稳定动作集合。
 */
export function useGeneratorExternalActions(
  options: UseGeneratorExternalActionsOptions,
): UseGeneratorExternalActionsReturn {
  function decodeHTMLEntities(text: string): string {
    if (!text || !text.includes('&')) return text
    const decoder = document.createElement('textarea')
    decoder.innerHTML = text
    return decoder.value
  }

  function setPrompt(text: string): void {
    const decoded = decodeHTMLEntities(text)
    options.prompt.value = decoded
    options.workspaceRef.value?.setPromptInEditor(decoded)
  }

  async function setupFromToolCall(capability: string, modeId: string, text: string): Promise<void> {
    options.mode.selectedCapability.value = capability
    options.isExpanded.value = true
    try {
      const response = await getAllModels('generations', [capability])
      const models = response.models || []
      const selected = models.find((model) => supportsMode(model, modeId)) || models[0]
      if (selected) await options.mode.onModelSelect({ model: selected, capability, mode: modeId })
    } catch (error: unknown) {
      console.warn('[setupFromToolCall] 加载模型失败', error)
    }
    setPrompt(text)
  }

  function toggleTextExpanded(): void {
    options.isTextExpanded.value = !options.isTextExpanded.value
  }

  function collapsePanel(): void {
    options.isExpanded.value = false
  }

  function closeFloatingOverlays(): void {
    options.contextMenu.value.visible = false
    options.workspaceRef.value?.closePromptMenu()
  }

  return {
    closeFloatingOverlays,
    collapsePanel,
    decodeHTMLEntities,
    setPrompt,
    setupFromToolCall,
    toggleTextExpanded,
  }
}
