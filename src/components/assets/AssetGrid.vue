<template>
  <div ref="scrollRef" class="asset-grid-wrap" @scroll="onScroll" @wheel="onWheel">
    <div v-if="store.loading && !store.items.length && !isTableMode" class="skeleton-grid" :style="{ '--col-width': `${colWidth}px` }">
      <div v-for="index in 10" :key="index" class="skeleton-card">
        <div class="skeleton-media" /><div class="skeleton-bar" />
      </div>
    </div>
    <div v-else-if="store.loading && !store.items.length" class="empty-hint">加载中...</div>
    <div v-else-if="!store.items.length" class="empty-hint">暂无资产</div>
    <AssetTableView
      v-else-if="isTableMode"
      :items="store.items"
      :restore-supported="store.restoreSupported"
      :scroll-top="scrollTop"
      :selected-ids="store.selectedIds"
      :trash="store.filter.trash"
      :viewport-height="viewportHeight"
      @delete="store.doDelete"
      @download="onDownload"
      @favorite="store.doToggleFavorite"
      @restore="store.doRestore"
      @select="onAssetSelect"
    />
    <AssetMasonryView
      v-else
      :col-width="colWidth"
      :container-width="containerInnerWidth"
      :items="store.items"
      :selectable="store.selectionMode || store.filter.trash"
      :selected-ids="store.selectedIds"
      @delete="store.doDelete"
      @download="onDownload"
      @favorite="store.doToggleFavorite($event.id)"
      @select="onAssetSelect"
      @toggle-select="store.toggleSelect"
    />
    <div v-if="store.loadingMore" class="load-more">加载中...</div>
    <div v-else-if="!store.hasMore && store.items.length" class="load-more">没有更多了</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { AssetItem } from '@/api/assets'
import { useAssetStore } from '@/stores/assets.store'
import AssetMasonryView from './AssetMasonryView.vue'
import AssetTableView from './AssetTableView.vue'

const props = defineProps<{ colWidth?: number; viewMode?: 'grid' | 'table' }>()
const emit = defineEmits<{ select: [asset: AssetItem]; 'ctrl-wheel': [deltaY: number] }>()
const store = useAssetStore()
const colWidth = computed(() => props.colWidth ?? 200)
const isTableMode = computed(() => props.viewMode === 'table')
const scrollRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const containerInnerWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

function updateViewportMetrics(): void {
  if (!scrollRef.value) return
  scrollTop.value = scrollRef.value.scrollTop
  viewportHeight.value = scrollRef.value.clientHeight
  containerInnerWidth.value = Math.max(0, scrollRef.value.clientWidth - 16)
}

function onScroll(): void {
  if (!scrollRef.value) return
  updateViewportMetrics()
  const { scrollHeight, clientHeight } = scrollRef.value
  if (scrollHeight - scrollTop.value - clientHeight < 200 && store.hasMore && !store.loadingMore) {
    void store.loadMore()
  }
}

function fillIfNeeded(): void {
  nextTick(() => {
    if (!scrollRef.value) return
    const { scrollHeight, clientHeight } = scrollRef.value
    if (scrollHeight <= clientHeight && store.hasMore && !store.loadingMore) {
      void store.loadMore().then(fillIfNeeded)
    }
  })
}

function resolveDownloadUrl(asset: AssetItem): string {
  if (typeof asset.url === 'string') return asset.url
  return asset.url?.origin_url || asset.url?.proxy_url || ''
}

function onDownload(asset: AssetItem): void {
  const url = resolveDownloadUrl(asset)
  if (!url) return
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ''
  anchor.target = '_blank'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function onAssetSelect(asset: AssetItem): void {
  if (store.selectionMode || store.filter.trash) store.toggleSelect(asset.id)
  else emit('select', asset)
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey || isTableMode.value) return
  event.preventDefault()
  event.stopPropagation()
  emit('ctrl-wheel', event.deltaY)
}

watch([() => store.loading, () => store.loadingMore], ([loading, loadingMore]) => {
  if (loading || loadingMore) return
  fillIfNeeded()
  nextTick(updateViewportMetrics)
})

onMounted(() => {
  updateViewportMetrics()
  if (!scrollRef.value) return
  resizeObserver = new ResizeObserver(updateViewportMetrics)
  resizeObserver.observe(scrollRef.value)
})

onUnmounted(() => resizeObserver?.disconnect())
</script>

<style src="./AssetGrid.css"></style>
