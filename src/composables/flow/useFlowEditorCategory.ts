import type { MaybeRefOrGetter, Ref } from 'vue'
import { ref, toValue, watch } from 'vue'
import { resolveFlowAssetCategoryId } from '@/services/flow/flowAssetCategory.service'

interface UseFlowEditorCategoryReturn {
  categoryId: Ref<string>
}

/**
 * 根据当前画布资产同步所属分类，不加载已不展示的分类路径。
 * @param activeWorkflowId 当前激活画布资产 ID。
 * @returns 当前画布所属分类 ID。
 */
export function useFlowEditorCategory(
  activeWorkflowId: MaybeRefOrGetter<string | null | undefined>,
): UseFlowEditorCategoryReturn {
  const categoryId = ref('')
  const cache = new Map<string, string>()
  let latestRequestId = 0

  watch(
    () => String(toValue(activeWorkflowId) || '').trim(),
    async (workflowId) => {
      const requestId = ++latestRequestId
      categoryId.value = ''
      if (!workflowId) return
      const cachedCategoryId = cache.get(workflowId)
      if (cachedCategoryId !== undefined) {
        categoryId.value = cachedCategoryId
        return
      }
      try {
        const nextCategoryId = await resolveFlowAssetCategoryId(workflowId)
        if (requestId !== latestRequestId) return
        cache.set(workflowId, nextCategoryId)
        categoryId.value = nextCategoryId
      } catch {
        if (requestId === latestRequestId) categoryId.value = ''
      }
    },
    { immediate: true },
  )

  return { categoryId }
}
