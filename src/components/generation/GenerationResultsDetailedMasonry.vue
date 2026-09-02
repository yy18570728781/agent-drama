<template>
  <div class="generation-results-detailed">
    <template v-for="virtualGroup in virtualGroups" :key="virtualGroup.dateGroup.dateLabel">
      <div v-if="props.showDateGroups" class="masonry-group-header">
        <span class="group-title">{{ virtualGroup.dateGroup.dateLabel }}</span>
        <span class="group-count">{{ virtualGroup.dateGroup.count }} 条</span>
      </div>
      <div class="masonry-grid-row">
        <div v-for="colWindow in virtualGroup.columns" :key="colWindow.key" class="masonry-col">
          <div class="virtual-column-spacer" :style="{ height: colWindow.topSpacer + 'px' }"></div>
          <div
            v-for="item in colWindow.items"
            :key="item.group[0].id"
            :class="['generation-group-wrapper', { 'uniform-card': !props.waterfallEnabled }]"
            :style="!props.waterfallEnabled ? { aspectRatio: props.displayRatioValue } : undefined"
          >
            <!-- 生成中占位卡片 -->
            <GeneratingPlaceholderCard
              v-if="item.group[0]._isPlaceholder"
              :task="item.group[0]._task"
              :aspect-ratio="props.waterfallEnabled ? undefined : props.displayRatioValue"
              @repair="props.onRepairTask?.($event)"
            />
            <!-- 普通结果卡片 -->
            <template v-else>
            <div
              class="generation-group"
              :class="['generation-group', { 'is-selected': props.selectedIds.has(props.getCurrentAsset(item.group).id), 'is-selection-mode': props.selectionMode }]"
              :draggable="!props.selectionMode"
              @dblclick.stop.prevent="undefined"
              @mouseenter="props.selectionMode ? props.onSweepSelect(props.getCurrentAsset(item.group).id) : props.onDragPrepare?.(props.getCurrentAsset(item.group))"
              @mousedown="props.selectionMode ? props.onSweepPointerDown(props.getCurrentAsset(item.group).id) : props.onDragPrepare?.(props.getCurrentAsset(item.group))"
              @dragstart.capture="onGroupDragStartCapture($event, props.getCurrentAsset(item.group))"
              @dragend="!props.selectionMode && props.onDragEnd?.($event, props.getCurrentAsset(item.group))"
            >
              <div v-if="props.selectionMode && props.selectedIds.has(props.getCurrentAsset(item.group).id)" class="selection-badge">✓</div>
              <div :class="['feed-card', { 'new-result-highlight': props.highlightedGroupKeys.has(String(item.group[0].id)), 'uniform-feed': !props.waterfallEnabled }]">
                <div class="media-container">
                  <div class="card-content-panel">
                    <div class="card-details">
                      <div class="detail-inline-row">
                        <div v-if="getCardReferenceUrls(props.getCurrentAsset(item.group)).length" class="inline-ref-strip">
                          <a
                            v-for="(url, idx) in getCardReferenceUrls(props.getCurrentAsset(item.group))"
                            :key="idx"
                            class="inline-ref-thumb"
                            :href="url"
                            target="_blank"
                            rel="noopener noreferrer"
                            :title="url"
                            draggable="true"
                            @mouseenter="onRefThumbDragPrepare(url)"
                            @mousedown.stop="onRefThumbDragPrepare(url)"
                            @dragstart.stop="onRefThumbDragStart($event, url)"
                            @dragend.stop="onRefThumbDragEnd($event, url)"
                            @click.stop="onRefThumbClick($event, url)"
                          >
                            <video
                              v-if="isReferenceVideoUrl(url)"
                              :src="url"
                              class="inline-ref-thumb-media"
                              preload="metadata"
                              playsinline
                            />
                            <span v-if="isReferenceVideoUrl(url)" class="inline-ref-play-mask">
                              <span class="inline-ref-play-icon"></span>
                            </span>
                            <img
                              v-else
                              :src="url"
                              class="inline-ref-thumb-media"
                              alt="参考图"
                              loading="lazy"
                              draggable="false"
                              referrerpolicy="no-referrer"
                            />
                          </a>
                        </div>

                        <el-tooltip placement="top-start" :show-after="200" popper-class="cardview-prompt-tooltip">
                          <template #content>
                            <div class="prompt-tooltip-content">
                              {{ props.getCurrentAsset(item.group).prompt || '无提示词' }}
                            </div>
                          </template>
                          <div class="inline-prompt">
                            <span class="inline-prompt-text" :class="{ 'is-empty': !props.getCurrentAsset(item.group).prompt }">
                              {{ props.getCurrentAsset(item.group).prompt || '无提示词' }}
                            </span>
                          </div>
                        </el-tooltip>

                        <button v-if="!props.selectionMode" class="inline-copy-btn" type="button" title="复制提示词" @click.stop="props.onCopyPrompt(props.getCurrentAsset(item.group))">
                          <component :is="props.copiedPromptAssetId === props.getCurrentAsset(item.group).id ? Check : Copy" :size="13" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    class="main-media-view"
                    :style="{ aspectRatio: props.waterfallEnabled ? props.getAssetRatio(item.group[0]) : props.displayRatioValue }"
                    :draggable="!props.selectionMode"
                    @click="onMainMediaClick($event, props.getCurrentAsset(item.group))"
                    @contextmenu.prevent="onMainMediaContextmenu($event, props.getCurrentAsset(item.group))"
                  >
                    <template v-if="isFailedAsset(props.getCurrentAsset(item.group))">
                      <div
                        class="failed-preview-panel"
                        :title="getFailureReason(props.getCurrentAsset(item.group))"
                        @click.stop
                        @mousedown.stop
                      >
                        <div class="failed-preview-label">失败原因</div>
                        <div class="failed-preview-text">{{ getFailureReason(props.getCurrentAsset(item.group)) }}</div>
                      </div>
                    </template>
                    <HistoryRecord
                      v-else
                      :record="props.assetToRecord(props.getCurrentAsset(item.group))"
                      :show-actions="false"
                      :original-ratio="false"
                      :fit="props.waterfallEnabled ? 'contain' : props.displayFitMode"
                      class="media-item h-full !aspect-auto"
                      @media-loaded="(dims) => props.onMediaLoaded(dims, props.getCurrentAsset(item.group).id)"
                    />

                    <div
                      v-if="!props.selectionMode || currentAssetOf(item.group).is_favorites"
                      class="card-overlay"
                      :class="{ 'has-favorite': currentAssetOf(item.group).is_favorites, 'selection-favorite': props.selectionMode }"
                    >
                      <div
                        class="overlay-toolbar"
                      >
                        <div class="overlay-actions">
                          <el-tooltip :content="currentAssetOf(item.group).is_favorites ? '取消收藏' : '收藏'" placement="top" :show-after="500">
                            <button
                              class="icon-action-btn"
                              :class="{ 'icon-action-btn-active': currentAssetOf(item.group).is_favorites }"
                              @click.stop="!props.selectionMode && props.onToggleFavorite(currentAssetOf(item.group).id)"
                            >
                              <Heart :size="14" :fill="currentAssetOf(item.group).is_favorites ? 'currentColor' : 'none'" />
                            </button>
                          </el-tooltip>
                          <el-tooltip content="重新编辑" placement="top" :show-after="500">
                            <button
                              class="icon-action-btn hover-only-action"
                              @click.stop="props.onEdit(props.getCurrentAsset(item.group))"
                            >
                              <Edit3 :size="14" />
                            </button>
                          </el-tooltip>
                          <el-tooltip content="再次生成" placement="top" :show-after="500">
                            <button
                              class="icon-action-btn hover-only-action"
                              @click.stop="props.onRegenerate(props.getCurrentAsset(item.group))"
                            >
                              <RefreshCw :size="14" />
                            </button>
                          </el-tooltip>
                          <el-tooltip content="删除" placement="top" :show-after="500">
                            <button
                              class="icon-action-btn hover-only-action"
                              @click.stop="props.onDelete(props.getCurrentAsset(item.group).id)"
                            >
                              <Trash2 :size="14" />
                            </button>
                          </el-tooltip>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="item.group.length > 1" class="card-bottom-panel">
                    <div class="detail-section result-section-bottom">
                      <div class="detail-section-header">
                        <span class="detail-section-title">结果</span>
                        <span class="detail-section-count">{{ props.getSelectedAssetIndex(item.group[0].id) + 1 }}/{{ item.group.length }}</span>
                      </div>
                      <div class="thumbnail-list result-thumbnail-list">
                        <div
                          v-for="(asset, idx) in item.group"
                          :key="asset.id"
                          class="thumbnail-item"
                          :class="{ active: props.getSelectedAssetIndex(item.group[0].id) === idx }"
                          @click.stop="props.onSelectAssetIndex(item.group[0].id, idx)"
                        >
                          <img v-if="asset.thumbnail_url || (asset.type !== 'model' && asset.url)" :src="asset.thumbnail_url || asset.url" class="thumbnail-img" loading="lazy" />
                          <div v-else class="thumbnail-placeholder"><Box :size="14" /></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="props.getAssetEntity?.(props.getCurrentAsset(item.group))" class="card-entity-badge">
                    <Package :size="11" />
                    <span>{{ props.getAssetEntity(props.getCurrentAsset(item.group))?.name }}</span>
                  </div>

                  <div v-if="props.getAssetModelLabel(props.getCurrentAsset(item.group)) || getVisibleAssetParamsSafe(props.getCurrentAsset(item.group)).length" class="card-meta-footer">
                    <div class="footer-left">
                      <span v-if="props.getAssetModelLabel(props.getCurrentAsset(item.group))" class="model-badge">
                        {{ props.getAssetModelLabel(props.getCurrentAsset(item.group)) }}
                      </span>
                    </div>
                    <div class="footer-right">
                      <template v-if="getVisibleAssetParamsSafe(props.getCurrentAsset(item.group)).length">
                        <span v-for="param in getVisibleAssetParamsSafe(props.getCurrentAsset(item.group))" :key="param.key" class="meta-tag">
                          <span class="meta-tag-label">{{ param.label || param.key }}</span>
                          <span class="meta-tag-value">{{ props.formatParamValue(param.value) }}</span>
                        </span>
                      </template>
                      <button
                        v-if="!props.selectionMode && getHiddenAssetParamCountSafe(props.getCurrentAsset(item.group)) > 0"
                        class="detail-link-btn"
                        type="button"
                        @click.stop="props.onOpenDetail(props.getCurrentAsset(item.group))"
                      >
                        详细信息
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </template>
          </div>
          <div class="virtual-column-spacer" :style="{ height: colWindow.bottomSpacer + 'px' }"></div>
        </div>
      </div>
    </template>

    <div v-if="!props.loading && props.empty" class="empty-hint">
      <span class="empty-hint-text">暂无生成结果</span>
    </div>

    <ReferenceMediaPreviewModal
      v-model:visible="referencePreviewVisible"
      :url="referencePreviewUrl"
      :media-type="referencePreviewIsVideo ? 'video' : 'image'"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ReferenceMediaPreviewModal from '@/components/common/ReferenceMediaPreviewModal.vue'
