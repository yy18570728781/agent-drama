<script setup lang="ts">
import type { CardViewBatchActions, CardViewUIState } from './cardView.types'
import GenerationResultsBatchToolbar from './GenerationResultsBatchToolbar.vue'
import GenerationResultsToolbar from './GenerationResultsToolbar.vue'
import { ChevronUp } from '@/components/common/icon/lucide'

const props = defineProps<{
  batchActions: CardViewBatchActions
  onScrollToTop: () => void
  selectedCount: number
  selectionMode: boolean
  showBackToTop: boolean
  uiState: CardViewUIState
}>()

const emit = defineEmits<{
  'open-trash': []
}>()
</script>

<template>
  <div class="results-toolbar-section">
    <div class="toolbar">
      <GenerationResultsToolbar
        :display-mode="props.uiState.displayMode.value"
        :waterfall-enabled="props.uiState.waterfallEnabled.value"
        :display-ratio="props.uiState.displayRatio.value"
        :display-fit-mode="props.uiState.displayFitMode.value"
        :show-failed="props.uiState.showFailed.value"
        :gen-type="props.uiState.filterConditions.value.genType"
        :favorite-only="props.uiState.filterConditions.value.favoriteOnly"
        :show-date-groups="props.uiState.showDateGroups.value"
        @filter-change="props.uiState.onFilterChange"
        @display-mode-change="props.uiState.onDisplayModeChange"
        @waterfall-mode-change="props.uiState.onWaterfallModeChange"
        @display-ratio-change="props.uiState.onDisplayRatioChange"
        @display-fit-mode-change="props.uiState.onDisplayFitModeChange"
        @show-failed-change="props.uiState.onShowFailedChange"
        @refresh="props.uiState.onRefreshAssets"
        @open-trash="emit('open-trash')"
        @batch-action="props.batchActions.enterBatchAction"
      />
      <GenerationResultsBatchToolbar
        v-if="props.selectionMode"
        :action-type="props.batchActions.batchActionType.value"
        :selected-count="props.selectedCount"
        @cancel="props.batchActions.cancelBatchAction"
        @confirm="props.batchActions.confirmBatchAction"
        @confirm-favorite="props.batchActions.confirmBatchFavorite"
      />
    </div>

    <Transition name="fade">
      <button
        v-if="props.showBackToTop"
        class="back-to-top-btn"
        type="button"
        title="回到顶部"
        @click="props.onScrollToTop"
      >
        <ChevronUp :size="18" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.results-toolbar-section {
  display: contents;
}

.toolbar {
  position: relative;
  z-index: 60;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
  min-height: 44px;
  margin: 10px 14px 2px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--cardview-border) 82%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--cardview-surface-panel) 92%, transparent);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 1px 0 color-mix(in srgb, white 5%, transparent) inset;
  backdrop-filter: blur(18px) saturate(125%);
}

.back-to-top-btn {
  position: absolute;
  top: 50%;
  right: 18px;
  z-index: 40;
  width: 44px;
  height: 44px;
  border: 1px solid color-mix(in srgb, var(--cardview-accent) 38%, var(--cardview-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--cardview-accent) 16%, var(--cardview-surface-panel));
  color: var(--cardview-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(10px);
  transform: translateY(-50%);
  transition: transform var(--sys-duration-fast) ease, background var(--sys-duration-fast) ease, border-color var(--sys-duration-fast) ease;
}

.back-to-top-btn:hover {
  background: color-mix(in srgb, var(--cardview-accent) 24%, var(--cardview-surface-elevated));
  border-color: color-mix(in srgb, var(--cardview-accent) 68%, var(--cardview-border));
  transform: translateY(-50%) scale(1.04);
}

.back-to-top-btn:focus-visible {
  outline: 2px solid var(--cardview-accent);
  outline-offset: 3px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .toolbar {
    margin: 8px 10px 2px;
    padding: 5px;
  }
}
</style>
