import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { subjectAssetApi, type AssetFilter, type RawAsset, type RawThumbEntry } from '@/api/subjectAsset'
import { buildThumbUrl } from '@/utils/cosUpload'
import { deleteSubject, type Subject } from '@/api/subjects'

interface UseSubjectListReturn {
  subjects: Ref<Subject[]>
  totalCount: Ref<number>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  hasMore: ComputedRef<boolean>
  errorMessage: Ref<string>
  currentPage: Ref<number>
  pageSize: Ref<number>
  searchName: Ref<string>
  loadList: () => Promise<void>
  loadMore: () => Promise<void>
  removeSubject: (id: string) => Promise<void>
  renameSubject: (subject: Subject, name: string) => Promise<void>
}

function normalizeMediaType(value?: string): 'image' | 'video' {
  return String(value || '').toLowerCase().startsWith('video') ? 'video' : 'image'
}

function resolveCoverSource(raw: RawAsset, cover?: RawThumbEntry): string | null {
  const candidate = cover?.url || raw.cover_media_url || cover?.path || ''
  return /\.[a-z0-9]{2,5}(?:[?#]|$)/i.test(candidate) ? candidate : cover?.thumb || null
}

function mapAssetToListItem(raw: RawAsset, cover?: RawThumbEntry): Subject {
  const content = typeof raw.content === 'string'
    ? (() => { try { return JSON.parse(raw.content) } catch { return {} } })()
    : (raw.content || {})

  const desc = content && typeof content === 'object'
    ? String((content as Record<string, unknown>).description ?? '')
    : ''

  return {
    id: String(raw.id),
    name: raw.name ?? '',
    description: desc,
    category_id: String(raw.category_id ?? ''),
    media: [],
    code: raw.code ?? '',
    thumb: cover?.thumb ? buildThumbUrl(cover.thumb) : null,
    media_type: normalizeMediaType(cover?.type || cover?.media_type || raw.cover_media_type),
    source_url: resolveCoverSource(raw, cover),
  }
}

async function loadCoverMap(items: RawAsset[]): Promise<Record<string, RawThumbEntry>> {
  const coverMap: Record<string, RawThumbEntry> = {}
  const missingCoverItems = items.filter((item) => !item.thumb)
  if (!missingCoverItems.length) return coverMap
  try {
    const rawThumbs = await subjectAssetApi.getThumbs(missingCoverItems.map((item) => item.id))
    Object.entries(rawThumbs).forEach(([key, value]) => {
      coverMap[key] = typeof value === 'string' ? { thumb: value } : value
    })
  } catch {
    // 缩略图失败不应阻断主体列表使用。
  }
  return coverMap
}

function mapSubjectPage(items: RawAsset[], coverMap: Record<string, RawThumbEntry>): Subject[] {
  return items.map((item) => mapAssetToListItem(
    item,
    coverMap[String(item.id)] || (item.thumb ? { thumb: item.thumb } : undefined),
  ))
}

/**
 * 主体列表管理：搜索、分页、按分类过滤。
 * 分类通过后端 category_id 自动递归匹配子分类。
 */
export function useSubjectList(
  categoryId?: ComputedRef<number | null>,
): UseSubjectListReturn {
  const subjects = ref<Subject[]>([])
  const totalCount = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const errorMessage = ref('')
  const currentPage = ref(1)
  const pageSize = ref(24)
  const searchName = ref('')
  const reachedEnd = ref(false)
  const hasMore = computed(() => !reachedEnd.value)
  let requestVersion = 0

  function buildFilter(): AssetFilter {
    const filter: AssetFilter = {}
    if (searchName.value.trim()) {
      filter['asset.name'] = ['-lk', `%${searchName.value.trim()}%`]
    }
    return filter
  }

  async function fetchPage(page: number, append: boolean, version: number): Promise<boolean> {
    const filter = buildFilter()
    const catId = categoryId?.value ?? undefined
    const result = await subjectAssetApi.getPage(page, pageSize.value, filter, catId)
    const items = result.items
    const coverMap = await loadCoverMap(items)
    if (version !== requestVersion) return false
    const pageSubjects = mapSubjectPage(items, coverMap)
    subjects.value = append ? [...subjects.value, ...pageSubjects] : pageSubjects
    const loadedCount = subjects.value.length
    totalCount.value = result.total === null ? loadedCount : Math.max(result.total, loadedCount)
    reachedEnd.value = result.total === null
      ? items.length < pageSize.value
      : loadedCount >= result.total
    return true
  }

  async function loadList(): Promise<void> {
    const version = ++requestVersion
    loading.value = true
    loadingMore.value = false
    errorMessage.value = ''
    currentPage.value = 1
    reachedEnd.value = false
    try {
      await fetchPage(1, false, version)
    } catch (error) {
      if (version !== requestVersion) return
      subjects.value = []
      totalCount.value = 0
      reachedEnd.value = true
      errorMessage.value = error instanceof Error ? error.message : '主体列表加载失败'
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || reachedEnd.value) return
    const version = requestVersion
    const nextPage = currentPage.value + 1
    loadingMore.value = true
    try {
      if (await fetchPage(nextPage, true, version)) currentPage.value = nextPage
    } catch {
      if (version === requestVersion) reachedEnd.value = true
    } finally {
      if (version === requestVersion) loadingMore.value = false
    }
  }

  async function removeSubject(id: string): Promise<void> {
    await deleteSubject(id)
    await loadList()
  }

  async function renameSubject(subject: Subject, name: string): Promise<void> {
    await subjectAssetApi.update(subject.id, name, { description: subject.description || '' })
    subject.name = name
  }

  return {
    subjects,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    errorMessage,
    currentPage,
    pageSize,
    searchName,
    loadList,
    loadMore,
    removeSubject,
    renameSubject,
  }
}
