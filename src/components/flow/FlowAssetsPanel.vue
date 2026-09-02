<template>
  <Transition name="slide">
    <div
      v-if="visible"
      class="slide-panel slide-panel-wide"
      :class="{ 'is-canvas-mode': viewMode === 'canvas' }"
      :style="panelStyle"
    >
      <div class="slide-panel-header">
        <span class="slide-panel-title">资产列表</span>
        <span v-if="viewMode === 'canvas'" class="asset-selection-count">共 {{ canvasAssetTotal }} 个元素</span>
        <span v-else-if="selectedAssetIds.length" class="asset-selection-count">已选 {{ selectedAssetIds.length }} 个</span>
        <button class="slide-panel-close" @click="$emit('update:visible', false)">×</button>
      </div>

      <div class="asset-view-tabs">
        <button class="asset-view-tab" :class="{ active: viewMode === 'canvas' }" @click="setViewMode('canvas')">画布</button>
        <button class="asset-view-tab" :class="{ active: viewMode === 'assets' }" @click="setViewMode('assets')">资产</button>
        <div v-if="viewMode === 'canvas'" class="canvas-display-switch">
          <button
            class="canvas-display-button"
            :class="{ active: canvasDisplayMode === 'list' }"
            type="button"
            title="列表视图"
            @click="setCanvasDisplayMode('list')"
          >
            <List :size="15" />
          </button>
          <button
            class="canvas-display-button"
            :class="{ active: canvasDisplayMode === 'detail' }"
            type="button"
            title="详情视图"
            @click="setCanvasDisplayMode('detail')"
          >
            <LayoutGrid :size="15" />
          </button>
        </div>
      </div>

      <div v-if="viewMode === 'assets'" class="asset-type-tabs">
        <button
          v-for="tab in assetTypeTabs"
          :key="tab.value"
          class="asset-type-tab"
          :class="{ active: assetTypeFilter === tab.value }"
          @click="setAssetTypeFilter(tab.value)"
        >{{ tab.label }}</button>
      </div>

      <div v-if="viewMode === 'assets'" class="asset-filter-row">
        <label class="asset-favorite-filter" :class="{ active: favoriteOnly }">
          <input v-model="favoriteOnly" type="checkbox" />
          <span>只看收藏</span>
        </label>
      </div>

      <FlowCanvasAssetList
        v-if="viewMode === 'canvas'"
        :groups="canvasAssetGroups"
        :total="canvasAssetTotal"
        :display-mode="canvasDisplayMode"
        :result-only="canvasResultOnly"
        :type-filter="canvasTypeFilter"
        @focus-node="$emit('focus-node', $event)"
        @preview="openCanvasItemPreview"
        @update:result-only="setCanvasResultOnly"
        @update:type-filter="setCanvasTypeFilter"
      />

      <div v-else ref="assetPanelBodyRef" class="slide-panel-body" @scroll="onAssetsScroll" @wheel.passive="onAssetsWheel">
          <div v-if="assetStore.loading && !assetStore.items.length" class="assets-loading"><span>加载中...</span></div>
          <div v-else-if="!assetStore.items.length && !assetStore.loading" class="empty-hint">暂无资产</div>
          <div v-if="assetStore.items.length" class="asset-masonry-flow">
            <div v-for="(col, ci) in assetColumns" :key="ci" class="asset-masonry-col">
              <div
                v-for="asset in col"
                :key="asset.id"
                class="asset-mini-card"
                :class="{ 'is-selected': isAssetSelected(asset) }"
                @mousedown.prevent="onAssetMouseDown($event, asset)"
                @dblclick="openAssetPreview(asset)"
              >
                <div class="asset-mini-media" :style="{ aspectRatio: getAssetRatio(asset) }">
                  <button
                    class="asset-favorite-button"
                    :class="{ active: asset.is_favorites }"
                    :title="asset.is_favorites ? '取消收藏' : '收藏'"
                    @mousedown.stop
                    @dblclick.stop
                    @click.stop="assetStore.doToggleFavorite(asset.id)"
                  >
                    <Heart :size="15" :fill="asset.is_favorites ? 'currentColor' : 'none'" />
                  </button>
                  <img v-if="asset.type !== 'video'" :src="asset.thumbnail_url || asset.url" loading="lazy" draggable="false" />
                  <template v-else>
                    <video :src="asset.url" :poster="asset.thumbnail_url || undefined" preload="none" muted playsinline />
                    <div class="video-play-icon">&#9654;</div>
                  </template>
                </div>
                <div class="asset-mini-prompt-row" title="点击复制提示词" @mousedown.stop @click.stop="copyPrompt(asset)">
                  {{ asset.prompt || '无提示词' }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="assetStore.loadingMore || (assetStore.loading && assetStore.items.length)" class="assets-loading-more">加载更多...</div>
          <div v-else-if="!assetStore.hasMore && assetStore.items.length" class="assets-loading-more">已加载全部</div>
      </div>
    </div>
  </Transition>

  <ImagePreviewModal
    v-model:visible="detailVisible"
    :images="detailImages" :initial-index="0" :image-info="detailImageInfo" :is-video="detailIsVideo" :record-id="detailAsset?.id" :full-mode="true"
    :show-inspector="true" :show-actions="true" :show-ai-tools="true" :show-workflow-actions="false"
    :show-favorite="true" :show-share="false" :show-delete="true" :is-favorited="detailIsFavorited"
    @delete="handleDetailDelete" @favorite="handleDetailFavorite" @select-history="handleSelectHistoryFromPreview"
  />
</template>

<script setup>
import { computed, ref, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Heart, LayoutGrid, List } from '@/components/common/icon/lucide'
import ImagePreviewModal from '@/components/common/ImagePreviewModal.vue'
import { buildTeamonesUrl } from '@/api/teamonesClient'
import FlowCanvasAssetList from './FlowCanvasAssetList.vue'
import { useFlowAssetsPanel } from './useFlowAssetsPanel'
import { useFlowAssetSelectionDrag } from './useFlowAssetSelectionDrag'

const props = defineProps({
  visible: Boolean,
  modelNodes: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'drop-asset', 'focus-node'])

const {
  assetStore,
  assetColWidth,
  assetColCount,
  assetColumns,
  canvasAssetGroups,
  canvasAssetTotal,
  assetPanelBodyRef,
  viewMode,
  canvasDisplayMode,
  canvasResultOnly,
  canvasTypeFilter,
  assetTypeFilter,
  favoriteOnly,
  workflowOnly,
  setViewMode,
  setCanvasDisplayMode,
  setCanvasResultOnly,
  setCanvasTypeFilter,
  setAssetTypeFilter,
  onAssetsScroll,
  onAssetsWheel,
} = useFlowAssetsPanel(toRef(props, 'visible'), toRef(props, 'modelNodes'))

const {
  selectedAssetIds,
  isAssetSelected,
  onAssetMouseDown,
} = useFlowAssetSelectionDrag({
  visible: toRef(props, 'visible'),
  assetTypeFilter,
  favoriteOnly,
  workflowOnly,
  assetPanelBodyRef,
  getOrderedAssets: () => assetStore.items || [],
  resolveAssetUrl: extractAssetUrl,
  emitDropAsset: (payload) => emit('drop-asset', payload),
})

const assetTypeTabs = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '模型', value: 'model' },
]

