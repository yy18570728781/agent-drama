import { computed, type Ref } from 'vue'
import { capListIncludes, getCachedModelDetail, getCapId, sharedModelDetailCache } from './useGenerationRunner'
import type { useModeManager } from './useModeManager'
import type { useGeneratorReferenceController } from './useGeneratorReferenceController'
import type { UseUIRememberOptions } from '@/composables/useUIRemember'

interface GeneratorRememberOptionsContext {
  capModelRememberKey: string
  debugSource: string
  getDisableReferenceRemember: () => boolean
  emit: NonNullable<UseUIRememberOptions['emit']>
  mode: ReturnType<typeof useModeManager>
  prompt: Ref<string>
  reference: ReturnType<typeof useGeneratorReferenceController>
  renderPromptEditorFromState: () => void
  setPrompt: (text: string) => void
  getSkipUIRemember: () => boolean
  syncPromptFromDom: (preserveWhenEmpty?: boolean) => void
  uiRememberKey: string
}

/**
 * 构建 useUIRemember 的完整依赖，集中维护模型、引用与编辑器之间的协议映射。
 * @param context 生成器模式、引用和提示词桥接上下文。
 * @returns 可直接传给 useUIRemember 的类型化配置。
 */
export function createGeneratorRememberOptions(
  context: GeneratorRememberOptionsContext,
): UseUIRememberOptions {
  const { mode, reference } = context
  return {
    uiRememberKey: context.uiRememberKey,
    capModelRememberKey: context.capModelRememberKey,
    debugSource: context.debugSource,
    skipUIRemember: computed(() => context.getSkipUIRemember() || mode.isRestoringModelSelection.value),
    disableReferenceRemember: computed(context.getDisableReferenceRemember),
    selectedModelId: mode.selectedModelId,
    selectedCapability: mode.selectedCapability,
    selectedMode: mode.selectedMode,
    selectedModelInfo: mode.selectedModelInfo,
    paramValues: mode.paramValues,
    prompt: context.prompt,
    refImages: reference.uiRememberRefImages,
    hasFileParam: mode.hasFileParam,
    syncPromptFromDom: context.syncPromptFromDom,
    setPrompt: context.setPrompt,
    renderPromptEditorFromState: context.renderPromptEditorFromState,
    sanitizeRememberedParams: mode.sanitizeRememberedParams,
    applyRestoredParamValues: mode.applyRestoredParamValues,
    fetchModelModes: mode.fetchModelModes,
    resolveModeId: mode.resolveModeId,
    ensureModeParamsLoaded: mode.ensureModeParamsLoaded,
    ensureFileUploadMode: mode.ensureFileUploadMode,
    shouldPreferFileUploadMode: () => mode.selectedCapability.value === 'model_generation',
    capListIncludes,
    getCapId,
    getCachedModelDetail,
    getReferenceOrder: reference.manager.getReferenceOrder,
    dedupeReferenceImages: reference.manager.dedupeReferenceImages,
    buildRememberedReferenceImage: (url: string) => reference.manager.buildRemoteReferenceImage(url),
    sharedModelDetailCache,
    availableModes: mode.availableModes,
    emit: context.emit,
  }
}
