import type { AssetItem, AssetUrlObject } from '@/api/assets'
import type { MasonryVirtualDateGroup } from '@/composables/useMasonryVirtualWindow'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { computed, nextTick, onUnmounted, shallowRef, watch } from 'vue'
import { getMediaUrlMetrics } from '@/utils/mediaMetrics'

interface UseCardViewMasonryPreparationOptions {
  assets: Ref<AssetItem[]>
  aspectRatioCache: ShallowRef<Map<string, number>>
  dateGroups: Ref<MasonryVirtualDateGroup[]>
  enabled: ComputedRef<boolean>
  getFallbackRatio: (asset: AssetItem) => number
}

interface UseCardViewMasonryPreparationReturn {
  dateGroups: ShallowRef<MasonryVirtualDateGroup[]>
  isInitialPreparing: ComputedRef<boolean>
}

const MEDIA_METRICS_CONCURRENCY = 6
const MASONRY_PREPARATION_TIMEOUT_MS = 8_000

function resolveUrl(raw: string | AssetUrlObject | null | undefined): string {
  if (typeof raw === 'string') return raw.trim()
  return String(raw?.origin_url || raw?.proxy_url || '').trim()
}

function getDirectRatio(asset: AssetItem): number | null {
  const width = Number(asset.width)
  const height = Number(asset.height)
  return width > 0 && height > 0 ? width / height : null
}

function getMediaSource(asset: AssetItem): { type: string; url: string } | null {
  const type = String(asset.type || 'image').toLowerCase()
  const url = type === 'video'
    ? resolveUrl(asset.url)
    : resolveUrl(asset.thumbnail_url) || resolveUrl(asset.url)
  if (!url) return null
  return { type: type === 'video' ? 'video' : 'image', url }
}

async function getAssetMediaRatio(asset: AssetItem): Promise<number | null> {
  const source = getMediaSource(asset)
  if (!source) return null
  try {
    const metrics = await getMediaUrlMetrics(source.url, source.type)
    return metrics?.aspectRatio ?? null
  } catch {
    return null
  }
}

async function fillMissingRatios(
  assets: AssetItem[],
  ratios: Map<string, number>,
): Promise<void> {
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex]
      nextIndex += 1
      const id = String(asset.id)
      const ratio = await getAssetMediaRatio(asset)
      if (ratio && ratio > 0) ratios.set(id, ratio)
    }
  }
  const workerCount = Math.min(MEDIA_METRICS_CONCURRENCY, assets.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

async function loadAvailableRatios(assets: AssetItem[]): Promise<Map<string, number>> {
  const loadedRatios = new Map<string, number>()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, MASONRY_PREPARATION_TIMEOUT_MS)
  })
  await Promise.race([fillMissingRatios(assets, loadedRatios), timeout])
  if (timeoutId) clearTimeout(timeoutId)
  return loadedRatios
}

async function prepareRatioMap(
  assets: AssetItem[],
  current: Map<string, number>,
  getFallbackRatio: (asset: AssetItem) => number,
): Promise<Map<string, number>> {
  const ratios = new Map(current)
  const missing: AssetItem[] = []
  for (const asset of assets) {
    const id = String(asset.id)
    if (ratios.has(id)) continue
    const directRatio = getDirectRatio(asset)
    if (directRatio) ratios.set(id, directRatio)
    else {
      ratios.set(id, getFallbackRatio(asset))
      missing.push(asset)
    }
  }
  const loadedRatios = await loadAvailableRatios(missing)
  loadedRatios.forEach((ratio, id) => ratios.set(id, ratio))
  return ratios
}

/**
 * 在瀑布流渲染前批量准备媒体比例，并保留上一版布局直到新比例全部就绪。
 * @param options 卡片资产、比例缓存、待展示分组和瀑布流开关。
 * @returns 可安全渲染的分组快照与首次准备状态。
 */
export function useCardViewMasonryPreparation(
  options: UseCardViewMasonryPreparationOptions,
): UseCardViewMasonryPreparationReturn {
  const dateGroups = shallowRef<MasonryVirtualDateGroup[]>([])
  const isPreparing = shallowRef(false)
  const isInitialPreparing = computed(() => isPreparing.value && dateGroups.value.length === 0)
  let version = 0

  async function prepare(): Promise<void> {
    const currentVersion = ++version
    if (!options.enabled.value) {
      isPreparing.value = false
      await nextTick()
      if (currentVersion !== version) return
      dateGroups.value = options.dateGroups.value
      return
    }
    isPreparing.value = true
    const assets = [...options.assets.value]
    const ratios = await prepareRatioMap(
      assets,
      options.aspectRatioCache.value,
      options.getFallbackRatio,
    )
    if (currentVersion !== version) return
    options.aspectRatioCache.value = ratios
    await nextTick()
    if (currentVersion !== version) return
    dateGroups.value = options.dateGroups.value
    isPreparing.value = false
  }

  watch([options.assets, options.enabled], () => {
    void prepare()
  }, { immediate: true, flush: 'sync' })

  watch(options.dateGroups, (groups) => {
    if (!isPreparing.value) dateGroups.value = groups
  })

  onUnmounted(() => {
    version += 1
  })

  return { dateGroups, isInitialPreparing }
}
