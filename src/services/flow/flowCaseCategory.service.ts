import type { FlowCaseCategory } from '@/api/flowCases'
import type { FlowCaseCategoryNode } from '@/components/flow/flowCasePublication.types'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'

export interface FlowCaseFirstLevelIndex {
  categories: FlowCaseCategory[]
  names: string[]
}

function filterWritableNodes(nodes: FlowCaseCategoryNode[]): FlowCaseCategoryNode[] {
  return nodes.flatMap((node) => {
    const children = filterWritableNodes(node.children)
    const disabled = node.permission < FLOW_CATEGORY_PERMISSION.MANAGE
    if (disabled && !children.length) return []
    return [{ ...node, children, disabled }]
  })
}

function filterByKeyword(nodes: FlowCaseCategoryNode[], keyword: string): FlowCaseCategoryNode[] {
  if (!keyword) return nodes
  return nodes.flatMap((node) => {
    const children = filterByKeyword(node.children, keyword)
    if (!node.name.toLocaleLowerCase().includes(keyword) && !children.length) return []
    return [{ ...node, children }]
  })
}

/**
 * 建立案例目录到一级分类名称的映射，一级分类取 type 14 根目录的直接下级。
 * @param categories category_type 14 的扁平分类列表。
 * @returns 一级分类名称及所有后代目录对应的一级分类索引。
 */
export function buildFlowCaseFirstLevelIndex(
  categories: FlowCaseCategory[],
): FlowCaseFirstLevelIndex {
  const rootIds = new Set(
    categories.filter((item) => item.pid === '0').map((item) => item.id),
  )
  const firstLevel = categories.filter((item) => rootIds.has(item.pid))
  return {
    categories: firstLevel,
    names: [...new Set(firstLevel.map((item) => item.name).filter(Boolean))],
  }
}

/**
 * 将案例分类列表整理为可选择的目录树，并保留包含可管理后代的只读父节点。
 * @param categories category_type 14 的扁平分类列表。
 * @param keyword 可选的目录搜索词。
 * @returns 发布弹窗使用的分类树。
 */
export function buildFlowCaseCategoryTree(
  categories: FlowCaseCategory[],
  keyword = '',
): FlowCaseCategoryNode[] {
  const nodes = new Map<string, FlowCaseCategoryNode>()
  categories.forEach((category) => {
    nodes.set(category.id, { ...category, children: [], disabled: false })
  })
  const roots: FlowCaseCategoryNode[] = []
  nodes.forEach((node) => {
    const parent = nodes.get(node.pid)
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  })
  const writable = filterWritableNodes(roots)
  const visibleRoots = writable.length === 1 && writable[0].children.length
    ? writable[0].children
    : writable
  return filterByKeyword(visibleRoots, keyword.trim().toLocaleLowerCase())
}
