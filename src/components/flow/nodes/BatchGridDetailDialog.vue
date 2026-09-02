<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ImagePreviewModal from '@/components/common/ImagePreviewModal.vue'
import { findTeamonesAigcRecord } from '@/api/assets'
import { assetToHistoryRecord, getAssetModelLabel } from '@/components/generation/generationResultAdapters'

type BatchGridDetailSourceItem = {
  id: string
  label: string
  url: string
  displayUrl: string
  thumb: string
  recordId: string
}

type HistoryOverrideItem = {
  id: string
  thumbnail: string
  source: string
  title: string
  subtitle: string
  asset: any
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  items?: BatchGridDetailSourceItem[]
}>(), {
  label: '批量详情',
  items: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const loadingVisible = ref(false)
const previewVisible = ref(false)
const loadedCount = ref(0)
const detailItems = ref<HistoryOverrideItem[]>([])
const selectedRecord = ref<any | null>(null)

const totalCount = computed(() => props.items.filter((item) => item.recordId && (item.url || item.displayUrl)).length)
const previewImages = computed(() => detailItems.value.map((item) => item.source).filter(Boolean))
const previewInfo = computed(() => {
  if (!selectedRecord.value) return null
  const record = assetToHistoryRecord(selectedRecord.value)
  return {
    prompt: record.prompt,
    model: record.modelInfo,
    modelDisplayName: record.modelDisplayName,
    modelVendor: record.modelVendor,
    capability: record.capability,
    mode: record._asset?.mode || '',
    recordId: selectedRecord.value?.id || '',
    createTime: record.date,
    referenceUrls: record.reference_urls || [],
    paramsDisplay: record.params_display || [],
    generateParams: record.param || null,
  }
})
const previewRecordId = computed(() => selectedRecord.value?.id || undefined)

function resetState(): void {
  loadingVisible.value = false
  previewVisible.value = false
  loadedCount.value = 0
  detailItems.value = []
  selectedRecord.value = null
}

function buildHistoryItem(sourceItem: BatchGridDetailSourceItem, record: any, index: number): HistoryOverrideItem {
  const source = String(sourceItem.url || sourceItem.displayUrl || '').trim()
  const thumbnail = String(sourceItem.thumb || sourceItem.displayUrl || source).trim()
  const modelLabel = String(getAssetModelLabel(record) || '').trim()
  return {
    id: sourceItem.id || `${sourceItem.recordId}-${index}`,
    thumbnail,
    source,
    title: String(sourceItem.label || `结果 ${index + 1}`).trim() || `结果 ${index + 1}`,
    subtitle: modelLabel ? `#${sourceItem.recordId} · ${modelLabel}` : `#${sourceItem.recordId}`,
    asset: record,
  }
}

async function loadRecords(): Promise<void> {
  const sourceItems = props.items.filter((item) => item.recordId && (item.url || item.displayUrl))
  if (!sourceItems.length) {
    resetState()
    return
  }
  loadingVisible.value = true
  previewVisible.value = false
  loadedCount.value = 0
  detailItems.value = []
  selectedRecord.value = null
  const nextItems: HistoryOverrideItem[] = []
  for (let index = 0; index < sourceItems.length; index += 1) {
    const sourceItem = sourceItems[index]
    try {
      const record = await findTeamonesAigcRecord(sourceItem.recordId)
      if (record) {
        nextItems.push(buildHistoryItem(sourceItem, record, index))
        if (!selectedRecord.value) selectedRecord.value = record
      }
    } finally {
      loadedCount.value = index + 1
      detailItems.value = [...nextItems]
    }
  }
  loadingVisible.value = false
  previewVisible.value = detailItems.value.length > 0
  if (!detailItems.value.length) emit('update:modelValue', false)
}

function handlePreviewVisibleChange(value: boolean): void {
  previewVisible.value = value
  if (!value) emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      resetState()
      return
    }
    void loadRecords()
  },
)
</script>

<template>
  <el-dialog
    :model-value="loadingVisible"
    width="min(94vw, 420px)"
    destroy-on-close
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="batch-grid-detail-loading-dialog"
  >
    <div class="batch-grid-detail-loading">
      <div class="batch-grid-detail-loading-title">{{ label || '批量详情' }}</div>
      <div class="batch-grid-detail-loading-subtitle">正在加载详情 {{ loadedCount }}/{{ totalCount }}</div>
      <el-progress
        :percentage="totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 0"
        :stroke-width="10"
      />
    </div>
  </el-dialog>

  <ImagePreviewModal
    v-model:visible="previewVisible"
    :images="previewImages"
    :initial-index="0"
    :image-info="previewInfo"
    :record-id="previewRecordId"
    :history-items-override="detailItems"
    :full-mode="true"
    :show-inspector="true"
    :show-actions="true"
    :show-ai-tools="true"
    :show-workflow-actions="false"
    :show-favorite="false"
    :show-share="false"
    :show-delete="false"
    @update:visible="handlePreviewVisibleChange"
  />
</template>

<style scoped>
.batch-grid-detail-loading {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 4px;
}

.batch-grid-detail-loading-title {
  font-size: 18px;
  font-weight: 700;
  color: #fafafa;
}

.batch-grid-detail-loading-subtitle {
  font-size: 13px;
  color: #a1a1aa;
}
</style>
