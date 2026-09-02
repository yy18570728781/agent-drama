import { computed, inject, ref, type Ref } from 'vue'
import type GeneratorPromptWorkspace from '@/components/generation/GeneratorPromptWorkspace.vue'
import { SMART_MULTI_FRAME_MAX_ITEMS } from '@/components/generation/useSmartMultiFrame'
import { createGeneratorRememberOptions } from './generatorRememberOptions'
import { useGeneratorBatchModes } from './useGeneratorBatchModes'
import { useGeneratorPersistenceController, type GeneratorRememberLate } from './useGeneratorPersistenceController'
import { useGeneratorReferenceController } from './useGeneratorReferenceController'
import { useGeneratorReferenceIngress } from './useGeneratorReferenceIngress'
import { useUploadResolve } from '@/composables/useUploadResolve'
import type { useModeManager } from './useModeManager'
import type { UseReferenceManagerOptions } from './useReferenceManager'
import type { GeneratorInputEmits, GeneratorInputProps } from '@/components/generation/generatorInput.types'

type GeneratorEmit = <K extends keyof GeneratorInputEmits>(event: K, ...args: GeneratorInputEmits[K]) => void
type PromptWorkspaceInstance = InstanceType<typeof GeneratorPromptWorkspace>
type UploadInputFile = NonNullable<UseReferenceManagerOptions['uploadInputFile']>

interface UseGeneratorWorkspaceControllerOptions {
  emit: GeneratorEmit
  late: GeneratorRememberLate
  mode: ReturnType<typeof useModeManager>
  onRestoreComplete: () => void
  props: GeneratorInputProps
}

interface UseGeneratorWorkspaceControllerReturn {
  batch: ReturnType<typeof useGeneratorBatchModes>
  clearAllReferenceImages: () => void
  containerRef: Ref<HTMLElement | null>
  expandedPanelRef: Ref<HTMLElement | null>
  ingress: ReturnType<typeof useGeneratorReferenceIngress>
  isExpanded: Ref<boolean>
  isReferenceAutoCollapseEnabled: Ref<boolean>
  isTextExpanded: Ref<boolean>
  onReferenceUrlUpdated: (index: number, url: string) => void
  persistence: ReturnType<typeof useGeneratorPersistenceController>
  prompt: Ref<string>
  reference: ReturnType<typeof useGeneratorReferenceController>
  upload: ReturnType<typeof useUploadResolve>
  workspaceRef: Ref<PromptWorkspaceInstance | null>
}

function createPromptCommands(workspaceRef: Ref<PromptWorkspaceInstance | null>) {
  return {
    focusPrompt: (): void => workspaceRef.value?.focusPrompt(),
    getPromptFromDom: (): string => workspaceRef.value?.getPromptFromDom() || '',
    insertReference: (index: number): void => workspaceRef.value?.insertReference(index),
    renderPromptEditorFromState: (): void => workspaceRef.value?.renderPromptEditorFromState(),
    restorePromptSelection: (): void => workspaceRef.value?.restorePromptSelection(),
    savePromptSelection: (): void => workspaceRef.value?.savePromptSelection(),
    setPromptInEditor: (text: string): void => workspaceRef.value?.setPromptInEditor(text),
    syncPromptFromDom: (preserveWhenEmpty?: boolean): void => workspaceRef.value?.syncPromptFromDom(preserveWhenEmpty),
  }
}

function createWorkspaceState() {
  const workspaceRef = ref<PromptWorkspaceInstance | null>(null)
  const uploadInputFile: UploadInputFile = async () => {
    throw new Error('uploadInputFile is not bound')
  }
  return {
    prompt: ref(''),
    isExpanded: ref(true),
    isTextExpanded: ref(false),
    isReferenceAutoCollapseEnabled: ref(true),
    smartMultiFrameEnabled: ref(false),
    containerRef: ref<HTMLElement | null>(null),
    expandedPanelRef: ref<HTMLElement | null>(null),
    workspaceRef,
    promptCommands: createPromptCommands(workspaceRef),
    uploadLate: { uploadInputFile },
  }
}

function createReferenceContext(
  options: UseGeneratorWorkspaceControllerOptions,
  state: ReturnType<typeof createWorkspaceState>,
): ReturnType<typeof useGeneratorReferenceController> {
  const flowOpenDetail = inject<((payload: {
    imageUrl: string; mediaType: 'image' | 'video'; nodeId?: string; referenceSourceNodeId: string
  }) => void) | null>('flowOpenDetail', null)
  return useGeneratorReferenceController({
    emit: options.emit,
    hasFileParam: options.mode.hasFileParam,
    selectedModelInfo: options.mode.selectedModelInfo,
    selectedCapability: options.mode.selectedCapability,
    selectedMode: options.mode.selectedMode,
    ensureFileUploadMode: options.mode.ensureFileUploadMode,
    modelParams: options.mode.modelParams,
    currentModeName: options.mode.currentModeName,
    saveUIRemember: () => options.late.saveUIRemember(),
    isReferenceAutoCollapseEnabled: state.isReferenceAutoCollapseEnabled,
    autoSwitchToFileMode: options.mode.autoSwitchToFileMode,
    referenceLimitOverride: computed(() => state.smartMultiFrameEnabled.value ? SMART_MULTI_FRAME_MAX_ITEMS : null),
    uploadInputFile: (item) => state.uploadLate.uploadInputFile(item),
    disableReferenceRemember: !!options.props.disableReferenceRemember,
    isEmbedded: !!options.props.embedded,
    flowNodeId: options.props.flowNodeId,
    flowOpenDetail,
    emitFilesDropped: (urls, referenceNames) => options.emit('files-dropped', { urls, referenceNames }),
    ...state.promptCommands,
  })
}

