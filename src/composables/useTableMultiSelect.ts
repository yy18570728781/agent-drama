/**
 * 表格多选逻辑 — 支持 单击 / Ctrl+点击 / Shift+范围 / 拖拽选区
 */
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface UseTableMultiSelectReturn<T> {
  selectedIds: Ref<Set<number>>
  selectedItems: ComputedRef<T[]>
  anchorIndex: Ref<number | null>
  isSelected: (id: number) => boolean
  selectSingle: (item: T) => void
  toggleOne: (item: T) => void
  selectRange: (from: number, to: number, data: readonly T[]) => void
  clearSelection: () => void
}

export function useTableMultiSelect<T extends { owner_id: number }>(
  data: ComputedRef<T[]> | Ref<T[]>,
): UseTableMultiSelectReturn<T> {
  const selectedIds = ref<Set<number>>(new Set())
  const anchorIndex = ref<number | null>(null)

  const dataSource = data as Ref<T[]>
  const selectedItems = computed(() =>
    dataSource.value.filter((item: T) => selectedIds.value.has(item.owner_id)),
  )

  function isSelected(id: number): boolean {
    return selectedIds.value.has(id)
  }

  function selectSingle(item: T): void {
    selectedIds.value = new Set([item.owner_id])
  }

  function toggleOne(item: T): void {
    const next = new Set(selectedIds.value)
    if (next.has(item.owner_id)) {
      next.delete(item.owner_id)
    } else {
      next.add(item.owner_id)
    }
    selectedIds.value = next
  }

  function selectRange(from: number, to: number, data: readonly T[]): void {
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const next = new Set(selectedIds.value)
    for (let i = start; i <= end; i++) {
      if (data[i]) next.add(data[i].owner_id)
    }
    selectedIds.value = next
  }

  function clearSelection(): void {
    selectedIds.value = new Set()
    anchorIndex.value = null
  }

  return {
    selectedIds,
    selectedItems,
    anchorIndex,
    isSelected,
    selectSingle,
    toggleOne,
    selectRange,
    clearSelection,
  }
}
