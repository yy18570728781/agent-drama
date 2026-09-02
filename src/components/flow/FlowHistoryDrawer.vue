<script setup lang="ts">
import type { FlowCanvasHistoryVersion } from '@/services/flow/flowCanvasHistory.types'
import { computed } from 'vue'
import './FlowHistoryDrawer.scss'

defineOptions({ name: 'FlowHistoryDrawer' })

const props = defineProps<{
  loading: boolean
  previewError: string
  previewLoading: boolean
  restoringRevision: number | null
  selectedRevision: number | null
  versions: FlowCanvasHistoryVersion[]
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  restore: [revision: number]
  select: [revision: number]
}>()

interface HistoryGroup {
  items: FlowCanvasHistoryVersion[]
  label: string
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const key = date.toDateString()
  if (key === today.toDateString()) return '今天'
  if (key === yesterday.toDateString()) return '昨天'
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function historyDescription(version: FlowCanvasHistoryVersion): string {
  const actorName = version.actorName || version.actorId || '未知用户'
  return `${actorName} 的编辑 · 版本 ${version.revision}`
}

const historyGroups = computed<HistoryGroup[]>(() => {
  const groups = new Map<string, HistoryGroup>()
  props.versions.forEach((version) => {
    const date = new Date(version.createdAt)
    const label = Number.isNaN(date.getTime()) ? '更早' : dayLabel(date)
    const group = groups.get(label) ?? { items: [], label }
    group.items.push(version)
    groups.set(label, group)
  })
  return [...groups.values()]
})
</script>

<template>
  <Teleport to="body">
    <Transition name="flow-history-drawer">
      <aside v-if="visible" class="flow-history-drawer" aria-label="画布历史记录">
        <header class="flow-history-tabs" :class="{ 'is-loading-preview': previewLoading }">
          <span class="flow-history-tab">历史记录</span>
          <button class="flow-history-close" type="button" title="关闭" @click="emit('close')">×</button>
        </header>
        <div class="flow-history-scroll">
          <div v-if="loading" class="flow-history-empty">历史记录加载中...</div>
          <template v-else-if="historyGroups.length">
            <section v-for="group in historyGroups" :key="group.label" class="flow-history-day-group">
              <h3 class="flow-history-section-title">{{ group.label }}</h3>
              <article
                v-for="version in group.items"
                :key="version.id"
                class="flow-history-record"
                :class="{ 'is-active': selectedRevision === version.revision }"
              >
                <button class="flow-history-entry" type="button" @click="emit('select', version.revision)">
                  <span class="flow-history-time">{{ formatTime(version.createdAt) }}</span>
                  <span class="flow-history-tags">
                    <span v-if="version === versions[0]" class="flow-history-current-tag">当前版本</span>
                  </span>
                  <span class="flow-history-text">{{ historyDescription(version) }}</span>
                  <span
                    v-if="selectedRevision === version.revision && previewError"
                    class="flow-history-preview-error"
                  >{{ previewError }}</span>
                </button>
                <button
                  class="flow-history-restore"
                  type="button"
                  :disabled="
                    selectedRevision !== version.revision ||
                    version === versions[0] ||
                    restoringRevision !== null
                  "
                  @click="emit('restore', version.revision)"
                >
                  {{ restoringRevision === version.revision ? '还原中' : '还原' }}
                </button>
              </article>
            </section>
            <div class="flow-history-more">没有更多历史记录</div>
          </template>
          <div v-else class="flow-history-empty">暂无历史记录</div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