import HistoryRecord from '@/components/generation/HistoryRecord.vue'
import GeneratingPlaceholderCard from '@/components/generation/GeneratingPlaceholderCard.vue'
import { inferReferenceMediaTypeFromUrl } from '@/composables/useFileDrop'
import { useAssetDragOut, type AssetDragPayload } from '@/composables/assets/useAssetDragOut'
import { useMasonryVirtualWindow } from '@/composables/useMasonryVirtualWindow'
import { Edit3, RefreshCw, Trash2, Copy, Check, Package, Box, Heart } from '@/components/common/icon/lucide'

const referencePreviewVisible = ref(false)
const referencePreviewUrl = ref('')
const referencePreviewIsVideo = ref(false)
const assetDragOut = useAssetDragOut()

function appendReferenceValue(out: string[], value: any) {
  if (!value) return
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) out.push(trimmed)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => appendReferenceValue(out, item))
    return
  }
  if (typeof value === 'object') {
    for (const key of ['origin_url', 'proxy_url', 'url', 'file_url', 'file', 'src', 'path']) {
      const before = out.length
      appendReferenceValue(out, value[key])
      if (out.length > before) return
    }
  }
}

function getCardReferenceUrls(asset: any): string[] {
  const out: string[] = []
  appendReferenceValue(out, asset?.reference_urls)
  appendReferenceValue(out, asset?.referenceUrls)
  appendReferenceValue(out, asset?.param?.file_urls)
  appendReferenceValue(out, asset?.param?.reference_files)
  appendReferenceValue(out, asset?.param?.reference_urls)
  appendReferenceValue(out, asset?.param?.files)
  appendReferenceValue(out, asset?.param?.file_url)
  appendReferenceValue(out, asset?.param?.params?.file_urls)
  appendReferenceValue(out, asset?.param?.params?.reference_files)
  appendReferenceValue(out, asset?.param?.params?.reference_urls)
  appendReferenceValue(out, asset?.param?.params?.files)
  appendReferenceValue(out, asset?.param?.params?.file_url)
  appendReferenceValue(out, asset?.param?.image_first_frame)
  appendReferenceValue(out, asset?.param?.image_last_frame)
  appendReferenceValue(out, asset?.param?.params?.image_first_frame)
  appendReferenceValue(out, asset?.param?.params?.image_last_frame)
  return Array.from(new Set(out))
}

