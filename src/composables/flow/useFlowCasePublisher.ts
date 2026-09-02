import type { ComputedRef, Ref } from 'vue'
import type { FlowCaseCategory } from '@/api/flowCases'
import type { FlowCasePublishDraft } from '@/components/flow/flowCasePublication.types'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { listFlowCaseCategories } from '@/api/flowCases'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { useTeamonesResourcePermissions } from '@/composables/useTeamonesResourcePermissions'
import {
  FLOW_CASE_RELEASE_RESOURCE_CODE,
  TEAMONES_SHENSHU_APP_CODE,
} from '@/composables/flow/flowCasePermission.constants'
import { publishFlowCase } from '@/services/flow/flowCasePublication.service'

interface UseFlowCasePublisherOptions {
  activeWorkflowId: Ref<string>
  hasUnsavedChanges: Ref<boolean>
}

interface UseFlowCasePublisherReturn {
  canPublishCase: ComputedRef<boolean>
  caseCategories: Ref<FlowCaseCategory[]>
  caseDialogVisible: Ref<boolean>
  hasPublishPermission: ComputedRef<boolean>
  isCaseCategoryLoading: Ref<boolean>
  isCasePublishing: Ref<boolean>
  openCasePublisher: () => Promise<void>
  publishCase: (draft: FlowCasePublishDraft) => Promise<void>
}

/**
 * 管理画布发布为案例时的目录加载、提交状态与用户反馈。
 * @param options 当前画布 ID、名称和未保存状态。
 * @returns 发布按钮与弹窗需要的响应式状态和操作。
 */
export function useFlowCasePublisher(
  options: UseFlowCasePublisherOptions,
): UseFlowCasePublisherReturn {
  const caseCategories = ref<FlowCaseCategory[]>([])
  const caseDialogVisible = ref(false)
  const isCaseCategoryLoading = ref(false)
  const isCasePublishing = ref(false)
  const {
    hasResourcePermission: hasPublishPermission,
  } = useTeamonesResourcePermissions(
    TEAMONES_SHENSHU_APP_CODE,
    FLOW_CASE_RELEASE_RESOURCE_CODE,
  )
  const canPublishCase = computed(() => (
    !!options.activeWorkflowId.value
    && hasPublishPermission.value
    && !isCaseCategoryLoading.value
    && !isCasePublishing.value
  ))

  async function loadCaseCategories(showError: boolean): Promise<void> {
    if (isCaseCategoryLoading.value) return
    isCaseCategoryLoading.value = true
    try {
      caseCategories.value = await listFlowCaseCategories()
    } catch (error) {
      caseCategories.value = []
      if (showError) {
        ElMessage.error(error instanceof Error ? error.message : '案例目录加载失败')
      }
    } finally {
      isCaseCategoryLoading.value = false
    }
  }

  async function openCasePublisher(): Promise<void> {
    if (isCaseCategoryLoading.value) return
    if (!hasPublishPermission.value) return
    if (!options.activeWorkflowId.value) {
      ElMessage.warning('请先保存当前画布再发布案例')
      return
    }
    if (options.hasUnsavedChanges.value) {
      ElMessage.warning('当前画布有未保存更改，请保存后再发布')
      return
    }
    await loadCaseCategories(true)
    if (hasPublishPermission.value) caseDialogVisible.value = true
  }

  async function publishCase(draft: FlowCasePublishDraft): Promise<void> {
    if (isCasePublishing.value) return
    if (!hasPublishPermission.value) return
    const category = caseCategories.value.find((item) => item.id === draft.categoryId)
    if (!category || category.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
      ElMessage.warning('当前案例目录无管理权限')
      return
    }
    if (options.hasUnsavedChanges.value) {
      ElMessage.warning('当前画布有未保存更改，请保存后再发布')
      return
    }
    isCasePublishing.value = true
    try {
      await publishFlowCase({
        ...draft,
        sourceWorkflowId: options.activeWorkflowId.value,
      })
      caseDialogVisible.value = false
      ElMessage.success('案例发布成功')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '案例发布失败')
    } finally {
      isCasePublishing.value = false
    }
  }

  return {
    canPublishCase,
    caseCategories,
    caseDialogVisible,
    hasPublishPermission,
    isCaseCategoryLoading,
    isCasePublishing,
    openCasePublisher,
    publishCase,
  }
}
