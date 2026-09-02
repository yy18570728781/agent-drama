<script setup lang="ts">
import { computed, ref } from 'vue'
import CardGeneratorSection from '@/components/generation/CardGeneratorSection.vue'
import CardResultsCanvas from '@/components/generation/CardResultsCanvas.vue'
import CardResultsToolbarSection from '@/components/generation/CardResultsToolbarSection.vue'
import GenerationTrashDialog from '@/components/generation/GenerationTrashDialog.vue'
import MediaPreviewModal from '@/components/common/ImagePreviewModal.vue'
import type { CardGeneratorInputInstance } from '@/components/generation/cardView.types'
import { useCardViewActions } from '@/composables/generation/useCardViewActions'
import { useCardViewAssets } from '@/composables/generation/useCardViewAssets'
import { useCardViewBatchActions } from '@/composables/generation/useCardViewBatchActions'
import { useCardViewDetail } from '@/composables/generation/useCardViewDetail'
import { useCardViewGeneration } from '@/composables/generation/useCardViewGeneration'
import { useCardViewLayout } from '@/composables/generation/useCardViewLayout'
import { useCardViewLifecycle } from '@/composables/generation/useCardViewLifecycle'
import { useCardViewMasonryPreparation } from '@/composables/generation/useCardViewMasonryPreparation'
import { useCardViewResultHighlights } from '@/composables/generation/useCardViewResultHighlights'
import { useCardViewSweepSelection } from '@/composables/generation/useCardViewSweepSelection'
import { useCardViewUIState } from '@/composables/generation/useCardViewUIState'
import { useSingleFileBatchMode } from '@/composables/generation/useSingleFileBatchMode'
import { useAssetStore } from '@/stores/assets.store'

defineOptions({ name: 'CardView' })

const assetStore = useAssetStore()
const resultColRef = ref<HTMLElement | null>(null)
const inputRef = ref<CardGeneratorInputInstance | null>(null)
const trashDialogVisible = ref(false)
const inputPanelVisible = ref(true)
const uiState = useCardViewUIState({})
const layout = useCardViewLayout()
const assets = useCardViewAssets({
  filterConditions: uiState.filterConditions,
  displayMode: uiState.displayMode,
  waterfallEnabled: uiState.waterfallEnabled,
  displayRatioValue: uiState.displayRatioValue,
  showDateGroups: uiState.showDateGroups,
  aspectRatioCache: layout.aspectRatioCache,
  containerInnerWidth: layout.containerInnerWidth,
  showFailed: uiState.showFailed,
  colWidth: uiState.colWidth,
})
const masonryPreparation = useCardViewMasonryPreparation({
  assets: assets.completedAssets,
  aspectRatioCache: layout.aspectRatioCache,
  dateGroups: assets.dateGroupedRender,
  enabled: computed(() => (
    uiState.waterfallEnabled.value && uiState.displayMode.value !== 'table'
  )),
  getFallbackRatio: assets.getAssetRatio,
})
const detail = useCardViewDetail({
  completedAssets: assets.completedAssets,
  getAssetModelLabel: assets.getAssetModelLabel,
})
const actions = useCardViewActions({
  inputRef,
  resolveAssetUrl: detail.resolveAssetUrl,
  resolveDragAssetUrl: detail.resolveDragAssetUrl,
})
const batchActions = useCardViewBatchActions(assetStore)
const sweepSelection = useCardViewSweepSelection(assetStore)
const generation = useCardViewGeneration({
  inputRef,
  containerRef: layout.containerRef,
})
const singleFileBatch = useSingleFileBatchMode({
  inputRef,
  onGenerateStart: generation.onGenerateStart,
  onGenerateCreated: generation.onGenerateCreated,
  onGenerateProgress: generation.onGenerateProgress,
  onGenerateComplete: generation.onGenerateComplete,
  onGenerateError: generation.onGenerateError,
})
const showBackToTop = computed(() => layout.scrollTop.value > 120)
const { highlightedGroupKeys } = useCardViewResultHighlights({
  groupedAssets: assets.groupedAssets,
  containerRef: layout.containerRef,
  scheduleLayoutUpdate: layout.scheduleLayoutUpdate,
  isLoadingOlder: layout.isLoadingOlder,
  setSelectedAssetIndex: assets.setSelectedAssetIndex,
})

