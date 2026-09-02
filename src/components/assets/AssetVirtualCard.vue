<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AssetItem, AssetUrlObject } from '@/api/assets'
import { useAssetCardVisibility } from '@/composables/assets/useAssetCardVisibility'
import AssetCard from './AssetCard.vue'

const props = defineProps<{
  asset: AssetItem
  pushOffset?: { x: number; y: number }
  selectable: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  click: [asset: AssetItem]
  delete: [id: string]
  download: [asset: AssetItem]
  dragEnd: [id: string, x: number, y: number]
  dragMove: [id: string, x: number, y: number]
  favorite: [asset: AssetItem]
  hover: [id: string, x: number, y: number]
  hoverEnd: [id: string]
  toggleSelect: [id: string]
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const visible = useAssetCardVisibility(wrapperRef)
const cardAsset = computed(() => ({
  ...props.asset,
  thumbnail_url: resolveUrl(props.asset.thumbnail_url),
  url: resolveUrl(props.asset.url),
}))
const placeholderStyle = computed(() => {
  if (visible.value) return undefined
  const ratio = Number(props.asset.aspect_ratio)
  const width = Number(props.asset.width)
  const height = Number(props.asset.height)
  const heightRatio = ratio > 0 ? ratio : (width > 0 && height > 0 ? height / width : 1.25)
  return { aspectRatio: String(1 / heightRatio) }
})

function resolveUrl(value: string | AssetUrlObject | null): string {
  if (typeof value === 'string') return value
  return value?.origin_url || value?.proxy_url || ''
}

function forwardDragEnd(id: string, x: number, y: number): void {
  emit('dragEnd', id, x, y)
}

function forwardDragMove(id: string, x: number, y: number): void {
  emit('dragMove', id, x, y)
}

function forwardHover(id: string, x: number, y: number): void {
  emit('hover', id, x, y)
}
</script>

<template>
  <div ref="wrapperRef" class="virtual-asset-card" :style="placeholderStyle">
    <AssetCard
      v-if="visible"
      :asset="cardAsset"
      :push-offset="pushOffset"
      :selectable="selectable"
      :selected="selected"
      @click="$emit('click', asset)"
      @delete="$emit('delete', $event)"
      @download="$emit('download', asset)"
      @drag-end="forwardDragEnd"
      @drag-move="forwardDragMove"
      @favorite="$emit('favorite', asset)"
      @hover="forwardHover"
      @hover-end="$emit('hoverEnd', $event)"
      @toggle-select="$emit('toggleSelect', $event)"
    />
  </div>
</template>

<style scoped>
.virtual-asset-card {
  width: 100%;
  min-height: 1px;
  background: #27272a;
  overflow: hidden;
}
</style>
