import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { Position } from '@vue-flow/core'
import { getConnectionEdgePath } from '@/components/flow/edges/flowEdgePaths'
import { GROUP_AGGREGATE_SOURCE_HANDLE, GROUP_EXPANDED_SOURCE_HANDLE } from '@/composables/flow/groupConnection.constants'

// ==================== 依赖接口 ====================

export interface UseMultiSelectionConnectionDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  getSelectedNodes: any
  isConnecting: Ref<boolean>
  emit: {
    (e: string, ...args: any[]): void
  }
  viewport: Ref<any>
  edgeStyle: Ref<string>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  connectionStartHandle: Ref<{ nodeId: string; handleId: string; handleType: string } | null>
  sourceConnectionNodeIds: Ref<string[]>
  sourceConnectionMode: Ref<string>
  multiSelectionPointer: Ref<{ x: number; y: number } | null>
  groupConnectionPointer: Ref<{ x: number; y: number } | null>
  getGroupConnectorAnchorPoint: (nodeId: string) => { x: number; y: number } | null
  getCurrentMultiSelectionSourceIds: () => string[]
  clearMultiSelectionConnection: () => void
  clearSourceConnectionHighlight: () => void
  setSourceConnectionHighlight: (ids: string[], mode: string) => void
}

// ==================== 常量 ====================

const MULTI_SELECTION_NODE_ID = '__multi_selection__'
const CONNECTION_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 30 30'%3E%3Ccircle cx='15' cy='15' r='8.5' fill='none' stroke='rgba(129,140,248,0.42)' stroke-width='1.5'/%3E%3Cpath d='M15 9.5v11M9.5 15h11' stroke='%23818cf8' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='15' cy='15' r='2.5' fill='%2338bdf8' fill-opacity='0.95'/%3E%3C/svg%3E") 24 24, crosshair`

// ==================== 内部工具函数 ====================

function getNodeVisualWidth(node: any): number {
  const width = node?.dimensions?.width
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return width
  const styleWidth = parseFloat(String(node?.style?.width || ''))
  return Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : 320
}

function getNodeVisualHeight(node: any): number {
  const height = node?.dimensions?.height
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) return height
  const styleHeight = parseFloat(String(node?.style?.height || ''))
  return Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : 180
}

// ==================== 组合式函数 ====================

