<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChevronRight, LayoutGrid, X } from '@/components/common/icon/lucide'
import {
  useImageGridSelection,
  type GridSelectionResult,
} from '@/composables/flow/useImageGridSelection'

const props = defineProps<{
  nodeId: string
  imageUrl: string
}>()

const runGridSplit = inject<((nodeId: string, result: GridSelectionResult) => Promise<void>) | null>(
  'flowHandleImageGridSplit',
  null,
)
const buttonRef = ref<HTMLElement | null>(null)
const active = ref(false)
const menuOpen = ref(false)
const customOpen = ref(false)
const customHover = ref({ rows: 2, cols: 2 })
const splitting = ref(false)
const imageRect = ref({ left: 0, top: 0, width: 0, height: 0 })
const menuRect = ref({ left: 0, top: 0 })
let syncFrame = 0

const {
  rows,
  cols,
  selectedIndices,
  selectedCount,
  configure,
  toggleCell,
  selectAll,
  clearSelection,
  cropSelection,
} = useImageGridSelection()

const presets = [
  { rows: 2, cols: 2, label: '4宫格 (2×2)' },
  { rows: 3, cols: 3, label: '9宫格 (3×3)' },
  { rows: 4, cols: 4, label: '16宫格 (4×4)' },
  { rows: 5, cols: 5, label: '25宫格 (5×5)' },
]

const cellIndices = computed(() => (
  Array.from({ length: rows.value * cols.value }, (_, index) => index)
))

const gridStyle = computed(() => ({
  left: `${imageRect.value.left}px`,
  top: `${imageRect.value.top}px`,
  width: `${imageRect.value.width}px`,
  height: `${imageRect.value.height}px`,
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gridTemplateRows: `repeat(${rows.value}, 1fr)`,
}))

const actionStyle = computed(() => ({
  left: `${imageRect.value.left + imageRect.value.width / 2}px`,
  top: `${Math.max(8, imageRect.value.top - 98)}px`,
}))

const menuStyle = computed(() => ({
  left: `${menuRect.value.left}px`,
  top: `${menuRect.value.top}px`,
}))

function syncRects(): void {
  const button = buttonRef.value
  const node = button?.closest('.vue-flow__node')
  const image = node?.querySelector('.image-node-grid-source')
  if (button) {
    const bounds = button.getBoundingClientRect()
    menuRect.value = { left: bounds.left, top: bounds.bottom + 8 }
  }
  if (image instanceof HTMLElement) {
    const bounds = image.getBoundingClientRect()
    imageRect.value = {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    }
  }
}

function runRectSync(): void {
  cancelAnimationFrame(syncFrame)
  if (!(active.value || menuOpen.value)) return
  syncRects()
  syncFrame = requestAnimationFrame(runRectSync)
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
  customOpen.value = false
  if (menuOpen.value) runRectSync()
}

function chooseGrid(nextRows: number, nextCols: number): void {
  configure(nextRows, nextCols)
  active.value = true
  menuOpen.value = false
  customOpen.value = false
  runRectSync()
}

function closeGridSplit(): void {
  active.value = false
  menuOpen.value = false
  customOpen.value = false
  clearSelection()
  cancelAnimationFrame(syncFrame)
}

function setCustomHover(nextRows: number, nextCols: number): void {
  customHover.value = { rows: nextRows, cols: nextCols }
}

async function executeSelection(): Promise<void> {
  if (!selectedCount.value || splitting.value || !runGridSplit) return
  splitting.value = true
  try {
    const result = await cropSelection(props.imageUrl)
    closeGridSplit()
    await runGridSplit(props.nodeId, result)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '宫格切分失败')
  } finally {
    splitting.value = false
  }
}

watch(() => props.imageUrl, closeGridSplit)
onBeforeUnmount(closeGridSplit)
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    class="image-grid-trigger nodrag"
    :class="{ active }"
    title="宫格切分"
    @click.stop="toggleMenu"
  >
    <LayoutGrid :size="16" />
  </button>

  <Teleport to="body">
    <div v-if="menuOpen" class="image-grid-menu nodrag nowheel" :style="menuStyle">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        class="image-grid-menu__item"
        @click="chooseGrid(preset.rows, preset.cols)"
      >
        {{ preset.label }}
      </button>
      <div class="image-grid-menu__divider"></div>
      <div class="image-grid-custom" @mouseenter="customOpen = true">
        <button type="button" class="image-grid-menu__item">
          <span>自定义</span>
          <ChevronRight :size="14" />
        </button>
        <div v-if="customOpen" class="image-grid-custom__panel">
          <div class="image-grid-custom__heading">
            <span>自定义宫格</span>
            <strong>{{ customHover.rows }} × {{ customHover.cols }}</strong>
          </div>
          <div class="image-grid-custom__matrix">
            <button
              v-for="index in 25"
              :key="index"
              type="button"
              class="image-grid-custom__cell"
              :class="{
                selected:
                  Math.ceil(index / 5) <= customHover.rows
                  && ((index - 1) % 5) + 1 <= customHover.cols,
              }"
              @mouseenter="setCustomHover(Math.ceil(index / 5), ((index - 1) % 5) + 1)"
              @click="chooseGrid(customHover.rows, customHover.cols)"
            ></button>
          </div>
        </div>
      </div>
    </div>

    <template v-if="active && imageRect.width">
      <div class="image-grid-actions nodrag nowheel" :style="actionStyle">
        <button type="button" class="image-grid-actions__icon" title="退出宫格切分" @click="closeGridSplit">
          <X :size="16" />
        </button>
        <span>已选 {{ selectedCount }} 个宫格</span>
        <button type="button" @click="selectAll">全选</button>
        <button type="button" :disabled="!selectedCount" @click="clearSelection">清空</button>
        <button
          type="button"
          class="image-grid-actions__primary"
          :disabled="!selectedCount || splitting"
          @click="executeSelection"
        >
          {{ splitting ? '切分中...' : '生成画布节点' }}
        </button>
      </div>

      <div class="image-grid-selection nodrag nowheel" :style="gridStyle">
        <button
          v-for="index in cellIndices"
          :key="index"
          type="button"
          class="image-grid-selection__cell"
          :class="{ selected: selectedIndices.has(index) }"
          @click.stop="toggleCell(index)"
        >
          <span>{{ Math.floor(index / cols) + 1 }}-{{ (index % cols) + 1 }}</span>
        </button>
      </div>
    </template>
  </Teleport>
</template>

<style scoped src="./ImageNodeGridSplit.css"></style>
