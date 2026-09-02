<template>
  <teleport to="body">
    <div v-if="visible" class="ref-menu" :style="menuStyle">
      <div class="ref-search-wrapper">
        <Search :size="14" class="ref-search-icon" />
        <input v-model="internalSearch" type="text" placeholder="搜索参考图或主体（支持拼音首字母）..." class="ref-search-input"
          @keydown.stop @click.stop @compositionstart="isComposing = true" @compositionend="isComposing = false" />
        <button class="ref-multi-toggle" :class="{ active: multiSelectMode }"
          @mousedown.prevent @click.stop="multiSelectMode = !multiSelectMode">
          <span class="ref-multi-checkbox" :class="{ checked: multiSelectMode }"></span>
          <span>多选</span>
        </button>
      </div>
      <div class="ref-menu-body">
        <div class="ref-col-left-wrap" :style="leftColStyle">
        <RefMenuRefPanel
          :filtered-images="filteredImages"
          :ref-images="refImages"
          :active-item-id="activeItemId"
          :get-display-label="getDisplayLabel"
          @select-ref="$emit('select-ref', $event)"
          @set-active="$emit('set-active', $event)"
        />
        </div>
        <div class="ref-col-divider" :class="{ dragging: isDragging }"
          @mousedown.prevent="onDividerStart"></div>
        <RefMenuSubjectPanel
          :subjects="filteredSubjects"
          :loading="subjectsLoading"
          :active-item-id="activeItemId"
          :category-bar="categoryBar"
          :multi-select-mode="multiSelectMode"
          @select-subject="$emit('select-subject', $event)"
          @set-active="$emit('set-active', $event)"
        />
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@/components/common/icon/lucide'
import { matchesPinyin } from './promptPinyin.utils'
import RefMenuRefPanel from './RefMenuRefPanel.vue'
import RefMenuSubjectPanel from './RefMenuSubjectPanel.vue'
import type { SubjectPickerItem, SubjectCategoryBar, SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'

export type ReferenceImage = {
  url: string
  file: File
  referenceName?: string
  isVideo: boolean
  mediaType?: 'image' | 'video' | 'audio' | '3d_model'
  sourceUrl?: string
  sourceNodeId?: string
  uploaded?: boolean
}

const props = defineProps<{
  visible: boolean
  menuPosition: { top: number; left: number; width: number }
  refImages: ReferenceImage[]
  activeItemId: string
  getDisplayLabel: (index: number) => string
  getOrdinal: (index: number) => number
  searchQuery?: string
  subjects: SubjectPickerItem[]
  subjectsLoading: boolean
  categoryBar: SubjectCategoryBar
}>()

const emit = defineEmits<{
  'select-ref': [index: number]
  'set-active': [id: string]
  'update:search-query': [value: string]
  'select-subject': [payload: SubjectSelectPayload]
}>()

const internalSearch = ref(props.searchQuery || '')
const isComposing = ref(false)
const multiSelectMode = ref(false)

watch(() => props.searchQuery, (val) => {
  if (val !== undefined) internalSearch.value = val
})
watch(internalSearch, (val) => {
  emit('update:search-query', val)
})

const menuStyle = computed(() => ({
  top: `${props.menuPosition.top}px`,
  left: `${props.menuPosition.left}px`,
  width: `${props.menuPosition.width}px`,
}))

const filteredImages = computed(() => {
  if (!internalSearch.value.trim()) return props.refImages
  const query = internalSearch.value.toLowerCase()
  return props.refImages.filter((img, i) => {
    const label = props.getDisplayLabel(i)
    const numStr = String(props.getOrdinal(i))
    const mediaType = img.mediaType || (img.isVideo ? 'video' : 'image')
    const initials = mediaType === 'video' ? 'sp' : mediaType === 'audio' ? 'yp' : mediaType === '3d_model' ? 'mx' : 'tp'
    const fullPinyin = mediaType === 'video' ? 'shipin' : mediaType === 'audio' ? 'yinpin' : mediaType === '3d_model' ? 'moxing' : 'tupian'
    const shortRef = `${initials}${numStr}`
    return label.toLowerCase().includes(query)
      || shortRef === query
      || initials.startsWith(query)
      || fullPinyin.includes(query)
  })
})

const filteredSubjects = computed(() => {
  if (!internalSearch.value.trim()) return props.subjects
  return props.subjects.filter(s => matchesPinyin(s.name, internalSearch.value))
})

// ── 分割线拖动：控制左栏占比 ──
const leftRatio = ref(30)
const isDragging = ref(false)
let bodyRect: DOMRect | null = null

function onDividerStart(e: MouseEvent): void {
  e.preventDefault()
  const bodyEl = document.querySelector('.ref-menu-body')
  if (!bodyEl) return
  bodyRect = bodyEl.getBoundingClientRect()
  isDragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onDividerMove)
  document.addEventListener('mouseup', onDividerEnd)
}

