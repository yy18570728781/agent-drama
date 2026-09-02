import { ref, computed, nextTick, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isUploadLikeFileInputNode } from './flowReferenceNodes'
import { useWindowPointerListeners } from './useWindowPointerListeners'
import { GROUP_AGGREGATE_SOURCE_HANDLE, GROUP_EXPANDED_SOURCE_HANDLE } from '@/composables/flow/groupConnection.constants'

// ==================== 依赖接口 ====================

export interface FlowConnectionsDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
    (e: string, ...args: any[]): void
  }
  edgeStyle: Ref<string>
  updateNodeInternals: (ids: string[]) => void
  propagateDataFlow: () => void
  createRuntimeId: (prefix?: string) => string
  syncNodeEdgeHandles: (nodeId: string) => void
  getPrimaryPortId: (nodeData: any, direction: string) => string | undefined
  isValidFlowEdge: (edge: any) => boolean
  saveHistory: () => void
  vueFlowRef: Ref<any>
  viewport: Ref<any>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  getSelectedNodes: Ref<any[]>
  addEdges: (edges: any[]) => void
  project: (point: { x: number; y: number }) => { x: number; y: number }
  getNodeTypeDef: (type: string) => any
  applyPresetData: (node: any, item: any) => any
  buildBaseNodeRuntimeData: (opts: any) => any
  fixedSizeTypes: Record<string, any>
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  isEmptyGenerationSourceNode: (node: any) => boolean
  isLargeCanvasConnectionMode: Ref<boolean>
  syncTargetNodePrompt: (nodeId: string) => void
  revealManualGenerationPanel: (nodeId: string) => void
  isInteractionEffectsSuppressed: Ref<boolean>
  multiSelectionConnectorAnchor?: ComputedRef<{ x: number; y: number } | null>
  clientPointToCanvasPoint: (clientX: number, clientY: number) => { x: number; y: number }
}

// ==================== 常量 ====================

const MULTI_SELECTION_NODE_ID = '__multi_selection__'
const LOCKED_TARGET_CONNECT_MESSAGE = '已经存在生成结果的卡片禁止连接新的上游节点'

function isGroupExpandedHandle(handleId: string): boolean {
  return handleId === GROUP_EXPANDED_SOURCE_HANDLE
}

function isGroupAggregateHandle(handleId: string): boolean {
  return handleId === GROUP_AGGREGATE_SOURCE_HANDLE
}

type GroupConnectionMode = 'aggregate' | 'expanded'

// ==================== 模块级状态 ====================

const connectionPopup = ref({
  visible: false,
  x: 0,
  y: 0,
  sourceNodeId: '',
  sourceHandleId: '',
  sourceMode: 'single' as 'single' | 'multi' | 'group' | 'groupAggregate',
  sourceNodeIds: [] as string[],
})
const connectionStartHandle = ref<{ nodeId: string; handleId: string; handleType: string } | null>(null)
export const isConnecting = ref(false)
const sourceConnectionNodeIds = ref<string[]>([])
const sourceConnectionMode = ref('')
export const hoveredNodeId = ref<string | null>(null)
const multiSelectionPointer = ref<{ x: number; y: number } | null>(null)
const groupConnectionPointer = ref<{ x: number; y: number } | null>(null)
let pendingInvalidConnectionMessage = ''

// ==================== 组合式函数 ====================

