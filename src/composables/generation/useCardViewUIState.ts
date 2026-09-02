import { ref, computed, watch } from 'vue'
import { useAssetStore } from '@/stores/assets.store'
import { getStorage, setStorage } from '@/utils/storage'

export type DisplayMode = 'detailed-card' | 'compact-card' | 'table'

export function useCardViewUIState(params?: {
  scheduleLayoutUpdate?: () => void
}) {
  const assetStore = useAssetStore()
  const scheduleLayoutUpdate = params?.scheduleLayoutUpdate

  const SCALE_KEY_GEN = 'infinite_canvas_scale_generation'
  const RESULTS_UI_KEY = 'card_view_results_ui_v1'
  const SCALE_MIN = 0.2
  const SCALE_MAX = 0.8

  type PersistedResultsUiState = {
    displayMode: DisplayMode
    cardScale: number
    waterfallEnabled: boolean
    displayRatio: string
    displayFitMode: 'contain' | 'cover'
  }

  const parseResultsUiState = (): PersistedResultsUiState => {
    const fallback: PersistedResultsUiState = {
      displayMode: 'detailed-card',
      cardScale: 0.35,
      waterfallEnabled: true,
      displayRatio: '1:1',
      displayFitMode: 'contain',
    }
    try {
      const parsed = getStorage<Partial<PersistedResultsUiState>>(RESULTS_UI_KEY)
      if (!parsed) return fallback
      const displayMode = parsed?.displayMode
      const cardScale = Number(parsed?.cardScale)
      const waterfallEnabled = parsed?.waterfallEnabled
      const displayRatio = parsed?.displayRatio
      const displayFitMode = parsed?.displayFitMode
      return {
        displayMode: displayMode === 'compact-card' || displayMode === 'table' || displayMode === 'detailed-card'
          ? displayMode
          : fallback.displayMode,
        cardScale: Number.isFinite(cardScale)
          ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, cardScale))
          : fallback.cardScale,
        waterfallEnabled: typeof waterfallEnabled === 'boolean' ? waterfallEnabled : fallback.waterfallEnabled,
        displayRatio: typeof displayRatio === 'string' && /^\d+:\d+$/.test(displayRatio) ? displayRatio : fallback.displayRatio,
        displayFitMode: displayFitMode === 'cover' ? 'cover' : 'contain',
      }
    } catch {
      return fallback
    }
  }

  const initialResultsUiState = parseResultsUiState()
  const displayMode = ref<DisplayMode>(initialResultsUiState.displayMode)
  const recordScale = ref(initialResultsUiState.cardScale)
  const waterfallEnabled = ref(initialResultsUiState.waterfallEnabled)
  const displayRatio = ref(initialResultsUiState.displayRatio)
  const displayFitMode = ref<'contain' | 'cover'>(initialResultsUiState.displayFitMode)
  const showDateGroups = ref(true)
  const showScaleHint = ref(false)
  let scaleHintTimer: ReturnType<typeof setTimeout> | null = null

  const displayRatioValue = computed(() => {
    const [w, h] = String(displayRatio.value || '1:1').split(':').map(n => Number(n))
    if (!w || !h) return 1
    return w / h
  })

  const colWidth = computed(() => {
    return Math.round(220 + (recordScale.value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN) * (450 - 220))
  })

  const scalePercent = computed(() => Math.round(25 + (recordScale.value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN) * 75))

  watch([displayMode, recordScale, waterfallEnabled, displayRatio, displayFitMode], ([mode, scale, waterfall, ratio, fitMode]) => {
    setStorage(SCALE_KEY_GEN, String(scale))
    setStorage(RESULTS_UI_KEY, {
      displayMode: mode,
      cardScale: scale,
      waterfallEnabled: waterfall,
      displayRatio: ratio,
      displayFitMode: fitMode,
    })
  })

  // ── 筛选条件 ──
  const DEFAULT_GEN_TYPE = 'all'
  const filterConditions = ref({
    search: '',
    genType: DEFAULT_GEN_TYPE,
    timeFilter: 'all',
    startDate: '',
    endDate: '',
    favoriteOnly: false,
  })
  const showFailed = ref(false)

  const syncAssetStoreFilter = (filters: typeof filterConditions.value) => {
    assetStore.filter.type = filters.genType || DEFAULT_GEN_TYPE
    assetStore.filter.createdBy = ''
    assetStore.filter.search = filters.search || ''
    assetStore.filter.status = showFailed.value ? [2, 3] : 2
    assetStore.filter.createdAfter = ''
    assetStore.filter.createdBefore = ''
    assetStore.filter.favorite = filters.favoriteOnly
  }

  // ── 事件处理 ──
  const onFilterChange = (filters: any) => {
    if (filters.showDateGroups !== undefined) {
      showDateGroups.value = filters.showDateGroups
    }
    filterConditions.value = {
      search: filters.search || '',
      genType: filters.genType || DEFAULT_GEN_TYPE,
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      favoriteOnly: Boolean(filters.favoriteOnly),
    }
    syncAssetStoreFilter(filterConditions.value)
    assetStore.load()
  }

  const onShowFailedChange = (enabled: boolean) => {
    if (showFailed.value === enabled) return
    showFailed.value = enabled
    syncAssetStoreFilter(filterConditions.value)
    void assetStore.load()
  }

  const onRefreshAssets = async () => {
    syncAssetStoreFilter(filterConditions.value)
    await assetStore.load()
  }

  const onDisplayModeChange = (mode: DisplayMode) => {
    displayMode.value = mode
    if (mode === 'table') {
      showScaleHint.value = false
    }
  }

  const onWaterfallModeChange = (enabled: boolean) => {
    waterfallEnabled.value = enabled
  }

  const onDisplayRatioChange = (ratio: string) => {
    displayRatio.value = ratio
  }

  const onDisplayFitModeChange = (mode: 'contain' | 'cover') => {
    displayFitMode.value = mode
  }

  const onCtrlWheel = (e: WheelEvent) => {
    if (!e.ctrlKey || displayMode.value === 'table') return
    e.preventDefault()
    const step = 0.02
    const delta = e.deltaY > 0 ? -step : step
    recordScale.value = Math.min(SCALE_MAX, Math.max(SCALE_MIN, +(recordScale.value + delta).toFixed(2)))
    showScaleHint.value = true
    if (scaleHintTimer) clearTimeout(scaleHintTimer)
    scaleHintTimer = setTimeout(() => { showScaleHint.value = false }, 1000)
  }

  return {
    displayMode,
    recordScale,
    waterfallEnabled,
    displayRatio,
    displayFitMode,
    showDateGroups,
    showScaleHint,
    displayRatioValue,
    colWidth,
    scalePercent,
    filterConditions,
    showFailed,
    SCALE_MIN,
    SCALE_MAX,
    RESULTS_UI_KEY,
    DEFAULT_GEN_TYPE,
    parseResultsUiState,
    syncAssetStoreFilter,
    onFilterChange,
    onShowFailedChange,
    onRefreshAssets,
    onDisplayModeChange,
    onWaterfallModeChange,
    onDisplayRatioChange,
    onDisplayFitModeChange,
    onCtrlWheel,
  }
}
