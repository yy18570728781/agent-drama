import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  ASSET_RESTORE_SUPPORTED,
  listAssets,
  searchAssets,
  restoreAsset,
  addTag,
  removeTag,
  getAsset,
  getStats,
  type AssetItem,
  type AssetDetail,
  type AssetStats,
  type AssetListParams,
} from '@/api/assets'
import { buildTeamonesUrl } from '@/api/teamonesClient'
import {
  deleteAigcRecords,
  setAigcRecordsFavorite,
  toggleAigcRecordFavorite,
} from '@/services/assets/aigcRecord.service'

/** 从字符串或 {proxy_url, origin_url} 对象中提取显示用 URL（统一优先使用原始地址，不走图片代理） */
function extractUrl(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw.origin_url || raw.url || raw.proxy_url || null
  if (typeof raw === 'string') {
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    return buildTeamonesUrl(raw)
  }
  return null
}

function extractOriginUrl(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw.origin_url || raw.proxy_url || null
  if (typeof raw === 'string' && raw.startsWith('http')) return raw
  return null
}

/** 处理单个资产条目的 URL */
function resolveItemUrls(item: AssetItem): AssetItem {
  const resolvedReferenceUrls = Array.isArray(item.reference_urls)
    ? item.reference_urls.map(r => extractOriginUrl(r)).filter(Boolean) as string[]
    : []

  return {
    ...item,
    url: extractUrl(item.url) || (item.url as string),
    thumbnail_url: extractUrl(item.thumbnail_url) ?? null,
    reference_urls: resolvedReferenceUrls,
  }
}

export interface AssetFilter {
  type: string      // 'all' | 'image' | 'video'
  createdBy: string
  sort: string      // 'newest' | 'oldest'
  search: string
  status?: number | number[]
  favorite: boolean  // 只看收藏
  workflowOnly: boolean
  createdAfter: string   // ISO date string，如 '2024-01-01'
  createdBefore: string  // ISO date string
  trash: boolean         // 回收站模式（显示软删除的资产）
}

const WORKFLOW_RESULT_SOURCE = 'teamones_aigc_record'

function filterWorkflowResultItems(items: AssetItem[], workflowOnly: boolean): AssetItem[] {
  if (!workflowOnly) return items
  return items.filter(item => item.source === WORKFLOW_RESULT_SOURCE)
}

