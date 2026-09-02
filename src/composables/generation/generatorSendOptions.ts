import type { useModeManager } from './useModeManager'
import type { useGeneratorWorkspaceController } from './useGeneratorWorkspaceController'
import type { useSendDispatch } from './useSendDispatch'
import type { GeneratorInputEmits, GeneratorInputProps } from '@/components/generation/generatorInput.types'

type GeneratorEmit = <K extends keyof GeneratorInputEmits>(event: K, ...args: GeneratorInputEmits[K]) => void

interface GeneratorSendOptionsContext {
  emit: GeneratorEmit
  mode: ReturnType<typeof useModeManager>
  props: GeneratorInputProps
  workspace: ReturnType<typeof useGeneratorWorkspaceController>
}

/**
 * 映射生成器控制器状态到稳定的 SendDispatch 协议。
 * @param context 模式、工作区、外层属性和事件桥接。
 * @returns 可直接传给 useSendDispatch 的配置。
 */
export function createGeneratorSendOptions(
  context: GeneratorSendOptionsContext,
): Parameters<typeof useSendDispatch>[0] {
  const { mode, workspace } = context
  return {
    emit: context.emit,
    props: context.props,
    selectedModelId: mode.selectedModelId,
    selectedModelInfo: mode.selectedModelInfo,
    selectedCapability: mode.selectedCapability,
    selectedMode: mode.selectedMode,
    isSmartMode: mode.isSmartMode,
    selectedSkillId: mode.selectedSkillId,
    prompt: workspace.prompt,
    refImages: workspace.reference.manager.refImages,
    paramValues: mode.paramValues,
    hasFileParam: mode.hasFileParam,
    fileParamDef: mode.fileParamDef,
    hasPromptParam: mode.hasPromptParam,
    allowGenerateCountValue: mode.allowGenerateCountValue,
    multilineBatchMode: mode.multilineBatchMode,
    multilinePrompts: workspace.batch.multilinePrompts,
    buildMultilinePromptTasks: workspace.batch.multiline.buildMultilinePromptTasks,
    pendingPbrChannel: workspace.batch.pendingPbrChannel,
    isBatchMode: mode.isBatchMode,
    batchItems: mode.batchItems,
    smartMultiFrameEnabled: workspace.batch.smartMultiFrameEnabled,
    buildSmartMultiFrameTasks: workspace.batch.smart.buildSmartMultiFrameTasks,
    isExpanded: workspace.isExpanded,
    autoSwitchToFileMode: mode.autoSwitchToFileMode,
    ensureFileUploadMode: mode.ensureFileUploadMode,
    getCurrentReferenceUrls: workspace.persistence.remember.getCurrentReferenceUrls,
    resolveRefImageUrls: workspace.upload.resolveRefImageUrls,
    resolveReferenceImageGroupUrls: workspace.upload.resolveReferenceImageGroupUrls,
    resolveDataUrlToUpload: workspace.upload.resolveDataUrlToUpload,
    normalizeAllowGenerateCountValue: mode.normalizeAllowGenerateCountValue,
    saveUIRemember: workspace.persistence.remember.saveUIRemember,
    syncPromptFromDom: (preserveWhenEmpty?: boolean) => {
      workspace.workspaceRef.value?.syncPromptFromDom(preserveWhenEmpty)
    },
  }
}
