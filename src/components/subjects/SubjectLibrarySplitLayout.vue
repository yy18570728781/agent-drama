<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ChevronLeft, ChevronRight } from '@/components/common/icon/lucide'

const DEFAULT_SIDEBAR_WIDTH = 270
const MIN_SIDEBAR_WIDTH = 260
const MAX_SIDEBAR_WIDTH = 400
const STORAGE_KEY = 'subject_library_sidebar_width'

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

const sidebarWidth = ref(readSidebarWidth())
const isCollapsed = ref(false)
const isResizing = ref(false)
const splitStyle = computed(() => ({ '--subject-sidebar-width': `${sidebarWidth.value}px` }))
let resizeStartX = 0
let resizeStartWidth = 0

function saveSidebarWidth(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth.value))
  } catch {
    // 浏览器禁用本地存储时，宽度仍在当前会话生效。
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
    class="subject-library-split"
    :class="{ 'is-collapsed': isCollapsed, 'is-resizing': isResizing }"
    :style="splitStyle"
  >
    <div class="subject-library-split__sidebar" :aria-hidden="isCollapsed">
      <slot name="sidebar" />
    </div>
    <button
      v-if="!isCollapsed"
      class="subject-library-split__resizer"
      type="button"
      title="拖动调整目录宽度"
      aria-label="拖动调整目录宽度"
      @pointerdown="startResize"
    />
    <main class="subject-library-split__content"><slot name="content" /></main>
    <button
      class="subject-library-split__toggle"
      :class="{ 'is-collapsed': isCollapsed }"
      type="button"
      :title="isCollapsed ? '展开目录' : '收起目录'"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapsed"
    >
      <ChevronRight v-if="isCollapsed" :size="13" />
      <ChevronLeft v-else :size="13" />
    </button>
  </div>
</template>

<style scoped src="./SubjectLibrarySplitLayout.scss"></style>