function isReferenceVideoUrl(url: string): boolean {
  return inferReferenceMediaTypeFromUrl(url) === 'video'
}

function isFailedAsset(asset: any): boolean {
  return String(asset?.status || '').toLowerCase() === 'failed'
}

function getFailureReason(asset: any): string {
  return (
    asset?.fail_reason?.error_message
    || asset?.failReason
    || asset?.fail_reason?.message
    || asset?.statusText
    || '未返回失败原因'
  )
}

function onRefThumbDragStart(event: DragEvent, url: string): void {
  if (!event.dataTransfer) return
  const payload = buildReferenceDragPayload(url)
  assetDragOut.startDrag(event, payload)
  event.dataTransfer.setData('application/x-asset-url', url)
  event.dataTransfer.setData('application/x-asset-info', JSON.stringify(payload))
  event.dataTransfer.setData('text/uri-list', url)
  event.dataTransfer.effectAllowed = 'copy'
}

function onRefThumbDragPrepare(url: string): void {
  assetDragOut.prepare(buildReferenceDragPayload(url))
}

function onRefThumbDragEnd(event: DragEvent, url: string): void {
  assetDragOut.endDrag(event, buildReferenceDragPayload(url))
}

function buildReferenceDragPayload(url: string): AssetDragPayload {
  const cleanUrl = String(url || '').trim()
  const isVideo = isReferenceVideoUrl(cleanUrl)
  return {
    id: cleanUrl || 'reference',
    url: cleanUrl,
    thumb: cleanUrl,
    source: 'generation_reference',
    dragOrigin: 'generation-reference',
    type: isVideo ? 'video' : 'image',
    mediaType: isVideo ? 'video' : 'image',
    filename: cleanUrl.split('/').pop() || (isVideo ? 'reference.mp4' : 'reference.png'),
  }
}

