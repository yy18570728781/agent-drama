<template>
  <div class="filter-bar-wrap">
    <div class="filter-bar">
      <!-- 普通筛选区（回收站模式下隐藏） -->
      <template v-if="!store.filter.trash">
        <div class="filter-group type-group" aria-label="文件类型筛选">
          <button
            v-for="t in types"
            :key="t.value"
            class="filter-chip icon-chip"
            :class="{ active: store.filter.type === t.value }"
            :title="t.label"
            :aria-label="t.label"
            @click="store.setFilter({ type: t.value })"
          >
            <component :is="t.icon" :size="13" />
          </button>
        </div>
        <div class="filter-group">
          <span class="filter-label">排序</span>
          <button
            v-for="s in sorts"
            :key="s.value"
            class="filter-chip icon-chip"
            :class="{ active: store.filter.sort === s.value }"
            :title="s.label"
            :aria-label="s.label"
            @click="store.setFilter({ sort: s.value })"
          >
            <component :is="s.icon" :size="13" />
          </button>
        </div>
        <div class="filter-group">
          <button
            class="filter-chip"
            :class="{ active: store.filter.favorite }"
            @click="store.setFilter({ favorite: !store.filter.favorite })"
          >&#9733; 收藏</button>
        </div>
        <div class="filter-group">
          <span class="filter-label">视图</span>
          <button
            class="filter-chip icon-chip"
            :class="{ active: props.viewMode === 'grid' }"
            title="瀑布流"
            aria-label="瀑布流"
            @click="setViewMode('grid')"
          >
            <Grid3x3 :size="13" />
          </button>
          <button
            class="filter-chip icon-chip"
            :class="{ active: props.viewMode === 'table' }"
            title="明细"
            aria-label="明细"
            @click="setViewMode('table')"
          >
            <List :size="13" />
          </button>
        </div>
        <div class="search-box">
          <input
            type="text"
            placeholder="搜索..."
            :value="store.filter.search"
            @keyup.enter="onSearch"
            @input="onSearchInput"
          >
        </div>
        <div class="filter-group batch-entry-group">
          <button class="filter-chip" @click="startBatchFavorite">批量收藏</button>
          <button class="filter-chip danger-chip" @click="startBatchDelete">批量删除</button>
        </div>
      </template>

      <!-- 回收站模式标题 -->
      <template v-else>
        <span class="trash-mode-label"><Trash2 :size="13" /> 回收站</span>
        <span class="trash-mode-hint">共 {{ store.total }} 条已删除记录</span>
      </template>

      <div class="spacer" />

      <!-- 回收站切换按钮 -->
      <button
        class="filter-chip icon-chip"
        :class="{ active: store.filter.trash }"
        title="回收站"
        aria-label="回收站"
        @click="toggleTrash"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <!-- 批量操作条（有选中时显示） -->
    <div v-if="store.selectionMode || store.selectedCount > 0" class="batch-bar">
      <span class="batch-count">已选 {{ store.selectedCount }} 项</span>
      <button class="batch-btn" @click="store.toggleSelectAll()">
        {{ store.allSelected ? '取消全选' : '全选' }}
      </button>
      <button class="batch-btn" @click="store.stopSelectionMode()">取消</button>
      <div class="batch-sep" />
      <template v-if="store.filter.trash">
        <!-- 回收站模式：恢复 / 永久删除 -->
        <button v-if="store.restoreSupported" class="batch-btn" @click="onBatchRestore">恢复</button>
        <button class="batch-btn danger" @click="onBatchHardDelete">永久删除</button>
      </template>
      <template v-else>
        <button class="batch-btn" :disabled="store.selectedCount === 0" @click="onBatchFavorite">
          {{ allFavorited ? '取消收藏' : '收藏' }}
        </button>
        <!-- 普通模式：软删除 -->
        <button class="batch-btn danger" :disabled="store.selectedCount === 0" @click="onBatchDelete">删除</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ViewMode = 'grid' | 'table'

import { ArrowDownWideNarrow, ArrowUpWideNarrow, Folder, Grid3x3, Image, List, Video, Trash2 } from '@/components/common/icon/lucide'
import { useAssetStore } from '@/stores/assets.store'

const props = withDefaults(defineProps<{
  viewMode?: ViewMode
}>(), {
  viewMode: 'grid',
})

const emit = defineEmits<{
  (e: 'update:viewMode', mode: ViewMode): void
}>()

const store = useAssetStore()
const allFavorited = computed(() => {
  if (store.selectedCount === 0) return false
  return store.items
    .filter(item => store.selectedIds.has(item.id))
    .every(item => item.is_favorites)
})

const types = [
  { label: '全部', value: 'all', icon: Folder },
  { label: '图片', value: 'image', icon: Image },
  { label: '视频', value: 'video', icon: Video },
]

const sorts = [
  { label: '最新', value: 'newest', icon: ArrowDownWideNarrow },
  { label: '最早', value: 'oldest', icon: ArrowUpWideNarrow },
]

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  store.filter.search = val
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => store.load(), 500)
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  store.load()
}

function setViewMode(mode: ViewMode) {
  if (mode === props.viewMode) return
  emit('update:viewMode', mode)
}

function toggleTrash() {
  store.stopSelectionMode()
  store.setFilter({ trash: !store.filter.trash })
}

function startBatchFavorite() {
  store.startSelectionMode()
}

function startBatchDelete() {
  store.startSelectionMode()
}

function onBatchFavorite() {
  const ids = [...store.selectedIds]
  store.doToggleFavoriteBatch(ids)
}

function onBatchDelete() {
  const ids = [...store.selectedIds]
  store.doDeleteBatch(ids)
}

function onBatchHardDelete() {
  const ids = [...store.selectedIds]
  store.doDeleteBatch(ids, true)
}

function onBatchRestore() {
  const ids = [...store.selectedIds]
  store.doRestoreBatch(ids)
}
</script>

<style scoped>
.filter-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.spacer { flex: 1; }

.trash-mode-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #f87171;
}

.trash-mode-hint {
  font-size: 11px;
  color: #71717a;
}

.filter-group { display: flex; align-items: center; gap: 4px; }
.batch-entry-group { margin-left: 2px; }
.filter-label { font-size: 11px; color: #71717a; }

.filter-chip {
  padding: 2px 8px;
  border-radius: 5px;
  border: 1px solid #3f3f46;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  color: #a1a1aa;
  transition: all 0.15s;
}

.filter-chip:hover { border-color: #3b82f6; color: #d4d4d8; }

.filter-chip.active {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.danger-chip {
  color: #fca5a5;
  border-color: #7f1d1d;
}

.icon-chip {
  width: 28px;
  min-width: 28px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.search-box {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid #3f3f46;
  border-radius: 5px;
  background: transparent;
}

.search-box input {
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 11px;
  width: 100px;
  background: transparent;
  color: #d4d4d8;
}

.search-box input::placeholder { color: #52525b; }

/* 批量操作条 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 6px;
  flex-shrink: 0;
}

.batch-count {
  font-size: 12px;
  font-weight: 600;
  color: #93c5fd;
  min-width: 60px;
}

.batch-sep {
  width: 1px;
  height: 16px;
  background: #3f3f46;
  margin: 0 2px;
}

.batch-btn {
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid #3f3f46;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  color: #a1a1aa;
  transition: all 0.15s;
}

.batch-btn:hover { border-color: #52525b; color: #d4d4d8; }

.batch-btn.danger { color: #f87171; border-color: #7f1d1d; }
.batch-btn.danger:hover { background: rgba(239, 68, 68, 0.12); border-color: #ef4444; }
</style>
