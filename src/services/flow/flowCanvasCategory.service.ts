import type { FlowCanvasCategoryOption } from '@/components/flow/library/flowLibrary.types'
import type { FlowLibraryCategory } from '@/api/flowLibrary'
import { listFlowCategories } from '@/api/flowLibrary'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'

function toCategoryOption(category: FlowLibraryCategory): FlowCanvasCategoryOption {
  return {
    disabled: category.permission < FLOW_CATEGORY_PERMISSION.EDIT,
    id: category.id,
    label: category.name,
    pid: category.pid,
  }
}

/**
 * 将画布分类转换为弹窗使用的目录选项，同时保留父子 ID 和编辑权限。
 * @param categories 画布分类列表。
 * @returns 可由弹窗重新构建树结构的目录选项。
 */
export function buildFlowCanvasCategoryOptions(
  categories: readonly FlowLibraryCategory[],
): FlowCanvasCategoryOption[] {
  return categories.map(toCategoryOption)
}

/**
 * 读取可用于新建画布的目录选项，并标记当前用户不可写入的目录。
 * @returns 保留父子关系和编辑权限的画布目录选项。
 * @throws type 11 分类接口加载失败时抛出异常。
 */
export async function listFlowCanvasCategoryOptions(): Promise<FlowCanvasCategoryOption[]> {
  const categories = await listFlowCategories()
  return buildFlowCanvasCategoryOptions(categories)
}