/**
 * 外层 .generation-group 上的 dragstart capture 包装。
 * 参考图缩略图自带 dragstart（target 阶段），但 capture 阶段一定先触发，
 * 若不放行会被 useAssetDragOut 当成主图拖出（iframe 壳还会 preventDefault
 * 直接取消整个 drag），导致缩略图拖拽失效。这里识别到缩略图就放行。
 */
function onGroupDragStartCapture(event: DragEvent, asset: any): void {
  if (props.selectionMode) {
    event.preventDefault()
    return
  }
  if ((event.target as HTMLElement | null)?.closest('.inline-ref-thumb')) return
  props.onDragStart?.(event, asset)
}

function onRefThumbClick(event: MouseEvent, url: string): void {
  if ((event.ctrlKey || event.metaKey) && props.onRefAdd) {
    event.preventDefault()
    props.onRefAdd(url)
    return
  }
  event.preventDefault()
  referencePreviewUrl.value = url
  referencePreviewIsVideo.value = isReferenceVideoUrl(url)
  referencePreviewVisible.value = true
}

function onMainMediaClick(event: MouseEvent, asset: any): void {
  if (props.selectionMode) {
    props.onToggleSelect(asset.id)
    return
  }
  if ((event.ctrlKey || event.metaKey) && props.onRefAdd && props.resolveAssetUrl) {
    event.preventDefault()
    const url = props.resolveAssetUrl(asset)
    if (url) props.onRefAdd(url)
    return
  }
  props.onOpenDetail(asset)
}

