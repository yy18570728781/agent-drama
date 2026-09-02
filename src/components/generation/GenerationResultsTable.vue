<template>
  <div class="generation-results-table">
    <div v-if="!props.loading && props.empty" class="empty-hint">
      <span class="empty-hint-text">暂无生成结果</span>
    </div>

    <div v-else class="results-table-wrap">
      <div class="detail-table-header detail-table-grid">
        <div class="cell col-preview">预览</div>
        <div class="cell">类型</div>
        <div class="cell">提示词</div>
        <div class="cell">参考</div>
        <div class="cell">模型</div>
        <div class="cell">大小</div>
        <div class="cell">时间</div>
        <div class="cell col-actions">操作</div>
      </div>

      <template v-for="dateGroup in props.dateGroups" :key="dateGroup.dateLabel">
        <div v-if="props.showDateGroups" class="table-group-header">
          <span class="group-title">{{ dateGroup.dateLabel }}</span>
          <span class="group-count">{{ dateGroup.count }} 条</span>
        </div>

        <button
          v-for="row in dateGroup.rows"
          :key="row.asset.id"
          type="button"
          class="detail-table-row detail-table-grid"
          :class="{ 'is-selected': props.selectedIds.has(row.asset.id), 'is-selection-mode': props.selectionMode }"
          :draggable="!props.selectionMode"
          @dblclick.stop.prevent="undefined"
          @click="props.selectionMode ? props.onToggleSelect(row.asset.id) : props.onOpenDetail(row.asset)"
          @contextmenu.prevent="props.onContextMenu?.($event, row.asset)"
          @mouseenter="props.selectionMode ? props.onSweepSelect(row.asset.id) : props.onDragPrepare?.(row.asset)"
          @mousedown="props.selectionMode ? props.onSweepPointerDown(row.asset.id) : props.onDragPrepare?.(row.asset)"
          @dragstart.capture="props.selectionMode ? $event.preventDefault() : props.onDragStart?.($event, row.asset)"
          @dragend.capture="!props.selectionMode && props.onDragEnd?.($event, row.asset)"
        >
          <div class="cell col-preview">
            <div class="preview-thumb">
              <div v-if="props.selectionMode && props.selectedIds.has(row.asset.id)" class="selection-badge">✓</div>
              <template v-if="isFailedAsset(row.asset)">
                <div
                  class="failed-preview-inline"
                  :title="getFailureReason(row.asset)"
                  @click.stop
                  @mousedown.stop
                >
                  <div class="failed-preview-inline-text">{{ getFailureReason(row.asset) }}</div>
                </div>
              </template>
              <template v-else-if="row.asset.type === 'video'">
                <span class="preview-video-icon">&#9654;</span>
              </template>
              <template v-else-if="row.asset.type === 'model'">
                <span class="preview-model-icon">3D</span>
              </template>
              <template v-else-if="row.asset.thumbnail_url || row.asset.url">
                <img :src="row.asset.thumbnail_url || row.asset.url" loading="lazy" draggable="false" />
              </template>
              <template v-else>
              <span class="preview-empty">&#128444;</span>
              </template>
            </div>
          </div>
          <div class="cell">
            <span class="type-tag">{{ row.asset.type || '-' }}</span>
          </div>
          <div class="cell cell-prompt" :title="row.asset.prompt || ''">
            <div class="prompt-main">
              <span class="prompt-text">{{ row.asset.prompt || '-' }}</span>
            </div>
            <button v-if="!props.selectionMode" class="prompt-copy-btn" type="button" title="复制提示词" @click.stop="props.onCopyPrompt(row.asset)">
              <component :is="props.copiedPromptAssetId === row.asset.id ? Check : Copy" :size="12" />
            </button>
          </div>
          <div class="cell cell-reference">
            <div class="ref-thumbs">
              <img
                v-for="(url, ri) in getReferenceUrls(row.asset).slice(0, 3)"
                :key="ri"
                :src="url"
                :title="url"
                class="ref-thumb-img"
              />
              <span v-if="getReferenceUrls(row.asset).length > 3" class="ref-thumb-more">
                +{{ getReferenceUrls(row.asset).length - 3 }}
              </span>
            </div>
            <span v-if="!getReferenceUrls(row.asset).length" class="cell-empty">-</span>
          </div>
          <div class="cell cell-model">{{ props.getAssetModelLabel(row.asset) || '-' }}</div>
          <div class="cell">{{ formatFileSize(row.asset.file_size) }}</div>
          <div class="cell cell-time">{{ formatCreatedAt(row.asset.created_at) }}</div>
          <div class="cell col-actions" @click.stop>
            <div class="table-actions">
              <button v-if="!props.selectionMode || row.asset.is_favorites" class="table-action-btn" :class="{ 'table-action-btn-active': row.asset.is_favorites, 'selection-favorite': props.selectionMode }" type="button" :title="row.asset.is_favorites ? '已收藏' : '收藏'" @click="!props.selectionMode && props.onToggleFavorite(row.asset.id)"><Heart :size="13" :fill="row.asset.is_favorites ? 'currentColor' : 'none'" /></button>
              <button v-if="!props.selectionMode" class="table-action-btn" type="button" title="重新编辑" @click="props.onEdit(row.asset)"><Edit3 :size="13" /></button>
              <button v-if="!props.selectionMode" class="table-action-btn" type="button" title="再次生成" @click="props.onRegenerate(row.asset)"><RefreshCw :size="13" /></button>
              <button v-if="!props.selectionMode" class="table-action-btn danger" type="button" title="删除" @click="props.onDelete(row.asset.id)"><Trash2 :size="13" /></button>
            </div>
          </div>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit3, RefreshCw, Trash2, Copy, Check, Heart } from '@/components/common/icon/lucide'
