import type { ComputedRef, Ref } from 'vue'
import type { ReferenceImage, ReferenceMediaType } from '@/composables/generation/useReferenceManager'

export interface UseUIRememberOptions {
  uiRememberKey: string
  capModelRememberKey: string
  debugSource?: string
  skipUIRemember: Ref<boolean>
  disableReferenceRemember: Ref<boolean>
  selectedModelId: Ref<string>
  selectedCapability: Ref<string>
  selectedMode: Ref<string>
  selectedModelInfo: Ref<any>
  paramValues: Ref<Record<string, any>>
  prompt: Ref<string>
  refImages: Ref<ReferenceImage[]>
  hasFileParam: ComputedRef<boolean>
  emit?: {
    (e: 'request-payload-change', payload: any): void
    (e: 'reference-url-updated', oldUrl: string, newUrl: string): void
  }
  syncPromptFromDom: (silent?: boolean) => void
  setPrompt: (text: string) => void
  renderPromptEditorFromState: () => void
  sanitizeRememberedParams: (params: Record<string, any>) => Record<string, any>
  applyRestoredParamValues: (values: Record<string, any>) => void
  fetchModelModes: (modelId: string, capabilityId?: string) => Promise<any[]>
  resolveModeId: (modes: any[], preferredMode?: string | null) => string
  ensureModeParamsLoaded: (modelId: string, capabilityId: string, preferredMode: string, rememberedParams?: Record<string, any>) => Promise<string>
  ensureFileUploadMode: (opts: any) => Promise<boolean>
  shouldPreferFileUploadMode: () => boolean
  capListIncludes: (caps: any[], capId: string) => boolean
  getCapId: (cap: any) => string
  getCachedModelDetail: (modelId: string) => Promise<any>
  getReferenceOrder: (items: ReferenceImage[]) => string[]
  dedupeReferenceImages: (items: ReferenceImage[]) => { images: ReferenceImage[]; duplicateCount: number }
  buildRememberedReferenceImage: (url: string) => ReferenceImage
  sharedModelDetailCache: Map<string, any>
  availableModes: Ref<any[]>
}

export interface UIRememberReferenceTools {
  shouldRememberReferences: () => boolean
  getCurrentReferenceUrls: () => string[]
  replaceRememberedReferenceUrls: (urls: string[]) => void
  appendRememberedReferenceUrl: (out: string[], value: any) => void
  collectRememberedReferenceUrls: (data: Record<string, any> | null | undefined) => string[]
  buildRememberedReferenceImageFromState: (value: any) => ReferenceImage | null
  collectRememberedReferenceItems: (data: Record<string, any> | null | undefined) => ReferenceImage[]
  getReferenceOrderKey: (item: Partial<ReferenceImage> | null | undefined) => string
  collectRememberedReferenceOrder: (data: Record<string, any> | null | undefined) => string[]
  sortReferenceImagesByOrder: (images: ReferenceImage[], order: string[]) => ReferenceImage[]
}

export interface UIRequestPayload {
  capability: string
  mode: string
  params: Record<string, any>
  referenceItems: Array<{
    url: string
    isVideo: boolean
    mediaType?: ReferenceMediaType
    sourceNodeId?: string
  }>
  referenceOrder: string[]
}

export interface UIRememberPersistenceTools {
  saveCapModelRemember: () => void
  getCapModelRemember: (capability: string) => Record<string, any> | null
  buildRememberState: () => Record<string, any>
  saveUIRemember: () => void
  buildCurrentRequestPayloadCustom: () => UIRequestPayload
  applyRequestState: (data: Record<string, any> | null | undefined) => null
}

export interface UIRememberRestoreTools {
  applyRememberedState: (
    data: Record<string, any> | null | undefined,
    applyOptions?: { restorePrompt?: boolean },
  ) => Promise<void>
  loadUIRemember: () => Promise<void>
  isLoaded: () => boolean
}

export type UseUIRememberReturn = UIRememberReferenceTools
  & UIRememberPersistenceTools
  & Pick<UIRememberRestoreTools, 'applyRememberedState' | 'loadUIRemember'>
  & { buildRememberedReferenceImage: (url: string) => ReferenceImage }

export type RememberDebugLog = (label: string, payload: Record<string, any>) => void
