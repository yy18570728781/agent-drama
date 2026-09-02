import { computed, ref, watch, type Ref } from 'vue'

import {
  compressImageFileToLimit,
  getImageFileMeta,
  IMAGE_UPLOAD_COMPRESS_DEFAULT_QUALITY,
  IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH,
  isOversizeImageFile,
} from '@/utils/imageCompression'
import { getStorage, setStorage } from '@/utils/storage'

import type {
  CompressWorkbenchRow,
  ImageCompressWorkbenchOptions,
  ImageFileMeta,
  ProcessMode,
  RatioPreset,
  RowCompressSettings,
} from './imageCompressWorkbench.types'

const DEFAULT_RATIO_PRESETS: RatioPreset[] = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
]
const SOURCE_WIDTH_REMEMBER_KEY = 'image_compress_use_source_width'

function sanitizeDimension(value: string, fallback: number, min = 0, max = 4096) {
  const next = Number.parseInt(value.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : fallback
}

function getRememberedSourceWidthPreference(): boolean {
  const stored = getStorage<boolean | string>(SOURCE_WIDTH_REMEMBER_KEY)
  if (stored === null || stored === undefined) return true
  if (typeof stored === 'boolean') return stored
  return stored !== '0' && stored !== 'false'
}

function createDefaultSettings(meta: ImageFileMeta): RowCompressSettings {
  const targetWidth = Math.min(IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH, Math.max(1, meta.width || IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH))
  const ratio = meta.width && meta.height ? meta.width / meta.height : 0
  return {
    targetWidth,
    targetHeight: ratio > 0 ? Math.max(1, Math.round(targetWidth / ratio)) : 1080,
    quality: IMAGE_UPLOAD_COMPRESS_DEFAULT_QUALITY,
    lockRatio: true,
    activeRatioLabel: '',
    useSourceWidth: true,
  }
}

async function buildRow(file: File, index: number, maxBytes: number): Promise<CompressWorkbenchRow> {
  const meta = await getImageFileMeta(file).catch(() => ({ width: 0, height: 0 }))
  return {
    id: `${file.name}_${file.size}_${index}`,
    file,
    meta,
    isOversize: isOversizeImageFile(file, maxBytes),
    previewUrl: URL.createObjectURL(file),
    processedFile: null,
    processedMeta: null,
    processedPreviewUrl: '',
    processing: false,
    error: '',
    settings: createDefaultSettings(meta),
  }
}

function revokeRowUrls(rows: CompressWorkbenchRow[]) {
  rows.forEach((row) => {
    if (row.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(row.previewUrl)
    if (row.processedPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(row.processedPreviewUrl)
  })
}

export function useImageCompressWorkbench(options: ImageCompressWorkbenchOptions) {
  const rows = ref<CompressWorkbenchRow[]>([])
  const processing = ref(false)
  const processedOnce = ref(false)
  const selectedRowId = ref('')
  const processMode = ref<ProcessMode>('batch')
  const targetWidth = ref(IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH)
  const targetHeight = ref(1080)
  const targetWidthInput = ref(String(IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH))
  const targetHeightInput = ref('1080')
  const quality = ref(IMAGE_UPLOAD_COMPRESS_DEFAULT_QUALITY)
  const lockRatio = ref(true)
  const activeRatioLabel = ref('')
  const useSourceWidth = ref(getRememberedSourceWidthPreference())
  const ratioPresets = DEFAULT_RATIO_PRESETS

  const oversizeRows = computed(() => rows.value.filter((row) => row.isOversize))
  const sortedRows = computed(() => [...rows.value].sort((a, b) => Number(b.isOversize) - Number(a.isOversize)))
  const hasUnresolvedOversize = computed(() => rows.value.some((row) => row.isOversize))
  const selectedRow = computed(() => sortedRows.value.find((row) => row.id === selectedRowId.value) || sortedRows.value[0] || null)
  const isSingleRowScenario = computed(() => rows.value.length <= 1)
  const activeProcessMode = computed<ProcessMode>(() => {
    if (isSingleRowScenario.value) return 'single'
    if (useSourceWidth.value) return 'batch'
    return processMode.value
  })
  const formReferenceRow = computed(() => {
    if (activeProcessMode.value === 'single') return selectedRow.value
    return rows.value[0] || null
  })
  const currentSourceWidth = computed(() => formReferenceRow.value?.meta.width || 0)
  const currentRatio = computed(() => {
    const row = formReferenceRow.value
    return row?.meta?.width && row?.meta?.height ? row.meta.width / row.meta.height : 0
  })
  const maxTargetWidth = computed(() => Math.max(1, currentSourceWidth.value || 4096))
  const processActionLabel = computed(() => {
    if (activeProcessMode.value === 'single') return selectedRow.value?.processedFile ? '重新处理当前图' : '处理当前图'
    return processedOnce.value ? '重新处理' : '开始处理'
  })

  function reloadSourceWidthPreference() {
    useSourceWidth.value = getRememberedSourceWidthPreference()
  }

  function applySettingsToForm(settings: RowCompressSettings, options?: { preserveSourceWidth?: boolean }) {
    targetWidth.value = settings.targetWidth
    targetHeight.value = settings.targetHeight
    quality.value = settings.quality
    lockRatio.value = settings.lockRatio
    activeRatioLabel.value = settings.activeRatioLabel
    if (!options?.preserveSourceWidth) {
      useSourceWidth.value = settings.useSourceWidth
    }
  }

  function syncHeightFromCurrentMode() {
    if (lockRatio.value) {
      if (currentRatio.value > 0) targetHeight.value = Math.max(1, Math.round(targetWidth.value / currentRatio.value))
      return
    }
    const activeRatio = ratioPresets.find((item) => item.label === activeRatioLabel.value)
    if (activeRatio) targetHeight.value = Math.max(1, Math.round(targetWidth.value / activeRatio.value))
  }

  function persistSelectedRowSettings() {
    if (activeProcessMode.value !== 'single' || !selectedRow.value) return
    selectedRow.value.settings = {
      targetWidth: targetWidth.value,
      targetHeight: targetHeight.value,
      quality: quality.value,
      lockRatio: lockRatio.value,
      activeRatioLabel: activeRatioLabel.value,
      useSourceWidth: selectedRow.value.settings.useSourceWidth,
    }
  }

  function syncFormFromMode() {
    if (activeProcessMode.value === 'single') {
      if (selectedRow.value) {
        applySettingsToForm(selectedRow.value.settings, { preserveSourceWidth: true })
      }
      return
    }
    targetWidth.value = Math.min(IMAGE_UPLOAD_COMPRESS_DEFAULT_WIDTH, maxTargetWidth.value)
    targetHeight.value = 1080
    quality.value = IMAGE_UPLOAD_COMPRESS_DEFAULT_QUALITY
    lockRatio.value = true
    activeRatioLabel.value = ''
    syncHeightFromCurrentMode()
  }

  function getRowProcessingSettings(row: CompressWorkbenchRow): RowCompressSettings {
    if (activeProcessMode.value === 'single') {
      return {
        ...row.settings,
        targetWidth: targetWidth.value,
        targetHeight: targetHeight.value,
        quality: quality.value,
        lockRatio: lockRatio.value,
        activeRatioLabel: activeRatioLabel.value,
        useSourceWidth: useSourceWidth.value,
      }
    }
    return {
      targetWidth: targetWidth.value,
      targetHeight: targetHeight.value,
      quality: quality.value,
      lockRatio: lockRatio.value,
      activeRatioLabel: activeRatioLabel.value,
      useSourceWidth: useSourceWidth.value,
    }
  }

  function setProcessMode(mode: ProcessMode) {
    if (processMode.value === mode) return
    processMode.value = mode
    syncFormFromMode()
  }

  function applyRatioPreset(ratio: RatioPreset) {
    activeRatioLabel.value = ratio.label
    lockRatio.value = false
    targetHeight.value = Math.max(1, Math.round(targetWidth.value / ratio.value))
  }

  async function rebuildRows(files: File[]) {
    reloadSourceWidthPreference()
    revokeRowUrls(rows.value)
    rows.value = await Promise.all(files.map((file, index) => buildRow(file, index, options.maxBytes.value)))
    processedOnce.value = false
    processMode.value = 'batch'
    selectedRowId.value = rows.value[0]?.id || ''
    syncFormFromMode()
  }

  async function processRows() {
    // 手动弹窗：点「开始处理」就处理所有行，阈值只用于排序/超限提醒，不当硬闸门
    const targetRows = activeProcessMode.value === 'single'
      ? (selectedRow.value ? [selectedRow.value] : [])
      : rows.value.slice()
    if (!targetRows.length) return
    processing.value = true
    try {
      for (const row of targetRows) {
        if (row.processedPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(row.processedPreviewUrl)
        row.processedFile = null
        row.processedMeta = null
        row.processedPreviewUrl = ''
        row.error = ''
        row.processing = true
      }
      for (const row of targetRows) {
        try {
          const settings = getRowProcessingSettings(row)
          const processedFile = await options.processRow({ row, settings, maxBytes: options.maxBytes.value })
          row.processedFile = processedFile
          row.processedMeta = await getImageFileMeta(processedFile).catch(() => null)
          row.processedPreviewUrl = URL.createObjectURL(processedFile)
          row.isOversize = processedFile.size > options.maxBytes.value
          if (row.isOversize) row.error = '仍然超限'
        } catch (error) {
          row.error = error instanceof Error ? error.message : '压缩失败'
        } finally {
          row.processing = false
        }
      }
      processedOnce.value = true
    } finally {
      processing.value = false
    }
  }

  watch(targetWidthInput, (value) => {
    targetWidth.value = sanitizeDimension(value, targetWidth.value, 1, maxTargetWidth.value)
  })
  watch(targetHeightInput, (value) => {
    targetHeight.value = sanitizeDimension(value, targetHeight.value, 0)
  })
  watch(targetWidth, () => {
    targetWidthInput.value = String(targetWidth.value)
    syncHeightFromCurrentMode()
    persistSelectedRowSettings()
  })
  watch(targetHeight, () => {
    targetHeightInput.value = String(targetHeight.value)
    persistSelectedRowSettings()
  })
  watch(lockRatio, () => {
    if (lockRatio.value) activeRatioLabel.value = ''
    syncHeightFromCurrentMode()
    persistSelectedRowSettings()
  })
  watch(quality, persistSelectedRowSettings)
  watch(activeRatioLabel, persistSelectedRowSettings)
  watch(useSourceWidth, (value) => {
    setStorage(SOURCE_WIDTH_REMEMBER_KEY, value)
    persistSelectedRowSettings()
  })
  watch(selectedRowId, () => {
    if (activeProcessMode.value === 'single') syncFormFromMode()
  })

  return {
    rows,
    processing,
    processedOnce,
    selectedRowId,
    processMode,
    targetWidthInput,
    targetHeightInput,
    quality,
    lockRatio,
    activeRatioLabel,
    useSourceWidth,
    maxBytes: options.maxBytes,
    ratioPresets,
    oversizeRows,
    sortedRows,
    hasUnresolvedOversize,
    selectedRow,
    isSingleRowScenario,
    activeProcessMode,
    currentSourceWidth,
    processActionLabel,
    setProcessMode,
    applyRatioPreset,
    processRows,
    rebuildRows,
    reloadSourceWidthPreference,
    dispose: () => revokeRowUrls(rows.value),
  }
}

export async function processImageCompressRow(args: {
  row: CompressWorkbenchRow
  settings: RowCompressSettings
  maxBytes: number
}) {
  const sourceWidth = Math.max(1, args.row.meta.width || 1)
  const sourceHeight = Math.max(1, args.row.meta.height || 1)
  return await compressImageFileToLimit(args.row.file, {
    maxBytes: args.maxBytes,
    targetWidth: args.settings.useSourceWidth ? sourceWidth : args.settings.targetWidth,
    targetHeight: args.settings.useSourceWidth ? sourceHeight : args.settings.targetHeight,
    lockRatio: args.settings.lockRatio,
    fixedRatio: args.settings.lockRatio
      ? 0
      : (DEFAULT_RATIO_PRESETS.find((item) => item.label === args.settings.activeRatioLabel)?.value || 0),
    quality: args.settings.quality,
    // 手动弹窗里用户明确点了「开始处理」，即使原文件低于阈值也要按设置重新编码
    force: true,
  })
}
