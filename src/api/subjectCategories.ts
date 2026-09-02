import teamonesClient from './teamonesClient'

export const ROOT_CATEGORY_ID = 1720
const SUBJECT_CATEGORY_TYPE = 9

type UnknownRecord = Record<string, unknown>

export interface RawCategory {
  id: number | string
  name: string
  code: string
  pid: number | string
  type: number
  p_category_ids: string
  thumb?: string
  description?: string
  children?: RawCategory[]
  [key: string]: unknown
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  const axiosData = isRecord(value.data) ? value.data : value
  return isRecord(axiosData) && 'data' in axiosData ? axiosData.data : axiosData
}

function extractCategories(value: unknown): RawCategory[] {
  const payload = unwrap(value)
  if (Array.isArray(payload)) return payload as RawCategory[]
  if (!isRecord(payload)) return []
  const categoryRows = payload.items ?? payload.data
  return Array.isArray(categoryRows) ? categoryRows as RawCategory[] : []
}

function buildCategoryTree(categories: RawCategory[]): RawCategory {
  const entries = categories.map((item): [string, RawCategory] => [
    String(item.id),
    { ...item, children: [] },
  ])
  const categoryById = new Map<string, RawCategory>(entries)
  categoryById.forEach((item) => {
    const parent = categoryById.get(String(item.pid))
    if (parent) parent.children?.push(item)
  })
  const root = categoryById.get(String(ROOT_CATEGORY_ID))
  if (!root) throw new Error('未找到 AI 主体库根分类')
  return root
}

export const subjectCategoryApi = {
  /**
   * 获取主体分类树。
   * @returns 以主体库根分类为根节点的分类树。
   * @throws 根分类缺失或请求失败时抛出异常。
   */
  async getTree(): Promise<RawCategory> {
    const response = await teamonesClient.post('/api_assets/category/get_category_list', {
      param: { filter: { type: SUBJECT_CATEGORY_TYPE } },
    })
    return buildCategoryTree(extractCategories(response))
  },

  /**
   * 创建主体分类。
   * @param name 分类名称。
   * @param pid 父分类 ID。
   * @returns 新建分类数据。
   * @throws 请求失败时抛出异常。
   */
  async create(name: string, pid: number): Promise<RawCategory> {
    const response = await teamonesClient.post('/api_assets/category/create', {
      data: {
        name,
        pid,
        code: `subject_category_${Math.random().toString(36).slice(2, 10)}`,
        type: SUBJECT_CATEGORY_TYPE,
      },
    })
    return unwrap(response) as RawCategory
  },

  /**
   * 更新主体分类名称。
   * @param id 分类 ID。
   * @param name 新名称。
   * @returns 无返回值。
   * @throws 请求失败或接口返回业务错误时抛出异常。
   */
  async rename(id: number, name: string): Promise<void> {
    await teamonesClient.post('/api_assets/category/update', {
      isThrowError: 'yes',
      data: { id, name },
    })
  },

  /**
   * 删除主体分类。
   * @param id 分类 ID。
   * @returns 无返回值。
   * @throws 请求失败时抛出异常。
   */
  async delete(id: number): Promise<void> {
    await teamonesClient.post('/api_assets/category/delete', { data: { id } })
  },
}
