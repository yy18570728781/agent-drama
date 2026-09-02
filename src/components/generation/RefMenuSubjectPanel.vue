<template>
  <div class="ref-col ref-col-right">
    <div class="ref-section-title">主体库</div>
    <!-- 一级分类 -->
    <div v-if="categoryBar.firstLevelCategories.length" class="ref-cat-bar">
      <button class="ref-cat-pill" :class="{ active: !categoryBar.activeCategoryId }"
        @mousedown.prevent @click.stop="categoryBar.selectCategory(null)">全部</button>
      <button v-for="catItem in categoryBar.firstLevelCategories" :key="catItem.id"
        class="ref-cat-pill"
        :class="{ active: categoryBar.activeCategoryId === catItem.id && !categoryBar.activeSubCategoryId }"
        @mousedown.prevent @click.stop="categoryBar.selectCategory(catItem.id)">{{ catItem.name }}</button>
    </div>
    <!-- 二级分类 -->
    <div v-if="categoryBar.subCategories.length" class="ref-cat-bar">
      <button class="ref-cat-pill" :class="{ active: !categoryBar.activeSubCategoryId }"
        @mousedown.prevent @click.stop="categoryBar.selectSubCategory(null)">全部</button>
      <button v-for="subItem in categoryBar.subCategories" :key="subItem.id"
        class="ref-cat-pill"
        :class="{ active: categoryBar.activeSubCategoryId === subItem.id }"
        @mousedown.prevent @click.stop="categoryBar.selectSubCategory(subItem.id)">{{ subItem.name }}</button>
    </div>
    <!-- 主体网格 -->
    <div v-if="loading" class="ref-grid">
      <div v-for="n in 6" :key="'sk-' + n" class="ref-grid-item">
        <div class="ref-grid-thumb ref-skeleton"></div>
        <span class="ref-grid-label ref-skeleton">&nbsp;</span>
      </div>
    </div>
    <div v-else-if="subjects.length" class="ref-grid">
      <div v-for="sub in subjects" :key="'sub-' + sub.id"
        class="ref-grid-item"
        :class="{
          active: activeItemId === `sub-${sub.id}`,
          selected: multiSelectMode && selectedIds.has(sub.id),
        }"
        @mousedown.prevent
        @click.stop="onSubjectClick(sub)">
        <div class="ref-grid-thumb">
          <img v-if="sub.thumb" :src="sub.thumb" class="ref-grid-media" />
          <div v-else class="ref-grid-placeholder">
            <ImageIcon class="w-4 h-4" />
          </div>
          <div v-if="(sub.mediaCount ?? 0) > 1" class="ref-media-badge"
            @mouseenter="onSubjectHoverEnter(sub, $event)"
            @mouseleave="onSubjectHoverLeave"
            @mousedown.prevent.stop>×{{ sub.mediaCount }}</div>
        </div>
        <div v-if="multiSelectMode && selectedIds.has(sub.id)" class="ref-grid-check">
          <CheckIcon class="w-3 h-3" />
        </div>
        <span class="ref-grid-label">{{ sub.name }}</span>
      </div>
    </div>
    <div v-else class="ref-empty-hint">未找到匹配的主体</div>

    <!-- 多媒体悬浮面板 -->
    <teleport to="body">
      <div v-if="hoverPanel.show" class="sub-media-pop"
        :style="hoverPanelStyle"
        @mouseenter="onPanelEnter"
        @mouseleave="onPanelLeave">
        <div class="sub-media-title">选择引用</div>
        <div v-if="hoverPanel.loading" class="sub-media-loading">加载中...</div>
        <div v-else class="sub-media-grid">
          <div v-for="(m, idx) in hoverPanel.media" :key="m.id"
            class="sub-media-item"
            :class="{ primary: idx === 0 }"
            @pointerdown.stop.prevent="onSelectMedia(hoverPanel.subjectId, m.sourceUrl, m.mediaType)">
            <img :src="m.thumbUrl" class="sub-media-img" />
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import { Image as ImageIcon, Check as CheckIcon } from '@/components/common/icon/lucide'
import type { SubjectPickerItem, SubjectCategoryBar, SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'
import { useSubjectMediaHover, type SubjectMediaThumb } from '@/composables/subjects/useSubjectMediaHover'

const props = defineProps<{
  subjects: SubjectPickerItem[]
  loading: boolean
  activeItemId: string
  categoryBar: SubjectCategoryBar
  multiSelectMode: boolean
}>()

const emit = defineEmits<{
  'select-subject': [payload: SubjectSelectPayload]
  'set-active': [id: string]
}>()

// ── 多选已选集合 ──
const selectedIds = ref<Set<string>>(new Set())

// ── 多媒体悬浮状态 ──
const { loadMedia } = useSubjectMediaHover()

const hoverPanel = reactive({
  show: false,
  loading: false,
  subjectId: '',
  media: [] as SubjectMediaThumb[],
  anchorRect: null as DOMRect | null,
})

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const hoverPanelStyle = computed(() => {
  const rect = hoverPanel.anchorRect
  if (!rect) return { display: 'none' }
  const panelW = 260
  const panelH = 120
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = rect.right + 8
  if (left + panelW > vw - 8) {
    left = rect.left - panelW - 8
  }
  let top = rect.top
  if (top + panelH > vh - 8) {
    top = vh - panelH - 8
  }
  if (top < 8) top = 8
  return { left: `${left}px`, top: `${top}px` }
})

function clearHoverTimer(): void {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
}

function clearHideTimer(): void {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

async function onSubjectHoverEnter(sub: SubjectPickerItem, event: MouseEvent): Promise<void> {
  emit('set-active', `sub-${sub.id}`)
  clearHideTimer()
  clearHoverTimer()
  const target = event.currentTarget as HTMLElement
  hoverTimer = setTimeout(async () => {
    hoverTimer = null
    hoverPanel.anchorRect = target.getBoundingClientRect()
    hoverPanel.subjectId = sub.id
    hoverPanel.media = []
    hoverPanel.loading = true
    hoverPanel.show = true
    const cached = loadMedia(sub.id)
    const media = await cached
    if (hoverPanel.subjectId !== sub.id) return
    hoverPanel.media = media
    hoverPanel.loading = false
    if (media.length <= 1) {
      hoverPanel.show = false
    }
  }, 300)
}

function onSubjectHoverLeave(): void {
  clearHoverTimer()
  scheduleHide()
}

function onPanelEnter(): void {
  clearHideTimer()
}

function onPanelLeave(): void {
  scheduleHide()
}

function scheduleHide(): void {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    hoverPanel.show = false
  }, 200)
}

