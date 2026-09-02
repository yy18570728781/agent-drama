import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'
import {
  buildBaseNodeRuntimeData,
  buildRuntimeAssetNodeData,
} from '@/utils/workflowNodeData'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'
import { isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'
import { director3DOverlayVisible, director3DActiveNodeId, director3DActiveNode } from './useFlowCore'
import type { FlowNode } from './flowCore.types'

export interface FlowEventsDeps {
  // ---- VueFlow ----
  project: (pos: { x: number; y: number }) => { x: number; y: number }
  fitView: (opts?: any) => void
  findNode: (id: string) => any
  getSelectedNodes: { readonly value: any[] }
  addSelectedNodes: (nodes: any[]) => void
  removeSelectedNodes: (nodes: any[]) => void
  multiSelectionActive: Ref<boolean>
  updateNodeInternals: (ids: string[]) => void

  // ---- Core refs ----
  nodes: Ref<any[]>
  edges: Ref<any[]>
  contextMenu: Ref<{ visible: boolean; x: number; y: number; canvasX: number; canvasY: number; [key: string]: any }>
  connectionPopup: Ref<{ visible: boolean; [key: string]: any }>
  selectedPanelNode: Ref<any>
  showMinimap: Ref<boolean>
  shouldAutoHideMinimap: { readonly value: boolean }
  selectedImageNodes: { readonly value: any[] }
  lastMousePosition: Ref<{ x: number; y: number }>
  hoveredNodeId: Ref<string | null>
  edgeStyle: Ref<string>

  // ---- Canvas performance ----
  isSelectionBoxActive: Ref<boolean>
  isPointSelectionSuppressed: Ref<boolean>
  isInteractionEffectsSuppressed: Ref<boolean>
  isLargeCanvasConnectionMode: Ref<boolean>
  updateEdgeStyles: () => void

  // ---- Drag state ----
  isDraggingNode: Ref<boolean>

  // ---- Cut drag ----
  isCutKeyPressed: Ref<boolean>
  cutDragStartPoint: Ref<{ x: number; y: number } | null>
  cutPreviewEdgeIds: Ref<Set<string>>
  _pendingCutDeleteEdgeIds: Set<string>
  queueCutEdgeRemoval: (ids: string[]) => void

  // ---- Keyboard ----
  isShiftPressed: Ref<boolean>
  isCtrlPressed: Ref<boolean>

  // ---- Flow connections ----
  isConnecting: Ref<boolean>

  // ---- Group nodes ----
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  handleGridDrop: (node: any, x: number, y: number) => boolean
  cleanupGridOrdersForDeletedNodes: (deletedIds: Set<string>) => void
  getExpandedSelectedNodes: () => any[]
  syncGroupBoundsForNodes: (...args: any[]) => void

  // ---- Generation panel ----
  showGenerationPanel: (node: any) => void
  hideGenerationPanel: () => void
  clearGenerationPanel: (nodeId?: string) => void
  panelSwitchLockUntil: { get value(): number; set value(v: number) }
  panelSwitchLockedNodeId: { get value(): string; set value(v: string) }

  // ---- Context menu ----
  closeContextMenu: () => void

  // ---- Generation store ----
  generationStore: { isGenerating: boolean; [key: string]: any }

  // ---- Node classification ----
  canOpenGenerationPanel: (node: any) => boolean
  isImageLikeNode: (node: any) => boolean
  isVideoLikeNode: (node: any) => boolean
  getNodeMediaType: (node: any) => string
  getDefaultCapabilityByNodeType: (type: string) => string
  applyWorkflowRememberedRequest: (nodeData: any, capability: any) => any
  applyPresetData: (nodeData: any, typeDef: any) => any

  // ---- Media preview ----
  openEditorForNode: (opts: any) => void
  openDetailModal: (opts: any) => void

  // ---- Node factory ----
  createRuntimeId: (prefix?: string) => string

  // ---- File upload ----
  createUploadNodesFromFiles: (
    files: File[],
    position: { x: number; y: number },
  ) => Promise<unknown[]>

  // ---- Props ----
  nodeTypes: any[]
  fixedSizeTypes: Record<string, any>

  // ---- History ----
  saveHistory: () => void

  // ---- Emit ----
  emit: (event: string, ...args: any[]) => void

  // ---- Selection state ----
  selectionState: {
    _paneClickHandled: boolean
    _preShiftSelectionIds: Set<string> | null
    _preCtrlSelectionIds: Set<string> | null
  }
}

export function useFlowEvents(deps: FlowEventsDeps) {
  // Module-scoped variables for selection modifier tracking
  let _activeSelectionModifier: string | null = null
  let _activeSelectionPreIds: Set<string> | null = null
  let nodePointerDown = false
  let nodePointerStartX = 0
  let nodePointerStartY = 0

  // ==================== Wrapper pointer down ====================

  function onWrapperPointerDown(event: PointerEvent) {
    const target = event.target
    if (
      deps.contextMenu.value.visible
      && target instanceof HTMLElement
      && !target.closest('.context-menu')
    ) {
      deps.closeContextMenu()
    }

    if (event.button !== 0) return
    if (!(target instanceof Element)) return
    const isNodePointer = !!target.closest('.vue-flow__node') && !target.closest('.nodrag')
    nodePointerDown = isNodePointer
    nodePointerStartX = event.clientX
    nodePointerStartY = event.clientY
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    const isNodePointer = !!target.closest('.vue-flow__node') && !target.closest('.nodrag')
    nodePointerDown = isNodePointer
    nodePointerStartX = event.clientX
    nodePointerStartY = event.clientY
  }

  // ==================== Node click ====================

  function onNodeClick({ node, event }: { node: any; event?: MouseEvent }) {
    const freshNode = deps.findNode(node.id) || node
    if (
      deps.panelSwitchLockUntil.value > Date.now()
      && deps.panelSwitchLockedNodeId.value
      && freshNode.id !== deps.panelSwitchLockedNodeId.value
    ) {
      return
    }
    if (event?.altKey) return
    if (event?.ctrlKey || event?.shiftKey) {
      deps.emit('node-select', freshNode)
      return
    }
    if (freshNode.type === 'groupNode') {
      if (!deps.generationStore.isGenerating) {
        deps.hideGenerationPanel()
      }
      return
    }
    if (deps.generationStore.isGenerating && deps.selectedPanelNode.value && freshNode.id !== deps.selectedPanelNode.value.id) {
      return
    }

    deps.contextMenu.value.visible = false
    deps.connectionPopup.value.visible = false

    const noPanelTypes = ['output_gallery', 'waypoint', 'location_marker', 'image_compare', 'file_input', 'batch_grid']
    const blocksPanel = noPanelTypes.includes(freshNode.type) && !isWorkflowGenerationResultNode(freshNode)
    if (blocksPanel || !deps.canOpenGenerationPanel(freshNode)) {
      deps.hideGenerationPanel()
      deps.emit('node-select', freshNode)
      return
    }

    deps.showGenerationPanel(freshNode)
    deps.emit('node-select', freshNode)
  }

  // ==================== Node double click ====================

  function onNodeDoubleClick({ node, event }: { node: any; event?: any }) {
    if (event?.target?.closest?.('.subgraph-node__title-wrap, .subgraph-node__title, .subgraph-node__title-input')) {
      return
    }
    if (node?.type === 'subgraph') {
      deps.emit('open-subgraph', {
        nodeId: node.id,
        subgraphId: node?.data?.subgraphId || '',
        label: node?.data?.label || '子图',
      })
      return
    }

    if (node?.type === 'director_3d') {
      const freshNode = deps.nodes.value.find((n: any) => n.id === node.id)
      director3DActiveNodeId.value = node.id
      director3DActiveNode.value = freshNode || node
      director3DOverlayVisible.value = true
      return
    }

    const isImageNode = deps.isImageLikeNode(node)
    const isVideoNode = deps.isVideoLikeNode(node)

    if (!isImageNode && !isVideoNode) return

    const freshNode = deps.nodes.value.find((n: any) => n.id === node.id)
    const nodeData = freshNode?.data || node.data

    const preview = nodeData?.preview || nodeData?.url
    if (!preview) return

    deps.openEditorForNode({
      nodeId: node.id,
      imageUrl: preview,
      nodeType: isVideoNode ? 'video_input' : 'image_input',
      mediaType: nodeData?.mediaType || ''
    })
  }

  // ==================== Selection start ====================

  function onSelectionStart() {
    deps.selectionState._paneClickHandled = false
    if (deps.isPointSelectionSuppressed.value) return
    deps.isSelectionBoxActive.value = true
    if (deps.isShiftPressed.value && deps.selectionState._preShiftSelectionIds && deps.selectionState._preShiftSelectionIds.size > 0) {
      _activeSelectionModifier = 'shift'
      _activeSelectionPreIds = deps.selectionState._preShiftSelectionIds
    } else if (deps.isCtrlPressed.value && deps.selectionState._preCtrlSelectionIds && deps.selectionState._preCtrlSelectionIds.size > 0) {
      _activeSelectionModifier = 'ctrl'
      _activeSelectionPreIds = deps.selectionState._preCtrlSelectionIds
    } else {
      _activeSelectionModifier = null
      _activeSelectionPreIds = null
    }
  }

  // ==================== Selection end ====================

  function onSelectionEnd(event: any) {
    if (deps.isPointSelectionSuppressed.value) return
    deps.isSelectionBoxActive.value = false
    if (deps.selectionState._paneClickHandled) {
      deps.selectionState._paneClickHandled = false
      _activeSelectionModifier = null
      _activeSelectionPreIds = null
      return
    }

    const modifier = _activeSelectionModifier
    const preIds = _activeSelectionPreIds
    _activeSelectionModifier = null
    _activeSelectionPreIds = null

    if (!preIds || preIds.size === 0) return

    deps.multiSelectionActive.value = true

    if (modifier === 'shift') {
      for (const id of preIds) {
        const node = deps.findNode(id)
        if (node && !node.selected) deps.addSelectedNodes([node])
      }
    } else if (modifier === 'ctrl') {
      const currentSelected = deps.getSelectedNodes.value
      const currentIds = new Set(currentSelected.map((n: any) => n.id))
      const toDeselect = currentSelected.filter((n: any) => preIds.has(n.id))
      const toRestore = [...preIds].filter((id: string) => !currentIds.has(id))
      if (toDeselect.length > 0) deps.removeSelectedNodes(toDeselect)
      for (const id of toRestore) {
        const node = deps.findNode(id)
        if (node) deps.addSelectedNodes([node])
      }
    }
  }

  // ==================== Node drag start / stop ====================

  function onNodeDragStart() {
    deps.isDraggingNode.value = true
  }

  function onNodeDrag() {
    deps.isDraggingNode.value = true
  }

  function onNodeDragStop(event: any) {
    deps.isDraggingNode.value = false
    resetNodePointerDragState()
    const node = event.node
    if (!node) return
    const absX = node.computedPosition?.x ?? node.position.x
    const absY = node.computedPosition?.y ?? node.position.y
    // grid 模式优先：命中 grid 组时由 handleGridDrop 处理交换/插入，跳过自由 assign
    if (!deps.handleGridDrop(node, absX, absY)) {
      deps.assignToGroupIfOverlapping(node, absX, absY)
    }
    deps.nodes.value = deps.nodes.value.map((item: any) => {
      if (item.id !== node.id) return item
      return {
        ...item,
        position: { ...node.position },
        computedPosition: node.computedPosition ? { ...node.computedPosition } : item.computedPosition,
        parentNode: node.parentNode,
        extent: node.extent,
        hidden: node.hidden,
        selected: node.selected,
        dragging: false,
        class: node.class,
        data: {
          ...item.data,
          ...(node.data || {}),
        },
      }
    })
    nextTick(() => {
      const selector = `.vue-flow__node[data-id="${node.id}"]`
      const el = document.querySelector(selector)
      if (el instanceof HTMLElement && el.style.visibility === 'hidden') {
        el.style.visibility = 'visible'
      }
    })
    deps.updateNodeInternals([node.id])
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    setTimeout(() => deps.saveHistory(), 50)
  }

  // ==================== Node mouse enter / leave ====================

  function onNodeMouseEnter({ node }: { node: any }) {
    if (deps.isInteractionEffectsSuppressed.value) return
    if (deps.isConnecting.value && deps.isLargeCanvasConnectionMode.value) return
    if (deps.isConnecting.value && node.type !== 'groupNode' && node.type !== 'waypoint') {
      deps.hoveredNodeId.value = node.id
      const targetNode = deps.findNode(node.id)
      if (targetNode) {
        targetNode.class = 'is-connecting-hover'
      }
    }
  }

  function onNodeMouseLeave({ node }: { node: any }) {
    if (deps.isInteractionEffectsSuppressed.value) return
    if (deps.isConnecting.value && deps.isLargeCanvasConnectionMode.value) return
    if (deps.isConnecting.value && deps.hoveredNodeId.value === node.id) {
      const targetNode = deps.findNode(node.id)
      if (targetNode) {
        targetNode.class = ''
      }
      deps.hoveredNodeId.value = null
    }
  }

  // ==================== Remove selection ====================

  function removeSelection({ reason = 'delete' } = {}): boolean {
    const selectedNodesExpanded = deps.getExpandedSelectedNodes()
    const selectedEdges = deps.edges.value.filter((edge: any) => edge.selected)

    if (selectedNodesExpanded.length <= 0 && selectedEdges.length <= 0) return false

    const selectedSubgraphs = selectedNodesExpanded
      .filter((node: any) => node?.type === 'subgraph' && node?.data?.subgraphId)
      .map((node: any) => ({
        nodeId: node.id,
        subgraphId: node.data.subgraphId,
        label: node.data.label || '子图',
      }))

    const subgraphNodeIds = new Set(selectedSubgraphs.map((item: any) => item.nodeId))
    const selectedIds = new Set(selectedNodesExpanded.map((node: any) => node.id))
    const nodeIds = new Set(
      [...selectedIds].filter((id: string) => !subgraphNodeIds.has(id))
    )
    const edgeIds = new Set(selectedEdges.map((e: any) => e.id))
    if (deps.selectedPanelNode.value?.id && nodeIds.has(deps.selectedPanelNode.value.id)) {
      deps.clearGenerationPanel(deps.selectedPanelNode.value.id)
    }

    const waypoints = selectedNodesExpanded.filter((n: any) => nodeIds.has(n.id) && n.type === 'waypoint')
    const bypassEdges: any[] = []
    waypoints.forEach((wp: any) => {
      const incoming = deps.edges.value.filter((e: any) => e.target === wp.id && !edgeIds.has(e.id))
      const outgoing = deps.edges.value.filter((e: any) => e.source === wp.id && !edgeIds.has(e.id))
      if (incoming.length === 1 && outgoing.length === 1) {
        bypassEdges.push({
          id: deps.createRuntimeId('edge'),
          source: incoming[0].source,
          sourceHandle: incoming[0].sourceHandle,
          target: outgoing[0].target,
          targetHandle: outgoing[0].targetHandle,
          type: deps.edgeStyle.value,
          animated: incoming[0].animated,
          style: incoming[0].style,
        })
      }
    })

    deps.nodes.value = deps.nodes.value.filter((n: any) => !nodeIds.has(n.id))
    deps.edges.value = deps.edges.value.filter((e: any) =>
      !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)
    )

    // grid 模式：删除子节点后清理对应 gridOrder 空位
    deps.cleanupGridOrdersForDeletedNodes(nodeIds)

    if (reason === 'cut' || reason === 'delete') {
      deps.emit('record-tab-history')
    }

    if (bypassEdges.length > 0) {
      deps.edges.value = [...deps.edges.value, ...bypassEdges]
    }

    if (selectedSubgraphs.length > 0) {
      deps.emit('delete-subgraph-request', {
        subgraphs: selectedSubgraphs,
        reason,
      })
    }

    if (nodeIds.size > 0 || edgeIds.size > 0) {
      setTimeout(() => deps.saveHistory(), 50)
    }
    return nodeIds.size > 0 || edgeIds.size > 0 || selectedSubgraphs.length > 0
  }

  // ==================== Global mouse move ====================

  function resetNodePointerDragState() {
    nodePointerDown = false
    nodePointerStartX = 0
    nodePointerStartY = 0
  }

  function handleGlobalPointerUp() {
    resetNodePointerDragState()
    deps.isDraggingNode.value = false
  }

  function updateNodePointerDragState(e: PointerEvent) {
    if (!nodePointerDown || e.buttons !== 1) return
    const distance = Math.hypot(e.clientX - nodePointerStartX, e.clientY - nodePointerStartY)
    if (distance >= 3) deps.isDraggingNode.value = true
  }

  function handleGlobalMouseMove(e: PointerEvent) {
    const prevX = deps.lastMousePosition.value.x
    const prevY = deps.lastMousePosition.value.y
    deps.lastMousePosition.value = { x: e.clientX, y: e.clientY }
    updateNodePointerDragState(e)
    if (deps.isCutKeyPressed.value && e.buttons === 1) {
      if (!deps.cutDragStartPoint.value) {
        deps.cutDragStartPoint.value = { x: e.clientX, y: e.clientY }
      }
      const currentX = e.clientX
      const currentY = e.clientY
      const edgesToRemove = new Set<string>()
      const dx = currentX - prevX
      const dy = currentY - prevY
      const dist = Math.hypot(dx, dy)
      const steps = Math.max(1, Math.ceil(dist / 3))
      const normalLength = Math.hypot(dx, dy) || 1
      const normalX = -dy / normalLength
      const normalY = dx / normalLength
      const sampleOffsets = [0, 2, -2]

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps
        const sampleBaseX = prevX + dx * t
        const sampleBaseY = prevY + dy * t

        for (const offset of sampleOffsets) {
          const sampleX = sampleBaseX + normalX * offset
          const sampleY = sampleBaseY + normalY * offset
          const elements = document.elementsFromPoint(sampleX, sampleY)
          for (const el of elements) {
            if (!(el instanceof Element)) continue
            if (el.classList.contains('vue-flow__edge-interaction')) {
              const edgeGroup = el.closest('.vue-flow__edge')
              if (edgeGroup) {
                const id = edgeGroup.getAttribute('data-id')
                if (id && !deps.cutPreviewEdgeIds.value.has(id) && !deps._pendingCutDeleteEdgeIds.has(id)) {
                  edgesToRemove.add(id)
                }
              }
            }
          }
        }
      }

      if (edgesToRemove.size > 0) {
        deps.queueCutEdgeRemoval([...edgesToRemove])
      }
    }
  }

  // ==================== Drop ====================

  async function onDrop(event: DragEvent) {
    const dropTarget = event.target
    if (
      dropTarget instanceof HTMLElement
      && dropTarget.closest('.workflow-generation-panel, .generator-shell, .input-container')
    ) {
      return
    }

    const { left, top } = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const relativeX = event.clientX - left
    const relativeY = event.clientY - top
    const position = deps.project({ x: relativeX, y: relativeY })

    // 1. NodePalette drag
    const raw = event.dataTransfer?.getData('application/vueflow')
    if (raw) {
      const nodeType = JSON.parse(raw)
      const typeDef = deps.nodeTypes.find((t: any) => t.type === nodeType.type) || nodeType

      const id = deps.createRuntimeId('node')
      const newNode = deps.applyWorkflowRememberedRequest(deps.applyPresetData({
        id,
        type: nodeType.type,
        position: { x: position.x - 80, y: position.y - 20 },
        data: buildBaseNodeRuntimeData({
          nodeType: nodeType.type,
          label: nodeType.label || typeDef.label,
          paramDefs: typeDef.params || [],
          mediaType: nodeType.mediaType,
        }),
      }, nodeType), nodeType.defaultCapability || deps.getDefaultCapabilityByNodeType(nodeType.type))

      if (deps.fixedSizeTypes[nodeType.type]) {
        newNode.style = deps.fixedSizeTypes[nodeType.type]
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

      deps.assignToGroupIfOverlapping(newNode, position.x - 80, position.y - 20)
      deps.nodes.value = [...deps.nodes.value, newNode]
      setTimeout(() => deps.saveHistory(), 50)
      return
    }

    // 2. Asset list drag from CardView
    const assetInfoRaw = event.dataTransfer?.getData('application/x-asset-info')
    if (assetInfoRaw) {
      try {
        const assetInfo = JSON.parse(assetInfoRaw)
        const assetType = String(assetInfo.type || '').toLowerCase()
        const nodeType = 'aigc_result'
        const assetRecordId = assetInfo.recordId || assetInfo.id
        const assetThumb = String(assetInfo.thumb || '').trim()
        const assetModel = String(assetInfo.model || '').trim()
        const pbrChannel = inferTextureMaterialChannel(assetInfo)
        const nodeId = deps.createRuntimeId('node')
        const shortId = assetRecordId ? String(assetRecordId).slice(-6) : nodeId.slice(-6)
        const labelPrefix =
          assetModel || (
            assetType === 'video' ? '视频生成'
            : assetType === 'audio' ? '音频生成'
              : assetType === 'text' ? '文本结果'
                : '图片生成'
          )
        const newNode: FlowNode = {
          id: nodeId,
          type: nodeType,
          position: { x: position.x - 80, y: position.y - 20 },
          data: {
            ...buildRuntimeAssetNodeData({
              label: `${assetModel || labelPrefix} #${shortId}`,
              nodeType,
              url: assetInfo.url,
              thumb: assetThumb,
              recordId: assetRecordId,
              ...(pbrChannel ? { pbrChannel } : {}),
              mediaType: assetType === 'video' ? 'video' : assetType === 'audio' ? 'audio' : assetType === 'text' ? 'text' : 'image',
            }),
            status: 'completed',
            isGenerating: false,
            progress: undefined,
          },
        }
        if (deps.fixedSizeTypes[nodeType]) newNode.style = deps.fixedSizeTypes[nodeType]
        deps.assignToGroupIfOverlapping(newNode, position.x - 80, position.y - 20)
        deps.nodes.value = [...deps.nodes.value, newNode]
        setTimeout(() => deps.saveHistory(), 50)
      } catch { /* ignore */ }
      return
    }

    // 3. External file/folder drag
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    const droppedFiles = Array.from(files)
    if (droppedFiles.some((file: File) => /\.json$/i.test(file?.name || ''))) return
    await deps.createUploadNodesFromFiles(droppedFiles, position)
  }

  // ==================== Handle compare selected ====================

  function handleCompareSelected() {
    return
  }

  // ==================== Toggle minimap ====================

  function toggleMinimap() {
    if (deps.shouldAutoHideMinimap.value) {
      deps.showMinimap.value = false
      return
    }
    deps.showMinimap.value = !deps.showMinimap.value
  }

  // ==================== Handle fit view ====================

  function handleFitView() {
    deps.fitView({ padding: 0.08, duration: 500, minZoom: 0.02, maxZoom: 4 })
  }

  // ==================== Lifecycle: global listeners ====================

  onMounted(() => {
    window.addEventListener('pointerdown', handleGlobalPointerDown, true)
    window.addEventListener('pointermove', handleGlobalMouseMove, true)
    window.addEventListener('pointerup', handleGlobalPointerUp, true)
    window.addEventListener('pointercancel', handleGlobalPointerUp, true)
  })

  onUnmounted(() => {
    window.removeEventListener('pointerdown', handleGlobalPointerDown, true)
    window.removeEventListener('pointermove', handleGlobalMouseMove, true)
    window.removeEventListener('pointerup', handleGlobalPointerUp, true)
    window.removeEventListener('pointercancel', handleGlobalPointerUp, true)
  })

  return {
    onWrapperPointerDown,
    onNodeClick,
    onNodeDoubleClick,
    onSelectionStart,
    onSelectionEnd,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onNodeMouseEnter,
    onNodeMouseLeave,
    removeSelection,
    handleGlobalMouseMove,
    onDrop,
    handleCompareSelected,
    toggleMinimap,
    handleFitView,
  }
}
