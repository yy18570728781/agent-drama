import { ref } from 'vue'
import type { useAssetStore } from '@/stores/assets.store'
import { useAssetDeleteConfirm } from '@/composables/assets/useAssetDeleteConfirm'

type BatchActionType = 'favorite' | 'delete'

/**
 * 结果页批量操作编排，避免页面组件继续膨胀。
 * @param assetStore 资产列表 store
 * @returns 批量操作相关状态与动作
 */
export function useCardViewBatchActions(assetStore: ReturnType<typeof useAssetStore>): {
  batchActionType: typeof batchActionType
  enterBatchAction: (action: BatchActionType) => void
  cancelBatchAction: () => void
  confirmBatchAction: () => Promise<void>
  confirmBatchFavorite: (favorite: boolean) => Promise<void>
} {
  const batchActionType = ref<BatchActionType>('favorite')
  const { confirmDeleteMany } = useAssetDeleteConfirm()

  const enterBatchAction = (action: BatchActionType) => {
    batchActionType.value = action
    assetStore.startSelectionMode()
  }

  const cancelBatchAction = () => {
    assetStore.stopSelectionMode()
  }

  const confirmBatchAction = async () => {
    const ids = [...assetStore.selectedIds]
    if (!ids.length) return
    if (batchActionType.value === 'delete') {
      await confirmDeleteMany(ids.length)
      await assetStore.doDeleteBatch(ids)
      return
    }
    await assetStore.doToggleFavoriteBatch(ids)
  }

  const confirmBatchFavorite = async (favorite: boolean) => {
    const ids = [...assetStore.selectedIds]
    if (!ids.length) return
    await assetStore.doToggleFavoriteBatch(ids, favorite)
  }

  return {
    batchActionType,
    enterBatchAction,
    cancelBatchAction,
    confirmBatchAction,
    confirmBatchFavorite,
  }
}
