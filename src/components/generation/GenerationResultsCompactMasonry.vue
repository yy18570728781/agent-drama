<template>
  <div class="generation-results-compact">
    <template v-for="virtualGroup in virtualGroups" :key="virtualGroup.dateGroup.dateLabel">
      <div v-if="props.showDateGroups" class="masonry-group-header">
        <span class="group-title">{{ virtualGroup.dateGroup.dateLabel }}</span>
        <span class="group-count">{{ virtualGroup.dateGroup.count }} 条</span>
      </div>
      <div class="compact-grid-row" :style="{ gap: '2px' }">
        <div v-for="colWindow in virtualGroup.columns" :key="colWindow.key" class="compact-col" :style="{ gap: '2px' }">
          <div class="virtual-column-spacer" :style="{ height: colWindow.topSpacer + 'px' }"></div>
          <div
            v-for="item in colWindow.items"
            :key="item.group[0].id"
            class="compact-item-wrapper"
          >
            <!-- 生成中占位卡片 -->
            <GeneratingPlaceholderCard
              v-if="item.group[0]._isPlaceholder"
              :task="item.group[0]._task"
              :aspect-ratio="props.waterfallEnabled ? undefined : props.displayRatioValue"
              @repair="props.onRepairTask?.($event)"
            />
            <!-- 普通结果卡片 -->
            <div
              v-else
              :class="['compact-card', { 'new-result-highlight': props.highlightedGroupKeys.has(String(item.group[0].id)), 'uniform-card': !props.waterfallEnabled, 'is-selected': props.selectedIds.has(currentAssetOf(item.group).id), 'is-selection-mode': props.selectionMode }]"
              :style="!props.waterfallEnabled ? { aspectRatio: props.displayRatioValue } : undefined"
              :draggable="!props.selectionMode"
              @dblclick.stop.prevent="undefined"
              @click="props.selectionMode ? props.onToggleSelect(currentAssetOf(item.group).id) : props.onOpenDetail(props.getCurrentAsset(item.group))"
              @contextmenu.prevent="props.onContextMenu?.($event, props.getCurrentAsset(item.group))"
              @mouseenter="props.selectionMode ? props.onSweepSelect(currentAssetOf(item.group).id) : props.onDragPrepare?.(props.getCurrentAsset(item.group))"
              @mousedown="props.selectionMode ? props.onSweepPointerDown(currentAssetOf(item.group).id) : props.onDragPrepare?.(props.getCurrentAsset(item.group))"
              @dragstart.capture="props.selectionMode ? $event.preventDefault() : props.onDragStart?.($event, props.getCurrentAsset(item.group))"
              @dragend.capture="!props.selectionMode && props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
            >
              <div v-if="props.selectionMode && props.selectedIds.has(currentAssetOf(item.group).id)" class="selection-badge">✓</div>
              <div
                :class="['media-area', { 'uniform-media': !props.waterfallEnabled }]"
                :style="!props.waterfallEnabled ? { '--uniform-fit-mode': props.displayFitMode } : undefined"
              >
                <template v-if="isFailedAsset(currentAssetOf(item.group))">
                  <div
                    class="failed-preview-badge"
                    :title="getFailureReason(currentAssetOf(item.group))"
                    @click.stop
                    @mousedown.stop
                  >
                    <div class="failed-preview-text">{{ getFailureReason(currentAssetOf(item.group)) }}</div>
                  </div>
                </template>
                <template v-else-if="currentAssetOf(item.group).type === 'video'">
                  <video
                    :src="currentAssetOf(item.group).url"
                    :poster="currentAssetOf(item.group).thumbnail_url || undefined"
                    preload="none" loop muted playsinline
                    draggable="false"
                    class="media-content"
                    :style="{ aspectRatio: mediaAspectRatioOf(item.group) }"
                    @mouseenter="($event.target as HTMLVideoElement).play().catch(() => {})"
                    @mouseleave="resetVideo($event.target as HTMLVideoElement)"
                  />
                </template>
                <template v-else-if="currentAssetOf(item.group).type === 'model'">
                  <img
                    v-if="currentAssetOf(item.group).thumbnail_url"
                    :src="currentAssetOf(item.group).thumbnail_url"
                    class="media-content"
                    draggable="false"
                    :style="{ aspectRatio: mediaAspectRatioOf(item.group) }"
                    loading="lazy"
                  />
                  <div v-else class="media-placeholder media-placeholder-model">
                    <Box :size="22" />
                    <span>3D</span>
                  </div>
                </template>
                <template v-else-if="currentAssetOf(item.group).thumbnail_url || currentAssetOf(item.group).url">
                  <img
                    :src="currentAssetOf(item.group).thumbnail_url || currentAssetOf(item.group).url"
                    class="media-content"
                    draggable="false"
                    :style="{ aspectRatio: mediaAspectRatioOf(item.group) }"
                    loading="lazy"
                  />
                </template>
                <template v-else>
                  <div class="media-placeholder"><span class="placeholder-icon">&#128444;</span></div>
                </template>

                <div
                  v-if="!props.selectionMode || currentAssetOf(item.group).is_favorites"
                  class="action-overlay"
                  :class="{ 'has-favorite': currentAssetOf(item.group).is_favorites, 'selection-favorite': props.selectionMode }"
                  :draggable="!props.selectionMode"
                  @click.stop
                  @dragstart.capture="props.onDragStart?.($event, props.getCurrentAsset(item.group))"
                  @dragend.capture="props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
                >
                  <button
                    class="icon-btn"
                    :class="{ 'icon-btn-active': currentAssetOf(item.group).is_favorites }"
                    :title="currentAssetOf(item.group).is_favorites ? '取消收藏' : '收藏'"
                    :draggable="!props.selectionMode"
                    @click="!props.selectionMode && props.onToggleFavorite(currentAssetOf(item.group).id)"
                    @dragstart.stop="props.onDragStart?.($event, currentAssetOf(item.group))"
                    @dragend.stop="props.onDragEnd?.($event, currentAssetOf(item.group))"
                  ><Heart :size="14" :fill="currentAssetOf(item.group).is_favorites ? 'currentColor' : 'none'" /></button>
                  <button
                    class="icon-btn hover-only-action"
                    title="重新编辑"
                    :draggable="!props.selectionMode"
                    @click="props.onEdit(currentAssetOf(item.group))"
                    @dragstart.stop="props.onDragStart?.($event, props.getCurrentAsset(item.group))"
                    @dragend.stop="props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
                  ><Edit3 :size="14" /></button>
                  <button
                    class="icon-btn hover-only-action"
                    title="再次生成"
                    :draggable="!props.selectionMode"
                    @click="props.onRegenerate(currentAssetOf(item.group))"
                    @dragstart.stop="props.onDragStart?.($event, props.getCurrentAsset(item.group))"
                    @dragend.stop="props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
                  ><RefreshCw :size="14" /></button>
                  <button
                    class="icon-btn icon-btn-danger hover-only-action"
                    title="删除"
                    :draggable="!props.selectionMode"
                    @click="props.onDelete(currentAssetOf(item.group).id)"
                    @dragstart.stop="props.onDragStart?.($event, props.getCurrentAsset(item.group))"
                    @dragend.stop="props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
              ><Trash2 :size="14" /></button>
                </div>
              </div>
            </div>
          </div>
          <div class="virtual-column-spacer" :style="{ height: colWindow.bottomSpacer + 'px' }"></div>
        </div>
      </div>
    </template>

    <div v-if="!props.loading && props.empty" class="empty-hint">
      <span class="empty-hint-text">暂无生成结果</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Edit3, RefreshCw, Trash2, Box, Heart } from '@/components/common/icon/lucide'
