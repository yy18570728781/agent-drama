import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export interface LocationMarkerItem {
  id: string
  label: string
  x: number
  y: number
}

export interface UseLocationMarkerNavigatorDeps {
  nodes: Ref<any[]>
  setCenter: (x: number, y: number, options?: any) => void
  getZoom: () => number
}

export interface UseLocationMarkerNavigatorReturn {
  locationMarkerItems: ComputedRef<LocationMarkerItem[]>
  locationMarkerNavigatorVisible: Ref<boolean>
  activeLocationMarkerIndex: Ref<number>
  closeLocationMarkerNavigator: () => void
  focusLocationMarkerById: (id: string) => void
  focusSingleOrOpenLocationMarkerNavigator: () => 'empty' | 'single' | 'list'
  moveActiveLocationMarker: (delta: number) => void
  confirmActiveLocationMarker: () => void
  selectLocationMarker: (index: number) => void
  setActiveLocationMarker: (index: number) => void
}

function buildLocationMarkerLabel(node: any, index: number): string {
  const raw = String(node?.data?.label || '').trim()
  return raw || `位置标记 ${index + 1}`
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  if (index < 0) return length - 1
  if (index >= length) return 0
  return index
}

export function useLocationMarkerNavigator(
  deps: UseLocationMarkerNavigatorDeps,
): UseLocationMarkerNavigatorReturn {
  const locationMarkerNavigatorVisible = ref(false)
  const activeLocationMarkerIndex = ref(0)

  const locationMarkerItems = computed<LocationMarkerItem[]>(() =>
    deps.nodes.value
      .filter((node) => node?.type === 'location_marker')
      .map((node, index) => ({
        id: String(node.id || ''),
        label: buildLocationMarkerLabel(node, index),
        x: Number(node?.position?.x || 0),
        y: Number(node?.position?.y || 0),
      })),
  )

  function closeLocationMarkerNavigator(): void {
    locationMarkerNavigatorVisible.value = false
  }

  function focusLocationMarkerById(id: string): void {
    if (!id) return
    const node = deps.nodes.value.find((n) => n.id === id)
    if (!node) return
    const x = Number(node.position?.x || 0)
    const y = Number(node.position?.y || 0)
    const zoom = deps.getZoom()
    deps.setCenter(x, y, { zoom, duration: 220 })
  }

  function setActiveLocationMarker(index: number): void {
    const items = locationMarkerItems.value
    activeLocationMarkerIndex.value = clampIndex(index, items.length)
  }

  function focusSingleOrOpenLocationMarkerNavigator(): 'empty' | 'single' | 'list' {
    const items = locationMarkerItems.value
    if (items.length <= 0) return 'empty'
    if (items.length === 1) {
      focusLocationMarkerById(items[0].id)
      return 'single'
    }
    setActiveLocationMarker(0)
    locationMarkerNavigatorVisible.value = true
    return 'list'
  }

  function moveActiveLocationMarker(delta: number): void {
    const items = locationMarkerItems.value
    if (items.length <= 0) return
    setActiveLocationMarker(activeLocationMarkerIndex.value + delta)
    const active = items[activeLocationMarkerIndex.value]
    if (active) focusLocationMarkerById(active.id)
  }

  function confirmActiveLocationMarker(): void {
    const active = locationMarkerItems.value[activeLocationMarkerIndex.value]
    if (!active) return
    focusLocationMarkerById(active.id)
    closeLocationMarkerNavigator()
  }

  function selectLocationMarker(index: number): void {
    setActiveLocationMarker(index)
    confirmActiveLocationMarker()
  }

  return {
    locationMarkerItems,
    locationMarkerNavigatorVisible,
    activeLocationMarkerIndex,
    closeLocationMarkerNavigator,
    focusLocationMarkerById,
    focusSingleOrOpenLocationMarkerNavigator,
    moveActiveLocationMarker,
    confirmActiveLocationMarker,
    selectLocationMarker,
    setActiveLocationMarker,
  }
}
