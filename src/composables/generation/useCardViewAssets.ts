import { ref, computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import { getCachedGenerationModels } from '@/api/models'
import { getAssetModelLabel as getRawAssetModelLabel, assetToHistoryRecord, getAssetDisplayParams, getDateLabel } from '@/components/generation/generationResultAdapters'
import { useAssetStore } from '@/stores/assets.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import type { AssetItem } from '@/api/assets'

export type AssetGroupId = string | number
export type DisplayMode = 'detailed-card' | 'compact-card' | 'table'

export function useCardViewAssets(params: {
  filterConditions: Ref<{ search: string; genType: string; timeFilter: string; startDate: string; endDate: string }>
  displayMode: Ref<DisplayMode>
  waterfallEnabled: Ref<boolean>
  displayRatioValue: ComputedRef<number>
  showDateGroups: Ref<boolean>
  aspectRatioCache: ReturnType<typeof shallowRef<Map<string, number>>>
  containerInnerWidth: Ref<number>
  showFailed: Ref<boolean>
  colWidth: ComputedRef<number>
  taskQueueStore?: any
}) {
  const assetStore = useAssetStore()
  const taskQueueStore = useTaskQueueStore()

  const {
    filterConditions,
    displayMode,
    waterfallEnabled,
    displayRatioValue,
    showDateGroups,
    aspectRatioCache,
    containerInnerWidth,
    showFailed,
    colWidth,
  } = params

  // ── 选中资源索引 ──
  const selectedAssetIndices = ref<Map<AssetGroupId, number>>(new Map())

  const getSelectedAssetIndex = (groupId: AssetGroupId) => {
    return selectedAssetIndices.value.get(groupId) || 0
  }

  const setSelectedAssetIndex = (groupId: AssetGroupId, index: number) => {
    const nextMap = new Map(selectedAssetIndices.value)
    nextMap.set(groupId, index)
    selectedAssetIndices.value = nextMap
  }

  const getCurrentAsset = (group: any[]) => {
    const idx = getSelectedAssetIndex(group[0].id)
    return group[idx] || group[0]
  }

  const assetToRecord = assetToHistoryRecord

  // ── 模型显示名 ──
  const modelDisplayNameMap = ref<Record<string, string>>({})

  const loadModelDisplayNameMap = async () => {
    try {
      const models = await getCachedGenerationModels()
      const next: Record<string, string> = {}
      for (const model of models) {
        const displayName = model.display_name || model.name || model.id || ''
        if (!displayName) continue
        if (model.id) next[model.id] = displayName
        if (model.name) next[model.name] = displayName
      }
      modelDisplayNameMap.value = next
    } catch (error) {
    }
  }

  const getAssetModelLabel = (asset: any): string => {
    const modelId = asset?.model || asset?.modelInfo || asset?.param?.params?.model || ''
    if (modelId && modelDisplayNameMap.value[modelId]) return modelDisplayNameMap.value[modelId]
    const rawLabel = getRawAssetModelLabel(asset)
    if (rawLabel && modelDisplayNameMap.value[rawLabel]) return modelDisplayNameMap.value[rawLabel]
    return rawLabel
  }

  // ── 已完成资产 ──
  const completedAssets = computed(() => {
    let items = [...assetStore.items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    items = items.filter((item) => {
      const normalized = String(item.status || '').toLowerCase()
      const isSuccess = normalized === 'completed'
      const isFailed = normalized === 'failed'
      return isSuccess || (showFailed.value && isFailed)
    })
    if (filterConditions.value.search) {
      const query = filterConditions.value.search.toLowerCase()
      items = items.filter(item => item.prompt?.toLowerCase().includes(query))
    }
    return items
  })

  const allAssets = computed(() => {
    return [...completedAssets.value] as any[]
  })

  const groupedAssets = computed(() => {
    const assets = allAssets.value
    if (!assets.length) return []
    const groups: AssetItem[][] = []
    let current: AssetItem[] = [assets[0]]
    for (let i = 1; i < assets.length; i++) {
      const prev = assets[i - 1]
      const curr = assets[i]
      const sameRecord = prev.record_id && curr.record_id && prev.record_id === curr.record_id
      if (sameRecord) {
        current.push(curr)
      } else {
        groups.push(current)
        current = [curr]
      }
    }
    groups.push(current)
    return groups
  })

  // ── 布局计算 ──
  const GRID_GAP = 10

  const gridColumnCount = computed(() => {
    const innerWidth = Math.max(0, containerInnerWidth.value)
    if (!innerWidth) return 1
    return Math.max(2, Math.floor((innerWidth + GRID_GAP) / (colWidth.value + GRID_GAP)))
  })

  // ── 占位任务 ──
  const activePlaceholderTasks = computed(() =>
    taskQueueStore.tasks.filter(t =>
      t.status === 'running',
    ),
  )

  // ── 宽高比 ──
  const getAssetRatio = (asset: any): number => {
    const id = String(asset.id)
    const cache = aspectRatioCache.value
    if (cache && cache.has(id)) {
      return cache.get(id)!
    }
    const width = Number(asset.width)
    const height = Number(asset.height)
    if (width > 0 && height > 0) {
      return width / height
    }
    const serverAspectRatio = Number(asset.aspect_ratio)
    if (serverAspectRatio > 0) {
      return 1 / serverAspectRatio
    }
    const params = asset.param || {}
    const w = Number(params.width)
    const h = Number(params.height)
    if (w && h) {
      return w / h
    }
    const nestedWidth = Number(params.params?.width)
    const nestedHeight = Number(params.params?.height)
    if (nestedWidth > 0 && nestedHeight > 0) {
      return nestedWidth / nestedHeight
    }
    if (params.size && typeof params.size === 'string') {
      const parts = params.size.split('x')
      if (parts.length === 2) {
        const w_size = Number(parts[0])
        const h_size = Number(parts[1])
        if (w_size && h_size) return w_size / h_size
      }
    }
    return 1
  }

  // ── 瀑布流布局 ──
  const dateGroupedRender = computed(() => {
    const cols = gridColumnCount.value
    const colW = Math.max(1, (containerInnerWidth.value - GRID_GAP * (cols - 1)) / cols)

    type DateBucket = { dateLabel: string; batches: { group: any[]; groupIndex: number }[] }
    const dateBuckets: DateBucket[] = []
    let currentDate = ''
    let currentBatches: { group: any[]; groupIndex: number }[] = []

    groupedAssets.value.forEach((group, groupIndex) => {
      const date = getDateLabel(group[0].created_at)
      if (date !== currentDate && currentBatches.length) {
        dateBuckets.push({ dateLabel: currentDate, batches: currentBatches })
        currentBatches = []
      }
      currentDate = date
      currentBatches.push({ group, groupIndex })
    })
    if (currentBatches.length) {
      dateBuckets.push({ dateLabel: currentDate, batches: currentBatches })
    }

    if (dateBuckets.length === 0 && activePlaceholderTasks.value.length > 0) {
      dateBuckets.push({ dateLabel: '', batches: [] })
    }

    const effectiveBuckets = showDateGroups.value
      ? dateBuckets
      : dateBuckets.length <= 1
        ? dateBuckets
        : [{ dateLabel: '', batches: dateBuckets.flatMap(b => b.batches) }]

    return effectiveBuckets.map((bucket, bucketIdx) => {
      const colHeights = Array(cols).fill(0)
      const columns: any[][] = Array.from({ length: cols }, () => [])
      let count = 0

      if (bucketIdx === 0) {
        for (const gTask of activePlaceholderTasks.value) {
          const targetCol = colHeights.indexOf(Math.min(...colHeights))
          const ratio = displayRatioValue.value
          const h = colW / ratio
          const top = colHeights[targetCol]
          columns[targetCol].push({
            group: [{ id: `placeholder-${gTask.id}`, _isPlaceholder: true, _task: gTask }],
            groupIndex: -1,
            top,
            height: h,
          })
          colHeights[targetCol] += h + GRID_GAP
          count += 1
        }
      }

      for (const { group, groupIndex } of bucket.batches) {
        const targetCol = colHeights.indexOf(Math.min(...colHeights))
        const firstItem = group[0]
        const ratio = waterfallEnabled.value ? getAssetRatio(firstItem) : displayRatioValue.value
        const mediaHeight = colW / ratio
        const detailHeight = displayMode.value === 'detailed-card' && waterfallEnabled.value
          ? estimateCardDetailsHeight(group, colW)
          : 0
        const h = mediaHeight + detailHeight
        const top = colHeights[targetCol]
        columns[targetCol].push({ group, groupIndex, top, height: h })
        colHeights[targetCol] += h + GRID_GAP
        count += group.length
      }

      return { dateLabel: bucket.dateLabel, count, columns }
    })
  })

  const dateGroupedTableRows = computed(() => {
    type DateTableGroup = { dateLabel: string; count: number; rows: { asset: any; batchLabel: string }[] }
    const result: DateTableGroup[] = []
    let currentDate = ''
    let currentRows: { asset: any; batchLabel: string }[] = []

    groupedAssets.value.forEach((group, groupIndex) => {
      const date = getDateLabel(group[0].created_at)
      if (date !== currentDate && currentRows.length) {
        result.push({ dateLabel: currentDate, count: currentRows.length, rows: currentRows })
        currentRows = []
      }
      currentDate = date
      const batchLabel = `批次 ${groupIndex + 1}${group.length > 1 ? ` · ${group.length}项` : ''}`
      for (const asset of group) {
        currentRows.push({ asset, batchLabel })
      }
    })
    if (currentRows.length) {
      result.push({ dateLabel: currentDate, count: currentRows.length, rows: currentRows })
    }

    if (!showDateGroups.value && result.length > 1) {
      const allRows = result.flatMap(r => r.rows)
      return [{ dateLabel: '', count: allRows.length, rows: allRows }]
    }
    return result
  })

  // ── 工具函数 ──
  function formatParamValue(val: any) {
    const raw = typeof val === 'object' ? JSON.stringify(val) : String(val)
    return raw.length > 26 ? `${raw.slice(0, 23)}...` : raw
  }

  const MAX_VISIBLE_META_PARAMS = 2

  function getHiddenAssetParamCount(asset: any) {
    return Math.max(0, getAssetDisplayParams(asset).length - MAX_VISIBLE_META_PARAMS)
  }

  function estimateCardDetailsHeight(group: any[], columnWidth: number) {
    const safeGroup = Array.isArray(group) ? group : []
    if (!safeGroup.length) return 104
    let height = 46
    if (safeGroup.length > 1) {
      height += 72
    }
    height += 32
    if (columnWidth < 220) {
      height += 14
    }
    return height
  }

  return {
    selectedAssetIndices,
    getSelectedAssetIndex,
    setSelectedAssetIndex,
    getCurrentAsset,
    assetToRecord,
    modelDisplayNameMap,
    loadModelDisplayNameMap,
    getAssetModelLabel,
    completedAssets,
    allAssets,
    groupedAssets,
    activePlaceholderTasks,
    getAssetRatio,
    gridColumnCount,
    GRID_GAP,
    dateGroupedRender,
    dateGroupedTableRows,
    formatParamValue,
    getHiddenAssetParamCount,
    estimateCardDetailsHeight,
  }
}
