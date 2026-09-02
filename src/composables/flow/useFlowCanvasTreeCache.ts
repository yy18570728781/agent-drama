import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'

interface FlowCanvasTreeCacheOptions {
  canvases: ComputedRef<FlowLibraryCanvas[]>
  errorMessage: Ref<string>
  isLoading: Ref<boolean>
  searchKeyword: Ref<string>
  selectedCategoryId: Ref<string>
}

interface UseFlowCanvasTreeCacheReturn {
  canvasesByCategory: Ref<Record<string, FlowLibraryCanvas[]>>
  loadedCategoryIds: Ref<Set<string>>
  loadingCategoryId: ComputedRef<string>
  reset: () => void
  upsertCanvas: (canvas: FlowLibraryCanvas) => void
}

/**
 * 缓存已访问目录的画布，使右侧列表数据可同步复用于左侧树。
 * @param options 当前目录的列表状态与请求状态。
 * @returns 按目录分组的画布缓存、加载标识及重置动作。
 */
export function useFlowCanvasTreeCache(
  options: FlowCanvasTreeCacheOptions,
): UseFlowCanvasTreeCacheReturn {
  const canvasesByCategory = ref<Record<string, FlowLibraryCanvas[]>>({})
  const loadedCategoryIds = ref(new Set<string>())
  const loadingCategoryId = computed(() =>
    options.isLoading.value ? options.selectedCategoryId.value : '',
  )

  function reset(): void {
    canvasesByCategory.value = {}
    loadedCategoryIds.value = new Set<string>()
  }

  function upsertCanvas(canvas: FlowLibraryCanvas): void {
    const categoryId = canvas.categoryId
    const current = canvasesByCategory.value[categoryId] || []
    canvasesByCategory.value = {
      ...canvasesByCategory.value,
      [categoryId]: [canvas, ...current.filter((item) => item.id !== canvas.id)],
    }
    loadedCategoryIds.value = new Set([...loadedCategoryIds.value, categoryId])
  }

  watch(
    [
      options.selectedCategoryId,
      options.canvases,
      options.isLoading,
      options.errorMessage,
      options.searchKeyword,
    ],
    ([categoryId, canvases, isLoading, errorMessage, searchKeyword]) => {
      if (!categoryId || isLoading || errorMessage || String(searchKeyword).trim()) return
      canvasesByCategory.value = {
        ...canvasesByCategory.value,
        [String(categoryId)]: [...canvases],
      }
      loadedCategoryIds.value = new Set([...loadedCategoryIds.value, String(categoryId)])
    },
    { flush: 'post' },
  )

  return { canvasesByCategory, loadedCategoryIds, loadingCategoryId, reset, upsertCanvas }
}
