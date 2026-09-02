<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ name: 'FlowLibrarySplitLayout' })

const DEFAULT_SIDEBAR_WIDTH = 270
const MIN_SIDEBAR_WIDTH = 260
const MAX_SIDEBAR_WIDTH = 400
const STORAGE_KEY = 'flow_library_sidebar_width'

function clampSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SIDEBAR_WIDTH
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value))
}

function readSidebarWidth(): number {
  try {
    const storedWidth = localStorage.getItem(STORAGE_KEY)
    return storedWidth ? clampSidebarWidth(Number(storedWidth)) : DEFAULT_SIDEBAR_WIDTH
  } catch {
    return DEFAULT_SIDEBAR_WIDTH
  }
}

const route = useRoute()
const sidebarWidth = ref(readSidebarWidth())
const isCollapsed = ref(route.meta.standalone === true)
const isResizing = ref(false)
const splitStyle = computed(() => ({ '--flow-sidebar-width': `${sidebarWidth.value}px` }))
let resizeStartX = 0
let resizeStartWidth = 0

function saveSidebarWidth(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth.value))
  } catch {
    // 浏览器禁用本地存储时，当前会话内仍可正常调整宽度。
  }
}

function stopResize(): void {
  if (!isResizing.value) return
  isResizing.value = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopResize)
  saveSidebarWidth()
}

function handlePointerMove(event: PointerEvent): void {
  if (!isResizing.value) return
  sidebarWidth.value = clampSidebarWidth(resizeStartWidth + event.clientX - resizeStartX)
}

function startResize(event: PointerEvent): void {
  if (isCollapsed.value) return
  event.preventDefault()
  resizeStartX = event.clientX
  resizeStartWidth = sidebarWidth.value
  isResizing.value = true
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopResize)
}

function toggleCollapsed(): void {
  stopResize()
  isCollapsed.value = !isCollapsed.value
}

onBeforeUnmount(stopResize)
</script>

<template>
  <div
    class="flow-library-split"
    :class="{ 'is-collapsed': isCollapsed, 'is-resizing': isResizing }"
    :style="splitStyle"
  >
    <div class="flow-library-split__sidebar" :aria-hidden="isCollapsed">
      <slot name="sidebar" />
    </div>
    <button
      v-if="!isCollapsed"
      class="flow-library-split__resizer"
      type="button"
      title="拖动调整目录宽度"
      aria-label="拖动调整目录宽度"
      @pointerdown="startResize"
    />
    <main class="flow-library-split__content"><slot name="content" /></main>
    <button
      class="flow-library-split__toggle"
      :class="{ 'is-collapsed': isCollapsed }"
      type="button"
      :title="isCollapsed ? '展开目录' : '收起目录'"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapsed"
    >
      <Icon :icon="isCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" />
    </button>
  </div>
</template>

<style scoped src="./FlowLibrarySplitLayout.scss"></style>
