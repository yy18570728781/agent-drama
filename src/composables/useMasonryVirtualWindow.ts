import { computed, type ComputedRef, type Ref } from 'vue'

export interface MasonryVirtualItem {
  group: any[]
  top?: number
  height?: number
}

export interface MasonryVirtualDateGroup {
  dateLabel: string
  count: number
  columns: MasonryVirtualItem[][]
}

export interface MasonryVirtualColumnWindow {
  key: string
  topSpacer: number
  bottomSpacer: number
  items: MasonryVirtualItem[]
}

export interface MasonryVirtualGroupWindow {
  dateGroup: MasonryVirtualDateGroup
  columns: MasonryVirtualColumnWindow[]
}

export interface UseMasonryVirtualWindowReturn {
  virtualGroups: ComputedRef<MasonryVirtualGroupWindow[]>
}

const VIRTUAL_BUFFER = 900
const GROUP_HEADER_HEIGHT = 30

/**
 * Builds per-column virtual windows for masonry groups.
 *
 * @param dateGroups grouped masonry data with item top/height metadata
 * @param showDateGroups whether date headers contribute to group offsets
 * @param scrollTop current scroll offset of the outer result container
 * @param viewportHeight current viewport height of the outer result container
 * @returns virtual group windows with spacer heights and visible items
 */
export function useMasonryVirtualWindow(params: {
  dateGroups: Ref<MasonryVirtualDateGroup[]>
  showDateGroups: Ref<boolean>
  scrollTop: Ref<number>
  viewportHeight: Ref<number>
}): UseMasonryVirtualWindowReturn {
  const groupHeights = computed(() => params.dateGroups.value.map(getGroupHeight))

  const groupOffsets = computed(() => {
    let nextOffset = 0
    return groupHeights.value.map((height) => {
      const currentOffset = nextOffset
      nextOffset += height + (params.showDateGroups.value ? GROUP_HEADER_HEIGHT : 0)
      return currentOffset
    })
  })

  const virtualGroups = computed(() => {
    return params.dateGroups.value.map((dateGroup, groupIndex) => {
      const min = params.scrollTop.value - groupOffsets.value[groupIndex] - VIRTUAL_BUFFER
      const max = params.scrollTop.value - groupOffsets.value[groupIndex] + params.viewportHeight.value + VIRTUAL_BUFFER
      const groupHeight = groupHeights.value[groupIndex] || 0
      const columns = dateGroup.columns.map((col, columnIndex) => {
        const window = getColumnWindow(col, groupHeight, min, max)
        return {
          key: `${dateGroup.dateLabel || groupIndex}-${columnIndex}`,
          ...window,
        }
      })
      return { dateGroup, columns }
    })
  })

  return { virtualGroups }
}

function getGroupHeight(dateGroup: MasonryVirtualDateGroup): number {
  let maxHeight = 0
  for (const col of dateGroup.columns) {
    for (const item of col) {
      maxHeight = Math.max(maxHeight, getItemBottom(item))
    }
  }
  return maxHeight
}

function getColumnWindow(
  col: MasonryVirtualItem[],
  groupHeight: number,
  min: number,
  max: number,
): Omit<MasonryVirtualColumnWindow, 'key'> {
  const firstIndex = col.findIndex(item => getItemBottom(item) >= min)
  if (firstIndex < 0) {
    return { topSpacer: groupHeight, bottomSpacer: 0, items: [] }
  }

  let lastIndex = firstIndex
  while (lastIndex + 1 < col.length && getItemTop(col[lastIndex + 1]) <= max) {
    lastIndex += 1
  }

  const items = col.slice(firstIndex, lastIndex + 1)
  const firstItem = items[0]
  const lastItem = items[items.length - 1]

  return {
    topSpacer: Math.max(0, getItemTop(firstItem)),
    bottomSpacer: Math.max(0, groupHeight - getItemBottom(lastItem)),
    items,
  }
}

function getItemTop(item: MasonryVirtualItem): number {
  return Number(item.top || 0)
}

function getItemBottom(item: MasonryVirtualItem): number {
  return getItemTop(item) + Number(item.height || 0)
}
