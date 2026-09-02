import { computed, nextTick, ref, watch, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import { useSubjectReference } from '@/composables/subjects/useSubjectReference'
import { useRememberedReferenceBridge } from '@/components/generation/useRememberedReferenceBridge'
import {
  useReferenceManager,
  type ReferenceImage,
  type UseReferenceManagerOptions,
} from './useReferenceManager'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import type { SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'

interface FlowDetailPayload {
  imageUrl: string
  mediaType: 'image' | 'video'
  nodeId?: string
  referenceSourceNodeId: string
}

interface UseGeneratorReferenceControllerOptions {
  autoSwitchToFileMode: (silent?: boolean) => Promise<boolean>
  currentModeName: ComputedRef<string>
  disableReferenceRemember: boolean
  emit: UseReferenceManagerOptions['emit']
  emitFilesDropped: (urls: string[], referenceNames?: string[]) => void
  ensureFileUploadMode: UseReferenceManagerOptions['ensureFileUploadMode']
  flowNodeId?: string
  flowOpenDetail: ((payload: FlowDetailPayload) => void) | null
  getPromptFromDom: () => string
  hasFileParam: ComputedRef<boolean>
  insertReference: (index: number) => void
  isEmbedded: boolean
  isReferenceAutoCollapseEnabled: Ref<boolean>
  modelParams: Ref<ModelParamSchema[]>
  referenceLimitOverride: ComputedRef<number | null>
  renderPromptEditorFromState: () => void
  restorePromptSelection: () => void
  savePromptSelection: () => void
  saveUIRemember: () => void
  selectedCapability: Ref<string>
  selectedMode: Ref<string>
  selectedModelInfo: Ref<BackendModelInfo | null>
  setPromptInEditor: (text: string) => void
  uploadInputFile: UseReferenceManagerOptions['uploadInputFile']
}

interface UseGeneratorReferenceControllerReturn {
  handleReferencePreview: (index: number) => void
  manager: ReturnType<typeof useReferenceManager>
  onSelectSubject: (payload: SubjectSelectPayload) => Promise<void>
  rememberedRefImages: Ref<ReferenceImage[]>
  uiRememberRefImages: WritableComputedRef<ReferenceImage[]>
}

function buildReferenceSignature(images: ReferenceImage[]): string {
  return images.map((item) => `${item.isVideo ? 'v' : 'i'}:${item.sourceUrl || item.url}`).join('|')
}

/**
 * 组合参考素材状态、主体引用和记忆桥接，并保持 Card 与 Flow 的预览分流。
 * @param options 已初始化的模型状态、提示词桥接和延迟上传函数。
 * @returns ReferenceManager、记忆状态及对外事件处理器。
 */
export function useGeneratorReferenceController(
  options: UseGeneratorReferenceControllerOptions,
): UseGeneratorReferenceControllerReturn {
  const rememberedRefImages = ref<ReferenceImage[]>([])
  const manager = useReferenceManager({
    emit: options.emit,
    hasFileParam: options.hasFileParam,
    selectedModelInfo: options.selectedModelInfo,
    selectedCapability: options.selectedCapability,
    selectedMode: options.selectedMode,
    ensureFileUploadMode: options.ensureFileUploadMode,
    modelParams: options.modelParams,
    currentModeName: options.currentModeName,
    saveUIRemember: options.saveUIRemember,
    isReferenceAutoCollapseEnabled: options.isReferenceAutoCollapseEnabled,
    renderPromptEditorFromState: options.renderPromptEditorFromState,
    autoSwitchToFileMode: options.autoSwitchToFileMode,
    uploadInputFile: options.uploadInputFile,
    referenceLimitOverride: options.referenceLimitOverride,
  })

  const { onSelectSubject } = useSubjectReference({
    refImages: manager.refImages,
    addReferenceMedia: manager.addReferenceMedia,
    insertRefAtIndex: options.insertReference,
    saveSelection: options.savePromptSelection,
    restoreSelection: options.restorePromptSelection,
    onMediaResolved: (url: string, referenceName: string) => {
      if (!options.isEmbedded) return
      const savedPrompt = options.getPromptFromDom()
      const signature = buildReferenceSignature(manager.refImages.value)
      options.emitFilesDropped([url], [referenceName])
      const stop = watch(
        () => buildReferenceSignature(manager.refImages.value),
        (nextSignature) => {
          if (nextSignature === signature) return
          nextTick(() => {
            stop()
            if (savedPrompt && options.getPromptFromDom() !== savedPrompt) {
              options.setPromptInEditor(savedPrompt)
            }
          })
        },
      )
      window.setTimeout(stop, 3000)
    },
  })

  const uiRememberRefImages = computed<ReferenceImage[]>({
    get: () => manager.refImages.value,
    set: (images) => {
      manager.refImages.value = images
      if (!options.disableReferenceRemember) rememberedRefImages.value = images
    },
  })

  if (!options.disableReferenceRemember) {
    useRememberedReferenceBridge(rememberedRefImages, manager.refImages)
  }

  function handleReferencePreview(index: number): void {
    if (!options.isEmbedded || !options.flowOpenDetail) {
      manager.onThumbClick(index)
      return
    }
    const item = manager.refImages.value[index]
    if (!item) return
    options.flowOpenDetail({
      nodeId: options.flowNodeId,
      imageUrl: item.url,
      mediaType: item.isVideo ? 'video' : 'image',
      referenceSourceNodeId: item.sourceNodeId || '',
    })
  }

  return { handleReferencePreview, manager, onSelectSubject, rememberedRefImages, uiRememberRefImages }
}