function onSubjectClick(sub: SubjectPickerItem): void {
  clearHoverTimer()
  hoverPanel.show = false

  if (props.multiSelectMode) {
    selectedIds.value.add(sub.id)
    selectedIds.value = new Set(selectedIds.value)
  }

  emit('select-subject', {
    subjectId: sub.id,
    multiSelect: props.multiSelectMode,
  })
}

function onSelectMedia(subjectId: string, mediaUrl: string, mediaType?: 'image' | 'video'): void {
  hoverPanel.show = false
  if (props.multiSelectMode) {
    selectedIds.value.add(subjectId)
    selectedIds.value = new Set(selectedIds.value)
  }
  emit('select-subject', {
    subjectId,
    mediaUrl,
    mediaType,
    multiSelect: props.multiSelectMode,
  })
}

onBeforeUnmount(() => {
  clearHoverTimer()
  clearHideTimer()
})
</script>

<style scoped>
.ref-cat-bar {
  display: flex;
  gap: 4px;
  padding: 2px 0 4px;
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: thin;
}
.ref-cat-bar::-webkit-scrollbar {
  height: 2px;
}
.ref-cat-bar::-webkit-scrollbar-thumb {
  background: rgba(113, 113, 122, 0.3);
  border-radius: 1px;
}
.ref-cat-pill {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(63, 63, 70, 0.4);
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.ref-cat-pill:hover {
  background: rgba(63, 63, 70, 0.6);
  color: var(--generator-text-secondary, var(--text-secondary, #d4d4d8));
}
.ref-cat-pill.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}
</style>

<style>
.ref-grid-item.selected .ref-grid-thumb {
  position: relative;
}
.ref-grid-item.selected .ref-grid-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(59, 130, 246, 0.15);
  border-radius: 8px;
  pointer-events: none;
}
.ref-media-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  z-index: 2;
  transition: background 0.15s;
}
.ref-media-badge:hover {
  background: rgba(59, 130, 246, 0.8);
}
.ref-grid-check {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.sub-media-pop {
  position: fixed;
  z-index: 10001;
  background: var(--generator-surface-panel, var(--bg-surface, #18181b));
  border: 1px solid var(--generator-border, var(--border, rgba(255, 255, 255, 0.08)));
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  padding: 10px;
  width: 260px;
}
.sub-media-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  margin-bottom: 8px;
}
.sub-media-loading {
  font-size: 12px;
  color: var(--generator-text-muted, var(--text-muted, #71717a));
  padding: 16px 0;
  text-align: center;
}
.sub-media-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sub-media-item {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}
.sub-media-item:hover {
  border-color: rgba(59, 130, 246, 0.6);
}
.sub-media-item.primary {
  border-color: rgba(59, 130, 246, 0.4);
}
.sub-media-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