async function handleCardExternalSendOverride(): Promise<boolean> {
  if (!singleFileBatch.enabled.value || !singleFileBatch.canUse.value || singleFileBatch.isSubmitting.value) return false
  await singleFileBatch.send()
  return true
}

async function handleRefAddToReference(url: string): Promise<void> {
  const inner = inputRef.value?.getInner?.()
  if (!inner) return
  await inner.addReferenceMedia([{ url, uploaded: true }])
}

function scrollToTop(): void {
  layout.containerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleResultDragStart(event: DragEvent, asset: unknown): void {
  actions.onCardInternalDragStart(event, asset)
  actions.onCardDragStart(event, asset)
}

function handleDetailReEdit(_image: string, _index: number): void {
  detail.detailVisible.value = false
  actions.handleEdit(detail.detailRecord.value)
}

function handleDetailRegenerate(_image: string, _index: number): void {
  detail.detailVisible.value = false
  actions.handleRegenerate(detail.detailRecord.value)
}

function handleInputChange(instance: CardGeneratorInputInstance | null): void {
  inputRef.value = instance
}

function handleContainerChange(element: HTMLElement | null): void {
  layout.setContainer(element)
}

const lifecycle = useCardViewLifecycle({
  actions,
  assetStore,
  assets,
  inputRef,
  layout,
  resultColRef,
  uiState,
})
</script>

<template>
  <div class="gen-view">
    <div class="main-layout">
      <div ref="resultColRef" class="result-col">
        <CardResultsToolbarSection
          :ui-state="uiState"
          :batch-actions="batchActions"
          :selection-mode="assetStore.selectionMode"
          :selected-count="assetStore.selectedCount"
          :show-back-to-top="showBackToTop"
          :on-scroll-to-top="scrollToTop"
          @open-trash="trashDialogVisible = true"
        />
        <CardResultsCanvas
          :ui-state="uiState"
          :assets="assets"
          :actions="actions"
          :detail="detail"
          :sweep-selection="sweepSelection"
          :layout="layout"
          :initial-loading="lifecycle.initialLoading.value"
          :masonry-date-groups="masonryPreparation.dateGroups.value"
          :masonry-preparing="masonryPreparation.isInitialPreparing.value"
          :asset-store="assetStore"
          :highlighted-group-keys="highlightedGroupKeys"
          :input-panel-visible="inputPanelVisible"
          :on-result-drag-start="handleResultDragStart"
          :on-ref-add="handleRefAddToReference"
          @container-change="handleContainerChange"
        />
        <CardGeneratorSection
          v-model:visible="inputPanelVisible"
          :generation="generation"
          :single-file-batch="singleFileBatch"
          :selection-mode="assetStore.selectionMode"
          :scroll-el="layout.containerRef.value"
          :external-send-override="handleCardExternalSendOverride"
          @input-change="handleInputChange"
        />
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="actions.cardContextMenu.value.visible"
        class="card-context-menu"
        :style="{ left: actions.cardContextMenu.value.x + 'px', top: actions.cardContextMenu.value.y + 'px' }"
      >
        <button class="card-context-menu-item" @click.stop="actions.downloadCardImage">另存为</button>
      </div>
    </Teleport>

    <MediaPreviewModal
      v-model:visible="detail.detailVisible.value"
      :images="detail.detailImages.value"
      :initial-index="detail.detailInitialIndex.value"
      :image-info="detail.detailImageInfo.value"
      :is-video="detail.detailIsVideo.value"
      :is-model="detail.isDetailModel.value"
      :model-url="detail.modelViewerUrl.value"
      :record-id="detail.detailRecordId.value"
      :full-mode="true"
      :show-inspector="true"
      :show-actions="true"
      :show-ai-tools="true"
      :show-workflow-actions="false"
      :show-favorite="true"
      :show-share="false"
      :show-delete="true"
      :is-favorited="detail.detailIsFavorited.value"
      @close="detail.handleDetailClose"
      @re-edit="handleDetailReEdit"
      @regenerate="handleDetailRegenerate"
      @delete="detail.handleDetailDelete"
      @favorite="detail.handleDetailFavorite"
      @select-history="detail.handleSelectHistoryFromPreview"
    />
    <GenerationTrashDialog v-model:visible="trashDialogVisible" />
  </div>
</template>

<style scoped src="./CardView.css"></style>