function onMainMediaContextmenu(event: MouseEvent, asset: any): void {
  if ((event.ctrlKey || event.metaKey) && props.onRefAdd && props.resolveAssetUrl) {
    const url = props.resolveAssetUrl(asset)
    if (url) props.onRefAdd(url)
    return
  }
  props.onContextMenu?.(event, asset)
}

const props = defineProps<{
  dateGroups: Array<{
    dateLabel: string
    count: number
    columns: any[][]
  }>
  showDateGroups: boolean
  highlightedGroupKeys: Set<string>
  copiedPromptAssetId: string | number | null
  loading: boolean
  empty: boolean
  getCurrentAsset: (group: any[]) => any
  getSelectedAssetIndex: (groupId: string | number) => number
  getAssetRatio: (asset: any) => number
  assetToRecord: (asset: any, fullUrl?: string) => any
  getAssetModelLabel: (asset: any) => string
  getVisibleAssetParams?: (asset: any) => any[]
  getHiddenAssetParamCount?: (asset: any) => number
  getAssetEntity?: (asset: any) => { name: string } | null
  formatParamValue: (value: any) => string
  onOpenDetail: (asset: any) => void
  onSweepPointerDown: (id: string) => void
  onSweepSelect: (id: string) => void
  onToggleSelect: (id: string) => void
  onEdit: (asset: any) => void
  onRegenerate: (asset: any) => void
  onDelete: (id: string | number) => void
  onToggleFavorite: (id: string) => void
  onCopyPrompt: (asset: any) => void
  onSelectAssetIndex: (groupId: string | number, index: number) => void
  onMediaLoaded: (dims: { width: number; height: number }, id: string | number) => void
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
  onRefAdd?: (url: string) => void
  resolveAssetUrl?: (asset: any) => string
}>()

const { virtualGroups } = useMasonryVirtualWindow({
  dateGroups: computed(() => props.dateGroups),
  showDateGroups: computed(() => props.showDateGroups),
  scrollTop: computed(() => props.scrollTop),
  viewportHeight: computed(() => props.viewportHeight),
})

function getVisibleAssetParamsSafe(asset: any): any[] {
  return props.getVisibleAssetParams?.(asset) || []
}

function getHiddenAssetParamCountSafe(asset: any): number {
  return props.getHiddenAssetParamCount?.(asset) || 0
}

const currentAssetOf = (group: any[]) => props.getCurrentAsset(group)
</script>

<style scoped>
.generation-results-detailed { padding: 12px 0 24px; }
.generation-group { position: relative; }
.generation-group.is-selected .feed-card { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent); }
.selection-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 6;
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
.masonry-group-header { display:flex; align-items:baseline; gap:8px; padding:6px 4px 4px; font-size:12px; }
.group-title { color:var(--text-primary); font-weight:600; }
.group-count { font-size:11px; color:var(--text-muted); }
.masonry-grid-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 4px; }
.masonry-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.virtual-column-spacer { contain: layout style; flex: 0 0 auto; }
.generation-group { position: relative; border-radius: 12px; }
.feed-card {
  position: relative; display: flex; flex-direction: column;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 10%, var(--bg-surface)) 0%, color-mix(in srgb, var(--bg-elevated) 84%, var(--bg-surface)) 100%);
  border-radius: 12px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12); width: 100%;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.feed-card.uniform-feed { height: 100%; display: flex; flex-direction: column; }
