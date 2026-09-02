import type { Ref } from 'vue'
import type CardGeneratorInput from '@/components/flow/CardGeneratorInput.vue'
import type { useCardViewActions } from '@/composables/generation/useCardViewActions'
import type { useCardViewAssets } from '@/composables/generation/useCardViewAssets'
import type { useCardViewBatchActions } from '@/composables/generation/useCardViewBatchActions'
import type { useCardViewDetail } from '@/composables/generation/useCardViewDetail'
import type { useCardViewGeneration } from '@/composables/generation/useCardViewGeneration'
import type { useCardViewLayout } from '@/composables/generation/useCardViewLayout'
import type { useCardViewSweepSelection } from '@/composables/generation/useCardViewSweepSelection'
import type { useCardViewUIState } from '@/composables/generation/useCardViewUIState'
import type { useSingleFileBatchMode } from '@/composables/generation/useSingleFileBatchMode'
import type { useAssetStore } from '@/stores/assets.store'

export type CardGeneratorInputInstance = InstanceType<typeof CardGeneratorInput>
export type CardViewActions = ReturnType<typeof useCardViewActions>
export type CardViewAssets = ReturnType<typeof useCardViewAssets>
export type CardViewBatchActions = ReturnType<typeof useCardViewBatchActions>
export type CardViewDetail = ReturnType<typeof useCardViewDetail>
export type CardViewGeneration = ReturnType<typeof useCardViewGeneration>
export type CardViewLayout = ReturnType<typeof useCardViewLayout>
export type CardViewSweepSelection = ReturnType<typeof useCardViewSweepSelection>
export type CardViewUIState = ReturnType<typeof useCardViewUIState>
export type CardViewSingleFileBatch = ReturnType<typeof useSingleFileBatchMode>
export type CardViewAssetStore = ReturnType<typeof useAssetStore>

export interface CardViewLifecycleDeps {
  actions: CardViewActions
  assetStore: CardViewAssetStore
  assets: CardViewAssets
  inputRef: Ref<CardGeneratorInputInstance | null>
  layout: CardViewLayout
  resultColRef: Ref<HTMLElement | null>
  uiState: CardViewUIState
}
