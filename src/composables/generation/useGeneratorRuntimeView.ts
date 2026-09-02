import { computed, type ComputedRef } from 'vue'
import type { useGeneratorModelInteractions } from './useGeneratorModelInteractions'
import type { useGeneratorWorkspaceController } from './useGeneratorWorkspaceController'
import type { useModeManager } from './useModeManager'

interface UseGeneratorRuntimeViewOptions {
  mode: ReturnType<typeof useModeManager>
  model: ReturnType<typeof useGeneratorModelInteractions>
  workspace: ReturnType<typeof useGeneratorWorkspaceController>
}

interface UseGeneratorRuntimeViewReturn {
  collapsedSummary: ComputedRef<string>
  promptPlaceholder: ComputedRef<string>
  publisherIcon: ComputedRef<string>
}

/**
 * 派生生成器折叠摘要、提示词占位与模型图标。
 * @param options 模式、模型交互和工作区控制器。
 * @returns 仅用于渲染的稳定计算状态。
 */
export function useGeneratorRuntimeView(
  options: UseGeneratorRuntimeViewOptions,
): UseGeneratorRuntimeViewReturn {
  const { mode, model, workspace } = options
  const collapsedSummary = computed(() => {
    if (mode.isBatchMode.value) return `批量生成模式 · ${mode.batchItems.value.length} 个任务`
    if (mode.isSmartMode.value) return mode.selectedSkillId.value
      ? `✨ ${model.selectedSkillName.value}` : '✨ 智能模式'
    if (!mode.hasPromptParam.value) return workspace.prompt.value || '直接发送'
    return workspace.prompt.value || '说说你想做什么吧'
  })
  const promptPlaceholder = computed(() => {
    if (!mode.isSmartMode.value) return '说说你想做什么吧'
    return mode.selectedSkillId.value
      ? `使用 ${model.selectedSkillName.value} 执行...`
      : '描述你想要的效果，AI 会自动选择最佳方案...'
  })
  const publisherIcon = computed(() => mode.getPublisherIcon(mode.selectedModelInfo.value?.publisher))
  return { collapsedSummary, promptPlaceholder, publisherIcon }
}
