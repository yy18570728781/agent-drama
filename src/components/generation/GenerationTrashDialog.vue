<template>
  <el-dialog
    :model-value="visible"
    title="回收站"
    width="min(94vw, 1180px)"
    top="8vh"
    destroy-on-close
    :show-close="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="trash-dialog">
      <div class="trash-dialog-toolbar">
        <div class="trash-dialog-count">共 {{ total }} 条</div>
        <div class="trash-dialog-actions">
          <el-button
            type="primary"
            size="small"
            :disabled="selectedIds.size === 0"
            :loading="restoringIds.size > 0"
            @click="restoreSelected"
          >
            恢复
          </el-button>
          <button class="trash-dialog-close" type="button" title="关闭" aria-label="关闭回收管理" @click="closeDialog">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>

      <el-alert
        v-if="errorMessage"
        class="trash-dialog-alert"
        type="warning"
        :closable="false"
        show-icon
        :title="errorMessage"
      />

      <div ref="scrollerRef" class="trash-dialog-scroller" @scroll="handleScroll">
        <div v-if="records.length" class="trash-grid">
          <button
            v-for="record in records"
            :key="getRecordId(record)"
            type="button"
            class="trash-card"
            :class="{ selected: selectedIds.has(getRecordId(record)) }"
            @click="toggleSelect(record)"
          >
            <div v-if="selectedIds.has(getRecordId(record))" class="selection-badge">✓</div>
            <div class="trash-card-media">
              <img v-if="thumbnailUrl(record)" :src="thumbnailUrl(record)" alt="thumb" class="trash-card-image" />
              <div v-else class="trash-card-empty">暂无预览</div>
            </div>
          </button>
        </div>

        <div v-else-if="!loading" class="trash-empty">暂无已删除记录</div>
        <div v-if="loading || loadingMore" class="trash-loading">{{ loading ? '加载中...' : '正在加载更多...' }}</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from '@/components/common/icon/lucide'
import { useDeletedTeamonesRecords } from '@/composables/settings/useDeletedTeamonesRecords'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const scrollerRef = ref<HTMLElement | null>(null)
const {
  loading,
  loadingMore,
  errorMessage,
  records,
  total,
  hasMore,
  restoringIds,
  selectedIds,
  thumbnailUrl,
  getRecordId,
  loadRecords,
  toggleSelect,
  restoreSelected,
} = useDeletedTeamonesRecords()

function closeDialog(): void {
  emit('update:visible', false)
}

function handleScroll(): void {
  const el = scrollerRef.value
  if (!el || loading.value || loadingMore.value || !hasMore.value) return
  if (el.scrollTop + el.clientHeight < el.scrollHeight - 240) return
  void loadRecords(false)
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    void loadRecords(true)
  },
  { immediate: true },
)
</script>

<style scoped>
.trash-dialog { display: flex; flex-direction: column; gap: 8px; }
.trash-dialog-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.trash-dialog-actions { display: flex; align-items: center; gap: 8px; }
.trash-dialog-count { font-size: 12px; color: var(--text-muted); }
.trash-dialog-close {
  display: inline-grid; width: 36px; height: 36px; flex: 0 0 36px; padding: 0; place-items: center;
  border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-muted); cursor: pointer;
  transition: color var(--sys-duration-fast) ease, background var(--sys-duration-fast) ease, border-color var(--sys-duration-fast) ease;
}
.trash-dialog-close:hover { border-color: var(--border); background: var(--bg-hover); color: var(--text-primary); }
.trash-dialog-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.trash-dialog-alert { margin-bottom: 2px; }
.trash-dialog-scroller { height: 62vh; overflow: auto; }
.trash-grid { column-count: 5; column-gap: 1px; }
.trash-card {
  position: relative; width: 100%; margin: 0 0 1px; break-inside: avoid;
  border: 1px solid transparent; border-radius: 0; overflow: hidden; background: var(--bg-elevated); text-align: left; cursor: pointer;
}
.trash-card.selected { border-color: var(--accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
.selection-badge {
  position: absolute; top: 8px; right: 8px; z-index: 2; width: 22px; height: 22px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700;
}
.trash-card-media { position: relative; background: var(--bg-base); min-height: 120px; }
.trash-card-image { width: 100%; display: block; object-fit: cover; }
.trash-card-empty { min-height: 120px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; }
.trash-empty, .trash-loading { padding: 24px 0; text-align: center; color: var(--text-muted); font-size: 13px; }
</style>
