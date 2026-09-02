import {
  createLocalFlowCategory,
  deleteLocalFlowCategory,
  listLocalFlowCategories,
  listLocalFlowLibraryCanvases,
  updateLocalFlowCategory,
} from '@/services/flow/localFlowLibrary.service'

export interface FlowLibraryCategory {
  code?: string
  createdBy: string
  id: string
  name: string
  pid: string
  pathIds: string[]
  permission: number
}

export interface FlowLibraryCanvas {
  createdBy: string
  id: string
  name: string
  categoryId: string
  cover: string
  isFavorite: boolean
  updatedAt: string
}

export interface FlowLibraryCanvasQuery {
  categoryId: string
  keyword?: string
  page: number
  pageSize: number
}

/**
 * 读取本地画布分类。
 * @returns 文件夹列表。
 */
export async function listFlowCategories(): Promise<FlowLibraryCategory[]> {
  return listLocalFlowCategories()
}

/**
 * 读取本地画布资产。
 * @param query 当前文件夹、分页和搜索参数。
 * @returns 用于资料库卡片展示的画布列表。
 */
export async function listFlowLibraryCanvases(
  query: FlowLibraryCanvasQuery,
): Promise<FlowLibraryCanvas[]> {
  return listLocalFlowLibraryCanvases(query)
}

/**
 * 在当前选中的文件夹下创建本地子文件夹。
 * @param name 文件夹名称。
 * @param pid 父文件夹 ID。
 * @returns 新建文件夹的 ID。
 */
export async function createFlowCategory(
  name: string,
  pid: string,
  isNoInherit = false,
): Promise<string> {
  void isNoInherit
  return createLocalFlowCategory(name, pid)
}

/**
 * 更新本地文件夹名称。
 * @param categoryId 文件夹 ID。
 * @param name 新文件夹名称。
 * @returns 无返回值。
 */
export async function updateFlowCategory(categoryId: string, name: string): Promise<void> {
  updateLocalFlowCategory(categoryId, name)
}

/**
 * 删除本地文件夹及其下级分类。
 * @param categoryId 文件夹 ID。
 * @returns 无返回值。
 */
export async function deleteFlowCategory(categoryId: string): Promise<void> {
  deleteLocalFlowCategory(categoryId)
}