.feed-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 18%, var(--border)); }
.new-result-highlight { box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 18px 40px rgba(15, 23, 42, 0.16); }
.media-container { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.card-content-panel { padding: 8px 12px 6px; background: linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 62%, var(--bg-surface)) 0%, color-mix(in srgb, var(--bg-surface) 100%, transparent) 100%); border-bottom: 1px solid rgba(255,255,255,0.06); }
.uniform-feed .card-content-panel { min-height: 50px; max-height: 50px; overflow: hidden; }
.detail-inline-row { display:flex; align-items:center; gap:6px; min-width:0; overflow-x:auto; padding:0 2px; scrollbar-width:none; }
.detail-inline-row::-webkit-scrollbar { display:none; }
.inline-ref-strip { display:inline-flex; align-items:center; gap:6px; flex-shrink:0; }
.inline-ref-thumb { position:relative; width:34px; height:34px; flex:0 0 auto; border-radius:8px; overflow:hidden; border:1px solid rgba(251,191,36,0.32); background:rgba(251,191,36,0.08); text-decoration:none; }
.inline-ref-thumb-media { width:100%; height:100%; object-fit:cover; display:block; }
.inline-ref-play-mask { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.16); pointer-events:none; }
.inline-ref-play-icon { width:20px; height:20px; border-radius:999px; background:rgba(0,0,0,0.68); box-shadow:0 0 0 1px rgba(255,255,255,0.18); position:relative; }
.inline-ref-play-icon::after { content:''; position:absolute; left:8px; top:5px; border-left:7px solid #fff; border-top:5px solid transparent; border-bottom:5px solid transparent; }
.inline-prompt { min-width:60px; flex:1 1 120px; display:flex; align-items:center; padding:2px 0; cursor:pointer; }
.inline-prompt-text { color:#e2e8f0; font-size:12px; line-height:1.45; min-width:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; white-space:normal; overflow:hidden; text-overflow:ellipsis; }
.inline-prompt-text.is-empty { color: var(--text-muted); font-style: italic; }
.prompt-tooltip-content { max-width: 360px; white-space: pre-wrap; word-break: break-word; line-height: 1.55; font-size: 12px; }
.inline-copy-btn { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; flex-shrink:0; border-radius:999px; border:1px solid rgba(74,222,128,0.2); background:rgba(74,222,128,0.06); color:#6ee7b7; cursor:pointer; }
.main-media-view { width:100%; position:relative; overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 18%, var(--bg-elevated)) 0%, color-mix(in srgb, var(--bg-surface) 18%, var(--bg-elevated)) 100%); }
.uniform-feed .main-media-view { flex: 1 1 auto; min-height: 0; }
.main-media-view .media-item { width:100%; height:100%; object-fit:contain; }
.media-item :deep(.record-wrapper) { border-radius:0; border:none; background:transparent; width:100%; height:100%; }
.media-item :deep(video), .media-item :deep(img) { background: var(--bg-elevated); display:block; margin:0 auto; }
.card-overlay { position:absolute; inset:0; display:flex; justify-content:flex-start; background:linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 82%, transparent) 0%, color-mix(in srgb, var(--bg-base) 28%, transparent) 24%, rgba(10,10,12,0) 46%); opacity:0; transition:opacity 0.2s ease; z-index:10; padding:10px; pointer-events:none; }
.card-overlay.has-favorite { opacity:1; background:none; }
.card-overlay.has-favorite .hover-only-action { opacity:0; pointer-events:none; }
.card-overlay.selection-favorite { pointer-events:none; }
.card-overlay.selection-favorite .icon-action-btn-active { pointer-events:none; }
.feed-card:hover .card-overlay { opacity:1; }
.feed-card:hover .card-overlay.has-favorite { background:linear-gradient(180deg, color-mix(in srgb, var(--bg-base) 82%, transparent) 0%, color-mix(in srgb, var(--bg-base) 28%, transparent) 24%, rgba(10,10,12,0) 46%); }
.feed-card:hover .card-overlay.has-favorite .hover-only-action { opacity:1; pointer-events:auto; }
.overlay-toolbar,.overlay-actions { pointer-events:auto; }
.overlay-toolbar { width:100%; display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.overlay-actions { display:flex; gap:4px; }
.icon-action-btn { background: color-mix(in srgb, var(--bg-surface) 96%, transparent); border:1px solid color-mix(in srgb, var(--border) 94%, transparent); color:var(--text-primary); width:28px; height:28px; border-radius:999px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.icon-action-btn-active { color:#fb7185; border-color:rgba(251,113,133,0.48); }
.card-bottom-panel { padding:10px 14px 14px; background: linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 52%, var(--bg-surface)) 0%, color-mix(in srgb, var(--bg-elevated) 72%, var(--bg-surface)) 100%); border-top:1px solid rgba(255,255,255,0.06); }
.uniform-feed .card-bottom-panel { min-height: 74px; max-height: 74px; overflow: hidden; }
.detail-section-header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.detail-section-title,.detail-section-count { font-size:11px; font-weight:600; color:var(--text-muted); }
.thumbnail-list { display:flex; gap:10px; overflow-x:auto; padding:6px 2px 2px; scrollbar-width:none; }
.thumbnail-list::-webkit-scrollbar { display:none; }
.thumbnail-item { flex-shrink:0; width:44px; height:44px; border-radius:10px; overflow:hidden; cursor:pointer; border:1px solid color-mix(in srgb, var(--border) 62%, transparent); opacity:0.82; background:var(--bg-surface); }
.thumbnail-item.active { border-color: var(--accent); opacity:1; }
.thumbnail-img { width:100%; height:100%; object-fit:cover; }
.card-entity-badge { display:inline-flex; align-items:center; gap:6px; align-self:flex-start; margin:8px 12px 0; padding:4px 8px; border-radius:999px; font-size:11px; color:#93c5fd; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.18); }
.failed-preview-panel { width:100%; height:100%; min-height:180px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:10px; padding:18px; background:linear-gradient(180deg, rgba(60,18,18,0.92) 0%, rgba(35,12,12,0.96) 100%); color:#fecaca; cursor:text; user-select:text; -webkit-user-select:text; }
.failed-preview-label { font-size:11px; line-height:1; color:#fca5a5; letter-spacing:0.08em; text-transform:uppercase; }
.failed-preview-text { font-size:13px; line-height:1.6; color:#ffe4e6; word-break:break-word; white-space:pre-wrap; user-select:text; -webkit-user-select:text; }
.card-meta-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.12); }
.uniform-feed .card-meta-footer { min-height: 34px; max-height: 34px; overflow: hidden; }
.footer-left { display:flex; align-items:center; flex-shrink:0; }
.footer-right { display:flex; align-items:center; gap:5px; overflow-x:auto; scrollbar-width:none; flex-wrap:wrap; justify-content:flex-end; }
.uniform-feed .footer-right { flex-wrap: nowrap; }
.footer-right::-webkit-scrollbar { display:none; }
.model-badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; color:#a78bfa; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.22); white-space:nowrap; }
.meta-tag { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.15); font-size:10px; }
.meta-tag-label { color:#67a8c4; }
.meta-tag-value { color:#94a3b8; font-weight:500; }
.detail-link-btn { display:inline-flex; align-items:center; justify-content:center; padding:3px 8px; border-radius:999px; border:1px solid rgba(251,191,36,0.18); background:rgba(251,191,36,0.06); color:#d4a04a; font-size:10px; white-space:nowrap; cursor:pointer; }
.empty-hint { display:flex; align-items:center; justify-content:center; min-height:220px; color:var(--text-muted); }
.empty-hint-text { font-size:13px; }
</style>