export function useMultiSelectionConnection(deps: UseMultiSelectionConnectionDeps) {
  const {
    getSelectedNodes,
    isConnecting,
    findNode,
    viewport,
    edgeStyle,
    flowCanvasWrapperRef,
    connectionStartHandle,
    sourceConnectionNodeIds,
    sourceConnectionMode,
    multiSelectionPointer,
    groupConnectionPointer,
    getGroupConnectorAnchorPoint,
    getCurrentMultiSelectionSourceIds,
    clearMultiSelectionConnection,
    clearSourceConnectionHighlight,
    setSourceConnectionHighlight,
  } = deps

  // ── 状态 ─────────────────────────────────────────────────────

  const multiSelectionConnectorHandleRef = ref<{ connectorHandleRef: HTMLElement | null } | null>(null)
  const selectedNodes = computed(() => getSelectedNodes.value)

  // ── 选区边界 ─────────────────────────────────────────────────

  const multiSelectionBounds = computed(() => {
    if (selectedNodes.value.length < 2) return null
    const candidates = selectedNodes.value.filter((node: any) => node?.type !== 'groupNode')
    if (candidates.length < 2) return null

    const bounds = candidates.map((node: any) => {
      const x = node.computedPosition?.x ?? node.position?.x ?? 0
      const y = node.computedPosition?.y ?? node.position?.y ?? 0
      const width = getNodeVisualWidth(node)
      const height = getNodeVisualHeight(node)
      return { x, y, width, height, right: x + width, bottom: y + height }
    })

    const maxRight = Math.max(...bounds.map((item: any) => item.right))
    const minTop = Math.min(...bounds.map((item: any) => item.y))
    const maxBottom = Math.max(...bounds.map((item: any) => item.bottom))

    return { maxRight, minTop, maxBottom, centerY: (minTop + maxBottom) / 2 }
  })

  const multiSelectionHotspotStyle = computed(() => {
    if (!multiSelectionBounds.value) return null
    const { maxRight, centerY } = multiSelectionBounds.value

    return {
      left: `${maxRight * viewport.value.zoom + viewport.value.x + 2}px`,
      top: `${centerY * viewport.value.zoom + viewport.value.y}px`,
      width: '72px',
      height: '44px',
      cursor: CONNECTION_CURSOR,
    }
  })

  // 工具栏锚定在 hotspot 上方：左对齐 hotspot 左边缘，底部避让动作工具条（收藏/对比/删除）
  // hotspot 上方还有 multi-selection-action-toolbar（~32px 高 + 8px 间隙），需要再让出 ~40px
  const multiSelectionToolbarStyle = computed(() => {
    if (!multiSelectionBounds.value) return null
    const { maxRight, centerY } = multiSelectionBounds.value
    const zoom = viewport.value.zoom
    // hotspot 屏幕坐标：left = maxRight*zoom + vx + 2, width = 72, top = centerY*zoom + vy (translateY -50%, 即垂直中心)
    // hotspot 视觉顶部 = centerY*zoom + vy - 22
    const hotspotLeftX = maxRight * zoom + viewport.value.x + 2
    const hotspotTopY = centerY * zoom + viewport.value.y - 22
    // 动作工具条高度约 32px + 8px 间隙
    const ACTION_TOOLBAR_RESERVED = 40

    return {
      left: `${hotspotLeftX}px`,
      top: `${hotspotTopY - ACTION_TOOLBAR_RESERVED - 8}px`,
      transform: 'translateY(-100%)',
    }
  })

  const multiSelectionConnectorStyle = computed(() => {
    return {
      left: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
    }
  })

  // ── 连接锚点 ─────────────────────────────────────────────────

  const multiSelectionConnectorAnchor = computed(() => {
    const handleEl = multiSelectionConnectorHandleRef.value?.connectorHandleRef
    const wrapper = flowCanvasWrapperRef.value
    const handleRect = handleEl?.getBoundingClientRect?.()
    const wrapperRect = wrapper?.getBoundingClientRect?.()
    if (!handleRect || !wrapperRect) return null
    return {
      x: handleRect.left - wrapperRect.left + handleRect.width / 2,
      y: handleRect.top - wrapperRect.top + handleRect.height / 2,
    }
  })

  // ── 拖拽连线 ─────────────────────────────────────────────────

  const connectionDragLine = computed(() => {
    if (!isConnecting.value) return null
    const startNodeId = connectionStartHandle.value?.nodeId
    const isMultiSelectionStart = startNodeId === MULTI_SELECTION_NODE_ID
    const startNode = startNodeId ? findNode(startNodeId) : null
    const groupHandleId = String(connectionStartHandle.value?.handleId || '')
    const isGroupConnectorStart = startNode?.type === 'groupNode'
      && (groupHandleId === GROUP_EXPANDED_SOURCE_HANDLE || groupHandleId === GROUP_AGGREGATE_SOURCE_HANDLE)
    if (!isMultiSelectionStart && !isGroupConnectorStart) return null
    const anchor = isMultiSelectionStart ? multiSelectionConnectorAnchor.value : getGroupConnectorAnchorPoint(startNodeId!)
    const pointer = isMultiSelectionStart ? multiSelectionPointer.value : groupConnectionPointer.value
    if (!anchor || !pointer) return null
    const edgeParams = {
      sourceX: anchor.x,
      sourceY: anchor.y,
      sourcePosition: Position.Right,
      targetX: pointer.x,
      targetY: pointer.y,
      targetPosition: Position.Left,
    }

    return getConnectionEdgePath(
      edgeStyle.value,
      edgeParams.sourceX,
      edgeParams.sourceY,
      edgeParams.targetX,
      edgeParams.targetY,
      edgeParams.sourcePosition,
      edgeParams.targetPosition,
    )
  })

  // ── 响应选区变化 ─────────────────────────────────────────────

  watch(
    () => selectedNodes.value.map((node: any) => node.id).join('|'),
    () => {
      if (selectedNodes.value.length < 2) {
        clearMultiSelectionConnection()
      }
    }
  )

  // ── 工具函数 ─────────────────────────────────────────────────

  function updateNodeClassToken(nodeId: string, token: string, enabled: boolean) {
    const node = findNode(nodeId)
    if (!node) return
    const tokens = new Set(String(node.class || '').split(/\s+/).filter(Boolean))
    if (enabled) tokens.add(token)
    else tokens.delete(token)
    node.class = Array.from(tokens).join(' ')
  }

  function handleMultiSelectionIntentEnter() {
    if (isConnecting.value) return
    setSourceConnectionHighlight(getCurrentMultiSelectionSourceIds(), 'multi')
  }

  function handleMultiSelectionIntentLeave() {
    if (isConnecting.value || sourceConnectionMode.value !== 'multi') return
    clearSourceConnectionHighlight()
  }

  // ── 导出 ─────────────────────────────────────────────────────

  return {
    multiSelectionConnectorHandleRef,
    sourceConnectionNodeIds,
    sourceConnectionMode,
    selectedNodes,
    multiSelectionBounds,
    multiSelectionHotspotStyle,
    multiSelectionToolbarStyle,
    multiSelectionConnectorStyle,
    multiSelectionConnectorAnchor,
    multiSelectionPointer,
    groupConnectionPointer,
    connectionDragLine,
    updateNodeClassToken,
    handleMultiSelectionIntentEnter,
    handleMultiSelectionIntentLeave,
  }
}
