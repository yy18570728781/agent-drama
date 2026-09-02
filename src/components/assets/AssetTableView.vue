<script setup lang="ts">
import { computed } from 'vue'
import type { AssetItem, AssetUrlObject } from '@/api/assets'

const props = defineProps<{
  items: AssetItem[]
  restoreSupported: boolean
  scrollTop: number
  selectedIds: Set<string>
  trash: boolean
  viewportHeight: number
}>()

defineEmits<{
  delete: [id: string]
  download: [asset: AssetItem]
  favorite: [id: string]
  restore: [id: string]
  select: [asset: AssetItem]
}>()

const ROW_HEIGHT = 52
const OVERSCAN_ROWS = 10
const startIndex = computed(() => Math.max(0, Math.floor(props.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS))
const endIndex = computed(() => Math.min(
  props.items.length,
  startIndex.value + Math.ceil(props.viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2,
))
const totalHeight = computed(() => props.items.length * ROW_HEIGHT)
const visibleRows = computed(() => props.items.slice(startIndex.value, endIndex.value).map((asset, index) => ({
  asset,
  top: (startIndex.value + index) * ROW_HEIGHT,
})))

function resolveUrl(value: string | AssetUrlObject | null): string {
  if (typeof value === 'string') return value
  return value?.origin_url || value?.proxy_url || ''
}

function getReferenceUrls(asset: AssetItem): string[] {
  return (asset.reference_urls || []).flatMap((value) => {
    const url = resolveUrl(value)
    return url ? [url] : []
  })
}

function formatFileSize(size: number | null | undefined): string {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`
  return `${(size / 1024 ** 3).toFixed(1)} GB`
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso || '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div class="detail-table-wrap">
    <div class="detail-table-header detail-table-grid">
      <div class="cell col-preview">预览</div><div class="cell">类型</div><div class="cell">提示词</div>
      <div class="cell">参考</div><div class="cell">模型</div><div class="cell">来源</div>
      <div class="cell">大小</div><div class="cell">时间</div><div class="cell col-actions">操作</div>
    </div>
    <div class="detail-table-body" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="row in visibleRows"
        :key="row.asset.id"
        class="detail-table-row detail-table-grid"
        :class="{ 'is-selected': selectedIds.has(row.asset.id) }"
        :style="{ transform: `translateY(${row.top}px)` }"
        @click="$emit('select', row.asset)"
      >
        <div class="cell col-preview">
          <div class="preview-thumb">
            <span v-if="row.asset.type === 'video'" class="preview-video-icon">&#9654;</span>
            <img v-else-if="resolveUrl(row.asset.thumbnail_url) || resolveUrl(row.asset.url)" :src="resolveUrl(row.asset.thumbnail_url) || resolveUrl(row.asset.url)" loading="lazy" alt="preview" />
            <span v-else class="preview-empty">&#128444;</span>
          </div>
        </div>
        <div class="cell"><span class="type-tag">{{ row.asset.type || '-' }}</span></div>
        <div class="cell cell-prompt" :title="row.asset.prompt || ''">{{ row.asset.prompt || '-' }}</div>
        <div class="cell cell-reference">
          <div class="ref-thumbs">
            <img v-for="(url, index) in getReferenceUrls(row.asset).slice(0, 3)" :key="index" :src="url" :title="url" class="ref-thumb-img" />
            <span v-if="getReferenceUrls(row.asset).length > 3" class="ref-thumb-more">+{{ getReferenceUrls(row.asset).length - 3 }}</span>
          </div>
          <span v-if="!getReferenceUrls(row.asset).length" class="cell-empty">-</span>
        </div>
        <div class="cell cell-model">{{ row.asset.model_display_name || row.asset.model || '-' }}</div>
        <div class="cell">{{ row.asset.source || '-' }}</div>
        <div class="cell">{{ formatFileSize(row.asset.file_size) }}</div>
        <div class="cell cell-time">{{ formatDateTime(row.asset.created_at) }}</div>
        <div class="cell col-actions">
          <div class="table-actions" @click.stop>
            <button class="table-action-btn" :title="row.asset.is_favorites ? '取消收藏' : '收藏'" @click="$emit('favorite', row.asset.id)">{{ row.asset.is_favorites ? '★' : '☆' }}</button>
            <button class="table-action-btn" title="下载" @click="$emit('download', row.asset)">↓</button>
            <button v-if="trash && restoreSupported" class="table-action-btn" title="恢复" @click="$emit('restore', row.asset.id)">↻</button>
            <button class="table-action-btn danger" :title="trash ? '永久删除' : '删除'" @click="$emit('delete', row.asset.id)">×</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
