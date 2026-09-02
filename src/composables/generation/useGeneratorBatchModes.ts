import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import { clearCurrentBatchId } from './useTextureBatchMeta'
import { useMultilineBatchPanel } from '@/components/generation/useMultilineBatchPanel'
import { useMultilinePromptReferences } from '@/components/generation/useMultilinePromptReferences'
import { useSmartMultiFrame } from '@/components/generation/useSmartMultiFrame'
import type { ModelParamSchema } from '@/api/models'
import type { ReferenceImage } from './useReferenceManager'
import type { PBRChannel } from '@/types/pbr.types'

interface UseGeneratorBatchModesOptions {
  fileParamDef: ComputedRef<ModelParamSchema | null>
  isTextExpanded: Ref<boolean>
  modelParams: Ref<ModelParamSchema[]>
  multilineBatchMode: Ref<boolean>
  onModeRowStateChange: (multiline: boolean, smart: boolean) => void
  paramValues: Ref<Record<string, unknown>>
  prompt: Ref<string>
  refImages: Ref<ReferenceImage[]>
  selectedMode: Ref<string>
  setPromptInEditor: (text: string) => void
  smartMultiFrameEnabled: Ref<boolean>
}

interface UseGeneratorBatchModesReturn {
  clearAllMultilinePromptRows: () => void
  multiline: ReturnType<typeof useMultilinePromptReferences>
  multilinePrompts: ComputedRef<string[]>
  onApplyPreset: (payload: { content: string; channel?: PBRChannel }) => void
  onApplyPresetBatch: (texts: string[], channels?: PBRChannel[]) => void
  pendingPbrChannel: Ref<PBRChannel | ''>
  setMultilineBatchMode: (enabled: boolean) => void
  smart: ReturnType<typeof useSmartMultiFrame>
  smartMultiFrameEnabled: Ref<boolean>
  toggleMultilineBatchMode: () => void
}

/**
 * 组合多行提示词、智能多帧和预设应用流程，统一维护三种创作模式的互斥关系。
 * @param options 模型参数、提示词、参考素材及模式状态。
 * @returns 两类批量控制器、预设处理器和提交所需任务构造器。
 */
export function useGeneratorBatchModes(
  options: UseGeneratorBatchModesOptions,
): UseGeneratorBatchModesReturn {
  const smartMultiFrameEnabled = options.smartMultiFrameEnabled
  const pendingPbrChannel = ref<PBRChannel | ''>('')
  const multiline = useMultilinePromptReferences({
    refImages: options.refImages,
    multilineBatchMode: options.multilineBatchMode,
  })
  const smart = useSmartMultiFrame({
    fileParamDef: options.fileParamDef,
    modelParams: options.modelParams,
    refImages: options.refImages,
    prompt: options.prompt,
    paramValues: options.paramValues,
    selectedMode: options.selectedMode,
    enabledRef: smartMultiFrameEnabled,
  })
  const panel = useMultilineBatchPanel({
    multilineBatchMode: options.multilineBatchMode,
    multilinePromptRows: multiline.multilinePromptRows,
    smartMultiFrameEnabled,
    isTextExpanded: options.isTextExpanded,
    setSmartMultiFrameEnabled: smart.setSmartMultiFrameEnabled,
    resetMultilinePromptRows: multiline.resetMultilinePromptRows,
  })
  const multilinePrompts = computed(() => {
    if (!options.multilineBatchMode.value) return []
    return options.prompt.value.split('\n').map((line) => line.trim()).filter(Boolean)
  })

  function setMultilineBatchMode(enabled: boolean): void {
    if (enabled) smart.setSmartMultiFrameEnabled(false)
    options.multilineBatchMode.value = enabled
  }

  function onApplyPreset(payload: { content: string; channel?: PBRChannel }): void {
    clearCurrentBatchId()
    pendingPbrChannel.value = payload.channel || ''
    options.setPromptInEditor(payload.content)
  }

  function onApplyPresetBatch(texts: string[], channels?: PBRChannel[]): void {
    if (!texts.length) return
    clearCurrentBatchId()
    pendingPbrChannel.value = ''
    smart.setSmartMultiFrameEnabled(false)
    options.multilineBatchMode.value = false
    nextTick(() => {
      options.multilineBatchMode.value = true
      nextTick(() => multiline.replaceMultilinePromptRows(texts.map((prompt, index) => ({
        prompt,
        references: options.refImages.value,
        pbrChannel: channels?.[index],
      }))))
    })
  }

  watch([options.multilineBatchMode, smartMultiFrameEnabled], ([multilineEnabled, smartEnabled]) => {
    options.onModeRowStateChange(multilineEnabled, smartEnabled)
  })

  return {
    clearAllMultilinePromptRows: panel.clearAllMultilinePromptRows,
    multiline,
    multilinePrompts,
    onApplyPreset,
    onApplyPresetBatch,
    pendingPbrChannel,
    setMultilineBatchMode,
    smart,
    smartMultiFrameEnabled,
    toggleMultilineBatchMode: panel.toggleMultilineBatchMode,
  }
}
