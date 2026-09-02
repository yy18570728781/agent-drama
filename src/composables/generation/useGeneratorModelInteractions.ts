import { computed, nextTick, type ComputedRef, type Ref } from 'vue'
import { getModeLabel, normalizeModeKey } from '@/utils/modeLabels'
import {
  isGigaModel as checkIsGigaModel,
  isTvaiFiModel as checkIsTvaiFiModel,
  isTvaiProcModel as checkIsTvaiProcModel,
  isTvaiUpModel as checkIsTvaiUpModel,
} from '@/services/generation/topaz.constants'
import type { BackendModelInfo } from '@/api/models'
import type { ReferenceImage } from './useReferenceManager'
import type { GeneratorModelSelection } from '@/components/generation/generatorInput.types'

interface GeneratorSkillOption {
  id: string
  name: string
}

interface UseGeneratorModelInteractionsOptions {
  isSmartMode: Ref<boolean>
  onModeSelect: (modeId: string) => Promise<void>
  onModelSelect: (selection: GeneratorModelSelection) => Promise<void>
  refImages: Ref<ReferenceImage[]>
  rememberedRefImages: Ref<ReferenceImage[]>
  saveUIRemember: () => void
  selectedMode: Ref<string>
  selectedModelId: Ref<string>
  selectedModelInfo: Ref<BackendModelInfo | null>
  selectedSkillId: Ref<string | null>
  setSmartMultiFrameEnabled: (enabled: boolean) => void
  showSkillDropdown: Ref<boolean>
  skills: Ref<GeneratorSkillOption[]>
}

interface UseGeneratorModelInteractionsReturn {
  handleModeSelect: (modeId: string) => Promise<void>
  handleModelSelectKeepReferences: (selection: GeneratorModelSelection) => Promise<void>
  isGigaModel: ComputedRef<boolean>
  isTvaiModel: ComputedRef<boolean>
  isTvaiProcModel: ComputedRef<boolean>
  onSkillSelect: (skillId: string | null) => void
  selectedSkillName: ComputedRef<string>
  tvaiModelType: ComputedRef<'up' | 'fi'>
}

function isSameModeFamily(previousModeId: string, nextModeId: string): boolean {
  if (!previousModeId || !nextModeId) return false
  if (previousModeId === nextModeId) return true
  const previousLabel = normalizeModeKey(getModeLabel(previousModeId, previousModeId))
  const nextLabel = normalizeModeKey(getModeLabel(nextModeId, nextModeId))
  return !!previousLabel && previousLabel === nextLabel
}

/**
 * 管理模型和模式切换时的参考素材保留策略及专用参数表单派生状态。
 * @param options 模型选择状态、参考素材和保存回调。
 * @returns 模型交互处理器及视图派生状态。
 */
export function useGeneratorModelInteractions(
  options: UseGeneratorModelInteractionsOptions,
): UseGeneratorModelInteractionsReturn {
  const isGigaModel = computed(() => checkIsGigaModel(options.selectedModelId.value))
  const isTvaiModel = computed(() => checkIsTvaiUpModel(options.selectedModelId.value) || checkIsTvaiFiModel(options.selectedModelId.value))
  const isTvaiProcModel = computed(() => checkIsTvaiProcModel(options.selectedModelId.value))
  const tvaiModelType = computed<'up' | 'fi'>(() => checkIsTvaiFiModel(options.selectedModelId.value) ? 'fi' : 'up')
  const selectedSkillName = computed(() => {
    if (!options.selectedSkillId.value) return '自动'
    return options.skills.value.find((skill) => skill.id === options.selectedSkillId.value)?.name
      || options.selectedSkillId.value
  })

  async function handleModeSelect(modeId: string): Promise<void> {
    if (!modeId || modeId === options.selectedMode.value) return
    await options.onModeSelect(modeId)
    options.setSmartMultiFrameEnabled(false)
    options.refImages.value = []
    options.saveUIRemember()
  }

  async function handleModelSelectKeepReferences(selection: GeneratorModelSelection): Promise<void> {
    const previousMode = options.selectedMode.value
    const previousReferences = [...options.refImages.value]
    await options.onModelSelect(selection)
    await nextTick()
    if (!previousReferences.length || !isSameModeFamily(previousMode, options.selectedMode.value)) return
    if (options.refImages.value.length) return
    options.refImages.value = previousReferences
    options.rememberedRefImages.value = previousReferences
    options.saveUIRemember()
  }

  function onSkillSelect(skillId: string | null): void {
    options.selectedSkillId.value = skillId
    options.showSkillDropdown.value = false
    if (skillId) options.isSmartMode.value = true
  }

  return {
    handleModeSelect,
    handleModelSelectKeepReferences,
    isGigaModel,
    isTvaiModel,
    isTvaiProcModel,
    onSkillSelect,
    selectedSkillName,
    tvaiModelType,
  }
}
