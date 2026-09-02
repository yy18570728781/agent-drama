import { ref, shallowRef, nextTick } from 'vue'
import { useAssetStore } from '@/stores/assets.store'

let lastKnownContainerInnerWidth = 0
const LOAD_MORE_DISTANCE_PX = 80
const VIEWPORT_FILL_TOLERANCE_PX = 24

export function useCardViewLayout() {
  const assetStore = useAssetStore()

  const containerRef = ref<HTMLElement | null>(null)
  const containerInnerWidth = ref(lastKnownContainerInnerWidth)
  const scrollTop = ref(0)
  const viewportHeight = ref(0)
  const aspectRatioCache = shallowRef<Map<string, number>>(new Map())
  const triggerLayoutUpdate = ref(0)

  let resizeObserver: ResizeObserver | null = null
  let resizeTimer: any = null
  let updateTimer: any = null
  let scrollTimer: any = null
  let scrollMetricsRaf: number | null = null
  let isLoadingOlder = false

  function updateContainerWidth() {
    if (containerRef.value) {
      const nextWidth = Math.max(0, containerRef.value.clientWidth - 32)
      if (nextWidth > 0) {
        lastKnownContainerInnerWidth = nextWidth
        containerInnerWidth.value = nextWidth
      }
    }
  }

  function updateScrollMetrics() {
    if (scrollMetricsRaf !== null) return
    scrollMetricsRaf = requestAnimationFrame(() => {
      scrollMetricsRaf = null
      syncScrollMetrics()
    })
  }

  function syncScrollMetrics() {
    if (!containerRef.value) return
    scrollTop.value = containerRef.value.scrollTop
    viewportHeight.value = containerRef.value.clientHeight
  }

  function scheduleLayoutUpdate() {
    if (isLoadingOlder) return
    if (updateTimer) clearTimeout(updateTimer)
    updateTimer = setTimeout(() => {
      triggerLayoutUpdate.value++
    }, 300)
  }

  function preloadImage(url: string, id: string) {
    if (aspectRatioCache.value.has(id)) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        aspectRatioCache.value = new Map(aspectRatioCache.value).set(id, img.naturalWidth / img.naturalHeight)
        scheduleLayoutUpdate()
      }
    }
    img.src = url
  }

  function onMediaLoaded(dims: { width: number; height: number }, id: string | number) {
    const assetId = String(id)
    if (aspectRatioCache.value.has(assetId)) return
    if (dims.width && dims.height) {
      aspectRatioCache.value = new Map(aspectRatioCache.value).set(assetId, dims.width / dims.height)
      scheduleLayoutUpdate()
    }
  }

  async function loadOlderNearBottom(): Promise<void> {
    if (!containerRef.value) return
    const { scrollTop: st, scrollHeight, clientHeight: ch } = containerRef.value
    const distanceFromBottom = scrollHeight - st - ch
    if (distanceFromBottom > LOAD_MORE_DISTANCE_PX) return
    if (!assetStore.hasMore || assetStore.loadingMore || isLoadingOlder) return
    isLoadingOlder = true
    try {
      await assetStore.loadOlder()
    } finally {
      isLoadingOlder = false
    }
  }

  function onScroll(): void {
    updateScrollMetrics()
    if (scrollTimer) return
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      void loadOlderNearBottom()
    }, 50)
  }

  async function checkLoadMore(): Promise<void> {
    if (!containerRef.value) return
    const { scrollHeight, clientHeight } = containerRef.value
    if (scrollHeight <= clientHeight + VIEWPORT_FILL_TOLERANCE_PX && assetStore.hasMore && !assetStore.loadingMore) {
      await assetStore.loadOlder()
      await nextTick()
      await checkLoadMore()
    }
  }

  const loadAll = async () => {
    while (assetStore.hasMore && !assetStore.loadingMore) {
      await assetStore.loadOlder()
    }
  }

  function setupResizeObserver(): void {
    if (containerRef.value) {
      updateContainerWidth()
      syncScrollMetrics()
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          updateContainerWidth()
          updateScrollMetrics()
        }, 150)
      })
      resizeObserver.observe(containerRef.value)
    }
  }

  function teardownResizeObserver(): void {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (scrollMetricsRaf !== null) {
      cancelAnimationFrame(scrollMetricsRaf)
      scrollMetricsRaf = null
    }
    if (resizeTimer) clearTimeout(resizeTimer)
    if (scrollTimer) clearTimeout(scrollTimer)
    resizeTimer = null
    scrollTimer = null
  }

  function setContainer(element: HTMLElement | null): void {
    const previous = containerRef.value
    if (previous === element) return
    previous?.removeEventListener('scroll', onScroll)
    teardownResizeObserver()
    containerRef.value = element
    if (!element) return
    element.addEventListener('scroll', onScroll, { passive: true })
    setupResizeObserver()
  }

  return {
    containerRef,
    containerInnerWidth,
    scrollTop,
    viewportHeight,
    aspectRatioCache,
    triggerLayoutUpdate,
    updateContainerWidth,
    scheduleLayoutUpdate,
    preloadImage,
    onMediaLoaded,
    checkLoadMore,
    loadAll,
    setContainer,
    isLoadingOlder: () => isLoadingOlder,
  }
}
