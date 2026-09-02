import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { subjectAssetApi } from '@/api/subjectAsset'
import {
  ROOT_CATEGORY_ID,
  subjectCategoryApi,
  type RawCategory,
} from '@/api/subjectCategories'

export interface CategoryOption {
  id: number
  name: string
  children?: CategoryOption[]
}

interface UseSubjectCategoriesReturn {
  firstLevelCategories: ComputedRef<CategoryOption[]>
  subCategories: ComputedRef<CategoryOption[]>
  activeCategoryId: Ref<number | null>
  activeSubCategoryId: Ref<number | null>
  effectiveCategoryId: ComputedRef<number | null>
  categoryLoading: Ref<boolean>
  loadCategories: (force?: boolean) => Promise<void>
  selectCategory: (id: number | null) => void
  selectSubCategory: (id: number | null) => void
  createCategory: (name: string, parentId?: number) => Promise<number | null>
  renameCategory: (id: number, name: string) => Promise<boolean>
  deleteCategory: (id: number) => Promise<boolean>
}

// ── 模块级共享状态：所有 useSubjectCategories() 调用共用同一份分类树 ──
const sharedTree = ref<RawCategory | null>(null)
const sharedLoading = ref(false)
let sharedLoadPromise: Promise<void> | null = null

/** 从 RawCategory 提取 UI 用的精简结构 */
function toOption(raw: RawCategory): CategoryOption {
  return {
    id: Number(raw.id),
    name: raw.name,
    children: (raw.children || []).map(toOption),
  }
}

/**
 * 分类管理：加载分类树、一级/二级选择、创建/删除分类。
 * 分类树从后端 category/get_list 获取，客户端筛选 type=9。
 */
export function useSubjectCategories(): UseSubjectCategoriesReturn {
  // 选中状态为实例级（每个页面独立选择）
  const activeCategoryId = ref<number | null>(null)
  const activeSubCategoryId = ref<number | null>(null)

  const firstLevelCategories = computed<CategoryOption[]>(() => {
    if (!sharedTree.value?.children) return []
    return sharedTree.value.children.map(toOption)
  })

  const subCategories = computed<CategoryOption[]>(() => {
    if (!activeCategoryId.value || !sharedTree.value?.children) return []
    const parent = sharedTree.value.children.find(
      (c) => Number(c.id) === activeCategoryId.value,
    )
    return (parent?.children || []).map(toOption)
  })

  const effectiveCategoryId = computed<number | null>(() => {
    return activeSubCategoryId.value ?? activeCategoryId.value
  })

  async function loadCategories(force = false): Promise<void> {
    if (sharedLoadPromise) return sharedLoadPromise
    if (sharedTree.value && !force) return
    sharedLoadPromise = (async () => {
      sharedLoading.value = true
      try {
        sharedTree.value = await subjectCategoryApi.getTree()
      } catch {
        sharedTree.value = null
      } finally {
        sharedLoading.value = false
        sharedLoadPromise = null
      }
    })()
    return sharedLoadPromise
  }

  function selectCategory(id: number | null): void {
    activeCategoryId.value = id
    activeSubCategoryId.value = null
  }

  function selectSubCategory(id: number | null): void {
    activeSubCategoryId.value = id
  }

  async function createCategory(name: string, parentId?: number): Promise<number | null> {
    const pid = parentId ?? ROOT_CATEGORY_ID
    try {
      const created = await subjectCategoryApi.create(name, pid)
      await loadCategories(true)
      const createdId = Number(created.id)
      return Number.isFinite(createdId) ? createdId : null
    } catch (e) {
      const msg = e instanceof Error ? e.message : '创建分类失败'
      ElMessage.error(msg)
      return null
    }
  }

  async function renameCategory(id: number, name: string): Promise<boolean> {
    try {
      await subjectCategoryApi.rename(id, name)
      await loadCategories(true)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '重命名分类失败'
      ElMessage.error(message)
      return false
    }
  }

  async function deleteCategory(id: number): Promise<boolean> {
    try {
      const count = await subjectAssetApi.getCount({}, id)
      if (count > 0) {
        ElMessage.warning(`该分类下有 ${count} 个资产，无法删除`)
        return false
      }
      await ElMessageBox.confirm('确定删除该分类吗？', '提示', { type: 'warning' })
      await subjectCategoryApi.delete(id)
      if (activeCategoryId.value === id) selectCategory(null)
      await loadCategories(true)
      return true
    } catch (e) {
      if (e === 'cancel' || (e as { __elId?: unknown })?.__elId) return false
      const msg = e instanceof Error ? e.message : '删除分类失败'
      ElMessage.error(msg)
      return false
    }
  }

  return {
    firstLevelCategories,
    subCategories,
    activeCategoryId,
    activeSubCategoryId,
    effectiveCategoryId,
    categoryLoading: sharedLoading,
    loadCategories,
    selectCategory,
    selectSubCategory,
    createCategory,
    renameCategory,
    deleteCategory,
  }
}