function onDividerMove(e: MouseEvent): void {
  if (!bodyRect) return
  const ratio = ((e.clientX - bodyRect.left) / bodyRect.width) * 100
  leftRatio.value = Math.max(15, Math.min(60, ratio))
}

function onDividerEnd(): void {
  isDragging.value = false
  bodyRect = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onDividerMove)
  document.removeEventListener('mouseup', onDividerEnd)
}

const leftColStyle = computed(() => ({
  flex: `0 0 ${leftRatio.value}%`,
}))
</script>

<script lang="ts">
export default { name: 'ReferenceMenu' }
</script>

<style scoped>
.ref-menu {
  position: fixed;
  background: var(--generator-surface-panel, var(--bg-surface, #18181b));
  border: 1px solid var(--generator-border, var(--border, rgba(255, 255, 255, 0.08)));
  border-radius: 12px;
  box-shadow: var(--generator-shadow-elevated, 0 18px 48px rgba(0, 0, 0, 0.45));
  transform: translateY(calc(-100% - 8px));
  z-index: 10000;
  display: flex;
  flex-direction: column;
  max-height: 420px;
}
.ref-search-wrapper {
  position: relative;
  padding: 10px 12px 6px;
  flex-shrink: 0;
}
.ref-search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  pointer-events: none;
}
.ref-search-input {
  width: 100%;
  padding: 8px 68px 8px 34px;
  background: var(--generator-surface-elevated, var(--bg-elevated, #27272a));
  border: 1px solid var(--generator-border, var(--border, rgba(255, 255, 255, 0.08)));
  border-radius: 20px;
  color: var(--generator-text-primary, var(--text-primary, #f4f4f5));
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.ref-search-input:focus {
  border-color: var(--generator-accent, var(--accent, #3b82f6));
}
.ref-search-input::placeholder {
  color: var(--generator-text-muted, var(--text-muted, #71717a));
}
.ref-multi-toggle {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 5px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(63, 63, 70, 0.4);
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.ref-multi-toggle:hover {
  background: rgba(63, 63, 70, 0.6);
  color: var(--generator-text-secondary, var(--text-secondary, #d4d4d8));
}
.ref-multi-toggle.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}
.ref-multi-checkbox {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid var(--generator-text-muted, var(--text-muted, #71717a));
  flex-shrink: 0;
  transition: all 0.15s;
}
.ref-multi-checkbox.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}
.ref-menu-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 10px;
  display: flex;
  gap: 0;
  min-height: 0;
}
.ref-col-left-wrap {
  min-width: 0;
  overflow: hidden;
}
.ref-col-divider {
  width: 4px;
  flex-shrink: 0;
  background: var(--generator-border, var(--border, rgba(255, 255, 255, 0.08)));
  margin: 4px 2px;
  cursor: col-resize;
  border-radius: 2px;
  transition: background 0.15s;
}
.ref-col-divider:hover,
.ref-col-divider.dragging {
  background: rgba(59, 130, 246, 0.6);
}
</style>

<style>
.ref-col {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  min-width: 0;
}
.ref-col-left {
  width: 100%;
}
.ref-col-right {
  flex: 1;
}
.ref-empty-hint {
  font-size: 12px;
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  padding: 16px 4px;
  text-align: center;
}
.ref-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 2px 4px;
}
.ref-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ref-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 64px;
  cursor: pointer;
  border-radius: 8px;
  padding: 4px;
  transition: background 0.15s;
}
.ref-grid-item:hover,
.ref-grid-item.active {
  background: var(--generator-surface-hover, var(--bg-hover, rgba(63, 63, 70, 0.7)));
}
.ref-grid-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--generator-surface-elevated, var(--bg-elevated, #27272a));
  display: flex;
  align-items: center;
  justify-content: center;
}
.ref-grid-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ref-grid-placeholder {
  color: var(--generator-text-muted, var(--text-muted, #71717a));
}
.ref-grid-label {
  font-size: 11px;
  color: var(--generator-text-secondary, var(--text-secondary, #d4d4d8));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 64px;
  text-align: center;
}
.ref-skeleton {
  animation: ref-sk-pulse 1.2s ease-in-out infinite;
}
@keyframes ref-sk-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
</style>
