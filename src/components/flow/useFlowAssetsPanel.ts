import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { AssetItem } from '@/api/assets'
import { useAssetStore } from '@/stores/assets.store'
import { getStorage, setStorage } from '@/utils/storage'
import { buildCanvasAssetGroups } from './flowCanvasAssets'
import type {
  CanvasAssetDisplayMode,
  CanvasAssetTypeFilter,
  FlowCanvasAssetGroup,
} from './flowCanvasAssets'

const ASSET_COL_KEY = 'workflow_asset_col_width'

type FlowAssetViewMode = 'canvas' | 'assets'

interface UseFlowAssetsPanelReturn {
  assetStore: ReturnType<typeof useAssetStore>
  assetColWidth: Ref<number>
  assetColCount: ComputedRef<number>
  assetColumns: ComputedRef<AssetItem[][]>
  canvasAssetGroups: ComputedRef<FlowCanvasAssetGroup[]>
  canvasAssetTotal: ComputedRef<number>
  assetPanelBodyRef: Ref<HTMLElement | null>
  viewMode: Ref<FlowAssetViewMode>
  canvasDisplayMode: Ref<CanvasAssetDisplayMode>
  canvasResultOnly: Ref<boolean>
  canvasTypeFilter: Ref<CanvasAssetTypeFilter>
  assetTypeFilter: Ref<string>
  favoriteOnly: ComputedRef<boolean>
  workflowOnly: ComputedRef<boolean>
  setViewMode: (mode: FlowAssetViewMode) => void
  setCanvasDisplayMode: (mode: CanvasAssetDisplayMode) => void
  setCanvasResultOnly: (value: boolean) => void
  setCanvasTypeFilter: (type: CanvasAssetTypeFilter) => void
  setAssetTypeFilter: (type: string) => void
  onAssetsScroll: (event: Event) => void
  onAssetsWheel: (event: WheelEvent) => void
}

function createAssetColumns(items: AssetItem[], count: number): AssetItem[][] {
  const columns = Array.from({ length: count }, () => [] as AssetItem[])
  items.forEach((item, index) => columns[index % count].push(item))
  return columns
}

/**
 * 管理工作流资产面板的分页、筛选与瀑布流布局。
 * @param visible 面板可见状态
 * @param nodes Current canvas nodes.
 * @returns 资产面板展示状态和交互方法
 */
export function useFlowAssetsPanel(visible: Ref<boolean>, nodes: Ref<unknown[]>): UseFlowAssetsPanelReturn {
  const assetStore = useAssetStore()
  const assetPanelBodyRef = ref<HTMLElement | null>(null)
  const viewMode = ref<FlowAssetViewMode>('canvas')
  const canvasDisplayMode = ref<CanvasAssetDisplayMode>('list')
  const canvasResultOnly = ref(false)
  const canvasTypeFilter = ref<CanvasAssetTypeFilter>('all')
  const assetTypeFilter = ref('all')
  const assetColWidth = ref(Number.parseInt(getStorage(ASSET_COL_KEY) || '170', 10))
  const assetColCount = computed(() => 4)

  const assetColumns = computed(() => createAssetColumns(assetStore.items, assetColCount.value))
  const canvasAssetGroups = computed(() => buildCanvasAssetGroups(
    nodes.value || [],
    canvasTypeFilter.value,
    canvasResultOnly.value,
  ))
  const canvasAssetTotal = computed(() => canvasAssetGroups.value.reduce((sum, group) => sum + group.items.length, 0))
  const favoriteOnly = computed({
    get: () => assetStore.filter.favorite,
    set: (favorite: boolean) => {
      assetStore.setFilter({ favorite, status: undefined })
    },
  })
  const workflowOnly = computed({
    get: () => assetStore.filter.workflowOnly,
    set: (workflowOnly: boolean) => {
      assetStore.setFilter({ workflowOnly, status: undefined })
    },
  })

  function setViewMode(mode: FlowAssetViewMode): void {
    viewMode.value = mode
    if (mode === 'assets' && visible.value) ensureAssetListLoaded()
  }

  function setCanvasDisplayMode(mode: CanvasAssetDisplayMode): void {
    canvasDisplayMode.value = mode
  }

  function setCanvasResultOnly(value: boolean): void {
    canvasResultOnly.value = value
  }

  function setCanvasTypeFilter(type: CanvasAssetTypeFilter): void {
    canvasTypeFilter.value = type
  }

  function ensureAssetListLoaded(): void {
    assetStore.filter.type = assetTypeFilter.value
    assetStore.filter.status = undefined
    if (!assetStore.items.length) assetStore.load()
  }

  function setAssetTypeFilter(type: string): void {
    assetTypeFilter.value = type
    if (viewMode.value === 'canvas') return
    assetStore.setFilter({ type, status: undefined })
  }

  function onAssetsWheel(event: WheelEvent): void {
    if (!event.ctrlKey || viewMode.value !== 'assets') return
    const delta = event.deltaY > 0 ? -20 : 20
    assetColWidth.value = Math.min(380, Math.max(80, assetColWidth.value + delta))
    setStorage(ASSET_COL_KEY, String(assetColWidth.value))
  }

  function onAssetsScroll(event: Event): void {
    if (viewMode.value !== 'assets') return
    const element = event.target as HTMLElement | null
    if (!element || element.scrollHeight - element.scrollTop - element.clientHeight >= 200) return
    if (assetStore.hasMore && !assetStore.loadingMore) assetStore.loadMore()
  }

  watch(visible, (open) => {
    if (!open) return
    ensureAssetListLoaded()
  })

  watch(() => assetStore.stale, (isStale) => {
    if (isStale && visible.value && viewMode.value === 'assets') assetStore.refreshIfStale()
  })

  return {
    assetStore,
    assetColWidth,
    assetColCount,
    assetColumns,
    canvasAssetGroups,
    canvasAssetTotal,
    assetPanelBodyRef,
    viewMode,
    canvasDisplayMode,
    canvasResultOnly,
    canvasTypeFilter,
    assetTypeFilter,
    favoriteOnly,
    workflowOnly,
    setViewMode,
    setCanvasDisplayMode,
    setCanvasResultOnly,
    setCanvasTypeFilter,
    setAssetTypeFilter,
    onAssetsScroll,
    onAssetsWheel,
  }
}
