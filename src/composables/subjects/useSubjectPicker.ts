import { ref, reactive, watch, type Ref, type ComputedRef } from 'vue'
import { subjectAssetApi, type AssetFilter, type RawAsset } from '@/api/subjectAsset'
import { buildThumbUrl } from '@/utils/cosUpload'
import { useSubjectCategories, type CategoryOption } from '@/composables/subjects/useSubjectCategories'
import { useSubjectMediaHover } from '@/composables/subjects/useSubjectMediaHover'

export interface SubjectPickerItem {
  id: string
  name: string
  thumb: string | null
  mediaCount?: number
}

export interface SubjectSelectPayload {
  subjectId: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  multiSelect?: boolean
}

export interface SubjectCategoryBar {
  firstLevelCategories: CategoryOption[]
  subCategories: CategoryOption[]
  activeCategoryId: number | null
  activeSubCategoryId: number | null
  selectCategory: (id: number | null) => void
  selectSubCategory: (id: number | null) => void
}

interface UseSubjectPickerReturn {
  subjects: Ref<SubjectPickerItem[]>
  loading: Ref<boolean>
  loaded: Ref<boolean>
  categoryBar: SubjectCategoryBar
  refresh: () => Promise<void>
}

function mapAssetToPickerItem(raw: RawAsset, thumb: string | null): SubjectPickerItem {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    thumb: thumb ? buildThumbUrl(thumb) : null,
  }
}

/**
 * 主体库选择器：当菜单可见时加载主体列表，
 * 支持按分类过滤（服务端）和关键词搜索（防抖 + 客户端拼音叠加）。
 */
export function useSubjectPicker(
  searchQuery: Ref<string> | ComputedRef<string>,
  visible: Ref<boolean>,
): UseSubjectPickerReturn {
  const subjects = ref<SubjectPickerItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const cat = useSubjectCategories()
  const { loadMedia, getCached } = useSubjectMediaHover()

  const categoryBar = reactive({
    firstLevelCategories: cat.firstLevelCategories,
    subCategories: cat.subCategories,
    activeCategoryId: cat.activeCategoryId,
    activeSubCategoryId: cat.activeSubCategoryId,
    selectCategory: cat.selectCategory,
    selectSubCategory: cat.selectSubCategory,
  }) as SubjectCategoryBar

  let preloadGen = 0

  function preloadMediaCounts(subjectIds: string[], gen: number): void {
    if (!subjectIds.length) return
    const pending = subjectIds.filter(id => !getCached(id))
    if (!pending.length) {
      applyMediaCounts(subjectIds, gen)
      return
    }
    const CONCURRENCY = 4
    let cursor = 0
    const worker = async () => {
      while (cursor < pending.length) {
        if (gen !== preloadGen) return
        const id = pending[cursor++]
        await loadMedia(id)
        if (gen !== preloadGen) return
        applyMediaCounts([id], gen)
      }
    }
    for (let i = 0; i < Math.min(CONCURRENCY, pending.length); i += 1) {
      worker()
    }
  }

  function applyMediaCounts(ids: string[], gen: number): void {
    if (gen !== preloadGen) return
    subjects.value = subjects.value.map(item => {
      if (item.mediaCount != null) return item
      const cached = getCached(item.id)
      return cached
        ? { ...item, mediaCount: cached.length }
        : item
    })
  }

  async function fetchSubjects(keyword: string): Promise<void> {
    const gen = ++preloadGen
    loading.value = true
    try {
      const filter: AssetFilter = {}
      const trimmed = keyword.trim()
      if (trimmed) {
        filter['asset.name'] = ['-lk', `%${trimmed}%`]
      }
      const catId = cat.effectiveCategoryId.value ?? undefined
      const items = await subjectAssetApi.getList(1, 24, filter, catId)
      if (gen !== preloadGen) return
      let thumbMap: Record<string, string | null> = {}
      if (items.length) {
        try {
          const rawThumbs = await subjectAssetApi.getThumbs(items.map(i => i.id))
          for (const key in rawThumbs) {
            const val = rawThumbs[key]
            thumbMap[key] = typeof val === 'string' ? val : (val?.thumb || null)
          }
        } catch { /* thumbs optional */ }
      }
      subjects.value = items.map(item =>
        mapAssetToPickerItem(item, thumbMap[String(item.id)] || null),
      )
      loaded.value = true
      const ids = subjects.value.map(s => s.id)
      preloadMediaCounts(ids, gen)
    } catch {
      subjects.value = []
    } finally {
      loading.value = false
    }
  }

  function refresh(): Promise<void> {
    return fetchSubjects(searchQuery.value)
  }

  watch(visible, (v) => {
    if (v) {
      cat.loadCategories()
      if (!loaded.value) {
        refresh()
      }
    }
  }, { immediate: true })

  watch(cat.effectiveCategoryId, () => {
    if (visible.value) {
      refresh()
    }
  })

  watch(searchQuery, (val) => {
    if (!visible.value) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      fetchSubjects(val)
    }, 300)
  })

  return { subjects, loading, loaded, categoryBar, refresh }
}
