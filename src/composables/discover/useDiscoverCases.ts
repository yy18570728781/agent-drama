import type {
  DiscoverCase,
  DiscoverCategory,
  DiscoverCategoryAccess,
} from '@/components/discover/discover.types'
import type { UseDiscoverCasesReturn } from './discoverCases.types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getFlowCaseCarouselIds, listFlowCaseCategories } from '@/api/flowCases'
import {
  loadDiscoverCases,
  mergeDiscoverCasePages,
} from '@/services/discover/discoverCases.service'
import { buildFlowCaseFirstLevelIndex } from '@/services/flow/flowCaseCategory.service'
import { useDiscoverCaseCollectionSync } from './useDiscoverCaseCollectionSync'
import { useDiscoverShowcase } from './useDiscoverShowcase'

const ALL_CASES_CATEGORY = '全部'
const CASE_PAGE_SIZE = 24

/**
 * 加载发现页的一级分类、推荐案例和当前分类案例。
 * @returns 发现页展示状态、服务端分类切换动作与重新加载动作。
 */
export function useDiscoverCases(): UseDiscoverCasesReturn {
  const activeCategory = ref<DiscoverCategory>(ALL_CASES_CATEGORY)
  const cases = ref<DiscoverCase[]>([])
  const categoryAccessById = ref<ReadonlyMap<string, DiscoverCategoryAccess>>(new Map())
  const categoryOptions = ref<string[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const showcaseLoading = ref(true)
  const hasMore = ref(true)
  const errorMessage = ref('')
  const searchKeyword = ref('')
  const categories = computed<readonly DiscoverCategory[]>(() => [
    ALL_CASES_CATEGORY,
    ...categoryOptions.value,
  ])
  const categoryIdByName = new Map<string, string>()
  const caseCache = new Map<string, DiscoverCase>()
  let nextPage = 1
  let requestVersion = 0

  function cacheCases(items: DiscoverCase[]): void {
    items.forEach((item) => caseCache.set(item.id, item))
  }

  function findCaseById(caseId: string): DiscoverCase | null {
    return caseCache.get(caseId) || null
  }

  const {
    decorateCases,
    loadShowcase,
    patchShowcase,
    removeShowcase,
    resetShowcase,
    showcaseItems,
    updateShowcase,
  } = useDiscoverShowcase({ categoryAccessById, onCasesLoaded: cacheCases })
  const {
    invalidateShowcaseRequests,
    loadShowcaseSnapshot,
    removeCase,
    updateCase,
    updateCaseRecommendation,
  } = useDiscoverCaseCollectionSync({
    caseCache,
    cases,
    loadShowcase,
    patchShowcase,
    removeShowcase,
    showcaseLoading,
    updateShowcase,
  })

  async function loadCasePage(
    category: DiscoverCategory,
    page: number,
    replace: boolean,
    version: number,
  ): Promise<void> {
    const categoryId = category === ALL_CASES_CATEGORY
      ? undefined
      : categoryIdByName.get(category)
    const access = categoryId ? categoryAccessById.value.get(categoryId) : undefined
    const result = await loadDiscoverCases({
      categoryId,
      categoryName: category === ALL_CASES_CATEGORY ? '' : category,
      keyword: searchKeyword.value,
      page,
      pageSize: CASE_PAGE_SIZE,
      permission: access?.permission,
    })
    if (version !== requestVersion || category !== activeCategory.value) return
    const loadedCases = decorateCases(result.items)
    cases.value = replace ? loadedCases : mergeDiscoverCasePages(cases.value, loadedCases)
    nextPage = page + 1
    hasMore.value = result.hasMore
    cacheCases(cases.value)
  }

  async function selectCategory(category: DiscoverCategory, force = false): Promise<void> {
    if (!force && activeCategory.value === category) return
    if (category !== ALL_CASES_CATEGORY && !categoryIdByName.has(category)) return
    const version = ++requestVersion
    activeCategory.value = category
    cases.value = []
    nextPage = 1
    hasMore.value = true
    loading.value = true
    loadingMore.value = false
    errorMessage.value = ''
    try {
      await loadCasePage(category, 1, true, version)
    } catch (error) {
      if (version !== requestVersion) return
      cases.value = []
      hasMore.value = false
      errorMessage.value = error instanceof Error ? error.message : '案例加载失败'
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  async function searchCases(keyword: string): Promise<void> {
    const normalizedKeyword = keyword.trim()
    if (searchKeyword.value === normalizedKeyword) return
    searchKeyword.value = normalizedKeyword
    await selectCategory(activeCategory.value, true)
  }

  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || !hasMore.value) return
    const version = requestVersion
    const category = activeCategory.value
    loadingMore.value = true
    errorMessage.value = ''
    try {
      await loadCasePage(category, nextPage, false, version)
    } catch (error) {
      if (version !== requestVersion) return
      hasMore.value = false
      errorMessage.value = error instanceof Error ? error.message : '更多案例加载失败'
    } finally {
      if (version === requestVersion) loadingMore.value = false
    }
  }

  async function reload(): Promise<void> {
    const version = ++requestVersion
    activeCategory.value = ALL_CASES_CATEGORY
    cases.value = []
    resetShowcase([])
    caseCache.clear()
    nextPage = 1
    hasMore.value = true
    loading.value = true
    loadingMore.value = false
    showcaseLoading.value = true
    errorMessage.value = ''
    try {
      const [categoryList, recommendedIds] = await Promise.all([
        listFlowCaseCategories(),
        getFlowCaseCarouselIds().catch(() => []),
      ])
      if (version !== requestVersion) return
      const firstLevel = buildFlowCaseFirstLevelIndex(categoryList)
      const accessById = new Map<string, DiscoverCategoryAccess>(
        categoryList.map((item) => [item.id, { name: item.name, permission: item.permission }]),
      )
      categoryAccessById.value = accessById
      categoryIdByName.clear()
      firstLevel.categories.forEach((item) => categoryIdByName.set(item.name, item.id))
      categoryOptions.value = firstLevel.names
      resetShowcase(recommendedIds)
      await Promise.all([
        loadCasePage(ALL_CASES_CATEGORY, 1, true, version),
        loadShowcaseSnapshot(recommendedIds).catch(() => undefined),
      ])
    } catch (error) {
      if (version !== requestVersion) return
      cases.value = []
      hasMore.value = false
      categoryAccessById.value = new Map()
      categoryOptions.value = []
      caseCache.clear()
      resetShowcase([])
      errorMessage.value = error instanceof Error ? error.message : '案例加载失败'
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  onMounted(() => { void reload() })
  onBeforeUnmount(() => {
    requestVersion += 1
    invalidateShowcaseRequests()
  })

  return {
    activeCategory,
    cases,
    categories,
    categoryAccessById,
    errorMessage,
    findCaseById,
    hasMore,
    loadMore,
    loading,
    loadingMore,
    reload,
    removeCase,
    searchCases,
    selectCategory,
    showcaseItems,
    showcaseLoading,
    updateCase,
    updateCaseRecommendation,
  }
}
