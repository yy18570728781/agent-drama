<script setup lang="ts">
import type { CanvasAssetDisplayMode, CanvasAssetTypeFilter, FlowCanvasAssetGroup, FlowCanvasAssetItem } from './flowCanvasAssets'
import { CANVAS_ASSET_TYPE_OPTIONS, getCanvasTypeIcon, getCanvasTypeLabel } from './flowCanvasAssets'
import './FlowCanvasAssetList.scss'

defineProps<{
  groups: FlowCanvasAssetGroup[]
  total: number
  displayMode: CanvasAssetDisplayMode
  resultOnly: boolean
  typeFilter: CanvasAssetTypeFilter
}>()

const emit = defineEmits<{
  (event: 'focus-node', id: string): void
  (event: 'preview', item: FlowCanvasAssetItem): void
  (event: 'update:resultOnly', value: boolean): void
  (event: 'update:typeFilter', value: CanvasAssetTypeFilter): void
}>()

</script>

<template>
  <div class="canvas-assets-view">
    <div class="canvas-assets-filters">
      <div class="canvas-type-filters" aria-label="画布媒体类型筛选">
        <button
          class="canvas-type-filter"
          :class="{ active: resultOnly }"
          type="button"
          @click="emit('update:resultOnly', !resultOnly)"
        >只看结果</button>
        <button
          v-for="option in CANVAS_ASSET_TYPE_OPTIONS"
          :key="option.value"
          class="canvas-type-filter"
          :class="{ active: typeFilter === option.value }"
          type="button"
          @click="emit('update:typeFilter', option.value)"
        >{{ option.label }}</button>
      </div>
    </div>

    <div class="canvas-assets-body">
      <div v-if="!total" class="canvas-assets-empty">当前筛选条件下暂无画布元素</div>
      <div v-else class="canvas-asset-groups">
        <section v-for="group in groups" :key="group.id" class="canvas-asset-group">
          <div class="canvas-asset-group-title">
            <span>{{ group.label }}</span>
            <span>{{ group.items.length }}</span>
          </div>
          <div :class="displayMode === 'detail' ? 'canvas-asset-detail-grid' : 'canvas-asset-list'">
            <button
              v-for="item in group.items"
              :key="item.id"
              :class="displayMode === 'detail' ? 'canvas-asset-detail-card' : 'canvas-asset-row'"
              type="button"
              @click="emit('focus-node', item.id)"
              @dblclick="emit('preview', item)"
            >
              <span :class="displayMode === 'detail' ? 'canvas-asset-detail-media' : 'canvas-asset-thumb'">
                <img v-if="item.type === 'image' && item.thumbnailUrl" :src="item.thumbnailUrl" loading="lazy" draggable="false" />
                <video v-else-if="item.type === 'video' && item.url" :src="item.url" :poster="item.thumbnailUrl || undefined" preload="none" muted playsinline />
                <span v-else class="canvas-asset-thumb-icon">{{ getCanvasTypeIcon(item.type) }}</span>
              </span>
              <span class="canvas-asset-meta">
                <span class="canvas-asset-name">{{ item.label }}</span>
                <span v-if="displayMode === 'list'" class="canvas-asset-desc">{{ item.prompt || getCanvasTypeLabel(item.type) }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
