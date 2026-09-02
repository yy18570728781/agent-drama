import type { ComputedRef, Ref } from 'vue'

export type ProcessMode = 'batch' | 'single'

export interface ImageFileMeta {
  width: number
  height: number
}

export interface RatioPreset {
  label: string
  value: number
}

export interface RowCompressSettings {
  targetWidth: number
  targetHeight: number
  quality: number
  lockRatio: boolean
  activeRatioLabel: string
  useSourceWidth: boolean
}

export interface CompressWorkbenchRow {
  id: string
  file: File
  meta: ImageFileMeta
  isOversize: boolean
  previewUrl: string
  processedFile: File | null
  processedMeta: ImageFileMeta | null
  processedPreviewUrl: string
  processing: boolean
  error: string
  settings: RowCompressSettings
}

export interface CompressProcessArgs {
  row: CompressWorkbenchRow
  settings: RowCompressSettings
  maxBytes: number
}

export interface ImageCompressWorkbenchOptions {
  maxBytes: Ref<number>
  processRow: (args: CompressProcessArgs) => Promise<File>
}

export interface ImageCompressWorkbenchState {
  rows: Ref<CompressWorkbenchRow[]>
  processing: Ref<boolean>
  processedOnce: Ref<boolean>
  selectedRowId: Ref<string>
  processMode: Ref<ProcessMode>
  targetWidthInput: Ref<string>
  targetHeightInput: Ref<string>
  quality: Ref<number>
  lockRatio: Ref<boolean>
  activeRatioLabel: Ref<string>
  useSourceWidth: Ref<boolean>
  maxBytes: Ref<number>
  ratioPresets: RatioPreset[]
  oversizeRows: ComputedRef<CompressWorkbenchRow[]>
  sortedRows: ComputedRef<CompressWorkbenchRow[]>
  hasUnresolvedOversize: ComputedRef<boolean>
  selectedRow: ComputedRef<CompressWorkbenchRow | null>
  isSingleRowScenario: ComputedRef<boolean>
  activeProcessMode: ComputedRef<ProcessMode>
  currentSourceWidth: ComputedRef<number>
  processActionLabel: ComputedRef<string>
  setProcessMode: (mode: ProcessMode) => void
  applyRatioPreset: (ratio: RatioPreset) => void
  processRows: () => Promise<void>
}
