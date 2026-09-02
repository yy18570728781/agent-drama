import type { Ref } from 'vue'
import type { WorkflowDefinition } from '@/composables/flow/flowCore.types'
import { onMounted, ref } from 'vue'
import {
  useDiscoverCaseCopy,
  type DiscoverCaseCopySource,
  type UseDiscoverCaseCopyReturn,
} from '@/composables/discover/useDiscoverCaseCopy'
import { loadDiscoverCasePreview } from '@/services/discover/discoverCaseDetail.service'

interface UseDiscoverCasePreviewReturn extends UseDiscoverCaseCopyReturn {
  definition: Ref<WorkflowDefinition | null>
  errorMessage: Ref<string>
  loading: Ref<boolean>
  title: Ref<string>
}

/**
 * 加载独立案例预览，并组合当前用户可用的制作同款流程。
 * @param caseId 路由中的案例资产 ID。
 * @returns 只读画布、加载状态及制作同款交互状态。
 */
export function useDiscoverCasePreview(caseId: string): UseDiscoverCasePreviewReturn {
  const definition = ref<WorkflowDefinition | null>(null)
  const errorMessage = ref('')
  const loading = ref(true)
  const title = ref('画布案例')
  const copySource = ref<DiscoverCaseCopySource | null>(null)
  const {
    canMakeSame,
    categoryLoading,
    categoryOptions,
    createDialogVisible,
    makeSame,
    makeSameError,
    makingSame,
    openMakeSameDialog,
  } = useDiscoverCaseCopy({ source: copySource })

  async function loadPreview(): Promise<void> {
    if (!caseId) {
      errorMessage.value = '缺少案例 ID'
      loading.value = false
      return
    }
    try {
      const preview = await loadDiscoverCasePreview(caseId)
      definition.value = preview.definition
      title.value = preview.title
      copySource.value = { id: caseId }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '画布预览加载失败'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => { void loadPreview() })

  return {
    canMakeSame,
    categoryLoading,
    categoryOptions,
    createDialogVisible,
    definition,
    errorMessage,
    loading,
    makeSame,
    makeSameError,
    makingSame,
    openMakeSameDialog,
    title,
  }
}