import { getReferenceUrls } from '@/components/generation/generationResultAdapters'

const props = defineProps<{
  dateGroups: Array<{
    dateLabel: string
    count: number
    rows: Array<{ asset: any; batchLabel: string }>
  }>
  showDateGroups: boolean
  copiedPromptAssetId: string | number | null
  loading: boolean
  empty: boolean
  getAssetModelLabel: (asset: any) => string
  onSweepPointerDown: (id: string) => void
  onSweepSelect: (id: string) => void
  onToggleSelect: (id: string) => void
  onOpenDetail: (asset: any) => void
  onEdit: (asset: any) => void
  onRegenerate: (asset: any) => void
  onDelete: (id: string | number) => void
  onToggleFavorite: (id: string) => void
  onCopyPrompt: (asset: any) => void
  onContextMenu?: (event: MouseEvent, asset: any) => void
  onDragPrepare?: (asset: any) => void
  onDragStart?: (event: DragEvent, asset: any) => void
  onDragEnd?: (event: DragEvent, asset: any) => void
  selectionMode: boolean
  selectedIds: Set<string>
}>()

const formatCreatedAt = (value: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value || '-'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

const formatFileSize = (size: number | null | undefined): string => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const isFailedAsset = (asset: any) => String(asset?.status || '').toLowerCase() === 'failed'
const getFailureReason = (asset: any) =>
  asset?.fail_reason?.error_message
  || asset?.failReason
  || asset?.fail_reason?.message
  || asset?.statusText
  || '未返回失败原因'
</script>

<style scoped>
.generation-results-table { padding: 12px 0 24px; }
.results-table-wrap {
  display: flex; flex-direction: column;
  border: 1px solid var(--border); border-radius: 8px;
  overflow-x: auto; background: var(--bg-surface);
}
.detail-table-grid {
  min-width: 1000px;
  display: grid;
  grid-template-columns: auto auto 1fr auto auto auto auto auto;
  align-items: center;
}
.detail-table-header {
  position: sticky; top: 0; z-index: 3;
  height: 42px; background: #17171a;
  border-bottom: 1px solid var(--border);
}
.detail-table-header .cell {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
}
.table-group-header {
  display: flex; align-items: baseline; gap: 8px;
  padding: 10px 12px 4px; font-size: 12px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.table-group-header:first-child { border-top: none; }
.group-title { color: var(--text-primary); font-weight: 600; }
.group-count { font-size: 11px; color: var(--text-muted); }
.detail-table-row {
  width: 100%; border: none; text-align: left; padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer;
  transition: background 0.15s; background: transparent;
}
.detail-table-row.is-selected { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.detail-table-row:hover { background: rgba(255,255,255,0.03); }
.cell {
  padding: 0 12px; font-size: 12px; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.col-preview { display: flex; align-items: center; }
.col-actions { display: flex; align-items: center; }
.preview-thumb {
  position: relative;
  width: 92px; height: 52px; border-radius: 6px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: #232327; border: 1px solid rgba(255,255,255,0.06);
}
.selection-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}
.preview-thumb img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
.failed-preview-inline { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap:4px; padding:6px; background:linear-gradient(180deg, rgba(60,18,18,0.92) 0%, rgba(35,12,12,0.96) 100%); cursor:text; user-select:text; -webkit-user-select:text; }
.failed-preview-inline-text { font-size:10px; line-height:1.35; color:#ffe4e6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; user-select:text; -webkit-user-select:text; }
.preview-video-icon, .preview-empty, .preview-model-icon { color: #a1a1aa; font-size: 13px; }
.preview-model-icon { font-weight: 700; letter-spacing: 0.08em; }
.type-tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px;
  border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
  color: var(--text-secondary); font-size: 11px;
}
.cell-prompt, .cell-model { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-prompt { display: flex; align-items: center; gap: 6px; }
.prompt-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.prompt-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.prompt-copy-btn {
  flex-shrink: 0; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); background: transparent;
  color: var(--text-muted); cursor: pointer; opacity: 0; transition: opacity 0.15s;
}
.detail-table-row:hover .prompt-copy-btn { opacity: 1; }
.prompt-copy-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
.cell-reference { display: flex; align-items: center; }
.ref-thumbs { display: flex; align-items: center; gap: 3px; }
.ref-thumb-img { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,0.08); background: #232327; flex-shrink: 0; }
.ref-thumb-more { font-size: 11px; color: var(--text-secondary); padding: 0 4px; }
.cell-empty { color: var(--text-secondary); }
.cell-time { color: var(--text-secondary); }
.table-actions { display: flex; align-items: center; gap: 6px; }
.table-action-btn {
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  color: #d4d4d8; cursor: pointer; font-size: 13px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.table-action-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.table-action-btn-active { color:#fb7185; border-color:rgba(251,113,133,0.48); }
.table-action-btn.selection-favorite { pointer-events:none; }
.table-action-btn.danger:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); color: #fda4af; }
.empty-hint { display:flex; align-items:center; justify-content:center; min-height:220px; color:var(--text-muted); }
.empty-hint-text { font-size:13px; }
</style>
