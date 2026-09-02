import type { FlowLibraryCategory } from '@/api/flowLibrary'

const VIRTUAL_ROOT_NAME = 'ai画布'

/**
 * 判断分类是否为不需要在文件夹树中展示的画布虚拟根节点。
 * @param category 待判断的画布分类。
 * @returns 是否为“AI画布”虚拟根节点。
 */
export function isFlowVirtualRoot(category?: FlowLibraryCategory | null): boolean {
  if (!category) return false
  const isTopLevel = !category.pid || category.pid === '0'
  const normalizedName = category.name.replace(/\s+/g, '').toLocaleLowerCase()
  return isTopLevel && normalizedName === VIRTUAL_ROOT_NAME
}

/**
 * 获取画布虚拟根节点 ID；没有专用根节点时回退到首个顶层分类。
 * @param categories 完整画布分类列表。
 * @returns 可作为画布根位置的分类 ID。
 */
export function findFlowRootCategoryId(categories: FlowLibraryCategory[]): string {
  const virtualRoot = categories.find(isFlowVirtualRoot)
  if (virtualRoot) return virtualRoot.id
  return categories.find((category) => !category.pid || category.pid === '0')?.id || ''
}
