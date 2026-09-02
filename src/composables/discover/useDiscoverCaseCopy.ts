import type { ComputedRef, Ref } from 'vue'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import type { ProductionCanvasCategoryOption } from '@/services/discover/discoverCaseDetail.service'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  createProductionCanvasFromCase,
  listProductionCanvasCategoryOptions,
} from '@/services/discover/discoverCaseDetail.service'

export interface DiscoverCaseCopySource {
  id: string
}

interface UseDiscoverCaseCopyOptions {
  onCreated?: () => void
  source: Ref<DiscoverCaseCopySource | null>
}

export interface UseDiscoverCaseCopyReturn {
  canMakeSame: ComputedRef<boolean>
  categoryLoading: Ref<boolean>
  categoryOptions: Ref<ProductionCanvasCategoryOption[]>
  createDialogVisible: Ref<boolean>
  makeSame: (draft: FlowCanvasCreateDraft) => Promise<void>
  makeSameError: Ref<string>
  makingSame: Ref<boolean>
  openMakeSameDialog: () => Promise<void>
}

/**
 * 管理案例复制为生产画布时的目录选择、创建状态与页面跳转。
 * @param options 当前案例复制源和可选的创建成功回调。
 * @returns 制作同款按钮与创建弹窗所需的响应式状态和动作。
 */
export function useDiscoverCaseCopy(
  options: UseDiscoverCaseCopyOptions,
): UseDiscoverCaseCopyReturn {
  const router = useRouter()
  const categoryLoading = ref(false)
  const categoryOptions = ref<ProductionCanvasCategoryOption[]>([])
  const createDialogVisible = ref(false)
  const makingSame = ref(false)
  const makeSameError = ref('')
  const canMakeSame = computed(() => Boolean(options.source.value?.id))

  async function openMakeSameDialog(): Promise<void> {
    if (!canMakeSame.value || categoryLoading.value) return
    makeSameError.value = ''
    categoryLoading.value = true
    try {
      if (!categoryOptions.value.length) {
        categoryOptions.value = await listProductionCanvasCategoryOptions()
      }
      if (!categoryOptions.value.some((item) => !item.disabled)) {
        throw new Error('没有可编辑的生产画布目录')
      }
      createDialogVisible.value = true
    } catch (error) {
      makeSameError.value = error instanceof Error ? error.message : '生产画布目录加载失败'
    } finally {
      categoryLoading.value = false
    }
  }

  async function makeSame(draft: FlowCanvasCreateDraft): Promise<void> {
    const source = options.source.value
    if (!source || !canMakeSame.value || makingSame.value || !draft.categoryId) return
    makingSame.value = true
    makeSameError.value = ''
    try {
      const created = await createProductionCanvasFromCase({
        caseId: source.id,
        categoryId: draft.categoryId,
        name: draft.name,
      })
      createDialogVisible.value = false
      options.onCreated?.()
      await router.push({
        name: 'flow',
        query: { categoryId: draft.categoryId, workflowId: created.id },
      })
    } catch (error) {
      makeSameError.value = error instanceof Error ? error.message : '制作同款失败'
    } finally {
      makingSame.value = false
    }
  }

  watch(options.source, () => {
    createDialogVisible.value = false
    makeSameError.value = ''
  })

  return {
    canMakeSame,
    categoryLoading,
    categoryOptions,
    createDialogVisible,
    makeSame,
    makeSameError,
    makingSame,
    openMakeSameDialog,
  }
}
