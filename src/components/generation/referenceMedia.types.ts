import type { DroppedAssetInfo, ReferenceMediaType } from '@/composables/useFileDrop'

export type ReferenceImage = {
  url: string
  file: File
  referenceName?: string
  isVideo: boolean
  mediaType?: ReferenceMediaType
  sourceUrl?: string
  sourceNodeId?: string
  uploaded?: boolean
  uploading?: boolean
  uploadProgress?: number
}

export type ReferenceExternalDropPayload = {
  files?: File[]
  urls?: string[]
  referenceNames?: string[]
  assetInfo?: DroppedAssetInfo | null
  replaceIndex?: number
}

export type DraggedReferenceImagePayload = {
  url: string
  isVideo: boolean
  mediaType?: ReferenceMediaType
  sourceUrl?: string
  uploaded?: boolean
  fileName?: string
}
