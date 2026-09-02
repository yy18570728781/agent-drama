import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ModelParamSchema } from '@/api/models'
import type { ReferenceImage } from './referenceMedia.types'
import { filterDynamicVisibleParams } from './dynamicParamFormCombos'

export const SMART_MULTI_FRAME_MAX_ITEMS = 24

export interface SmartMultiFrameRow {
  id: string
  startIndex: number
  endIndex: number
  firstImage: ReferenceImage
  lastImage: ReferenceImage
  prompt: string
  params: Record<string, unknown>
}

interface UseSmartMultiFrameOptions {
  fileParamDef: ComputedRef<ModelParamSchema | null>
  modelParams: Ref<ModelParamSchema[]>
  refImages: Ref<ReferenceImage[]>
  prompt: Ref<string>
  paramValues: Ref<Record<string, unknown>>
  selectedMode?: Ref<string>
  enabledRef?: Ref<boolean>
}

function isFirstLastFrameMode(fileParam: ModelParamSchema | null): boolean {
  const names = fileParam?.sub_params?.map((item) => item.name) || []
  return names.length === 2 && names[0] === 'first_frame' && names[1] === 'last_frame'
}

function formatParamValue(param: ModelParamSchema, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (param.options?.length) {
    const matched = param.options.find((option) => {
      if (typeof option === 'string') return option === value
      return option.value === value
    })
    if (matched) return typeof matched === 'string' ? matched : matched.label
  }
  return String(value)
}

function buildEditableParams(params: ModelParamSchema[]): ModelParamSchema[] {
  return filterDynamicVisibleParams(params, ['prompt', 'file_urls', 'model', 'mode'])
}

function buildRowParams(
  rowId: string,
  paramValues: Record<string, unknown>,
  rowParamMap: Record<string, Record<string, unknown>>,
  editableParams: ModelParamSchema[],
): Record<string, unknown> {
  const baseValues = editableParams.reduce<Record<string, unknown>>((result, param) => {
    result[param.name] = paramValues[param.name] ?? param.default ?? null
    return result
  }, {})
  return { ...baseValues, ...(rowParamMap[rowId] || {}) }
}

export function useSmartMultiFrame(options: UseSmartMultiFrameOptions) {
  const { fileParamDef, modelParams, refImages, prompt, paramValues, selectedMode } = options
  const smartMultiFrameEnabled = options.enabledRef || ref(false)
  const rowPromptMap = ref<Record<string, string>>({})
  const rowParamMap = ref<Record<string, Record<string, unknown>>>({})
  const currentModeId = computed(() => selectedMode?.value || '')
  const editableParams = computed(() => buildEditableParams(modelParams.value))

  const smartMultiFrameAvailable = computed(() => (
    currentModeId.value === 'first_last_frame' || isFirstLastFrameMode(fileParamDef.value)
  ))

  const effectiveFileParamDef = computed<ModelParamSchema | null>(() => {
    if (!smartMultiFrameEnabled.value || !fileParamDef.value) return fileParamDef.value
    return {
      ...fileParamDef.value,
      label: '帧序列参考',
      min_items: 2,
      max_items: SMART_MULTI_FRAME_MAX_ITEMS,
      sub_params: undefined,
    }
  })

  const referenceMaxItemsOverride = computed<number | null>(() => (
    smartMultiFrameEnabled.value ? SMART_MULTI_FRAME_MAX_ITEMS : null
  ))

  const smartMultiFrameRows = computed<SmartMultiFrameRow[]>(() => {
    const rows: SmartMultiFrameRow[] = []
    for (let index = 0; index < refImages.value.length - 1; index += 1) {
      const nextIndex = index + 1
      const key = `${index}-${nextIndex}`
      rows.push({
        id: key,
        startIndex: index,
        endIndex: nextIndex,
        firstImage: refImages.value[index],
        lastImage: refImages.value[nextIndex],
        prompt: rowPromptMap.value[key] ?? '',
        params: buildRowParams(key, paramValues.value, rowParamMap.value, editableParams.value),
      })
    }
    return rows
  })

  function setSmartMultiFrameEnabled(nextValue: boolean): void {
    if (nextValue && !smartMultiFrameAvailable.value) return
    if (!nextValue && refImages.value.length > 2) {
      refImages.value = refImages.value.slice(0, 2)
      ElMessage.info('已退出智能多帧，仅保留前两张参考图')
    }
    smartMultiFrameEnabled.value = nextValue
  }

  function updateRowPrompt(rowId: string, value: string): void {
    rowPromptMap.value = { ...rowPromptMap.value, [rowId]: value }
  }

  function updateRowParam(rowId: string, paramName: string, value: unknown): void {
    rowParamMap.value = {
      ...rowParamMap.value,
      [rowId]: {
        ...(rowParamMap.value[rowId] || {}),
        [paramName]: value,
      },
    }
  }

  function buildSmartMultiFrameTasks(uploadedUrls: string[]): Array<{ prompt: string; file_urls: string[]; params: Record<string, unknown> }> {
    return smartMultiFrameRows.value
      .map((row) => ({
        prompt: row.prompt.trim(),
        file_urls: [uploadedUrls[row.startIndex], uploadedUrls[row.endIndex]].filter(Boolean),
        params: row.params,
      }))
      .filter((row) => row.file_urls.length === 2)
  }

  watch(smartMultiFrameAvailable, (available) => {
    if (!available && smartMultiFrameEnabled.value) {
      setSmartMultiFrameEnabled(false)
    }
  }, { immediate: true })

  watch(
    () => smartMultiFrameRows.value.map((row) => row.id).join('|'),
    () => {
      const nextPromptMap: Record<string, string> = {}
      const nextParamMap: Record<string, Record<string, unknown>> = {}
      smartMultiFrameRows.value.forEach((row) => {
        nextPromptMap[row.id] = rowPromptMap.value[row.id] ?? ''
        nextParamMap[row.id] = rowParamMap.value[row.id] || {}
      })
      rowPromptMap.value = nextPromptMap
      rowParamMap.value = nextParamMap
    },
    { immediate: true }
  )

  return {
    smartMultiFrameAvailable,
    smartMultiFrameEnabled,
    effectiveFileParamDef,
    referenceMaxItemsOverride,
    editableParams,
    smartMultiFrameRows,
    setSmartMultiFrameEnabled,
    updateRowPrompt,
    updateRowParam,
    buildSmartMultiFrameTasks,
    formatParamValue,
  }
}