const panelStyle = computed(() => {
  if (viewMode.value === 'canvas') return { width: canvasDisplayMode.value === 'detail' ? '360px' : '280px' }
  const width = Math.max(400, assetColCount.value * assetColWidth.value + (assetColCount.value - 1) * 8 + 32)
  return { width: `${width}px` }
})

function getAssetRatio(asset) {
  const w = asset?.width
  const h = asset?.height
  return w && h ? w / h : 1
}

function copyPrompt(asset) {
  const text = asset?.prompt?.trim?.()
  if (!text) {
    ElMessage.info('当前卡片没有提示词')
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  ElMessage.success('已复制提示词')
}

const detailVisible = ref(false)
const detailAsset = ref(null)
const detailIsVideo = computed(() => detailAsset.value?.type === 'video')
const detailIsFavorited = computed(() => {
  const id = detailAsset.value?.id
  const asset = (assetStore.items || []).find(item => String(item.id) === String(id))
  return Boolean(asset?.is_favorites ?? detailAsset.value?.is_favorites)
})
const detailImages = computed(() => {
  if (!detailAsset.value) return []
  const url = detailAsset.value.url
  return url ? [url] : []
})
const detailImageInfo = computed(() => {
  if (!detailAsset.value) return null
  const a = detailAsset.value
  return {
    prompt: a.prompt || '',
    model: a.model || '',
    modelDisplayName: a.model_display_name || a.model || '',
    modelVendor: a.vendor || '',
    createTime: a.created_at || '',
    vendor: a.vendor || '',
    referenceUrls: getReferenceUrls(a),
  }
})

function getReferenceUrls(asset) {
  const refs = asset?.reference_urls
  if (Array.isArray(refs)) return refs.filter(u => typeof u === 'string' && u.trim())
  return []
}

function extractAssetUrl(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw.origin_url || raw.url || raw.proxy_url || null
  if (typeof raw === 'string') {
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('blob:') || raw.startsWith('data:')) return raw
    return buildTeamonesUrl(raw)
  }
  return null
}

function openCanvasItemPreview(item) {
  if (!item.url || (item.type !== 'image' && item.type !== 'video')) return
  detailAsset.value = {
    id: item.id,
    type: item.type,
    url: item.url,
    thumbnail_url: item.thumbnailUrl,
    prompt: item.prompt,
    is_favorites: false,
  }
  detailVisible.value = true
}

function openAssetPreview(asset) {
  detailAsset.value = asset
  detailVisible.value = true
}

function handleSelectHistoryFromPreview(id) {
  const target = (assetStore.items || []).find(asset => String(asset.id) === String(id))
  if (!target) return
  openAssetPreview(target)
}

function handleDetailDelete(id) {
  const idx = assetStore.items.findIndex(a => a.id === id)
  if (idx >= 0) assetStore.items.splice(idx, 1)
  detailVisible.value = false
}

async function handleDetailFavorite() {
  const id = detailAsset.value?.id
  if (!id) return
  const nextFavorite = await assetStore.doToggleFavorite(id)
  if (nextFavorite === undefined || !detailAsset.value) return
  detailAsset.value.is_favorites = nextFavorite
}
</script>

<style scoped src="./FlowAssetsPanel.scss"></style>
