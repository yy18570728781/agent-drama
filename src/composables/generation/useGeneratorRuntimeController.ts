import {
  computed,
  inject,
  ref,
  toRef,
  type Ref,
} from 'vue'
import { useClipboardPaste } from '@/composables/useClipboardPaste'
import { useScrollIndicator } from '@/composables/useScrollIndicator'
import { useUserStore } from '@/stores/auth.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import { createGeneratorSendOptions } from './generatorSendOptions'
import { useGeneratorExternalActions } from './useGeneratorExternalActions'
import { useGeneratorInputScreenshot } from './useGeneratorInputScreenshot'
import { useGeneratorModelInteractions } from './useGeneratorModelInteractions'
import { useGeneratorPoints } from './useGeneratorPoints'
import { useGeneratorRuntimeLifecycle } from './useGeneratorRuntimeLifecycle'
import { useGeneratorRuntimeView } from './useGeneratorRuntimeView'
import { useGeneratorSubmissionController } from './useGeneratorSubmissionController'
import type { useGeneratorWorkspaceController } from './useGeneratorWorkspaceController'
import type { useModeManager } from './useModeManager'
import type { GeneratorInputEmits, GeneratorInputProps } from '@/components/generation/generatorInput.types'

type GeneratorEmit = <K extends keyof GeneratorInputEmits>(event: K, ...args: GeneratorInputEmits[K]) => void

interface GeneratorSkillOption {
  description?: string
  id: string
  name: string
}

interface UseGeneratorRuntimeControllerOptions {
  emit: GeneratorEmit
  mode: ReturnType<typeof useModeManager>
  props: GeneratorInputProps
  workspace: ReturnType<typeof useGeneratorWorkspaceController>
}

interface UseGeneratorRuntimeControllerReturn {
  actions: ReturnType<typeof useGeneratorExternalActions>
  lifecycle: ReturnType<typeof useGeneratorRuntimeLifecycle>
  model: ReturnType<typeof useGeneratorModelInteractions>
  points: ReturnType<typeof useGeneratorPoints>
  screenshot: ReturnType<typeof useGeneratorInputScreenshot>
  scroll: ReturnType<typeof useScrollIndicator>
  skills: Ref<GeneratorSkillOption[]>
  submission: ReturnType<typeof useGeneratorSubmissionController>
  view: ReturnType<typeof useGeneratorRuntimeView>
}

function createClipboardEmitter(emit: GeneratorEmit) {
  const clipboardEmit = ((
    event: 'clipboard-reference-pasted' | 'files-dropped',
    payload: { files?: File[]; urls?: string[] },
  ): void => {
    if (event === 'clipboard-reference-pasted') {
      emit(event, { files: payload.files || [] })
      return
    }
    emit(event, payload)
  }) as Parameters<typeof useClipboardPaste>[0]['emit']
  return clipboardEmit
}

function createClipboardRuntime(options: UseGeneratorRuntimeControllerOptions) {
  const { manager } = options.workspace.reference
  return useClipboardPaste({
    containerRef: options.workspace.containerRef,
    embedded: computed(() => !!options.props.embedded),
    ensureFileUploadMode: options.mode.ensureFileUploadMode,
    addFiles: async (files) => { await manager.addFiles(files, false) },
    addRemoteReferenceUrl: manager.addRemoteReferenceUrl,
    getRemainingReferenceSlots: manager.getRemainingReferenceSlots,
    getRefImageMaxItems: manager.getRefImageMaxItems,
    selectedModelInfo: options.mode.selectedModelInfo,
    currentModeName: options.mode.currentModeName,
    emit: createClipboardEmitter(options.emit),
  })
}

function createPointsRuntime(options: UseGeneratorRuntimeControllerOptions) {
  const userStore = useUserStore()
  const taskQueueStore = useTaskQueueStore()
  const { mode, workspace } = options
  return useGeneratorPoints({
    getUserId: () => userStore.userId,
    getAuthStatus: () => userStore.authStatus,
    getSelectedModelId: () => mode.selectedModelId.value,
    getSelectedModelInfo: () => mode.selectedModelInfo.value,
    getSelectedCapability: () => mode.selectedCapability.value,
    getSelectedMode: () => mode.selectedMode.value,
    getIsRestoringModelSelection: () => mode.isRestoringModelSelection.value,
    getRequestState: () => ({
      modelId: mode.selectedModelId.value,
      capability: mode.selectedCapability.value,
      mode: mode.selectedMode.value,
      prompt: workspace.prompt.value,
      params: mode.paramValues.value,
      references: workspace.reference.manager.refImages.value,
    }),
    getTaskSnapshots: () => taskQueueStore.tasks.map((task) => ({ id: task.id, status: task.status })),
    buildCurrentRequestPayload: workspace.persistence.remember.buildCurrentRequestPayloadCustom,
  })
}

/**
 * 组合生成器提交、积分、截图、粘贴、滚动和公开动作的运行时能力。
 * @param options 已初始化的模式与工作区控制器。
 * @returns UI 运行状态、提交入口和生命周期安全的外部动作。
 */
export function useGeneratorRuntimeController(
  options: UseGeneratorRuntimeControllerOptions,
): UseGeneratorRuntimeControllerReturn {
  const flowTriggerGridSplitBatch = inject<((nodeId: string) => boolean) | null>('flowTriggerGridSplitBatch', null)
  const submission = useGeneratorSubmissionController({
    externalSendOverride: options.props.externalSendOverride,
    flowNodeId: options.props.flowNodeId,
    flowTriggerGridSplitBatch,
    sendOptions: createGeneratorSendOptions(options),
  })
  const skills = ref<GeneratorSkillOption[]>([])
  const model = useGeneratorModelInteractions({
    isSmartMode: options.mode.isSmartMode,
    onModeSelect: options.mode.onModeSelectWrapper,
    onModelSelect: options.mode.onModelSelect,
    refImages: options.workspace.reference.manager.refImages,
    rememberedRefImages: options.workspace.reference.rememberedRefImages,
    saveUIRemember: options.workspace.persistence.remember.saveUIRemember,
    selectedMode: options.mode.selectedMode,
    selectedModelId: options.mode.selectedModelId,
    selectedModelInfo: options.mode.selectedModelInfo,
    selectedSkillId: options.mode.selectedSkillId,
    setSmartMultiFrameEnabled: options.workspace.batch.smart.setSmartMultiFrameEnabled,
    showSkillDropdown: options.mode.showSkillDropdown,
    skills,
  })
  const actions = useGeneratorExternalActions({
    contextMenu: options.workspace.reference.manager.contextMenu,
    isExpanded: options.workspace.isExpanded,
    isTextExpanded: options.workspace.isTextExpanded,
    mode: options.mode,
    prompt: options.workspace.prompt,
    workspaceRef: options.workspace.workspaceRef,
  })
  const clipboard = createClipboardRuntime(options)
  const screenshot = useGeneratorInputScreenshot({
    ensureFileUploadMode: options.mode.ensureFileUploadMode,
    onScreenshotCapture: clipboard.onScreenshotCapture,
  })
  const scroll = useScrollIndicator({ scrollEl: toRef(options.props, 'scrollEl') })
  const points = createPointsRuntime(options)
  const lifecycle = useGeneratorRuntimeLifecycle({
    actions, clipboard, mode: options.mode, points, props: options.props, submission,
    workspace: options.workspace,
  })
  const view = useGeneratorRuntimeView({ mode: options.mode, model, workspace: options.workspace })
  return {
    actions,
    lifecycle,
    model,
    points,
    screenshot,
    scroll,
    skills,
    submission,
    view,
  }
}
