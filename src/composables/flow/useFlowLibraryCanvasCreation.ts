import type { ComputedRef, Ref } from 'vue'
import type { FlowLibraryCanvas, FlowLibraryCategory } from '@/api/flowLibrary'
import type {
  FlowCanvasCategoryOption,
  FlowCanvasCreateDraft,
} from '@/components/flow/library/flowLibrary.types'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { createEmptyFlowCanvas } from '@/services/flow/flowCanvasCreation.service'
import { buildFlowCanvasCategoryOptions } from '@/services/flow/flowCanvasCategory.service'
import { isFlowVirtualRoot } from '@/services/flow/flowCategoryPath.service'

interface UseFlowLibraryCanvasCreationOptions {
  categories: Ref<FlowLibraryCategory[]>
  onCreated: (canvas: FlowLibraryCanvas) => void
  rootCategoryId: ComputedRef<string>
  selectedCategoryId: Ref<string>
}

interface UseFlowLibraryCanvasCreationReturn {
  canCreateCanvas: ComputedRef<boolean>
  confirmCreateCanvas: (draft: FlowCanvasCreateDraft) => Promise<void>
  createCategoryOptions: ComputedRef<FlowCanvasCategoryOption[]>
  createCanvas: () => void
  createDialogVisible: Ref<boolean>
  isCreatingCanvas: Ref<boolean>
  requiresCreateCategory: ComputedRef<boolean>
}

/**
 * 管理资料库中有无当前目录时的新建画布流程。
 * @param options 分类数据、当前目录和资料库根目录。
 * @returns 创建权限、目录选项、弹窗状态和创建动作。
 */
export function useFlowLibraryCanvasCreation(
  options: UseFlowLibraryCanvasCreationOptions,
): UseFlowLibraryCanvasCreationReturn {
  const route = useRoute()
  const router = useRouter()
  const createDialogVisible = ref(false)
  const isCreatingCanvas = ref(false)
  const createCategoryOptions = computed(() => (
    buildFlowCanvasCategoryOptions(
      options.categories.value.filter((category) => !isFlowVirtualRoot(category)),
    )
  ))
  const selectedCategory = computed(() => options.categories.value.find(
    (category) => category.id === options.selectedCategoryId.value,
  ))
  const requiresCreateCategory = computed(() => (
    !selectedCategory.value || isFlowVirtualRoot(selectedCategory.value)
  ))
  const canCreateCanvas = computed(() => {
    const candidates = requiresCreateCategory.value
      ? options.categories.value.filter((category) => !isFlowVirtualRoot(category))
      : selectedCategory.value ? [selectedCategory.value] : []
    return candidates.some((category) => (
      category.permission >= FLOW_CATEGORY_PERMISSION.EDIT
    ))
  })

  function createCanvas(): void {
    if (!canCreateCanvas.value) {
      ElMessage.warning(requiresCreateCategory.value
        ? '没有可编辑的画布文件夹'
        : '当前文件夹无编辑权限')
      return
    }
    createDialogVisible.value = true
  }

  async function confirmCreateCanvas(draft: FlowCanvasCreateDraft): Promise<void> {
    if (isCreatingCanvas.value) return
    const categoryId = requiresCreateCategory.value
      ? draft.categoryId || ''
      : options.selectedCategoryId.value
    const category = options.categories.value.find((item) => item.id === categoryId)
    if (!category || category.permission < FLOW_CATEGORY_PERMISSION.EDIT) {
      ElMessage.warning('请选择有编辑权限的画布文件夹')
      return
    }
    isCreatingCanvas.value = true
    try {
      const workflow = await createEmptyFlowCanvas({
        categoryId,
        coverFile: draft.coverFile,
        name: draft.name,
      })
      options.onCreated({
        categoryId,
        cover: '',
        createdBy: '',
        id: workflow.id,
        isFavorite: false,
        name: workflow.name,
        updatedAt: workflow.updated_at || workflow.created_at || new Date().toISOString(),
      })
      createDialogVisible.value = false
      await router.push({
        name: route.meta.standalone === true ? 'flow-single' : 'flow',
        query: {
          workflowId: workflow.id,
          ...(route.meta.standalone === true && options.rootCategoryId.value
            ? { scopeCategoryId: options.rootCategoryId.value }
            : {}),
        },
      })
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '画布创建失败')
    } finally {
      isCreatingCanvas.value = false
    }
  }

  return {
    canCreateCanvas,
    confirmCreateCanvas,
    createCategoryOptions,
    createCanvas,
    createDialogVisible,
    isCreatingCanvas,
    requiresCreateCategory,
  }
}