export function useFlowConnections(deps: FlowConnectionsDeps) {
  const {
    nodes,
    edges,
    findNode,
    emit,
    edgeStyle,
    updateNodeInternals,
    propagateDataFlow,
    createRuntimeId,
    syncNodeEdgeHandles,
    getPrimaryPortId,
    isValidFlowEdge,
    saveHistory,
    vueFlowRef,
    viewport,
    flowCanvasWrapperRef,
    getSelectedNodes,
    addEdges,
    project,
    getNodeTypeDef,
    applyPresetData,
    buildBaseNodeRuntimeData,
    fixedSizeTypes,
    assignToGroupIfOverlapping,
    isEmptyGenerationSourceNode,
    isLargeCanvasConnectionMode,
    syncTargetNodePrompt,
    revealManualGenerationPanel,
    isInteractionEffectsSuppressed,
    multiSelectionConnectorAnchor = computed(() => null),
    clientPointToCanvasPoint,
  } = deps
  const multiSelectionPointerListeners = useWindowPointerListeners()
  const groupConnectionPointerListeners = useWindowPointerListeners()

  // ── Internal helpers ─────────────────────────────────────────

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

  function hasPath(startNodeId: string, targetNodeId: string, visited = new Set<string>()): boolean {
    if (startNodeId === targetNodeId) return true
    if (visited.has(startNodeId)) return false
    visited.add(startNodeId)
    const outEdges = edges.value.filter((e: any) => e.source === startNodeId)
    for (const edge of outEdges) {
      if (hasPath(edge.target, targetNodeId, visited)) return true
    }
    return false
  }

  function updateNodeClassToken(nodeId: string, token: string, enabled: boolean) {
    const node = findNode(nodeId)
    if (!node) return
    const tokens = new Set(String(node.class || '').split(/\s+/).filter(Boolean))
    if (enabled) tokens.add(token)
    else tokens.delete(token)
    node.class = Array.from(tokens).join(' ')
  }

  function dedupeSourceNodes(sourceNodes: any[] = []) {
    const normalizeSourceUrl = (value: string) => {
      const raw = String(value || '').trim()
      if (!raw) return ''
      try {
        return new URL(raw).toString()
      } catch {
        return raw
      }
    }

    const seenSourceKeys = new Set()
    const dedupedSourceNodes: any[] = []
    let duplicateSourceCount = 0

    sourceNodes.forEach((sourceNode: any) => {
      const sourceData = sourceNode?.data || {}
      const aigcKey = String(sourceData.recordId || '').trim()
      const urlKey = normalizeSourceUrl(
        sourceData.preview ||
        sourceData.imageUrl ||
        sourceData.videoUrl ||
        sourceData.audioUrl
      )
      const sourceKey = aigcKey ? `aigc:${aigcKey}` : urlKey ? `url:${urlKey}` : `node:${sourceNode.id}`

      if (seenSourceKeys.has(sourceKey)) {
        duplicateSourceCount += 1
        return
      }

      seenSourceKeys.add(sourceKey)
      dedupedSourceNodes.push(sourceNode)
    })

    return { dedupedSourceNodes, duplicateSourceCount }
  }

  function getDropTargetFromPoint(clientX: number, clientY: number): { nodeId: string; handleId: string | undefined; isTargetHandle: boolean } {
    if (typeof clientX !== 'number' || typeof clientY !== 'number' || typeof document === 'undefined') {
      return { nodeId: '', handleId: undefined, isTargetHandle: false }
    }
    const pointTarget = document.elementFromPoint(clientX, clientY)
    if (!(pointTarget instanceof Element)) {
      return { nodeId: '', handleId: undefined, isTargetHandle: false }
    }
    const handleEl = pointTarget.closest('.vue-flow__handle')
    const nodeEl = pointTarget.closest('.vue-flow__node')
    const nodeId = handleEl?.getAttribute?.('data-nodeid')
      || nodeEl?.getAttribute?.('data-id')
      || ''
    const handleId = handleEl?.getAttribute?.('data-handleid') || undefined
    const isTargetHandle = !!(handleEl && handleEl.classList.contains('target'))
    return { nodeId, handleId, isTargetHandle }
  }

  // ── Composed state ───────────────────────────────────────────

  // ── Public API ───────────────────────────────────────────────

  function getCurrentMultiSelectionSourceIds(): string[] {
    return getSelectedNodes.value
      .filter(node => node && node.type !== 'groupNode' && node.type !== 'waypoint' && !isEmptyGenerationSourceNode(node))
      .map(node => node.id)
  }

  // ── 1 ────────────────────────────────────────────────────────

  function getIncomingConnectionBlockMessage(sourceId: string, targetId: string): string {
    const targetNode = findNode(targetId)
    if (!targetNode) return ''
    const sourceNode = findNode(sourceId)
    const isSystemReferenceSource = isUploadLikeFileInputNode(sourceNode)
    if (isSystemReferenceSource) return ''
    const targetHasGenerationResult = !!targetNode.data?.recordId
    if (!targetHasGenerationResult) return ''
    return LOCKED_TARGET_CONNECT_MESSAGE
  }

  // ── 2 ────────────────────────────────────────────────────────

  function validateConnection(connection: { id?: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }, options: { deferGraphChecks?: boolean } = {}) {
    const { deferGraphChecks = false } = options
    if (!connection || !connection.source || !connection.target) return false
    if (connection.source === connection.target) return false
    if (deferGraphChecks) return true
    const sourceNode = findNode(connection.source)
    const targetNode = findNode(connection.target)
    if (!sourceNode || !targetNode) return false
    if (sourceNode.data?.disableOutputPorts || targetNode.data?.disableInputPorts) return false
    if (connection.sourceHandle) {
      const sourcePort = (sourceNode.data?.ports?.outputs || []).find((port: any) => port.id === connection.sourceHandle)
      if (sourcePort?.disabled) return false
    }
    if (connection.targetHandle) {
      const targetPort = (targetNode.data?.ports?.inputs || []).find((port: any) => port.id === connection.targetHandle)
      if (targetPort?.disabled) return false
    }
    const isExistingEdge = connection.id && edges.value.some((e: any) => e.id === connection.id)
    if (!isExistingEdge && !deferGraphChecks) {
      if (hasPath(connection.target, connection.source)) return false
    }
    if (!isExistingEdge) {
      const blockedMsg = getIncomingConnectionBlockMessage(connection.source, connection.target)
      if (blockedMsg) {
        pendingInvalidConnectionMessage = blockedMsg
        return false
      }
    }
    return true
  }

  // ── 3 ────────────────────────────────────────────────────────

  function onConnectStart(...args: any[]) {
    // VueFlow callback signature varies by version: (event, params) or (params)
    let nativeEvent: any = null
    let connectionEvent: any = null

    if (args.length >= 2) {
      nativeEvent = args[0]
      connectionEvent = args[1]
    } else if (args.length === 1 && args[0]) {
      connectionEvent = args[0]
      nativeEvent = connectionEvent.event || args[0]
    }

    if (!connectionEvent) return

    // Alt+拖拽已连接的 handle 时，断开该连接
    const isAltKey = nativeEvent && 'altKey' in nativeEvent ? nativeEvent.altKey : false
    if (isAltKey && connectionEvent.nodeId) {
      const edgesToRemove = edges.value.filter((e: any) =>
        (e.source === connectionEvent.nodeId && e.sourceHandle === connectionEvent.handleId) ||
        (e.target === connectionEvent.nodeId && e.targetHandle === connectionEvent.handleId)
      )
      if (edgesToRemove.length > 0) {
        const idsToRemove = edgesToRemove.map((e: any) => e.id)
        edges.value = edges.value.filter((e: any) => !idsToRemove.includes(e.id))
        emit('update:modelEdges', edges.value)
        saveHistory()
      }
      connectionStartHandle.value = null
      isConnecting.value = false
      clearSourceConnectionHighlight()
      return
    }

    connectionStartHandle.value = connectionEvent
    if (connectionEvent.nodeId === MULTI_SELECTION_NODE_ID) {
      setSourceConnectionHighlight(
        getSelectedNodes.value
          .filter(node => node && node.type !== 'groupNode' && node.type !== 'waypoint' && !isEmptyGenerationSourceNode(node))
          .map(node => node.id),
        'multi'
      )
    } else if (connectionEvent.nodeId) {
      setSourceConnectionHighlight([connectionEvent.nodeId], findNode(connectionEvent.nodeId)?.type === 'groupNode' ? 'group' : 'single')
    }
    isConnecting.value = true
  }

  // ── 4 ────────────────────────────────────────────────────────

  async function onConnectEnd(event: any) {
    const nativeEvent = (event && typeof event === 'object' && 'event' in event) ? event.event : event

    if (!nativeEvent) {
      isConnecting.value = false
      connectionStartHandle.value = null
      clearSourceConnectionHighlight()
      return
    }

    const startHandle = connectionStartHandle.value
    if (!startHandle) {
      isConnecting.value = false
      clearSourceConnectionHighlight()
      return
    }

    const startNodeId = startHandle.nodeId
    const startHandleId = startHandle.handleId
    const startType = startHandle.handleType
    const isSource = !startType || startType === 'source'
    const isMultiSelectionStart = startNodeId === MULTI_SELECTION_NODE_ID
    const startNode = startNodeId ? findNode(startNodeId) : null
    const isGroupConnectorStart = startNode?.type === 'groupNode' && isGroupExpandedHandle(startHandleId)
    const isGroupAggregateStart = startNode?.type === 'groupNode' && isGroupAggregateHandle(startHandleId)

    const target = nativeEvent.target
    const isTargetHandle = target && target.classList && typeof target.classList.contains === 'function' && target.classList.contains('vue-flow__handle')

    let clientX: number | undefined = undefined
    let clientY: number | undefined = undefined
    if ('clientX' in nativeEvent) {
      clientX = nativeEvent.clientX
      clientY = nativeEvent.clientY
    } else if (nativeEvent.changedTouches && nativeEvent.changedTouches.length > 0) {
      clientX = nativeEvent.changedTouches[0].clientX
      clientY = nativeEvent.changedTouches[0].clientY
    }

    const flowEl = vueFlowRef.value
    const dropTarget = getDropTargetFromPoint(clientX!, clientY!)
    const targetNodeIdAtPointer = dropTarget.nodeId
    const targetHandleIdAtPointer = dropTarget.handleId
    const endedOnTargetHandle = isTargetHandle || dropTarget.isTargetHandle

    if (isMultiSelectionStart || isGroupConnectorStart) {
      const targetNodeId = targetNodeIdAtPointer
      if (targetNodeId && targetNodeId !== startNodeId) {
        const targetNode = findNode(targetNodeId)
        const resolvedTargetHandle = targetHandleIdAtPointer || targetNode?.handleBounds?.target?.[0]?.id || undefined
        if (isMultiSelectionStart) {
          connectSelectedNodesToTarget(targetNodeId, {
            targetHandle: resolvedTargetHandle,
          })
        } else {
          await connectGroupChildrenToTarget(startNodeId, targetNodeId, {
            targetHandle: resolvedTargetHandle,
          })
        }
      } else if (clientX !== undefined && clientY !== undefined && flowEl) {
        const bounds = flowEl.getBoundingClientRect()
        connectionPopup.value = {
          visible: true,
          x: clientX - bounds.left,
          y: clientY - bounds.top,
          sourceNodeId: isGroupConnectorStart ? startNodeId : '',
          sourceHandleId: isGroupConnectorStart ? startHandleId : '',
          sourceMode: isGroupConnectorStart ? 'group' as const : 'multi' as const,
          sourceNodeIds: isGroupConnectorStart
            ? getEligibleGroupChildSourceNodes(startNodeId).map(node => node.id)
            : getSelectedNodes.value
              .filter(node => node && node.type !== 'groupNode' && node.type !== 'waypoint' && !isEmptyGenerationSourceNode(node))
              .map(node => node.id),
        }
      }
      isConnecting.value = false
      connectionStartHandle.value = null
      clearSourceConnectionHighlight()
      return
    }

    if (isGroupAggregateStart && targetNodeIdAtPointer && targetNodeIdAtPointer !== startNodeId) {
      const targetNode = findNode(targetNodeIdAtPointer)
      if (targetNode?.type !== 'groupNode') {
        await connectGroupAggregateToTarget(startNodeId, targetNodeIdAtPointer, {
          sourceHandle: startHandleId || undefined,
          targetHandle: targetHandleIdAtPointer || targetNode?.handleBounds?.target?.[0]?.id || undefined,
        })
      }
      isConnecting.value = false
      connectionStartHandle.value = null
      clearSourceConnectionHighlight()
      return
    }

    if (!endedOnTargetHandle && clientX !== undefined && clientY !== undefined && flowEl) {
      const bounds = flowEl.getBoundingClientRect()
      const relativeX = clientX - bounds.left
      const relativeY = clientY - bounds.top
      const targetedNodeId = targetNodeIdAtPointer

      setTimeout(async () => {
        if (targetedNodeId && targetedNodeId !== startNodeId) {
          const targetNode = findNode(targetedNodeId)
          if (targetNode?.type !== 'groupNode') {
            if (isSource) {
              const selectedSourceIds = new Set(getSelectedNodes.value.map((node: any) => node.id))
              const startSourceNode = findNode(startNodeId)
              const shouldBatchConnectSelected = (
                !!startSourceNode
                && selectedSourceIds.size > 1
                && selectedSourceIds.has(startNodeId)
                && startSourceNode.type !== 'groupNode'
                && startSourceNode.type !== 'waypoint'
              )
              if (shouldBatchConnectSelected) {
                const didBatchConnect = connectSelectedNodesToTarget(targetedNodeId, {
                  sourceHandle: startHandleId || undefined,
                  targetHandle: targetNode?.handleBounds?.target?.[0]?.id || undefined,
                })
                if (didBatchConnect) return
              }

              if (startSourceNode?.type === 'groupNode' && isGroupExpandedHandle(startHandleId)) {
                await connectGroupChildrenToTarget(startNodeId, targetedNodeId, {
                  targetHandle: targetNode?.handleBounds?.target?.[0]?.id || undefined,
                })
                return
              }

              const blockedMsg = getIncomingConnectionBlockMessage(startNodeId, targetedNodeId)
              if (blockedMsg) {
                pendingInvalidConnectionMessage = blockedMsg
                return
              }
              if (!validateConnection({
                source: startNodeId,
                target: targetedNodeId,
                sourceHandle: startHandleId || undefined,
                targetHandle: targetNode?.handleBounds?.target?.[0]?.id || undefined,
              })) {
                return
              }
              const edgeExists = edges.value.some(
                (e: any) => e.source === startNodeId && e.target === targetedNodeId
              )
              if (!edgeExists) {
                const resolvedTargetHandle = targetNode?.handleBounds?.target?.[0]?.id || undefined
                addEdges([{
                  id: createRuntimeId('edge'),
                  source: startNodeId,
                  target: targetedNodeId,
                  sourceHandle: startHandleId || undefined,
                  targetHandle: resolvedTargetHandle,
                  type: edgeStyle.value
                }])
                nextTick(() => {
                  emit('update:modelEdges', edges.value)
                  syncTargetNodePrompt(targetedNodeId)
                  propagateDataFlow()
                  saveHistory()
                })
              }
            } else {
              const blockedMsg = getIncomingConnectionBlockMessage(targetedNodeId, startNodeId)
              if (blockedMsg) {
                pendingInvalidConnectionMessage = blockedMsg
                return
              }
              if (!validateConnection({
                source: targetedNodeId,
                target: startNodeId,
                sourceHandle: targetNode?.handleBounds?.source?.[0]?.id || undefined,
                targetHandle: startHandleId || undefined,
              })) {
                return
              }
              const edgeExists = edges.value.some(
                (e: any) => e.source === targetedNodeId && e.target === startNodeId
              )
              if (!edgeExists) {
                const resolvedSourceHandle = targetNode?.handleBounds?.source?.[0]?.id || undefined
                addEdges([{
                  id: createRuntimeId('edge'),
                  source: targetedNodeId,
                  target: startNodeId,
                  sourceHandle: resolvedSourceHandle,
                  targetHandle: startHandleId || undefined,
                  type: edgeStyle.value
                }])
                nextTick(() => {
                  emit('update:modelEdges', edges.value)
                  syncTargetNodePrompt(startNodeId)
                  propagateDataFlow()
                  saveHistory()
                })
              }
            }
          }
        } else {
          if (isSource) {
            const isGroupNodeStart = startNodeId && findNode(startNodeId)?.type === 'groupNode'
            const popupSourceMode = isGroupNodeStart
              ? (isGroupAggregateHandle(startHandleId) ? 'groupAggregate' as const : 'group' as const)
              : 'single' as const
            connectionPopup.value = {
              visible: true,
              x: relativeX,
              y: relativeY,
              sourceNodeId: startNodeId,
              sourceHandleId: startHandleId,
              sourceMode: popupSourceMode,
              sourceNodeIds: popupSourceMode === 'group'
                ? getEligibleGroupChildSourceNodes(startNodeId).map(node => node.id)
                : [],
            }
          }
        }
      }, 10)
    }

    if (hoveredNodeId.value) {
      const node = findNode(hoveredNodeId.value)
      if (node) node.class = ''
    }
    if (pendingInvalidConnectionMessage) {
      ElMessage.warning(pendingInvalidConnectionMessage)
      pendingInvalidConnectionMessage = ''
    }
    hoveredNodeId.value = null
    isConnecting.value = false
    connectionStartHandle.value = null
    clearSourceConnectionHighlight()
  }

  // ── 5 ────────────────────────────────────────────────────────

  function clearSourceConnectionHighlight() {
    if (!isLargeCanvasConnectionMode.value) {
      sourceConnectionNodeIds.value.forEach((nodeId) => updateNodeClassToken(nodeId, 'is-connecting-source', false))
    }
    sourceConnectionNodeIds.value = []
    sourceConnectionMode.value = ''
  }

  // ── 6 ────────────────────────────────────────────────────────

  function setSourceConnectionHighlight(nodeIds: string[] = [], mode: string = '') {
    clearSourceConnectionHighlight()
    sourceConnectionMode.value = mode
    sourceConnectionNodeIds.value = Array.from(new Set((nodeIds || []).filter(Boolean)))
    if (isLargeCanvasConnectionMode.value) return
    sourceConnectionNodeIds.value.forEach((nodeId) => updateNodeClassToken(nodeId, 'is-connecting-source', true))
  }

  // ── 7 ────────────────────────────────────────────────────────

  function clearMultiSelectionConnection() {
    multiSelectionPointerListeners.clear()
    if (connectionStartHandle.value?.nodeId === MULTI_SELECTION_NODE_ID) {
      connectionStartHandle.value = null
    }
    multiSelectionPointer.value = null
    isConnecting.value = false
  }

  // ── 8 ────────────────────────────────────────────────────────

  function clearGroupConnection() {
    groupConnectionPointerListeners.clear()
    if (
      connectionStartHandle.value
      && (isGroupExpandedHandle(connectionStartHandle.value.handleId) || isGroupAggregateHandle(connectionStartHandle.value.handleId))
    ) {
      connectionStartHandle.value = null
    }
    groupConnectionPointer.value = null
    isConnecting.value = false
  }

  // ── 9 ────────────────────────────────────────────────────────

  function startMultiSelectionConnection(event: any) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (getSelectedNodes.value.length < 2) return

    clearMultiSelectionConnection()
    connectionStartHandle.value = {
      nodeId: MULTI_SELECTION_NODE_ID,
      handleId: 'multi-selection-source',
      handleType: 'source',
    }
    isConnecting.value = true
    if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
      multiSelectionPointer.value = clientPointToCanvasPoint(event.clientX, event.clientY)
    } else {
      multiSelectionPointer.value = multiSelectionConnectorAnchor.value
        ? { ...multiSelectionConnectorAnchor.value }
        : null
    }

    multiSelectionPointerListeners.bind(
      (pointerEvent) => {
        multiSelectionPointer.value = clientPointToCanvasPoint(pointerEvent.clientX, pointerEvent.clientY)
      },
      (pointerEvent) => {
        onConnectEnd(pointerEvent)
        clearMultiSelectionConnection()
      },
    )
  }

  // ── 10 ──────────────────────────────────────────────────────

  function startGroupConnectionFromZone(groupNodeId: string, event: any, handleId = GROUP_EXPANDED_SOURCE_HANDLE) {
    if (!groupNodeId) return
    clearMultiSelectionConnection()
    clearGroupConnection()
    connectionStartHandle.value = {
      nodeId: groupNodeId,
      handleId,
      handleType: 'source',
    }
    setSourceConnectionHighlight([groupNodeId], 'group')
    isConnecting.value = true
    if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
      groupConnectionPointer.value = clientPointToCanvasPoint(event.clientX, event.clientY)
    } else {
      groupConnectionPointer.value = getGroupConnectorAnchorPoint(groupNodeId)
    }
    groupConnectionPointerListeners.bind(
      (pointerEvent) => {
        groupConnectionPointer.value = clientPointToCanvasPoint(pointerEvent.clientX, pointerEvent.clientY)
      },
      (pointerEvent) => {
        onConnectEnd(pointerEvent)
        clearGroupConnection()
      },
    )
  }

  // ── 11 ──────────────────────────────────────────────────────

  function getEligibleGroupChildSourceNodes(groupNodeId: string, targetNodeId: string = ''): any[] {
    return nodes.value.filter((node: any) => {
      if (!node || node.parentNode !== groupNodeId) return false
      if (node.id === targetNodeId) return false
      return node.type !== 'groupNode' && node.type !== 'waypoint'
    })
  }

  function getConflictingGroupModeEdges(groupNodeId: string, targetNodeId: string, nextMode: GroupConnectionMode): any[] {
    if (!groupNodeId || !targetNodeId) return []
    if (nextMode === 'expanded') {
      return edges.value.filter((edge: any) => (
        edge.source === groupNodeId
        && edge.target === targetNodeId
        && edge.sourceHandle === GROUP_AGGREGATE_SOURCE_HANDLE
      ))
    }
    const childIds = new Set(getEligibleGroupChildSourceNodes(groupNodeId, targetNodeId).map((node: any) => node.id))
    return edges.value.filter((edge: any) => edge.target === targetNodeId && childIds.has(edge.source))
  }

  async function removeConflictingGroupModeEdges(groupNodeId: string, targetNodeId: string, nextMode: GroupConnectionMode): Promise<boolean> {
    const conflictingEdges = getConflictingGroupModeEdges(groupNodeId, targetNodeId, nextMode)
    if (!conflictingEdges.length) return true
    const nextLabel = nextMode === 'aggregate' ? '分组连接' : '节点连接'
    const oldLabel = nextMode === 'aggregate' ? '节点连接' : '分组连接'
    try {
      await ElMessageBox.confirm(
        `该分组到目标节点已经存在${oldLabel}。切换为${nextLabel}会断开原有 ${conflictingEdges.length} 条连接，是否继续？`,
        '切换连接方式',
        { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' },
      )
    } catch {
      return false
    }
    const conflictIds = new Set(conflictingEdges.map((edge: any) => edge.id))
    edges.value = edges.value.filter((edge: any) => !conflictIds.has(edge.id))
    emit('update:modelEdges', edges.value)
    return true
  }

  async function connectGroupChildrenToTarget(groupNodeId: string, targetNodeId: string, options: { targetHandle?: string } = {}): Promise<boolean> {
    if (!await removeConflictingGroupModeEdges(groupNodeId, targetNodeId, 'expanded')) return false
    return connectSourceNodesToTarget(getEligibleGroupChildSourceNodes(groupNodeId, targetNodeId), targetNodeId, options)
  }

  async function connectGroupAggregateToTarget(groupNodeId: string, targetNodeId: string, options: { targetHandle?: string; sourceHandle?: string } = {}): Promise<boolean> {
    if (!await removeConflictingGroupModeEdges(groupNodeId, targetNodeId, 'aggregate')) return false
    return connectSingleSourceToTarget(groupNodeId, targetNodeId, {
      sourceHandle: options.sourceHandle || GROUP_AGGREGATE_SOURCE_HANDLE,
      targetHandle: options.targetHandle,
    })
  }

  // ── 12 ──────────────────────────────────────────────────────

  function connectSourceNodesToTarget(sourceNodes: any[], targetNodeId: string, options: { targetHandle?: string; sourceHandle?: string } = {}): boolean {
    if (!targetNodeId) return false
    const targetNode = findNode(targetNodeId)
    if (!targetNode || targetNode.type === 'groupNode') return false
    if (!Array.isArray(sourceNodes) || !sourceNodes.length) return false

    const validSourceNodes = sourceNodes.filter((node: any) => {
      if (!node || node.id === targetNodeId) return false
      return node.type !== 'groupNode' && node.type !== 'waypoint'
    })
    if (!validSourceNodes.length) return false

    const { dedupedSourceNodes, duplicateSourceCount } = dedupeSourceNodes(validSourceNodes)

    if (duplicateSourceCount > 0) {
      ElMessage.warning(`选中卡片里有 ${duplicateSourceCount} 个重复来源，已自动只连接其中一张`)
    }

    if (!dedupedSourceNodes.length) return false

    const resolvedTargetHandle = options.targetHandle || targetNode?.handleBounds?.target?.[0]?.id || undefined
    const newEdges = dedupedSourceNodes
      .filter((sourceNode: any) => !edges.value.some((edge: any) => (
        edge.source === sourceNode.id
        && edge.target === targetNodeId
        && (resolvedTargetHandle ? edge.targetHandle === resolvedTargetHandle : true)
      )))
      .map((sourceNode: any) => ({
        id: createRuntimeId('edge'),
        source: sourceNode.id,
        target: targetNodeId,
        sourceHandle: options.sourceHandle || sourceNode?.handleBounds?.source?.[0]?.id || undefined,
        targetHandle: resolvedTargetHandle,
        type: edgeStyle.value,
      }))

    if (!newEdges.length) return false

    addEdges(newEdges)
    nextTick(() => {
      emit('update:modelEdges', edges.value)
      syncTargetNodePrompt(targetNodeId)
      propagateDataFlow()
      saveHistory()
    })
    return true
  }

  function connectSingleSourceToTarget(sourceNodeId: string, targetNodeId: string, options: { targetHandle?: string; sourceHandle?: string } = {}): boolean {
    const targetNode = findNode(targetNodeId)
    if (!sourceNodeId || !targetNode || targetNode.type === 'groupNode') return false
    const blockedMsg = getIncomingConnectionBlockMessage(sourceNodeId, targetNodeId)
    if (blockedMsg) {
      pendingInvalidConnectionMessage = blockedMsg
      return false
    }
    const edgePayload = {
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: options.sourceHandle || undefined,
      targetHandle: options.targetHandle || targetNode?.handleBounds?.target?.[0]?.id || undefined,
    }
    if (!validateConnection(edgePayload)) return false
    const edgeExists = edges.value.some((edge: any) => (
      edge.source === sourceNodeId
      && edge.target === targetNodeId
      && edge.sourceHandle === edgePayload.sourceHandle
      && edge.targetHandle === edgePayload.targetHandle
    ))
    if (edgeExists) return false
    addEdges([{ id: createRuntimeId('edge'), ...edgePayload, type: edgeStyle.value }])
    nextTick(() => {
      emit('update:modelEdges', edges.value)
      syncTargetNodePrompt(targetNodeId)
      propagateDataFlow()
      saveHistory()
    })
    return true
  }

  // ── 13 ──────────────────────────────────────────────────────

  function connectSelectedNodesToTarget(targetNodeId: string, options: { targetHandle?: string; sourceHandle?: string } = {}): boolean {
    const sourceNodes = getSelectedNodes.value.filter((node: any) => {
      if (!node || node.id === targetNodeId) return false
      return node.type !== 'groupNode' && node.type !== 'waypoint' && !isEmptyGenerationSourceNode(node)
    })
    return connectSourceNodesToTarget(sourceNodes, targetNodeId, options)
  }

  // ── 14 ──────────────────────────────────────────────────────

  function connectNodeIdsToTarget(sourceNodeIds: string[] = [], targetNodeId: string, options: { targetHandle?: string; sourceHandle?: string } = {}): boolean {
    if (!Array.isArray(sourceNodeIds) || !sourceNodeIds.length) return false
    const sourceNodes = sourceNodeIds
      .map((nodeId) => findNode(nodeId))
      .filter((node) => !!node)
    return connectSourceNodesToTarget(sourceNodes, targetNodeId, options)
  }

  // ── 15 ──────────────────────────────────────────────────────

  function getGroupConnectorAnchorPoint(nodeId: string): { x: number; y: number } | null {
    const node = findNode(nodeId)
    if (!node) return null
    const x = node.computedPosition?.x ?? node.position?.x ?? 0
    const y = node.computedPosition?.y ?? node.position?.y ?? 0
    const width = getNodeVisualWidth(node)
    const height = getNodeVisualHeight(node)
    return {
      x: (x + width) * viewport.value.zoom + viewport.value.x + 12,
      y: (y + height / 2) * viewport.value.zoom + viewport.value.y,
    }
  }

  // ── 16 ──────────────────────────────────────────────────────

  function handleAddNodeFromConnection(item: any) {
    const type = item.type
    const label = item.label
    const typeDef = getNodeTypeDef(type)
    const position = project({ x: connectionPopup.value.x, y: connectionPopup.value.y })

    const newNodeId = createRuntimeId('node')
    const newNode = applyPresetData({
      id: newNodeId,
      type,
      position: { x: position.x - 100, y: position.y - 40 },
      data: buildBaseNodeRuntimeData({
        nodeType: type,
        label,
        paramDefs: typeDef.params || [],
        mediaType: item.mediaType,
      }),
    }, item)

    if (fixedSizeTypes[type]) {
      newNode.style = fixedSizeTypes[type]
    }

    if (typeDef.params) {
      typeDef.params.forEach((p: any) => {
        if (
          p.default !== undefined
          && p.default !== null
          && newNode.data.request?.params?.[p.name] === undefined
        ) {
          newNode.data.request.params[p.name] = p.default
        }
      })
    }

    assignToGroupIfOverlapping(newNode, position.x - 100, position.y - 40)

    nodes.value = [...nodes.value, newNode]
    emit('update:modelNodes', nodes.value)

    nextTick(() => {
      updateNodeInternals([newNodeId])
      const createdNode = findNode(newNodeId)
      const resolvedTargetHandle = createdNode?.handleBounds?.target?.[0]?.id

      if (connectionPopup.value.sourceMode === 'multi' || connectionPopup.value.sourceMode === 'group') {
        connectNodeIdsToTarget(connectionPopup.value.sourceNodeIds, newNodeId, {
          targetHandle: resolvedTargetHandle,
        })
      } else {
        const newEdge = {
          id: createRuntimeId('edge'),
          source: connectionPopup.value.sourceNodeId,
          sourceHandle: connectionPopup.value.sourceHandleId || undefined,
          target: newNodeId,
          targetHandle: resolvedTargetHandle,
          type: edgeStyle.value,
          animated: true,
        }
        edges.value = [...edges.value, newEdge]
        emit('update:modelEdges', edges.value)
        syncTargetNodePrompt(newNodeId)
        propagateDataFlow()
      }
    })

    connectionPopup.value.visible = false
    revealManualGenerationPanel(newNodeId)
    setTimeout(saveHistory, 100)
  }

  // ==================== 返回 ====================

  onUnmounted(() => {
    clearMultiSelectionConnection()
    clearGroupConnection()
    clearSourceConnectionHighlight()
    connectionPopup.value.visible = false
    connectionStartHandle.value = null
    hoveredNodeId.value = null
    pendingInvalidConnectionMessage = ''
  })

  return {
    // state refs
    connectionStartHandle,
    isConnecting,
    connectionPopup,
    sourceConnectionNodeIds,
    sourceConnectionMode,
    hoveredNodeId,
    multiSelectionPointer,
    groupConnectionPointer,
    get pendingInvalidConnectionMessage() { return pendingInvalidConnectionMessage },
    set pendingInvalidConnectionMessage(v: string) { pendingInvalidConnectionMessage = v },
    // public functions
    getCurrentMultiSelectionSourceIds,
    getIncomingConnectionBlockMessage,
    validateConnection,
    onConnectStart,
    onConnectEnd,
    clearSourceConnectionHighlight,
    setSourceConnectionHighlight,
    clearMultiSelectionConnection,
    clearGroupConnection,
    startMultiSelectionConnection,
    startGroupConnectionFromZone,
    getEligibleGroupChildSourceNodes,
    connectGroupChildrenToTarget,
    connectGroupAggregateToTarget,
    connectSourceNodesToTarget,
    connectSelectedNodesToTarget,
    connectNodeIdsToTarget,
    getGroupConnectorAnchorPoint,
    handleAddNodeFromConnection,
  }
}
