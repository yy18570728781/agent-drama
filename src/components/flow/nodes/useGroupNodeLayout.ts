import { computed, onMounted, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { isCanvasViewportLayoutSuspended } from '@/composables/flow/useCanvasViewportMovement'
import { GRID_DEFAULT_GAP, inferGridShape } from '@/utils/gridGridLayout'

interface GroupNodeData {
  layoutMode?: string
  gridSplit?: { cols?: number; rows?: number; gap?: number }
  gridOrder?: string[]
}

interface FlowNodeLike {
  id: string
  parentNode?: string
  dimensions?: { width?: number; height?: number }
}

interface UseGroupNodeLayoutOptions {
  id: string
  data: GroupNodeData
  getNodes: Ref<FlowNodeLike[]>
  updateNodeData: (id: string, data: Record<string, unknown>) => void
  updateNodeInternals: (ids: string[]) => void
  layoutGridChildren?: ((id: string) => void) | null
  saveHistory?: (() => void) | null
}

interface UseGroupNodeLayoutReturn {
  isGridMode: ComputedRef<boolean>
  gridCols: ComputedRef<number>
  incCols: () => void
  decCols: () => void
}

function ensureGridMetadata(options: UseGroupNodeLayoutOptions): void {
  if (!options.data.layoutMode) options.data.layoutMode = 'grid'
  if (options.data.layoutMode !== 'grid') return
  const children = options.getNodes.value.filter(node => node.parentNode === options.id)
  if (!options.data.gridSplit || typeof options.data.gridSplit.cols !== 'number') {
    const shape = inferGridShape(children.length)
    options.data.gridSplit = { cols: shape.cols, rows: shape.rows, gap: GRID_DEFAULT_GAP }
    options.updateNodeData(options.id, { gridSplit: options.data.gridSplit })
  }
  if (!Array.isArray(options.data.gridOrder) || !options.data.gridOrder.length) {
    options.data.gridOrder = children.map(node => node.id)
    options.updateNodeData(options.id, { gridOrder: options.data.gridOrder })
  }
}

/**
 * 管理分组节点的网格元数据和自动排版；显式 free 分组保持手动位置。
 * @param options 分组节点及 Vue Flow 布局依赖
 * @returns 网格状态与列数调整方法
 */
export function useGroupNodeLayout(options: UseGroupNodeLayoutOptions): UseGroupNodeLayoutReturn {
  const isGridMode = computed(() => options.data.layoutMode === 'grid')
  const gridCols = computed(() => Math.max(Number(options.data.gridSplit?.cols || 0), 1))
  const childDimensionsSignature = computed(() => {
    if (!isGridMode.value) return ''
    return options.getNodes.value
      .filter(node => node.parentNode === options.id)
      .map(node => `${node.id}:${Math.round(node.dimensions?.width || 0)}x${Math.round(node.dimensions?.height || 0)}`)
      .join('|')
  })

  function patchGridSplit(cols: number): void {
    options.updateNodeData(options.id, { gridSplit: { ...(options.data.gridSplit || {}), cols } })
    options.saveHistory?.()
  }

  function incCols(): void {
    patchGridSplit(gridCols.value + 1)
  }

  function decCols(): void {
    const next = Math.max(gridCols.value - 1, 1)
    if (next !== gridCols.value) patchGridSplit(next)
  }

  onMounted(() => {
    if (!isCanvasViewportLayoutSuspended.value) ensureGridMetadata(options)
  })
  watch(
    () => [options.data.layoutMode, options.data.gridSplit, options.data.gridOrder, childDimensionsSignature.value],
    () => {
      if (
        isCanvasViewportLayoutSuspended.value
        || !isGridMode.value
        || !options.layoutGridChildren
      ) return
      options.layoutGridChildren(options.id)
      const childIds = options.getNodes.value.filter(node => node.parentNode === options.id).map(node => node.id)
      if (childIds.length) options.updateNodeInternals(childIds)
    },
    { deep: true, flush: 'post' },
  )

  return { isGridMode, gridCols, incCols, decCols }
}