export const useAssetStore = defineStore('assets', () => {
  // ── 状态 ──────────────────────────────────────────
  const items = ref<AssetItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const offset = ref(0)
  const limit = 50  // 初始加载 50 条
  const pageSize = 50  // loadMore / loadOlder 每次加载条数

  const filter = ref<AssetFilter>({
    type: 'all',
    createdBy: '',
    sort: 'newest',
    search: '',
    status: 2,
    favorite: false,
    workflowOnly: false,
    createdAfter: '',
    createdBefore: '',
    trash: false,
  })

  // 多选状态
  const selectedIds = ref<Set<string>>(new Set())
  const selectionMode = ref(false)

  const detail = ref<AssetDetail | null>(null)
  const stats = ref<AssetStats | null>(null)

  // ── 计算属性 ──────────────────────────────────────
  // 用 offset 而不是 items.length，避免 dedup 后 items < offset 导致误判结束
  const hasMore = computed(() => total.value > 0 && offset.value < total.value)
  const selectedCount = computed(() => selectedIds.value.size)
  const allSelected = computed(() => items.value.length > 0 && items.value.every(a => selectedIds.value.has(a.id)))
  const restoreSupported = ASSET_RESTORE_SUPPORTED
  // ── 核心方法 ──────────────────────────────────────

  // 排队重载标记：当 load() 被并发调用时，标记在当前加载完成后自动重载
  let _pendingReload = false
  // 脏标记：外部（如 taskQueue）通知数据已过期，下次 load/refreshIfStale 时才真正请求
  const stale = ref(false)

  /** 加载第一页 */
  async function load() {
    if (loading.value) {
      // 已有加载进行中，标记完成后自动重载（确保新数据不会被丢弃）
      _pendingReload = true
      return
    }
    loading.value = true
    _pendingReload = false
    offset.value = 0
    try {
      const f = filter.value
      if (f.search) {
        const res = await searchAssets(
          f.search,
          f.type !== 'all' ? f.type : undefined,
          limit,
          0,
          f.favorite || undefined,
        )
        const resolvedItems = (res?.items || []).map(resolveItemUrls)
        const filteredItems = filterWorkflowResultItems(resolvedItems, f.workflowOnly)
        items.value = filteredItems
        total.value = f.workflowOnly ? filteredItems.length : (res?.total || 0)
      } else {
        const params: AssetListParams = {
          limit,
          offset: 0,
          order_by: 'created_at',
          order_desc: true,
        }
        if (f.type !== 'all') params.type = f.type
        if (f.createdBy) params.createdBy = f.createdBy
        if (f.status !== undefined) params.status = f.status
        if (f.favorite) params.is_favorites = true
        if (f.workflowOnly) params.source = WORKFLOW_RESULT_SOURCE
        if (f.trash) params.is_delete = true

        const res = await listAssets(params)
        items.value = filterWorkflowResultItems((res?.items || []).map(resolveItemUrls), f.workflowOnly)
        total.value = res?.total || 0
      }
      offset.value = items.value.length
    } catch (e) {
      console.error('[AssetStore] load failed:', e)
      items.value = []
      total.value = 0
      offset.value = 0
    } finally {
      loading.value = false
      stale.value = false
      // 如果在加载期间有新的 load() 请求被拦截，自动重载
      if (_pendingReload) {
        _pendingReload = false
        load()
      }
    }
  }

  /** 加载下一页（AssetGrid 向下滚动，追加到末尾） */
  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
    const currentOffset = offset.value
    try {
      const f = filter.value
      const params: AssetListParams = {
        limit: pageSize,
        offset: currentOffset,
        order_by: 'created_at',
        order_desc: true,
      }
      if (f.type !== 'all') params.type = f.type
      if (f.createdBy) params.createdBy = f.createdBy
      if (f.status !== undefined) params.status = f.status
      if (f.favorite) params.is_favorites = true
      if (f.workflowOnly) params.source = WORKFLOW_RESULT_SOURCE
      if (f.trash) params.is_delete = true

      const res = await listAssets(params)
      const newItems = filterWorkflowResultItems((res.items || []).map(resolveItemUrls), f.workflowOnly)
      total.value = Math.max(total.value, res.total ?? 0)
      if (newItems.length === 0) {
        // 服务端返回空页，直接将 offset 对齐 total 防止死循环
        offset.value = total.value
      } else {
        const existingIds = new Set(items.value.map(i => i.id))
        const deduped = newItems.filter(i => !existingIds.has(i.id))
        items.value.push(...deduped)
        offset.value = currentOffset + newItems.length
      }
    } catch (e) {
      console.error('[AssetStore] loadMore failed:', e)
    } finally {
      loadingMore.value = false
    }
  }

  /** 加载更旧的记录（CardView 向上滚动，push 到末尾，展示时 reverse() 出现在顶部） */
  async function loadOlder() {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
    const currentOffset = offset.value
    try {
      const f = filter.value
      const params: AssetListParams = {
        limit: pageSize,
        offset: currentOffset,
        order_by: 'created_at',
        order_desc: true,
      }
      if (f.type !== 'all') params.type = f.type
      if (f.createdBy) params.createdBy = f.createdBy
      if (f.status !== undefined) params.status = f.status
      if (f.favorite) params.is_favorites = true
      if (f.workflowOnly) params.source = WORKFLOW_RESULT_SOURCE
      if (f.trash) params.is_delete = true

      const res = await listAssets(params)
      const newItems = filterWorkflowResultItems((res.items || []).map(resolveItemUrls), f.workflowOnly)
      total.value = Math.max(total.value, res.total ?? 0)
      if (newItems.length === 0) {
        offset.value = total.value
      } else {
        const existingIds = new Set(items.value.map(i => i.id))
        const deduped = newItems.filter(i => !existingIds.has(i.id))
        items.value.push(...deduped)
        offset.value = currentOffset + newItems.length
      }
    } catch (e) {
      console.error('[AssetStore] loadOlder failed:', e)
    } finally {
      loadingMore.value = false
    }
  }

  /** 更新过滤条件并重新加载 */
  function setFilter(patch: Partial<AssetFilter>) {
    Object.assign(filter.value, patch)
    load()
  }

  /** 标记数据已过期（轻量，不发请求） */
  function markStale() {
    stale.value = true
  }

  /** 如果数据已过期则刷新，否则跳过 */
  function refreshIfStale() {
    if (!stale.value) return
    load()
  }

  function getAssetRecordId(item?: AssetItem | null) {
    return String(item?.record_id || item?.id || '').trim()
  }

  function getRecordIdsFromAssetIds(ids: string[]) {
    const idSet = new Set(ids)
    return items.value
      .filter(item => idSet.has(item.id))
      .map(getAssetRecordId)
      .filter(Boolean)
  }

  /** 切换收藏 */
  async function doToggleFavorite(id: string): Promise<boolean | undefined> {
    try {
      const item = items.value.find(a => String(a.id) === String(id))
      const recordId = getAssetRecordId(item)
      if (!recordId) return undefined
      const res = await toggleAigcRecordFavorite(recordId, Boolean(item?.is_favorites))
      if (!item) return res.is_favorites
      item.is_favorites = res.is_favorites
      if (filter.value.favorite && !res.is_favorites) {
        items.value = items.value.filter(asset => asset.id !== id)
        total.value = Math.max(0, total.value - 1)
      }
      return res.is_favorites
    } catch (e) {
      console.error('[AssetStore] toggleFavorite failed:', e)
      return undefined
    }
  }

  async function doToggleFavoriteBatch(ids: string[], favorite?: boolean) {
    if (!ids.length) return
    const idSet = new Set(ids)
    const shouldFavorite = favorite ?? items.value.some(item => idSet.has(item.id) && !item.is_favorites)
    await doSetFavoriteBatch(ids, shouldFavorite)
  }

  async function doSetFavoriteBatch(ids: string[], favorite: boolean) {
    if (!ids.length) return
    try {
      const idSet = new Set(ids)
      const targetItems = items.value.filter(item => idSet.has(item.id))
      const recordIds = targetItems.map(getAssetRecordId).filter(Boolean)
      if (!recordIds.length) return
      await setAigcRecordsFavorite(recordIds, favorite)
      items.value = items.value.map(item => idSet.has(item.id) ? { ...item, is_favorites: favorite } : item)
      if (filter.value.favorite && !favorite) {
        items.value = items.value.filter(item => !idSet.has(item.id))
        total.value = Math.max(0, total.value - targetItems.length)
      }
      clearSelection()
    } catch (e) {
      console.error('[AssetStore] setBatchFavorite failed:', e)
    }
  }

  async function deleteSelectedAigcRecords(ids: string[]) {
    const recordIds = getRecordIdsFromAssetIds(ids)
    if (!recordIds.length) return
    await deleteAigcRecords(recordIds)
  }

  /** 删除资产（普通模式软删除，回收站模式永久删除） */
  async function doDelete(id: string, _hard?: boolean) {
    try {
      await deleteSelectedAigcRecords([id])
      items.value = items.value.filter(a => a.id !== id)
      total.value = Math.max(0, total.value - 1)
      selectedIds.value.delete(id)
    } catch (e) {
      console.error('[AssetStore] delete failed:', e)
    }
  }

  /** 批量删除 */
  async function doDeleteBatch(ids: string[], _hard?: boolean) {
    try {
      await deleteSelectedAigcRecords(ids)
      const idSet = new Set(ids)
      items.value = items.value.filter(a => !idSet.has(a.id))
      total.value = Math.max(0, total.value - ids.length)
      ids.forEach(id => selectedIds.value.delete(id))
    } catch (e) {
      console.error('[AssetStore] batchDelete failed:', e)
    }
  }

  /** 从回收站恢复资产 */
  async function doRestore(id: string) {
    if (!restoreSupported) return
    try {
      await restoreAsset(id)
      items.value = items.value.filter(a => a.id !== id)
      total.value = Math.max(0, total.value - 1)
      selectedIds.value.delete(id)
    } catch (e) {
      console.error('[AssetStore] restore failed:', e)
    }
  }

  /** 批量从回收站恢复 */
  async function doRestoreBatch(ids: string[]) {
    if (!restoreSupported) return
    try {
      await Promise.all(ids.map(id => restoreAsset(id)))
      const idSet = new Set(ids)
      items.value = items.value.filter(a => !idSet.has(a.id))
      total.value = Math.max(0, total.value - ids.length)
      ids.forEach(id => selectedIds.value.delete(id))
    } catch (e) {
      console.error('[AssetStore] restoreBatch failed:', e)
    }
  }

  /** 切换单条选中 */
  function toggleSelect(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  /** 全选/取消全选 */
  function toggleSelectAll() {
    if (allSelected.value) {
      selectedIds.value = new Set()
    } else {
      selectedIds.value = new Set(items.value.map(a => a.id))
    }
  }

  /** 清空选择 */
  function clearSelection() {
    selectedIds.value = new Set()
  }

  function startSelectionMode() {
    selectionMode.value = true
    clearSelection()
  }

  function stopSelectionMode() {
    selectionMode.value = false
    clearSelection()
  }

  /** 添加标签 */
  async function doAddTag(id: string, tag: string) {
    try {
      await addTag(id, tag)
      const item = items.value.find(a => a.id === id)
      if (item && !item.tags.includes(tag)) item.tags.push(tag)
    } catch (e) {
      console.error('[AssetStore] addTag failed:', e)
    }
  }

  /** 移除标签 */
  async function doRemoveTag(id: string, tag: string) {
    try {
      await removeTag(id, tag)
      const item = items.value.find(a => a.id === id)
      if (item) item.tags = item.tags.filter(t => t !== tag)
    } catch (e) {
      console.error('[AssetStore] removeTag failed:', e)
    }
  }

  /** 获取资产详情 */
  async function loadDetail(id: string) {
    try {
      detail.value = resolveItemUrls(await getAsset(id)) as AssetDetail
    } catch (e) {
      console.error('[AssetStore] loadDetail failed:', e)
      detail.value = null
    }
  }

  /** 获取统计信息 */
  async function loadStats() {
    try {
      stats.value = await getStats()
    } catch (e) {
      console.error('[AssetStore] loadStats failed:', e)
    }
  }

  return {
    // state
    items,
    total,
    offset,
    loading,
    loadingMore,
    filter,
    detail,
    stats,
    hasMore,
    stale,
    restoreSupported,
    selectionMode,
    selectedIds,
    selectedCount,
    allSelected,
    // actions
    load,
    loadMore,
    loadOlder,
    setFilter,
    markStale,
    refreshIfStale,
    doToggleFavorite,
    doToggleFavoriteBatch,
    doDelete,
    doDeleteBatch,
    doRestore,
    doRestoreBatch,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    startSelectionMode,
    stopSelectionMode,
    doAddTag,
    doRemoveTag,
    loadDetail,
    loadStats,
  }
})
