import type { ComputedRef, Ref } from 'vue'
import type { Router } from 'vue-router'
import type {
  DiscoverCase,
  DiscoverCaseDetail,
  DiscoverCategoryAccess,
} from '@/components/discover/discover.types'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  useDiscoverCaseCopy,
  type UseDiscoverCaseCopyReturn,
} from '@/composables/discover/useDiscoverCaseCopy'
import {
  useDiscoverCaseManagement,
  type UseDiscoverCaseManagementReturn,
} from '@/composables/discover/useDiscoverCaseManagement'
import {
  loadDiscoverCaseDetail,
  updateDiscoverCaseRecommendation,
} from '@/services/discover/discoverCaseDetail.service'

interface UseDiscoverCaseDetailOptions {
  canReleaseCase: Ref<boolean>
  categoryAccessById: Ref<ReadonlyMap<string, DiscoverCategoryAccess>>
  item: Ref<DiscoverCase | null>
  onCaseChanged: (item: DiscoverCase) => void
  onCreated: () => void
  onDeleted: (caseId: string) => void
  onRecommendationChanged: (caseId: string, recommended: boolean) => void
}

interface UseDiscoverCaseDetailReturn extends UseDiscoverCaseCopyReturn, UseDiscoverCaseManagementReturn {
  canManageRecommendation: ComputedRef<boolean>
  detail: Ref<DiscoverCaseDetail | null>
  detailError: Ref<string>
  detailLoading: Ref<boolean>
  openPreview: () => void
  recommendationError: Ref<string>
  recommendationPending: Ref<boolean>
  toggleRecommendation: () => Promise<void>
}

function openDiscoverCasePreview(router: Router, detail: DiscoverCaseDetail | null): void {
  if (!detail) return
  const resolved = router.resolve({
    name: 'discover-case-preview',
    params: { caseId: detail.id },
  })
  window.open(new URL(resolved.href, window.location.href).href, '_blank', 'noopener,noreferrer')
}

/**
 * 管理案例详情、独立只读预览、推荐设置和复制到 type 11 生产画布的交互状态。
 * @param options 当前案例、分类权限索引和状态同步回调。
 * @returns 案例详情弹窗所需的响应式状态与动作。
 */
export function useDiscoverCaseDetail(
  options: UseDiscoverCaseDetailOptions,
): UseDiscoverCaseDetailReturn {
  const router = useRouter()
  const detail = ref<DiscoverCaseDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref('')
  const recommendationPending = ref(false)
  const recommendationError = ref('')
  const management = useDiscoverCaseManagement({
    canReleaseCase: options.canReleaseCase,
    detail,
    onCaseChanged: options.onCaseChanged,
    onDeleted: options.onDeleted,
  })
  const canManageRecommendation = computed(() => options.canReleaseCase.value)
  const copySource = computed(() => detail.value
    ? { id: detail.value.id }
    : null)
  const {
    canMakeSame,
    categoryLoading,
    categoryOptions,
    createDialogVisible,
    makeSame,
    makeSameError,
    makingSame,
    openMakeSameDialog,
  } = useDiscoverCaseCopy({ source: copySource, onCreated: options.onCreated })

  function resetDetailState(): void {
    detail.value = null
    detailError.value = ''
    recommendationError.value = ''
  }

  async function loadDetail(item: DiscoverCase): Promise<void> {
    detailLoading.value = true
    try {
      detail.value = await loadDiscoverCaseDetail(item, options.categoryAccessById.value)
    } catch (error) {
      detailError.value = error instanceof Error ? error.message : '案例详情加载失败'
    } finally {
      detailLoading.value = false
    }
  }

  const openPreview = (): void => openDiscoverCasePreview(router, detail.value)

  async function toggleRecommendation(): Promise<void> {
    const current = detail.value
    if (!current || !canManageRecommendation.value || recommendationPending.value) return
    recommendationPending.value = true
    recommendationError.value = ''
    try {
      const recommended = await updateDiscoverCaseRecommendation(current, !current.featured)
      detail.value = { ...current, featured: recommended }
      options.onRecommendationChanged(current.id, recommended)
    } catch (error) {
      recommendationError.value = error instanceof Error ? error.message : '推荐状态更新失败'
    } finally {
      recommendationPending.value = false
    }
  }

  watch(options.item, (item) => {
    resetDetailState()
    if (item) void loadDetail(item)
  }, { immediate: true })

  return {
    ...management,
    canMakeSame,
    canManageRecommendation,
    categoryLoading,
    categoryOptions,
    createDialogVisible,
    detail,
    detailError,
    detailLoading,
    makeSame,
    makeSameError,
    makingSame,
    openMakeSameDialog,
    openPreview,
    recommendationError,
    recommendationPending,
    toggleRecommendation,
  }
}
