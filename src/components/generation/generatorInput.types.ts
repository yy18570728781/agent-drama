import type { Ref } from 'vue'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'
import type { DroppedAssetInfo } from '@/composables/useFileDrop'

export interface GeneratorDropPayload {
  files?: File[]
  urls?: string[]
  referenceNames?: string[]
  assetInfo?: GeneratorDroppedAsset | null
  replaceIndex?: number
}

export type GeneratorDroppedAsset = DroppedAssetInfo

export interface GeneratorHeightResizeOptions {
  height?: number
  max: number
  min: number
}

export interface GeneratorInputProps {
  capModelRememberKey?: string
  compact?: boolean
  debugSource?: string
  disableQueue?: boolean
  disableReferenceRemember?: boolean
  embedded?: boolean
  embeddedModeRow?: boolean
  externalSendOverride?: (() => boolean | Promise<boolean>) | null
  externalSingleFileBatchMode?: boolean
  flowNodeId?: string
  heightResize?: GeneratorHeightResizeOptions | false
  isGenerating?: boolean
  lockedCapability?: string
  scrollEl?: HTMLElement | null
  showPanelControls?: boolean
  skipUIRemember?: boolean
  uiRememberKey?: string
}

export interface GeneratorInputEmits {
  'batch-mode-change': [isBatch: boolean]
  'before-remove-reference': [removed: unknown]
  'capability-change': [capabilityId: string]
  'clipboard-reference-pasted': [payload: { files: File[] }]
  'files-dropped': [payload: GeneratorDropPayload]
  'generate-complete': [result: unknown]
  'generate-created': [task: unknown]
  'generate-error': [error: string, batchInfo?: unknown]
  'generate-progress': [data: unknown]
  'generate-start': [task: unknown]
  'height-resize-end': [height: number]
  'mode-row-state-change': [state: GeneratorModeRowState]
  'model-change': [payload: unknown]
  'queue-task-assigned': [payload: unknown]
  'reference-url-updated': [oldUrl: string, newUrl: string]
  'remove-upstream': [sourceNodeId: string]
  'request-payload-change': [payload: unknown]
}

export interface GeneratorModeRowState {
  multilineBatchMode: boolean
  smartMultiFrameEnabled: boolean
}

export interface GeneratorModelSelection {
  capability?: string
  mode?: string
  model: BackendModelInfo
  modes?: unknown[]
  params?: ModelParamSchema[]
}

export interface GeneratorPointDisplayState {
  pointInfoTooltip: string
  pointInfoVisible: boolean
  displayGroupPoints: string
  displayReservePoints: string
  displayUserPoints: string
  showGroupPoints: boolean
  showReservePoints: boolean
  showUserPoints: boolean
}

export interface GeneratorPromptApi {
  closeMenus?: () => void
  focus: () => void
  getPrompt: () => string
  insertReference: (index: number) => void
  renderFromState: () => void
  restoreSelection: () => void
  saveSelection: () => void
  setPrompt: (text: string) => void
  syncFromDom: (preserveWhenEmpty?: boolean) => void
}

export interface GeneratorInputPublicState {
  availableModes: Ref<unknown[]>
  modelParams: Ref<ModelParamSchema[]>
  paramValues: Ref<Record<string, unknown>>
  refImages: Ref<ReferenceImage[]>
  selectedCapability: Ref<string>
  selectedMode: Ref<string>
  selectedModelId: Ref<string>
  selectedModelInfo: Ref<BackendModelInfo | null>
}
