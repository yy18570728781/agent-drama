<template>
  <aside class="compress-workbench-panel">
    <div v-if="showStats || showUploadMore" class="compress-sidehead">
      <div v-if="showStats" class="compress-stats-strip">
        <div class="compress-stat-pill danger">
          <span class="stat-pill-label">待处理大图</span>
          <span class="stat-pill-value">{{ oversizeCount }}</span>
        </div>
        <div class="compress-stat-pill">
          <span class="stat-pill-label">上传上限</span>
          <span class="stat-pill-value">{{ maxBytesText }}</span>
        </div>
      </div>
      <el-button v-if="showUploadMore" class="compress-upload-more" size="small" @click="openFilePicker">继续上传</el-button>
    </div>

    <div class="compress-panel">
      <div class="compress-panel-head">
        <div class="compress-panel-title">压缩参数</div>
        <div class="compress-panel-sub">{{ processMode === 'batch' ? '统一参数会作用到当前全部图片。' : '当前参数只作用到选中的这一张图片。' }}</div>
      </div>

      <div class="compress-ratio-card">
        <label class="ratio-lock">
          <input :checked="lockRatio" type="checkbox" @change="emit('update:lockRatio', readCheckbox($event))" />
          <span>锁定原图宽高比</span>
        </label>
        <template v-if="!lockRatio">
          <span class="ratio-meta-label">预设比例</span>
          <div class="ratio-chip-row">
            <button
              v-for="ratio in ratioPresets"
              :key="ratio.label"
              type="button"
              class="ratio-chip"
              :class="{ active: activeRatioLabel === ratio.label }"
              @click="emit('apply-ratio-preset', ratio)"
            >
              {{ ratio.label }}
            </button>
          </div>
        </template>
      </div>

      <div class="compress-controls">
        <div v-if="showModeSwitch" class="compress-mode-switch">
          <button type="button" class="mode-chip" :class="{ active: processMode === 'batch' }" @click="emit('update:processMode', 'batch')">统一处理</button>
          <button type="button" class="mode-chip" :class="{ active: processMode === 'single' }" @click="emit('update:processMode', 'single')">分批处理</button>
        </div>
        <div class="control-inline control-inline-row">
          <div class="control-label">目标宽度</div>
          <el-input
            v-if="!useSourceWidth"
            :model-value="targetWidthInput"
            inputmode="numeric"
            @update:model-value="emit('update:targetWidthInput', String($event ?? ''))"
          />
          <label v-if="showSourceWidthToggle" class="source-width-toggle inline">
            <input :checked="useSourceWidth" type="checkbox" @change="emit('update:useSourceWidth', readCheckbox($event))" />
            <span>原图宽度</span>
          </label>
        </div>
        <div v-if="showTargetHeight" class="control-inline control-inline-row">
          <div class="control-label">目标高度</div>
          <el-input
            :model-value="targetHeightInput"
            inputmode="numeric"
            @update:model-value="emit('update:targetHeightInput', String($event ?? ''))"
          />
        </div>
        <div class="control-inline control-inline-row quality-inline">
          <div class="control-label">输出质量</div>
          <div class="quality-row">
            <el-slider :model-value="quality" :min="40" :max="95" :step="1" @update:model-value="emit('update:quality', Number($event ?? 40))" />
            <span class="quality-value">{{ quality }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="compress-list-pane">
      <div class="list-pane-header">
        <div class="list-pane-header-copy">
          <div class="list-pane-title">处理列表</div>
          <div class="list-pane-sub">{{ rows.length }} 张</div>
        </div>
      </div>
      <div class="compress-list">
        <button
          v-for="row in rows"
          :key="row.id"
          type="button"
          class="compress-list-item"
          :class="{ active: selectedRowId === row.id, oversize: row.isOversize, error: !!row.error }"
          @click="emit('update:selectedRowId', row.id)"
        >
          <div class="list-item-image-wrap">
            <img v-if="row.previewUrl" :src="row.previewUrl" alt="" class="list-item-image" draggable="false" />
            <span v-if="row.processing" class="status-chip image-badge">处理中</span>
            <span v-else-if="row.error" class="status-chip danger image-badge">{{ row.error }}</span>
            <span v-else-if="row.processedFile && row.processedFile.size <= maxBytes" class="status-chip success image-badge">已压缩</span>
            <span v-else-if="row.isOversize" class="status-chip danger image-badge">超限</span>
            <span v-else class="status-chip image-badge">正常</span>
          </div>
          <div class="list-item-copy">
            <div class="file-grid">
              <span class="file-kv"><span class="file-k">原始</span><span class="file-v">{{ formatSize(row.file.size) }}</span></span>
              <span class="file-kv"><span class="file-k">尺寸</span><span class="file-v">{{ row.meta.width }} × {{ row.meta.height }}</span></span>
              <span class="file-kv"><span class="file-k">压后</span><span class="file-v">{{ row.processedFile ? formatSize(row.processedFile.size) : '未处理' }}</span></span>
              <span class="file-kv"><span class="file-k">压后尺寸</span><span class="file-v">{{ row.processedMeta ? `${row.processedMeta.width} × ${row.processedMeta.height}` : '未处理' }}</span></span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <div class="compress-workbench-actions">
      <el-button class="compress-process-btn" :loading="processing" :disabled="processDisabled" @click="emit('process')">{{ processActionLabel }}</el-button>
    </div>
  </aside>

  <input
    v-if="showUploadMore"
    ref="fileInputRef"
    type="file"
    accept="image/*"
    multiple
    class="hidden-file-input"
    @change="handleFilePick"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { CompressWorkbenchRow, ProcessMode, RatioPreset } from './imageCompressWorkbench.types'

const props = defineProps<{
  oversizeCount: number
  maxBytes: number
  maxBytesText: string
  showStats?: boolean
  showUploadMore?: boolean
  rows: CompressWorkbenchRow[]
  selectedRowId: string
  processMode: ProcessMode
  showModeSwitch: boolean
  targetWidthInput: string
  targetHeightInput: string
  quality: number
  lockRatio: boolean
  activeRatioLabel: string
  useSourceWidth: boolean
  showSourceWidthToggle: boolean
  showTargetHeight: boolean
  ratioPresets: RatioPreset[]
  processing: boolean
  processDisabled?: boolean
  processActionLabel: string
}>()

const emit = defineEmits<{
  (e: 'update:selectedRowId', value: string): void
  (e: 'update:processMode', value: ProcessMode): void
  (e: 'update:targetWidthInput', value: string): void
  (e: 'update:targetHeightInput', value: string): void
  (e: 'update:quality', value: number): void
  (e: 'update:lockRatio', value: boolean): void
  (e: 'update:useSourceWidth', value: boolean): void
  (e: 'apply-ratio-preset', value: RatioPreset): void
  (e: 'append-files', value: File[]): void
  (e: 'process'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function readCheckbox(event: Event) {
  return Boolean((event.target as HTMLInputElement | null)?.checked)
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleFilePick(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files || []).filter((file) => file.type?.startsWith('image/'))
  if (files.length) emit('append-files', files)
  if (input) input.value = ''
}
</script>

<style scoped lang="scss">
.compress-workbench-panel { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.compress-sidehead { display: flex; flex-direction: column; gap: 10px; }
.compress-stats-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.compress-stat-pill { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: 10px; border: 1px solid #27272a; background: linear-gradient(180deg, rgba(24,24,27,.96), rgba(17,18,20,.98)); min-width: 0; }
.compress-stat-pill.danger { border-color: rgba(239,68,68,.24); background: linear-gradient(180deg, rgba(52,17,20,.36), rgba(17,18,20,.98)); }
.stat-pill-label { font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat-pill-value { font-size: 12px; font-weight: 700; color: #fafafa; white-space: nowrap; }
.compress-upload-more { width: 100%; }
.compress-panel,
.compress-list-pane { border: 1px solid #27272a; border-radius: 16px; background: linear-gradient(180deg, rgba(24,24,27,.92), rgba(17,18,20,.96)); }
.compress-panel { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.compress-panel-head { display: flex; flex-direction: column; gap: 4px; }
.compress-panel-title { font-size: 13px; font-weight: 700; color: #f4f4f5; }
.compress-panel-sub { font-size: 11px; line-height: 1.5; color: #71717a; }
.compress-ratio-card { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid #2f2f35; border-radius: 12px; background: rgba(14,14,16,.68); flex-wrap: wrap; }
.ratio-lock { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #f4f4f5; white-space: nowrap; }
.ratio-meta-label { font-size: 11px; color: #a1a1aa; white-space: nowrap; }
.ratio-chip-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ratio-chip { height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid #3f3f46; background: #111214; color: #d4d4d8; font-size: 11px; transition: .18s ease; }
.ratio-chip.active { border-color: #818cf8; background: rgba(99,102,241,.16); color: #c7d2fe; }
.compress-controls { display: grid; gap: 8px; }
.compress-mode-switch { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border: 1px solid #2f2f35; border-radius: 12px; background: rgba(14,14,16,.68); }
.mode-chip { height: 30px; border: none; border-radius: 8px; background: transparent; color: #d4d4d8; font-size: 12px; font-weight: 600; cursor: pointer; }
.mode-chip.active { background: rgba(99,102,241,.16); color: #c7d2fe; }
.control-inline { display: flex; align-items: center; gap: 10px; min-width: 0; }
.control-inline :deep(.el-input) { margin-left: auto; width: 96px; }
.control-label { font-size: 11px; color: #a1a1aa; white-space: nowrap; }
.source-width-toggle.inline { margin-left: 10px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #d4d4d8; }
.quality-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.quality-value { font-size: 12px; color: #f4f4f5; white-space: nowrap; }
.compress-list-pane { min-height: 220px; max-height: 320px; display: flex; flex-direction: column; overflow: hidden; }
.list-pane-header { padding: 12px 14px; border-bottom: 1px solid #202127; }
.list-pane-title { font-size: 13px; font-weight: 600; color: #f4f4f5; }
.list-pane-sub { margin-top: 4px; font-size: 11px; color: #71717a; }
.compress-list { padding: 10px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.compress-list-item { width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 10px; border: 1px solid #23242a; border-radius: 14px; background: rgba(22,22,24,.72); text-align: left; transition: .18s ease; position: relative; }
.compress-list-item.active { border-color: #818cf8; background: rgba(79,70,229,.12); }
.compress-list-item.oversize:not(.active) { border-color: rgba(239,68,68,.22); }
.list-item-image-wrap { position: relative; flex-shrink: 0; }
.list-item-image { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(255,255,255,.08); }
.list-item-copy { min-width: 0; flex: 1; }
.file-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
.file-kv { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.file-k { color: #71717a; font-size: 11px; }
.file-v { color: #e4e4e7; font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-chip { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; background: #27272a; color: #e4e4e7; font-weight: 600; }
.status-chip.success { background: rgba(34,197,94,.16); color: #86efac; }
.status-chip.danger { background: rgba(239,68,68,.15); color: #fca5a5; }
.image-badge { position: absolute; top: 6px; left: 6px; height: 22px; padding: 0 7px; font-size: 11px; backdrop-filter: blur(10px); background: rgba(10,12,16,.76); border: 1px solid rgba(255,255,255,.08); }
.compress-workbench-actions { display: flex; }
.compress-process-btn { width: 100%; }
.hidden-file-input { display: none; }
</style>