function createPersistenceContext(
  options: UseGeneratorWorkspaceControllerOptions,
  state: ReturnType<typeof createWorkspaceState>,
  reference: ReturnType<typeof useGeneratorReferenceController>,
): ReturnType<typeof useGeneratorPersistenceController> {
  return useGeneratorPersistenceController({
    late: options.late,
    onRestoreComplete: options.onRestoreComplete,
    rememberOptions: createGeneratorRememberOptions({
      uiRememberKey: options.props.uiRememberKey || 'infinite_canvas_ui_remember',
      capModelRememberKey: options.props.capModelRememberKey || 'infinite_canvas_cap_model_remember',
      debugSource: options.props.debugSource || '',
      getSkipUIRemember: () => !!options.props.skipUIRemember,
      getDisableReferenceRemember: () => !!options.props.disableReferenceRemember,
      mode: options.mode,
      reference,
      prompt: state.prompt,
      emit: options.emit,
      syncPromptFromDom: state.promptCommands.syncPromptFromDom,
      setPrompt: (text) => { state.prompt.value = text },
      renderPromptEditorFromState: state.promptCommands.renderPromptEditorFromState,
    }),
  })
}

/**
 * 组合生成器提示词、参考素材、记忆恢复、批量模式及拖入入口。
 * @param options 已初始化的 ModeManager、公开事件与延迟绑定代理。
 * @returns 工作区全部状态控制器及模板引用。
 */
export function useGeneratorWorkspaceController(
  options: UseGeneratorWorkspaceControllerOptions,
): UseGeneratorWorkspaceControllerReturn {
  const state = createWorkspaceState()
  const reference = createReferenceContext(options, state)
  const persistence = createPersistenceContext(options, state, reference)
  const batch = useGeneratorBatchModes({
    fileParamDef: options.mode.fileParamDef,
    modelParams: options.mode.modelParams,
    refImages: reference.manager.refImages,
    prompt: state.prompt,
    paramValues: options.mode.paramValues,
    selectedMode: options.mode.selectedMode,
    multilineBatchMode: options.mode.multilineBatchMode,
    isTextExpanded: state.isTextExpanded,
    smartMultiFrameEnabled: state.smartMultiFrameEnabled,
    setPromptInEditor: state.promptCommands.setPromptInEditor,
    onModeRowStateChange: (multiline, smart) => options.emit('mode-row-state-change', {
      multilineBatchMode: multiline,
      smartMultiFrameEnabled: smart,
    }),
  })
  const upload = useUploadResolve({
    refImages: reference.manager.refImages,
    normalizeReferenceUrlForCompare: reference.manager.normalizeReferenceUrlForCompare,
    getReferenceFileKey: reference.manager.getReferenceFileKey,
  })
  state.uploadLate.uploadInputFile = upload.uploadInputFile
  const ingress = useGeneratorReferenceIngress({
    containerRef: state.expandedPanelRef,
    refImages: reference.manager.refImages,
    isEmbedded: () => !!options.props.embedded,
    getRefImageMaxItems: reference.manager.getRefImageMaxItems,
    ensureFileUploadMode: options.mode.ensureFileUploadMode,
    addFiles: reference.manager.addFiles,
    addReferenceMedia: reference.manager.addReferenceMedia,
    addReferenceMediaAt: reference.manager.addReferenceMediaAt,
    addRemoteReferenceUrl: reference.manager.addRemoteReferenceUrl,
    emitFilesDropped: (payload) => options.emit('files-dropped', payload),
  })

  function onReferenceUrlUpdated(index: number, url: string): void {
    const images = [...reference.manager.refImages.value]
    if (!images[index]) return
    images[index] = { ...images[index], sourceUrl: url }
    reference.manager.refImages.value = images
  }

  function clearAllReferenceImages(): void {
    if (!reference.manager.refImages.value.length) return
    reference.manager.refImages.value = []
    reference.rememberedRefImages.value = []
    persistence.remember.saveUIRemember()
  }

  return {
    batch, clearAllReferenceImages, containerRef: state.containerRef,
    expandedPanelRef: state.expandedPanelRef, ingress, isExpanded: state.isExpanded,
    isReferenceAutoCollapseEnabled: state.isReferenceAutoCollapseEnabled,
    isTextExpanded: state.isTextExpanded, onReferenceUrlUpdated, persistence,
    prompt: state.prompt, reference, upload, workspaceRef: state.workspaceRef,
  }
}
