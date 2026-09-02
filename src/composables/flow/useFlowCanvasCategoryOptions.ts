import type { Ref } from 'vue'
import type { FlowCanvasCategoryOption } from '@/components/flow/library/flowLibrary.types'
import { ref } from 'vue'
import { listFlowCanvasCategoryOptions } from '@/services/flow/flowCanvasCategory.service'

interface UseFlowCanvasCategoryOptionsReturn {
  categoryError: Ref<string>
  categoryLoading: Ref<boolean>
  categoryOptions: Ref<FlowCanvasCategoryOption[]>
  loadCategoryOptions: () => Promise<void>
}

/**
 * 管理新建画布弹窗所需的目录选项和加载状态。
 * @returns 目录选项、加载错误、加载状态和按需加载动作。
 */
export function useFlowCanvasCategoryOptions(): UseFlowCanvasCategoryOptionsReturn {
  const categoryError = ref('')
  const categoryLoading = ref(false)
  const categoryOptions = ref<FlowCanvasCategoryOption[]>([])

  async function loadCategoryOptions(): Promise<void> {
    if (categoryLoading.value || categoryOptions.value.length) return
    categoryError.value = ''
    categoryLoading.value = true
    try {
      const options = await listFlowCanvasCategoryOptions()
      categoryOptions.value = options
      if (!options.some((option) => !option.disabled)) {
        categoryError.value = '没有可编辑的画布文件夹'
      }
    } catch (error) {
      categoryError.value = error instanceof Error ? error.message : '画布文件夹加载失败'
    } finally {
      categoryLoading.value = false
    }
  }

  return { categoryError, categoryLoading, categoryOptions, loadCategoryOptions }
}
