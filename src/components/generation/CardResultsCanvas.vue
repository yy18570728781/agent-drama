<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue'
import type {
  CardViewActions,
  CardViewAssetStore,
  CardViewAssets,
  CardViewDetail,
  CardViewLayout,
  CardViewSweepSelection,
  CardViewUIState,
} from './cardView.types'
import type { MasonryVirtualDateGroup } from '@/composables/useMasonryVirtualWindow'
import GenerationResultsCompactMasonry from './GenerationResultsCompactMasonry.vue'
import GenerationResultsDetailedMasonry from './GenerationResultsDetailedMasonry.vue'
import GenerationResultsTable from './GenerationResultsTable.vue'
import { getVisibleAssetParams } from './generationResultAdapters'

const props = defineProps<{
  actions: CardViewActions
  assetStore: CardViewAssetStore
  assets: CardViewAssets
  detail: CardViewDetail
  highlightedGroupKeys: Set<string>
  initialLoading: boolean
  inputPanelVisible: boolean
  layout: CardViewLayout
  masonryDateGroups: MasonryVirtualDateGroup[]
  masonryPreparing: boolean
  onRefAdd: (url: string) => Promise<void>
  onResultDragStart: (event: DragEvent, asset: unknown) => void
  sweepSelection: CardViewSweepSelection
  uiState: CardViewUIState
}>()

const emit = defineEmits<{
  'container-change': [element: HTMLElement | null]
}>()

const detailedProps = computed(() => ({
  dateGroups: props.masonryDateGroups,
  showDateGroups: props.uiState.showDateGroups.value,
  highlightedGroupKeys: props.highlightedGroupKeys,
  copiedPromptAssetId: props.actions.copiedPromptAssetId.value,
  loading: props.assetStore.loading,
  empty: props.assets.completedAssets.value.length === 0 && props.assets.activePlaceholderTasks.value.length === 0,
  getCurrentAsset: props.assets.getCurrentAsset,
  getSelectedAssetIndex: props.assets.getSelectedAssetIndex,
  getAssetRatio: props.assets.getAssetRatio,
  assetToRecord: props.assets.assetToRecord,
  getAssetModelLabel: props.assets.getAssetModelLabel,
  getVisibleAssetParams,
  getHiddenAssetParamCount: props.assets.getHiddenAssetParamCount,
  formatParamValue: props.assets.formatParamValue,
  onOpenDetail: props.detail.openAssetDetail,
  onEdit: props.actions.handleEdit,
  onRegenerate: props.actions.handleRegenerate,
  onDelete: props.actions.handleAssetDelete,
  onToggleFavorite: props.assetStore.doToggleFavorite,
  onCopyPrompt: props.actions.copyAssetPrompt,
  onSelectAssetIndex: props.assets.setSelectedAssetIndex,
  onSweepPointerDown: props.sweepSelection.onSweepPointerDown,
  onSweepSelect: props.sweepSelection.onSweepSelect,
  selectionMode: props.assetStore.selectionMode,
  selectedIds: props.assetStore.selectedIds,
  onToggleSelect: props.sweepSelection.onSelectionToggle,
  onMediaLoaded: props.layout.onMediaLoaded,
  onContextMenu: props.actions.onCardContextMenu,
  onDragPrepare: props.actions.onCardDragPrepare,
  onDragStart: props.onResultDragStart,
  onDragEnd: props.actions.onCardDragEnd,
  waterfallEnabled: props.uiState.waterfallEnabled.value,
  displayRatioValue: props.uiState.displayRatioValue.value,
  displayFitMode: props.uiState.displayFitMode.value,
  scrollTop: props.layout.scrollTop.value,
  viewportHeight: props.layout.viewportHeight.value,
  onRepairTask: props.actions.handleRepairTask,
  onRefAdd: props.onRefAdd,
  resolveAssetUrl: props.detail.resolveDragAssetUrl,
}))

const compactProps = computed(() => ({
  dateGroups: props.masonryDateGroups,
  showDateGroups: props.uiState.showDateGroups.value,
  highlightedGroupKeys: props.highlightedGroupKeys,
  loading: props.assetStore.loading,
  empty: props.assets.completedAssets.value.length === 0 && props.assets.activePlaceholderTasks.value.length === 0,
  getCurrentAsset: props.assets.getCurrentAsset,
  getAssetRatio: props.assets.getAssetRatio,
  onSweepPointerDown: props.sweepSelection.onSweepPointerDown,
  onSweepSelect: props.sweepSelection.onSweepSelect,
  selectionMode: props.assetStore.selectionMode,
  selectedIds: props.assetStore.selectedIds,
  onToggleSelect: props.sweepSelection.onSelectionToggle,
  onOpenDetail: props.detail.openAssetDetail,
  onEdit: props.actions.handleEdit,
  onRegenerate: props.actions.handleRegenerate,
  onDelete: props.actions.handleAssetDelete,
  onToggleFavorite: props.assetStore.doToggleFavorite,
  onContextMenu: props.actions.onCardContextMenu,
  onDragPrepare: props.actions.onCardDragPrepare,
  onDragStart: props.onResultDragStart,
  onDragEnd: props.actions.onCardDragEnd,
  waterfallEnabled: props.uiState.waterfallEnabled.value,
  displayRatioValue: props.uiState.displayRatioValue.value,
  displayFitMode: props.uiState.displayFitMode.value,
  scrollTop: props.layout.scrollTop.value,
  viewportHeight: props.layout.viewportHeight.value,
  onRepairTask: props.actions.handleRepairTask,
}))