import GeneratingPlaceholderCard from '@/components/generation/GeneratingPlaceholderCard.vue'
import { useMasonryVirtualWindow } from '@/composables/useMasonryVirtualWindow'

const props = defineProps<{
  dateGroups: Array<{
    dateLabel: string
    count: number
    columns: any[][]
  }>
  showDateGroups: boolean
  highlightedGroupKeys: Set<string>
  loading: boolean
  empty: boolean
  getCurrentAsset: (group: any[]) => any
  getAssetRatio: (asset: any) => number
  onSweepPointerDown: (id: string) => void
  onSweepSelect: (id: string) => void
  onToggleSelect: (id: string) => void
  onOpenDetail: (asset: any) => void
  onEdit: (asset: any) => void
  onRegenerate: (asset: any) => void
  onDelete: (id: string | number) => void
  onToggleFavorite: (id: string) => void
  onContextMenu?: (event: MouseEvent, asset: any) => void
  onDragPrepare?: (asset: any) => void
  onDragStart?: (event: DragEvent, asset: any) => void
  onDragEnd?: (event: DragEvent, asset: any) => void
  waterfallEnabled: boolean
  displayRatioValue: number
  displayFitMode: 'contain' | 'cover'
  selectionMode: boolean
  selectedIds: Set<string>
  scrollTop: number
  viewportHeight: number
  onRepairTask?: (task: any) => void
}>()

const { virtualGroups } = useMasonryVirtualWindow({
  dateGroups: computed(() => props.dateGroups),
  showDateGroups: computed(() => props.showDateGroups),
  scrollTop: computed(() => props.scrollTop),
  viewportHeight: computed(() => props.viewportHeight),
})

