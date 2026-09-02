<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AssetItem } from '@/api/assets'
import { useAssetMasonryInteraction } from '@/composables/assets/useAssetMasonryInteraction'
import { useAssetMasonryLayout } from '@/composables/assets/useAssetMasonryLayout'
import AssetVirtualCard from './AssetVirtualCard.vue'

const props = defineProps<{
  colWidth: number
  containerWidth: number
  items: AssetItem[]
  selectable: boolean
  selectedIds: Set<string>
}>()

defineEmits<{
  delete: [id: string]
  download: [asset: AssetItem]
  favorite: [asset: AssetItem]
  select: [asset: AssetItem]
  toggleSelect: [id: string]
}>()

const GRID_GAP = 2
const flowRef = ref<HTMLElement | null>(null)
const items = computed(() => props.items)
const colWidth = computed(() => props.colWidth)
const containerWidth = computed(() => props.containerWidth)
const { groups } = useAssetMasonryLayout({ colWidth, containerWidth, gap: GRID_GAP, items })
const interaction = useAssetMasonryInteraction(flowRef)

watch(groups, () => interaction.updateCardPositions(), { flush: 'post' })
</script>

<template>
  <div ref="flowRef" class="masonry-wrap">
    <template v-for="group in groups" :key="group.key">
      <div class="masonry-group-header">
        <span class="group-title">{{ group.label }}</span>
        <span class="group-count">{{ group.count }} 条</span>
      </div>
      <div class="masonry-row-grid" :style="{ gap: `${GRID_GAP}px` }">
        <div v-for="(column, index) in group.columns" :key="index" class="masonry-col" :style="{ gap: `${GRID_GAP}px` }">
          <AssetVirtualCard
            v-for="asset in column"
            :key="asset.id"
            :asset="asset"
            :push-offset="interaction.pushOffsets.value.get(asset.id)"
            :selectable="selectable"
            :selected="selectedIds.has(asset.id)"
            @click="$emit('select', $event)"
            @delete="$emit('delete', $event)"
            @download="$emit('download', $event)"
            @drag-end="interaction.onDragEnd"
            @drag-move="interaction.onDragMove"
            @favorite="$emit('favorite', $event)"
            @hover="interaction.onHover"
            @hover-end="interaction.onHoverEnd"
            @toggle-select="$emit('toggleSelect', $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
