<template>
  <el-dialog
    :model-value="visible"
    width="min(94vw, 1480px)"
    top="4vh"
    destroy-on-close
    class="image-compress-dialog"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <template #header>
      <div class="compress-header">
        <div class="compress-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="14" rx="3"></rect>
            <path d="M8 21h8"></path>
            <path d="M12 18v3"></path>
            <path d="M8.5 13.5 11 11l2 2 3.5-4 2 3"></path>
          </svg>
        </div>
        <div class="compress-header-copy">
          <div class="compress-title">上传前压缩图片</div>
          <div class="compress-subtitle">超限图片会优先排在左侧上方。先处理，再批量上传，避免工作流里堆进一批大图。</div>
        </div>
      </div>
    </template>

    <div class="compress-layout">
      <section
        class="compress-main"
        :class="{ 'is-dragging': isDragging }"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <template v-if="selectedRow">
          <div class="preview-pane-header"></div>
          <div class="preview-stage-shell">
            <MediaCompareStage
              v-if="selectedRow.processedPreviewUrl"
              :images="[selectedRow.previewUrl, selectedRow.processedPreviewUrl]"
              :current-index="1"
              :display-image="selectedRow.processedPreviewUrl"
              :compare-mode="true"
              compare-type="overlay"
              :has-compare="true"
              :compare-left-image="selectedRow.previewUrl"
              :compare-right-image="selectedRow.processedPreviewUrl"
              compare-left-label="原图"
              compare-right-label="新图"
            />
            <div v-else class="preview-original-stage">
              <img :src="selectedRow.previewUrl" alt="" class="preview-original-image" draggable="false" />
              <div class="preview-original-overlay">
                <div class="preview-placeholder-title">{{ processedOnce ? '当前图片还没有可用结果' : '等待开始处理' }}</div>
                <div class="preview-placeholder-sub">原图会先铺在底下，点击“开始处理”后会直接叠加压缩结果对比。</div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="compress-empty-dropzone">
          <div class="compress-empty-title">请拖入一个或多个文件</div>
          <div class="compress-empty-sub">支持批量拖入图片，自动加入处理列表</div>
        </div>
      </section>

      <ImageCompressWorkbenchPanel
        :oversize-count="oversizeRows.length"
        :max-bytes="maxBytes"
        :max-bytes-text="formatSize(maxBytes)"
        :show-stats="true"
        :show-upload-more="true"
        :rows="sortedRows"
        :selected-row-id="selectedRowId"
        :process-mode="activeProcessMode"
        :show-mode-switch="!isSingleRowScenario && !useSourceWidth"
        :target-width-input="targetWidthInput"
        :target-height-input="targetHeightInput"
        :quality="quality"
        :lock-ratio="lockRatio"
        :active-ratio-label="activeRatioLabel"
        :use-source-width="useSourceWidth"
        :show-source-width-toggle="currentSourceWidth > 0"
        :show-target-height="!lockRatio"
        :ratio-presets="ratioPresets"
        :processing="processing"
        :process-action-label="processActionLabel"
        @update:selected-row-id="setSelectedRowId"
        @update:process-mode="setProcessMode"
        @update:target-width-input="setTargetWidthInput"
        @update:target-height-input="setTargetHeightInput"
        @update:quality="setQuality"
        @update:lock-ratio="setLockRatio"
        @update:use-source-width="setUseSourceWidth"
        @apply-ratio-preset="applyRatioPreset"
        @append-files="appendFiles"
        @process="processOversizeRows"
      />
    </div>

    <template #footer>
      <div class="compress-footer">
        <div class="footer-left">
          <span v-if="hasUnresolvedOversize" class="footer-warning">还有图片超出 {{ formatSize(maxBytes) }}，请先处理。</span>
        </div>
        <div class="footer-actions">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" :disabled="hasUnresolvedOversize" @click="handleConfirm">批量上传</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useThemeStore } from '@/styles/theme/store/theme'
import MediaCompareStage from './MediaCompareStage.vue'
import ImageCompressWorkbenchPanel from './ImageCompressWorkbenchPanel.vue'
import { processImageCompressRow, useImageCompressWorkbench } from './useImageCompressWorkbench'

const props = defineProps<{ visible: boolean; files: File[]; maxBytes?: number }>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', files: File[]): void
  (e: 'cancel'): void
}>()

const themeStore = useThemeStore()
const fallbackBytes = computed(() => themeStore.compressThresholdMb * 1024 * 1024)
const maxBytes = computed(() => Math.max(1024 * 1024, Number(props.maxBytes || fallbackBytes.value)))
const workbench = useImageCompressWorkbench({
  maxBytes,
  processRow: async ({ row, settings, maxBytes: limit }) => {
    return await processImageCompressRow({ row, settings, maxBytes: limit })
  },
})
const {
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
  processRows: processOversizeRows,
  rebuildRows,
  dispose,
} = workbench

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

watch(() => props.visible, async (visible) => {
  if (!visible) return
  await rebuildRows(Array.isArray(props.files) ? props.files.filter((file) => file?.type?.startsWith('image/')) : [])
}, { immediate: true })

async function appendFiles(files: File[]) {
  if (!files.length) return
  await rebuildRows([...rows.value.map((row) => row.file), ...files])
}

const isDragging = ref(false)

function onDragEnter() {
  isDragging.value = true
}

function onDragOver() {
  isDragging.value = true
}

function onDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  if (related && (event.currentTarget as HTMLElement)?.contains(related)) return
  isDragging.value = false
}

async function onDrop(event: DragEvent) {
  isDragging.value = false
  const dropped = Array.from(event.dataTransfer?.files || []).filter((file) => file.type?.startsWith('image/'))
  if (dropped.length) await appendFiles(dropped)
}

function setSelectedRowId(value: string) {
  selectedRowId.value = value
}

function setTargetWidthInput(value: string) {
  targetWidthInput.value = value
}

function setTargetHeightInput(value: string) {
  targetHeightInput.value = value
}

function setQuality(value: number) {
  quality.value = value
}

function setLockRatio(value: boolean) {
  lockRatio.value = value
}

function setUseSourceWidth(value: boolean) {
  useSourceWidth.value = value
}

function handleCancel() {
  emit('update:visible', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm', rows.value.map((row) => row.processedFile || row.file))
  emit('update:visible', false)
}

onBeforeUnmount(dispose)
</script>

<style scoped lang="scss">
@use './ImageCompressDialog.scss';
</style>