// 缓存当前资产，避免模板中重复调用
const currentAssetOf = (group: any[]) => props.getCurrentAsset(group)
const mediaAspectRatioOf = (group: any[]) => (props.waterfallEnabled ? props.getAssetRatio(currentAssetOf(group)) : props.displayRatioValue)
const isFailedAsset = (asset: any) => String(asset?.status || '').toLowerCase() === 'failed'
const getFailureReason = (asset: any) =>
  asset?.fail_reason?.error_message
  || asset?.failReason
  || asset?.fail_reason?.message
  || asset?.statusText
  || '未返回失败原因'

const resetVideo = (el: HTMLVideoElement) => {
  el.pause()
  el.currentTime = 0
}
</script>

<style scoped>
.generation-results-compact { padding: 12px 0 24px; }
.masonry-group-header { display:flex; align-items:baseline; gap:8px; padding:6px 4px 4px; font-size:12px; }
.group-title { color:var(--text-primary); font-weight:600; }
.group-count { font-size:11px; color:var(--text-muted); }
.compact-grid-row { display:flex; align-items:flex-start; }
.compact-col { flex:1; min-width:0; display:flex; flex-direction:column; }
.virtual-column-spacer { contain: layout style; flex: 0 0 auto; }
.compact-card { position:relative; cursor:pointer; overflow:hidden; }
.compact-card.is-selected { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: -1px; }
.selection-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
}
.compact-card:hover { outline:2px solid #3f3f46; outline-offset:-1px; }
.new-result-highlight { box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent); }
.media-area { position:relative; width:100%; overflow:hidden; background:#27272a; }
.media-content { width:100%; height:auto; display:block; }
.uniform-media .media-content { width: 100%; height: 100%; object-fit: var(--uniform-fit-mode, contain); }
.media-placeholder {
  width:100%; min-height:80px; aspect-ratio:1;
  display:flex; align-items:center; justify-content:center; background:#27272a;
}
.placeholder-icon { font-size:24px; color:#52525b; }
.media-placeholder-model { flex-direction:column; gap:6px; color:#a1a1aa; font-size:12px; }
.action-overlay {
  position:absolute; top:0; left:0; right:0;
  display:flex; align-items:center; justify-content:flex-start; gap:6px;
  padding:10px;
  background:linear-gradient(180deg, rgba(10,10,12,0.72) 0%, rgba(10,10,12,0) 100%);
  opacity:0; transition:opacity 0.18s ease; pointer-events:none;
}
.action-overlay.has-favorite { opacity:1; background:none; }
.action-overlay.has-favorite .hover-only-action { opacity:0; pointer-events:none; }
.action-overlay.has-favorite .icon-btn-active { pointer-events:auto; }
.action-overlay.selection-favorite { pointer-events:none; }
.action-overlay.selection-favorite .icon-btn-active { pointer-events:none; }
.failed-preview-badge {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px;
  background: linear-gradient(180deg, rgba(60,18,18,0.92) 0%, rgba(35,12,12,0.96) 100%);
  color: #ffe4e6;
  cursor: text;
  user-select: text;
  -webkit-user-select: text;
}
.failed-preview-text { font-size: 11px; line-height: 1.45; color: #ffe4e6; word-break: break-word; user-select: text; -webkit-user-select: text; }
.compact-card:hover .action-overlay { opacity:1; pointer-events:auto; }
.compact-card:hover .action-overlay.has-favorite { background:linear-gradient(180deg, rgba(10,10,12,0.72) 0%, rgba(10,10,12,0) 100%); }
.compact-card:hover .action-overlay.has-favorite .hover-only-action { opacity:1; pointer-events:auto; }
.icon-btn {
  display:flex; align-items:center; justify-content:center;
  width:32px; height:32px; border-radius:7px;
  background:rgba(22,22,28,0.82); color:#c4c4cc;
  border:1px solid rgba(255,255,255,0.12); cursor:pointer;
  transition:background 0.15s, color 0.15s, border-color 0.15s, transform 0.12s;
  backdrop-filter:blur(8px); font-size:14px; flex-shrink:0;
}
.icon-btn:hover { background:rgba(50,50,62,0.95); color:#fff; border-color:rgba(255,255,255,0.24); transform:scale(1.08); }
.icon-btn.icon-btn-active { color:#fb7185; border-color:rgba(251,113,133,0.48); }
.icon-btn-danger:hover { background:rgba(248,113,113,0.2); border-color:rgba(248,113,113,0.45); color:#F87171; }
.empty-hint { display:flex; align-items:center; justify-content:center; min-height:220px; color:var(--text-muted); }
.empty-hint-text { font-size:13px; }
</style>