const tableProps = computed(() => ({
  dateGroups: props.assets.dateGroupedTableRows.value,
  showDateGroups: props.uiState.showDateGroups.value,
  copiedPromptAssetId: props.actions.copiedPromptAssetId.value,
  loading: props.assetStore.loading,
  empty: props.assets.completedAssets.value.length === 0,
  getAssetModelLabel: props.assets.getAssetModelLabel,
  onSweepPointerDown: props.sweepSelection.onSweepPointerDown,
  onSweepSelect: props.sweepSelection.onSweepSelect,
  selectionMode: props.assetStore.selectionMode,
  selectedIds: props.assetStore.selectedIds,
  onToggleSelect: props.sweepSelection.onSelectionToggle,
  onOpenDetail: props.detail.openAssetDetail,
  onEdit: props.actions.handleEdit,
  onRegenerate: props.actions.handleRegenerate,
  onDelete: props.actions.handleAssetDelete,
  onToggleFavorite: props.assetStore.doToggleFavorite,
  onCopyPrompt: props.actions.copyAssetPrompt,
  onContextMenu: props.actions.onCardContextMenu,
  onDragPrepare: props.actions.onCardDragPrepare,
  onDragStart: props.onResultDragStart,
  onDragEnd: props.actions.onCardDragEnd,
}))

function setContainerRef(element: Element | ComponentPublicInstance | null): void {
  emit('container-change', element instanceof HTMLElement ? element : null)
}
</script>

<template>
  <div :ref="setContainerRef" class="result-area card-results-canvas" :class="{ 'input-hidden': !props.inputPanelVisible }">
    <Transition name="fade">
      <div v-if="props.uiState.showScaleHint.value && props.uiState.displayMode.value !== 'table'" class="scale-hint">
        {{ props.uiState.scalePercent.value }}%
      </div>
    </Transition>
    <div v-if="props.assetStore.loadingMore" class="loading-top">
      <div class="loading-spinner" />
      <span>正在刷新...</span>
    </div>

    <div v-if="props.initialLoading || props.masonryPreparing">
      <div class="loading-top">
        <div class="loading-spinner" />
        <span>正在加载中...</span>
      </div>
      <div v-if="props.masonryPreparing" class="masonry-preparing" aria-label="正在准备瀑布流布局">
        <div v-for="index in 12" :key="index" class="masonry-preparing__card" />
      </div>
    </div>
    <GenerationResultsDetailedMasonry
      v-else-if="props.uiState.displayMode.value === 'detailed-card'"
      v-bind="detailedProps"
    />
    <GenerationResultsCompactMasonry
      v-else-if="props.uiState.displayMode.value === 'compact-card'"
      v-bind="compactProps"
    />
    <GenerationResultsTable v-else v-bind="tableProps" />

    <Transition name="fade">
      <div v-if="props.assetStore.loadingMore" class="loading-bottom">
        <div class="loading-spinner" />
        <span>正在加载更多...</span>
      </div>
    </Transition>
    <div
      v-if="!props.assetStore.loading && props.assets.completedAssets.value.length && !props.assetStore.hasMore"
      class="pagination-end"
    >已加载全部</div>
  </div>
</template>

<style scoped>
.result-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 160px;
  -webkit-overflow-scrolling: touch;
  transform: translateZ(0);
  will-change: transform;
  overscroll-behavior: contain;
  background:
    radial-gradient(circle at 50% 14%, color-mix(in srgb, var(--cardview-accent) 7%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--cardview-surface-page) 94%, transparent), var(--cardview-surface-page));
}

.result-area.input-hidden {
  padding-bottom: 48px;
}

.masonry-preparing {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  padding: 12px 0 24px;
}

.masonry-preparing__card {
  aspect-ratio: 1;
  border: 1px solid var(--cardview-border);
  border-radius: 12px;
  background: linear-gradient(110deg, var(--cardview-surface-panel) 30%, var(--cardview-surface-elevated) 45%, var(--cardview-surface-panel) 60%);
  background-size: 220% 100%;
  animation: masonry-preparing-pulse 1.4s ease-in-out infinite;
}

.scale-hint {
  position: fixed;
  top: 60px;
  right: 80px;
  z-index: 100;
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, var(--cardview-accent) 30%, var(--cardview-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--cardview-surface-elevated) 92%, transparent);
  color: var(--cardview-text-primary);
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--cardview-shadow-surface);
  backdrop-filter: blur(8px);
}

.loading-top,
.loading-bottom,
.pagination-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--cardview-text-muted);
  font-size: 12px;
}

.pagination-end {
  padding: 20px 0 8px;
}

.loading-top {
  width: 100%;
  padding: 12px 0;
}

.loading-bottom {
  position: absolute;
  left: 50%;
  bottom: 112px;
  z-index: 40;
  width: max-content;
  min-width: 164px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--cardview-border) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--cardview-surface-panel) 92%, transparent);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
  pointer-events: none;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--cardview-border);
  border-top-color: var(--cardview-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes masonry-preparing-pulse {
  to { background-position-x: -220%; }
}

</style>

<style scoped src="./CardResultsCanvas.theme.css"></style>
