import { computed, type ComputedRef, type Ref } from 'vue'
import type { AssetItem } from '@/api/assets'

export interface AssetMasonryGroup {
  columns: AssetItem[][]
  count: number
  key: string
  label: string
}

interface AssetMasonryLayoutOptions {
  colWidth: ComputedRef<number>
  containerWidth: Ref<number>
  gap: number
  items: ComputedRef<AssetItem[]>
}

interface AssetMasonryLayoutReturn {
  groups: ComputedRef<AssetMasonryGroup[]>
}

function formatDateKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diffDays = Math.round((todayStart - date.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return dateKey
}

function getHeightRatio(item: AssetItem): number {
  const serverRatio = Number(item.aspect_ratio)
  if (serverRatio > 0) return serverRatio
  const width = Number(item.width)
  const height = Number(item.height)
  return width > 0 && height > 0 ? height / width : 1.25
}

function groupItems(items: AssetItem[]): Array<{ key: string; items: AssetItem[] }> {
  const groups: Array<{ key: string; items: AssetItem[] }> = []
  for (const item of items) {
    const key = formatDateKey(item.created_at)
    const current = groups[groups.length - 1]
    if (current?.key === key) current.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

/**
 * 计算按日期分组的瀑布流列，不再为未知尺寸资源主动预加载图片。
 * @param options 布局所需的资产和容器尺寸。
 * @returns 响应式瀑布流分组。
 */
export function useAssetMasonryLayout(options: AssetMasonryLayoutOptions): AssetMasonryLayoutReturn {
  const groups = computed(() => {
    const columnCount = Math.max(
      1,
      Math.floor((options.containerWidth.value + options.gap) / (options.colWidth.value + options.gap)),
    )
    const columnWidth = Math.max(
      1,
      (options.containerWidth.value - options.gap * (columnCount - 1)) / columnCount,
    )
    return groupItems(options.items.value).map((group) => {
      const heights = Array<number>(columnCount).fill(0)
      const columns = Array.from({ length: columnCount }, () => [] as AssetItem[])
      group.items.forEach((item) => {
        const columnIndex = heights.indexOf(Math.min(...heights))
        columns[columnIndex].push(item)
        heights[columnIndex] += columnWidth * getHeightRatio(item) + options.gap
      })
      return {
        columns,
        count: group.items.length,
        key: group.key,
        label: formatDateLabel(group.key),
      }
    })
  })

  return { groups }
}
