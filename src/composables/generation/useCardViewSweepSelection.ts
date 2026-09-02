import { onUnmounted, ref } from 'vue'
import type { useAssetStore } from '@/stores/assets.store'

/**
 * 批量模式下支持按住鼠标滑过自动补选，避免大量结果逐个点选。
 * @param assetStore 资产列表 store
 * @returns 滑选相关事件处理
 */
export function useCardViewSweepSelection(assetStore: ReturnType<typeof useAssetStore>): {
  onSelectionToggle: (id: string) => void
  onSweepPointerDown: (id: string) => void
  onSweepSelect: (id: string) => void
} {
  const sweeping = ref(false)
  const pendingDeselectId = ref('')
  const suppressedClickId = ref('')

  const selectIfMissing = (id: string) => {
    if (assetStore.selectedIds.has(id)) return
    assetStore.selectedIds = new Set([...assetStore.selectedIds, id])
  }

  const stopSweep = () => {
    sweeping.value = false
  }

  const onSelectionToggle = (id: string) => {
    if (suppressedClickId.value === id) {
      suppressedClickId.value = ''
      return
    }
    if (pendingDeselectId.value === id) {
      pendingDeselectId.value = ''
      assetStore.toggleSelect(id)
      return
    }
    assetStore.toggleSelect(id)
  }

  const onSweepPointerDown = (id: string) => {
    if (!assetStore.selectionMode) return
    sweeping.value = true
    if (assetStore.selectedIds.has(id)) {
      pendingDeselectId.value = id
      suppressedClickId.value = ''
      return
    }
    pendingDeselectId.value = ''
    suppressedClickId.value = id
    selectIfMissing(id)
  }

  const onSweepSelect = (id: string) => {
    if (!assetStore.selectionMode || !sweeping.value) return
    pendingDeselectId.value = ''
    suppressedClickId.value = id
    selectIfMissing(id)
  }

  window.addEventListener('mouseup', stopSweep)
  onUnmounted(() => {
    window.removeEventListener('mouseup', stopSweep)
  })

  return {
    onSelectionToggle,
    onSweepPointerDown,
    onSweepSelect,
  }
}
