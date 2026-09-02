import { ref, watch, markRaw, nextTick, provide, computed, reactive } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { createFlowId } from '@/utils/flowId'
import { scatterBatchNode, packNodesToBatch } from '@/composables/flow/useBatchGridNode'
import { createGridSplitInputGroup, triggerGridSplitBatchGeneration, type GridSplitPiece } from '@/composables/flow/useGridSplitGroup'
import type { GridSelectionResult } from '@/composables/flow/useImageGridSelection'
import { scatterTextureMaterialNode } from '@/composables/flow/useTextureMaterialScatter'
import { useNodeHighlight } from '@/composables/flow/useNodeHighlight'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import { findTeamonesAigcRecord } from '@/api/assets'
import {
  buildBaseNodeRuntimeData,
  buildPortsForNode,
  buildRuntimeAssetNodeData,
  buildRuntimeWorkflowNodeData,
  buildGenerationStateFromRequest,
  buildWorkflowRequestFromNodeData,
  getNodeUrl,
  sanitizeWorkflowRequestParams,
  inferMediaType,
  inferMediaTypeFromUrl,
  getNodeTypeByMediaType,
  isFileInputNodeType,
  normalizeWorkflowRequest,
} from '@/utils/workflowNodeData'
import { createThumbnailFileIfNeeded } from '@/utils/imageThumbnail'
import { IMAGE_UPLOAD_SIZE_LIMIT } from '@/utils/imageCompression'
import { assetToHistoryRecord, getReferenceUrls } from '@/components/generation/generationResultAdapters'
import { fixedSizeTypes, defaultMediaNodes, HIDDEN_NODE_TYPES, nodeComponents, useSelectedImageNodes } from '@/composables/flow/flowNodeRegistry'
import { isTextInputLike, isGenerationPanelInputLike, isPointInsideCanvas } from '@/composables/flow/flowCanvasUtils'
import ColoredSmoothStepEdge from './edges/ColoredSmoothStepEdge.vue'
import StraightEdge from './edges/StraightEdge.vue'
import ColoredBezierEdge from './edges/ColoredBezierEdge.vue'
import WorkflowGenerationPanel from './WorkflowGenerationPanel.vue'
import ImagePreviewModal from '@/components/common/ImagePreviewModal.vue'
import ImageCompressDialog from '@/components/common/ImageCompressDialog.vue'
import ImageReferenceEditor from '@/components/generation/ImageReferenceEditor.vue'
import VideoReferenceEditor from '@/components/generation/VideoReferenceEditor.vue'
import { useGenerationStore } from '@/stores/generation.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import { getUploadErrorMessage, uploadFileToCosUrl } from '@/api/uploadHelpers'
import { createGeneration, subscribeTaskEvents } from '@/api/generation'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MapIcon,
  LayoutGrid,
  Maximize,
  Type,
  Image as ImageIcon,
  Video,
  Music,
  Layers,
  Box,
  Camera,
  FileText,
  Monitor,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Workflow,
  ChevronsLeft,
  Shield,
  Check,
  X,
} from '@/components/common/icon/lucide'
import {
  alignNodes,
  distributeNodes,
  autoLayoutNodes,
  tidyNodes,
} from '@/utils/nodeLayout'
import { useConsole } from '@/composables/useConsole'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { useFlowNodeClassification } from '@/composables/flow/useFlowNodeClassification'
import { useCutDrag } from '@/composables/flow/useCutDrag'
import { useKeyboardShortcuts } from '@/composables/flow/useKeyboardShortcuts'
import { useFlowMultiSelectionMedia } from '@/composables/flow/useFlowMultiSelectionMedia'
import { useNodeAlignment } from '@/composables/flow/useNodeAlignment'
import { useCanvasPerformance } from '@/composables/flow/useCanvasPerformance'
import { usePointSelection } from '@/composables/flow/usePointSelection'
import { useDataFlow } from '@/composables/flow/useDataFlow'
import { useNodeFactory } from '@/composables/flow/useNodeFactory'
import { useFileUpload } from '@/composables/flow/useFileUpload'
import { useFlowReferences } from '@/composables/flow/useFlowReferences'
import { useFlowConnections, hoveredNodeId, isConnecting } from '@/composables/flow/useFlowConnections'
import { useGroupNodes } from '@/composables/flow/useGroupNodes'
import { useFlowContextMenu } from '@/composables/flow/useFlowContextMenu'
import { useFlowClipboard } from '@/composables/flow/useFlowClipboard'
import { useResultNormalization } from '@/composables/flow/useResultNormalization'
import { useMultiSelectionConnection } from '@/composables/flow/useMultiSelectionConnection'
import FlowContextMenu from './FlowContextMenu.vue'
import FlowConnectionPopup from './FlowConnectionPopup.vue'
import FlowControlsPanel from './FlowControlsPanel.vue'
import FlowMultiSelectionConnector from './FlowMultiSelectionConnector.vue'
import { useGenerationOrchestration } from '@/composables/flow/useGenerationOrchestration'
import { useMediaPreview } from '@/composables/flow/useMediaPreview'
import { useReferenceEditApply } from '@/composables/flow/useReferenceEditApply'
import { useFlowResultRecordActions } from '@/composables/flow/useFlowResultRecordActions'
import { useFlowAssetDrag } from '@/composables/flow/useFlowAssetDrag'
import { useGenerationPipeline } from '@/composables/flow/useGenerationPipeline'
import { useFlowEvents } from '@/composables/flow/useFlowEvents'
import { useFlowCanvasEdgeInteractions } from '@/composables/flow/useFlowCanvasEdgeInteractions'
import { useFlowCanvasLifecycle } from '@/composables/flow/useFlowCanvasLifecycle'
import { useLocationMarkerNavigator } from '@/composables/flow/useLocationMarkerNavigator'
import { createFlowCanvasExpose } from '@/composables/flow/createFlowCanvasExpose'
import { buildWorkflowMediaMeta, normalizeWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { useFlowCanvasState } from './useFlowCanvasState'
import { imageEditorVisible } from '@/composables/flow/useFlowCore'
import type {
  FlowCanvasEmit,
  FlowCanvasLateBindings,
  FlowCanvasProps,
} from './flowCanvasSetup.types'

export function useFlowCanvas(props: FlowCanvasProps, emit: FlowCanvasEmit) {

// ==================== Pre-declarations (break circular deps) ====================
const contextMenu = ref({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 })
const selectionState = {
  _paneClickHandled: false,
  _preShiftSelectionIds: null,
  _preCtrlSelectionIds: null,
}
const late: FlowCanvasLateBindings = {
  stopPanelClickOutside: () => {},
  clearMultiSelectionConnection: () => {},
  clearSourceConnectionHighlight: () => {},
  getGenerationCardHorizontalGap: () => 0,
  refreshOpenGenerationPanelForNode: () => {},
  assignToGroupIfOverlapping: () => {},
  handleGridDrop: () => false,
  registerGridChildIfNeeded: () => false,
  normalizeSubgraphName: () => '',
  buildUniquePastedSubgraphLabel: () => '',
  getExpandedSelectedNodes: () => [],
  handleGroupSelected: () => {},
  handleUngroupSelected: () => {},
  arrangeNodes: () => {},
  handleAutoLayout: () => {},
  handleDistribute: () => {},
  handleAlign: () => {},
  revealManualGenerationPanel: () => {},
  hideGenerationPanel: () => {},
  handleCompareSelected: () => {},
  openDetailModalForNodes: () => {},
}

const {
  GENERATION_PANEL_CAPABILITIES,
  REPAIRABLE_GENERATION_NODE_TYPES,
  getNodeMediaType,
  isImageLikeNode,
  isVideoLikeNode,
  isAudioLikeNode,
  isTextLikeNode,
  getNodeTypeDef,
  applyPresetData,
  getWorkflowRememberedRequest,
  applyWorkflowRememberedRequest,
  getDefaultCapabilityByNodeType,
  getNodeGenerationCapability,
  canOpenGenerationPanel,
  getNodeWidth,
  getNodeHeight,
  isRenderableMediaNode,
  hasRenderableMediaThumb,
  isPlaceholderEligibleNode,
  normalizeReferenceUrlKey,
  getNodeMediaReferenceKey,
  hasNodeResultUrl,
  isEmptyGenerationSourceNode,
  getReferenceMediaType,
  getReferenceLabelByMediaType,
  getReferenceNodeType,
  getNodeIcon,
  getNodeIconColor,
  getNodeColor,
  getNodeStrokeColor,
  getNodeStrokeWidth,
} = useFlowNodeClassification({
  nodeTypes: computed(() => props.nodeTypes),
  icons: { ImageIcon, FileText, Type, Video, Box, Music, Camera, Monitor, LayoutGrid, MapIcon },
})

// Vue Flow hooks
const {
  viewport,
  project,
  vueFlowRef,
  findNode,
  getSelectedNodes,
  addSelectedNodes,
  removeSelectedNodes,
  multiSelectionActive,
  addNodes,
  addEdges,
  removeEdges,
  fitView,
  zoomTo,
  setViewport,
  setCenter,
  onNodesChange,
  onEdgesChange,
  onEdgeUpdateStart,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  onEdgeClick,
  onEdgeDoubleClick,
  onConnect,
  updateNodeInternals,
} = useVueFlow()

const { edgeStyle, mediaPreviewLimit } = useTheme()
const taskQueueStore = useTaskQueueStore()

const {
  nodes,
  edges,
  models,
  capabilityPorts,
  flowCanvasWrapperRef,
  pointOverviewCanvasRef,
  isDraggingNode,
  isResizing,
  toolbarDropdown,
  groupToolbarDropdown,
  ctxSubmenu,
  showGrid,
  showMinimap,
  snapToGrid,
  shouldAutoHideMinimap,
  effectiveShowMinimap,
  onlyRenderVisibleElements,
  selectedPanelNode,
  panelVisible,
  generationPanelRef,
  generationPanelLayoutTick,
  generationPanelViewportAdjustFrame,
  panelSwitchLockUntilRef,
  panelSwitchLockedNodeIdRef,
  panelSwitchLockUntilAccessor,
  panelSwitchLockedNodeIdAccessor,
  panelClickOutsideHandler,
  activePanelNode,
  pendingRegenHadResult: _pendingRegenHadResult,
  pendingRegenHadRecordId: _pendingRegenHadRecordId,
  activeGenerationTargetBySource: _activeGenerationTargetBySource,
  activeGenerationSessionBySource: _activeGenerationSessionBySource,
  generationSlotByTaskId: _generationSlotByTaskId,
  assetStore,
  fwdRemoveSelection: _fwdRemoveSelection,
  fwdHandleFitView: _fwdHandleFitView,
  skipEdgesChangeRef,
  skipNodesChangeRef,
} = useFlowCanvasState(findNode)

// ==================== Canvas Performance ====================
const {
  renderableMediaNodeIds,
  thumbRenderableMediaNodeIds,
  fullRenderNodeIds,
  isSelectionBoxActive,
  isViewportMoving,
  effectiveRenderZoom,
  isLightweightNodeMode,
  isUltraLightCanvasMode,
  isViewportCanvasPreviewMode,
  showOverviewCanvas,
  isPointSelectionSuppressed,
  isInteractionEffectsSuppressed,
  isLargeCanvasConnectionMode,
  shouldSuspendHeavyCanvasWork,
  defaultEdgeOptions,
  effectiveMediaPreviewLimit,
  isZoomPromotionPending,
  viewportVisibleMediaCount,
  getMediaRenderBudget,
  getFullNodeRenderBudget,
  getViewportWorldBounds,
  isNodeIntersectingWorldBounds,
  updateRenderableMediaNodeIds,
  scheduleRenderableMediaNodeIdsUpdate,
  schedulePointOverviewRender,
  renderPointOverviewCanvas,
  updateEdgeStyles,
  clearTimers,
  clearViewportMovingResetTimer,
  onViewportMoveStart,
  onViewportMoveEnd,
  setPendingEdgeStyleSync,
  getPendingEdgeStyleSync,
} = useCanvasPerformance({
  nodes,
  edges,
  viewport,
  flowCanvasWrapperRef,
  pointOverviewCanvasRef,
  mediaPreviewLimit,
  edgeStyle,
  isDraggingNode,
  isResizing,
  getSelectedNodes,
  classification: {
    getNodeWidth,
    getNodeHeight,
    isRenderableMediaNode,
    hasRenderableMediaThumb,
    isPlaceholderEligibleNode,
  },
  toolbarDropdown,
  groupToolbarDropdown,
  hoveredNodeId,
  findNode,
  isConnecting,
  clearSourceConnectionHighlight: (...a) => late.clearSourceConnectionHighlight(...a),
})

// ==================== Point Selection ====================
const {
  pointSelectionRectStyle,
  clientPointToCanvasPoint,
  clearPointSelectionState,
  shouldIgnorePointSelectionTarget,
  applyPointModeSelection,
  onPointSelectionPointerMove,
  onPointSelectionPointerUp,
} = usePointSelection({
  nodes,
  edges,
  viewport,
  flowCanvasWrapperRef,
  classification: { getNodeWidth, getNodeHeight },
  emit,
  updateEdgeStyles,
  stopPanelClickOutside: (...a) => late.stopPanelClickOutside(...a),
  clearMultiSelectionConnection: (...a) => late.clearMultiSelectionConnection(...a),
})

// 闁硅矇鍐ㄧ厬闁告瑧澧楀Λ鈺勭疀濡ゅ绀勯柛妤佹磻缁躲儵鏁嶇仦鑲╃憿 FlowView 闁稿繐褰夐棅鈺呮晬?
const { addLog } = useConsole()

// ==================== Flow History ====================
const saveHistory = (): void => emit('draft-save')

// ==================== Data Flow ====================
const {
  getUpstreamMedia: getUpstreamMediaDF,
  propagateDataFlow,
  getUpstreamPrompt,
  syncTargetNodePrompt,
  isValidFlowEdge,
  nodeSupportsFileUrls,
  disconnectUpstreamEdges,
  handleRemoveUpstream: handleRemoveUpstreamDF,
} = useDataFlow({
  nodes,
  edges,
  findNode,
  shouldSuspendHeavyCanvasWork,
  selectedPanelNode: () => selectedPanelNode.value,
  classification: {
    isImageLikeNode,
    isVideoLikeNode,
    getNodeMediaReferenceKey,
    normalizeReferenceUrlKey,
  },
  inferMediaTypeFromUrl,
  emit,
  saveHistory,
})

// ==================== Node Factory ====================
const {
  createRuntimeId,
  createEdgeId,
  getPrimaryPortId,
  syncNodeEdgeHandles,
  cloneIncomingEdgeToTarget,
  getNodeBoxSize,
  getConnectedAssetNodePosition,
  getAssetNodePositionBelow,
  createConnectedAssetNode,
  getStackedAssetNodePosition,
  getUpstreamAssetNodePosition,
} = useNodeFactory({
  nodes,
  edges,
  findNode,
  edgeStyle,
  emit,
  updateNodeInternals,
  buildRuntimeAssetNodeData,
  buildPortsForNode,
  getGenerationCardHorizontalGap: (...a) => late.getGenerationCardHorizontalGap(...a),
  fixedSizeTypes,
})

// ==================== File Upload ====================
const {
  imageCompressDialog,
  classifyUploadFile,
  handleImageCompressDialogVisibleChange,
  handleImageCompressDialogCancel,
  handleImageCompressDialogConfirm,
  createUploadNodesFromFiles,
  maybeCompressImageFilesBeforeUpload,
} = useFileUpload({
  nodes,
  edges,
  findNode,
  edgeStyle,
  emit,
  createRuntimeId,
  getPrimaryPortId,
  syncNodeEdgeHandles,
  isValidFlowEdge,
  propagateDataFlow,
  refreshOpenGenerationPanelForNode: (...a) => late.refreshOpenGenerationPanelForNode(...a),
  saveHistory,
  updateNodeInternals,
  buildRuntimeAssetNodeData,
  buildPortsForNode,
  getUpstreamAssetNodePosition,
  getStackedAssetNodePosition,
  assignToGroupIfOverlapping: (...a) => late.assignToGroupIfOverlapping(...a),
  fixedSizeTypes,
})

// ==================== Flow References ====================
const {
  connectReferenceItemsToNode,
  handleInferUpstream,
  handleClipboardReferencePasted,
  handleWorkflowReferenceDropped,
  getNodeStoredReferenceItems,
  resolveNodeReferenceItems,
  triggerNodeInferUpstream,
  handleBatchInferUpstream,
  normalizeReferenceOrderKey,
  buildReferenceOrderFromNodeAndUrls,
  ensureReferenceCardsForNode,
  handleReferenceUrlUpdated,
  handleConnectMatching,
} = useFlowReferences({
  nodes,
  edges,
  findNode,
  getSelectedNodes,
  emit,
  selectedPanelNode: () => selectedPanelNode.value,
  generationPanelRef: () => generationPanelRef.value,
  edgeStyle,
  contextMenu,
  skipEdgesChange: { get value() { return skipEdgesChangeRef.value }, set value(v) { skipEdgesChangeRef.value = v } },
  skipNodesChange: { get value() { return skipNodesChangeRef.value }, set value(v) { skipNodesChangeRef.value = v } },
  classification: {
    normalizeReferenceUrlKey,
    getNodeMediaReferenceKey,
    isImageLikeNode,
    isVideoLikeNode,
    getReferenceMediaType,
    getReferenceLabelByMediaType,
    getReferenceNodeType,
  },
  factory: {
    createRuntimeId,
    createEdgeId,
    getPrimaryPortId,
    syncNodeEdgeHandles,
  },
  dataFlow: {
    propagateDataFlow,
    isValidFlowEdge,
  },
  buildRuntimeAssetNodeData,
  fixedSizeTypes,
  createUploadNodesFromFiles,
  refreshOpenGenerationPanelForNode: (...a) => late.refreshOpenGenerationPanelForNode(...a),
  saveHistory,
  updateNodeInternals,
  inferMediaTypeFromUrl,
  getReferenceUrls,
  findTeamonesAigcRecord,
})

// 濮捬呭У閻栵絾鎷呭鍥╂瀭闁挎稑鐗忛弫銈嗙鎼达絿鐓掗悹鎰彧缁辨繈宕ョ仦鐐槯闁?useFlowClipboard 闁?useKeyboardShortcuts 濞戞搩鍘烘繛鍥偨椤帞绀?
const lastMousePosition = ref({ x: 0, y: 0 })

// 闂佹鍠氬ú?缂侇喗顭堥崚娑㈡儎缁嬪灝褰犵€规悶鍎遍崣鍧楀礄閼恒儲娈?
const _isPointInsideCanvas = (x: number, y: number): boolean => isPointInsideCanvas(x, y, flowCanvasWrapperRef)
const _getCanvasPastePosition = (_event: ClipboardEvent): { x: number; y: number } | null => {
  const wrapper = flowCanvasWrapperRef.value
  const rect = wrapper?.getBoundingClientRect?.()
  if (!rect) return null
  const mouseInsideCanvas = _isPointInsideCanvas(lastMousePosition.value.x, lastMousePosition.value.y)
  if (mouseInsideCanvas) {
    return project(clientPointToCanvasPoint(lastMousePosition.value.x, lastMousePosition.value.y))
  }
  return project({ x: rect.width / 2, y: rect.height / 2 })
}

// ==================== Clipboard ====================
const {
  clipboard,
  collectSelectedClipboardPayload,
  handleCanvasPaste,
  addAnnotationNote,
} = useFlowClipboard({
  nodes,
  edges,
  emit,
  props,
  normalizeSubgraphName: (...a) => late.normalizeSubgraphName(...a),
  buildUniquePastedSubgraphLabel: (...a) => late.buildUniquePastedSubgraphLabel(...a),
  createRuntimeId,
  assignToGroupIfOverlapping: (...a) => late.assignToGroupIfOverlapping(...a),
  registerGridChildIfNeeded: (...a) => late.registerGridChildIfNeeded(...a),
  addNodes,
  addEdges,
  saveHistory,
  getExpandedSelectedNodes: (...a) => late.getExpandedSelectedNodes(...a),
  isPointInsideCanvas: _isPointInsideCanvas,
  isTextInputLike,
  isGenerationPanelInputLike,
  getCanvasPastePosition: _getCanvasPastePosition,
  lastMousePosition,
  createUploadNodesFromFiles,
})

function addLocationMarker(x: number, y: number): void {
  const markerIndex = nodes.value.filter((node: any) => node?.type === 'location_marker').length + 1
  addNodes([{
    id: createRuntimeId('node'),
    type: 'location_marker',
    position: { x, y },
    data: buildBaseNodeRuntimeData({
      nodeType: 'location_marker',
      label: `位置标记 ${markerIndex}`,
      mediaType: 'text',
    }),
    style: fixedSizeTypes.location_marker,
  }])
}

const {
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
} = useLocationMarkerNavigator({
  nodes,
  setCenter,
  getZoom: () => viewport.value.zoom,
})

// ==================== Cut Drag ====================
const {
  isCutKeyPressed,
  cutDragStartPoint,
  cutPreviewEdgeIds,
  syncCutPreviewClasses,
  queueCutEdgeRemoval,
  clearCutPreview,
  _pendingCutDeleteEdgeIds,
  _cutDeleteTimer,
} = useCutDrag({
  edges,
  emit,
  saveHistory,
})

// ==================== Node Highlight ====================
const {
  applyHighlight: applyNodeHighlightRaw,
  clearHighlight: clearNodeHighlightRaw,
  getNodeHighlightColor,
} = useNodeHighlight({ nodes, saveHistory, findNode })

function syncHighlightedNodes() {
  emit('update:modelNodes', nodes.value)
}

function applyNodeHighlight(colorIndex: number) {
  const ids = getSelectedNodes.value.map((n: any) => n.id).filter(Boolean)
  if (!ids.length) return
  applyNodeHighlightRaw(ids, colorIndex)
  syncHighlightedNodes()
}

function clearNodeHighlight(nodeIds: string[]) {
  if (!Array.isArray(nodeIds) || !nodeIds.length) return
  clearNodeHighlightRaw(nodeIds)
  syncHighlightedNodes()
}

// ==================== Keyboard Shortcuts ====================
const {
  matchesShortcut,
  getShortcut,
  handleKeyDown,
  isShiftPressed,
  isCtrlPressed,
  isSpacePressed,
} = useKeyboardShortcuts({
  flowCanvasWrapperRef,
  nodes,
  edges,
  clipboard,
  showGrid,
  showMinimap,
  multiSelectionActive,
  selectionState,
  emit,
  props,
  getSelectedNodes,
  addSelectedNodes,
  removeSelectedNodes,
  getExpandedSelectedNodes: (...a) => late.getExpandedSelectedNodes(...a),
  removeSelection: (opts) => { const fn = _fwdRemoveSelection.current; return fn ? fn(opts) : false },
  handleFitView: () => { const fn = _fwdHandleFitView.current; fn?.() },
  handleGroupSelected: (...a) => late.handleGroupSelected(...a),
  handleUngroupSelected: (...a) => late.handleUngroupSelected(...a),
  arrangeNodes: (...a) => late.arrangeNodes(...a),
  handleAutoLayout: (...a) => late.handleAutoLayout(...a),
  handleDistribute: (...a) => late.handleDistribute(...a),
  handleAlign: (...a) => late.handleAlign(...a),
  addAnnotationNote,
  addLocationMarker,
  collectSelectedClipboardPayload,
  clearCutPreview,
  isCutKeyPressed,
  isTextInputLike,
  getCanvasPastePosition: _getCanvasPastePosition,
  lastMousePosition,
  fitView,
  locationMarkerNavigatorVisible,
  focusSingleOrOpenLocationMarkerNavigator,
  moveActiveLocationMarker,
  confirmActiveLocationMarker,
  closeLocationMarkerNavigator,
  applyNodeHighlight,
})

// ==================== Group Nodes ====================
const {
  assignToGroupIfOverlapping,
  handleGridDrop,
  cleanupGridOrdersForDeletedNodes,
  registerGridChildIfNeeded,
  handleGroupSelected,
  handleUngroupSelected,
  getGroupDepth,
  isGroupSelfOrAncestorOf,
  isPointInsideGroup,
  getBoundedNodePositionInGroup,
  isNodeFullyInsideGroup,
  getDirectChildNodes,
  applyCollapsedGroupFrame,
  collectDescendantNodeIds,
  syncCollapsedGroupVisibility,
  captureExpandedGroupFrame,
  restoreExpandedGroupFrame,
  layoutGridChildren,
  resizeGroupToFitChildren,
  resizeGroupChain,
  syncGroupBoundsForNodes,
  toggleGroupToolbarDropdown,
  getExpandedSelectedNodes,
  normalizeSubgraphName,
  buildUniquePastedSubgraphLabel,
  handleCreateSubgraph,
  handleCreateEmptySubgraph,
} = useGroupNodes({
  nodes,
  edges,
  findNode,
  getSelectedNodes,
  contextMenu,
  groupToolbarDropdown,
  allowSubgraphCreate: props.allowSubgraphCreate,
  emit,
  saveHistory,
})

late.normalizeSubgraphName = normalizeSubgraphName
late.buildUniquePastedSubgraphLabel = buildUniquePastedSubgraphLabel
late.assignToGroupIfOverlapping = assignToGroupIfOverlapping
late.handleGridDrop = handleGridDrop
late.registerGridChildIfNeeded = registerGridChildIfNeeded
late.getExpandedSelectedNodes = getExpandedSelectedNodes
late.handleGroupSelected = handleGroupSelected
late.handleUngroupSelected = handleUngroupSelected

// ==================== Flow Connections ====================
const flowConnections = useFlowConnections({
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
  assignToGroupIfOverlapping: (...a) => late.assignToGroupIfOverlapping(...a),
  isEmptyGenerationSourceNode,
  isLargeCanvasConnectionMode,
  syncTargetNodePrompt,
  revealManualGenerationPanel: (...a) => late.revealManualGenerationPanel(...a),
  isInteractionEffectsSuppressed,
  multiSelectionConnectorAnchor: computed(() => late.multiSelectionConnectorAnchor?.value ?? null),
  clientPointToCanvasPoint,
})

const {
  connectionStartHandle,
  connectionPopup,
  sourceConnectionNodeIds,
  sourceConnectionMode,
  multiSelectionPointer,
  groupConnectionPointer,
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
} = flowConnections

late.clearSourceConnectionHighlight = clearSourceConnectionHighlight
late.clearMultiSelectionConnection = clearMultiSelectionConnection

// ==================== Multi Selection Connection ====================
const {
  multiSelectionConnectorHandleRef,
  selectedNodes,
  multiSelectionBounds,
  multiSelectionHotspotStyle,
  multiSelectionToolbarStyle,
  multiSelectionConnectorStyle,
  multiSelectionConnectorAnchor,
  connectionDragLine,
  updateNodeClassToken,
  handleMultiSelectionIntentEnter,
  handleMultiSelectionIntentLeave,
} = useMultiSelectionConnection({
  nodes,
  edges,
  findNode,
  getSelectedNodes,
  isConnecting,
  emit,
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
})

late.multiSelectionConnectorAnchor = multiSelectionConnectorAnchor

const {
  compareDialogVisible,
  compareDialogItems,
  videoPreviewVisible,
  videoPreviewUrls,
  videoSourceNodeIds,
  mediaSelectionAction,
  detailSelectionAvailable,
  triggerSelectionAction,
  triggerDetailAction,
} = useFlowMultiSelectionMedia({
  selectedNodes,
  getNodeMediaType,
  openDetailForNodes: (nodesData) => late.openDetailModalForNodes(nodesData),
})

// ==================== Multi-Selection Capture Frame ====================
let multiCaptureOffsets: Map<string, number> = new Map()

function onMultiSelectionCaptureFrame({ url, sourceNodeId }: { url: string; sourceNodeId: string }) {
  if (!sourceNodeId || !url) return
  const sourceNode = findNode(sourceNodeId)
  const label = sourceNode?.data?.label || '视频'
  const count = multiCaptureOffsets.get(sourceNodeId) || 0

  const sourceX = Number(sourceNode?.position?.x || 0)
  const sourceY = Number(sourceNode?.position?.y || 0)
  const sourceSize = getNodeBoxSize(sourceNode)
  const columnGap = late.getGenerationCardHorizontalGap(sourceNode)
  const verticalGap = 28
  const nodeHeight = 180

  createConnectedAssetNode(sourceNodeId, {
    id: createFlowId('node'),
    label: `${label} - 帧截图`,
    url,
    mediaType: 'image',
    style: { width: '320px', height: '180px' },
    position: {
      x: sourceX + sourceSize.width + columnGap,
      y: sourceY + count * (nodeHeight + verticalGap),
    },
  })

  multiCaptureOffsets.set(sourceNodeId, count + 1)
  saveHistory()
  // 延迟关闭对话框，确保批量截帧全部处理完毕
  nextTick(() => { videoPreviewVisible.value = false })
}

watch(videoPreviewVisible, (visible) => {
  if (!visible) multiCaptureOffsets = new Map()
})

// ==================== Context Menu ====================
const generationStore = useGenerationStore()
  const {
    closeContextMenu,
    clampContextMenu,
    contextMenuNodes,
    contextMenuPrimaryNodes,
    contextMenuGenerationNodes,
    contextMenuOtherNodes,
  onPaneContextMenu,
  onNodeContextMenu,
  handleAddNodeFromContext,
  onPaneClick,
} = useFlowContextMenu({
  contextMenu,
  ctxSubmenu,
  connectionPopup,
  vueFlowRef,
  nodes,
  findNode,
  addSelectedNodes,
  multiSelectionActive,
  isShiftPressed,
  isCtrlPressed,
  generationStore,
  hideGenerationPanel: (...a) => late.hideGenerationPanel(...a),
  revealManualGenerationPanel: (...a) => late.revealManualGenerationPanel(...a),
  saveHistory,
  emit,
  project,
  props,
  defaultMediaNodes,
  HIDDEN_NODE_TYPES,
  getNodeIcon,
  getNodeIconColor,
  getNodeTypeDef,
  applyWorkflowRememberedRequest,
  applyPresetData,
  createRuntimeId,
  buildBaseNodeRuntimeData,
  getDefaultCapabilityByNodeType,
  fixedSizeTypes,
  assignToGroupIfOverlapping: (...a) => late.assignToGroupIfOverlapping(...a),
  selectionState,
  createUploadNodesFromFiles,
})

// ==================== Result Normalization ====================
const {
  extractUrl,
  extractPreviewUrl,
  extractThumbUrl,
  cloneGenerationState,
  normalizePublisher,
  updateWorkflowNodeState,
  tryParseJsonPayload,
  unwrapCompletedResultPayload,
  normalizeResultItems,
  getResultItemNodeType,
  getResultRecordId,
  buildResultNodeData,
  getCompletedResultLabel,
  getNodeDataRecordId,
  getNodeRepairRecordId,
  nodeHasActiveGenerationTask,
  isRepairableGeneratingNode,
  isRepairableResultThumbnailNode,
  isRepairableMissingResultNode,
  nodeHasResolvedResult,
  applyResolvedAssetToNodeData,
  extractGenerateFailReason,
  removeGeneratingPlaceholderNodes,
  extractEventRecordId,
  applyRecordIdToNodeData,
  getCachedAllowGenerateCountSchema,
  getRememberedGenerateCount,
  inferRegenerateType,
  inferNodeOutputMediaType,
  buildRegenerateContextFromRecord,
  markRegenerateSubmitCooldown,
  nodeHasGenerationContext,
  buildDetachedCopyLabel,
  resolveResultModelDisplayName,
  extractResultLabelPrefix,
  isGenericResultLabelPrefix,
  shouldOverwriteResultLabel,
  resolveLockedResultLabelName,
  getNodeStoredModelDisplayName,
  resolveNodeModelDisplayName,
  buildResultCardLabel,
  ensureResolvedResultTitle,
  isBlankGenerationNodeData,
  getDetachedCopyPosition,
  createDetachedGenerationNode,
} = useResultNormalization({
  nodes,
  edges,
  emit,
  saveHistory,
  findNode,
  selectedPanelNode,
  buildBaseNodeRuntimeData,
  getDefaultCapabilityByNodeType,
  GENERATION_PANEL_CAPABILITIES,
  getNodeGenerationCapability,
  getWorkflowRememberedRequest,
  applyWorkflowRememberedRequest,
  applyPresetData,
  isFileInputNodeType,
  hasNodeResultUrl,
  canOpenGenerationPanel,
  buildWorkflowRequestFromNodeData,
  buildRuntimeAssetNodeData,
  inferMediaType,
  buildPortsForNode,
  getReferenceUrls,
  sanitizeWorkflowRequestParams,
  taskQueueStore,
  REPAIRABLE_GENERATION_NODE_TYPES,
  getNodeUrl,
  resolveOriginalNodeId: () => '',
  fixedSizeTypes,
  assignToGroupIfOverlapping,
  propagateDataFlow,
  isValidFlowEdge,
  createEdgeId,
  createRuntimeId,
  updateNodeInternals,
  syncNodeEdgeHandles,
  buildReferenceOrderFromNodeAndUrls,
})

// ==================== Generation Orchestration ====================
const {
  // Panel management
  showGenerationPanel,
  handleGenerationPanelLayoutChange,
  hideGenerationPanel,
  revealManualGenerationPanel,
  createGenerationTargetForExistingResult,
  clearGenerationPanel,

  // Panel lifecycle
  stopPanelClickOutside,
  startPanelClickOutside,

  // Viewport
  getGenerationPanelElement,
  ensureGenerationPanelVisibleInViewport,
  scheduleGenerationPanelViewportAdjustment,
  getConstrainedPanelPosition,
  panelStyle,

  // Upstream / refresh
  syncUpstreamPrompt,
  refreshOpenGenerationPanelForNode,
  openNodeGenerationPanel,

  // Regenerate context
  buildNodeRegenerateContext,
  removeDuplicateUpstreamNodes,

  // Generation slots
  createGeneratingResultPlaceholders,
  getGenerationSlotNodes,
  canUseSourceNodeAsGenerationSlot,
  registerSourceNodeAsGenerationSlot,
  createGenerationSlotForTask,
  assignTaskToIndexedGenerationSlot,
  shouldCreateSeparateResultCardPerTask,
  assignTaskToGenerationSlot,
  clearGenerationTaskMarkers,

  // Regen / result sync
  createRegenCard,
  syncGeneratedResultNodes,
  restoreRecordIdAndCleanup,
  resolveGenerateTargetNodeId,
  resolveOriginalNodeId,
  getGenerationSourceKey,
  markGenerationTaskCompleted,
  bindGenerationTaskToSlot,
  resolveGenerationSlotByTaskId,
  nodeOwnsGenerationTask,
  clearGenerationTaskBinding,
  attachTaskIdToGenerationState,
  getActiveGenerationTargetNodeId,
  getGenerationCardHorizontalGap,
} = useGenerationOrchestration({
  // State refs
  nodes,
  edges,
  selectedPanelNode,
  panelVisible,
  generationPanelRef,
  generationPanelLayoutTick,
  activePanelNode,
  flowCanvasWrapperRef,

  // Let variables (wrapped as objects with value)
  generationPanelViewportAdjustFrame,
  panelSwitchLockUntil: panelSwitchLockUntilAccessor,
  panelSwitchLockedNodeId: panelSwitchLockedNodeIdAccessor,
  _panelClickOutsideHandler: panelClickOutsideHandler,

  // Maps
  _activeGenerationTargetBySource,
  _activeGenerationSessionBySource,
  _generationSlotByTaskId,
  _pendingRegenHadResult,
  _pendingRegenHadRecordId,

  // Stores
  generationStore,
  assetStore,

  // Constants
  PANEL_WIDTH: 720,
  PANEL_HEIGHT_FALLBACK: 560,
  PANEL_VIEWPORT_MARGIN: 12,
  fixedSizeTypes,
  edgeStyle,

  // VueFlow
  viewport,
  setViewport,
  project,
  findNode,
  updateNodeInternals,

  // Emit & history
  emit,
  saveHistory,

  // Data flow
  propagateDataFlow,
  syncTargetNodePrompt,
  getUpstreamPrompt,
  nodeSupportsFileUrls,

  // Classification
  isImageLikeNode,
  isVideoLikeNode,
  getNodeMediaReferenceKey,
  canOpenGenerationPanel,
  hasNodeResultUrl,
  inferNodeOutputMediaType,

  // Node factory
  createRuntimeId,
  createEdgeId,
  syncNodeEdgeHandles,
  cloneIncomingEdgeToTarget,
  buildPortsForNode,

  // Result normalization
  normalizeResultItems,
  buildResultNodeData,
  getResultItemNodeType,
  extractPreviewUrl,
  getResultRecordId,
  getNodeDataRecordId,
  buildRegenerateContextFromRecord,
  nodeHasGenerationContext,
  getCachedAllowGenerateCountSchema,
  getRememberedGenerateCount,
  markRegenerateSubmitCooldown,
  buildResultCardLabel,
  createDetachedGenerationNode,
  getDetachedCopyPosition,
  buildDetachedCopyLabel,
  buildRuntimeWorkflowNodeData,
  ensureResolvedResultTitle,
  cloneGenerationState,
  removeGeneratingPlaceholderNodes,
  nodeHasResolvedResult,
  applyResolvedAssetToNodeData,
  applyRecordIdToNodeData,
  inferRegenerateType,

  // API
  createGeneration,
  subscribeTaskEvents,
})

late.stopPanelClickOutside = stopPanelClickOutside
late.getGenerationCardHorizontalGap = getGenerationCardHorizontalGap
late.refreshOpenGenerationPanelForNode = refreshOpenGenerationPanelForNode
late.revealManualGenerationPanel = revealManualGenerationPanel
late.hideGenerationPanel = hideGenerationPanel

// 闁煎搫鍊婚崑锝夊矗濡搫顕у璺哄閹?- 闁告瑯浜滃﹢顏堟閻愭潙鐝涢柛鏂诲妽濡炲倿宕ョ仦缁㈠妱
const { checkValidConnection } = useFlowCanvasEdgeInteractions({
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeUpdateStart,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  onEdgeClick,
  onEdgeDoubleClick,
  skipNodesChangeRef,
  skipEdgesChangeRef,
  isDraggingNode,
  isResizing,
  emit,
  nodes,
  edges,
  getSelectedNodes,
  isPointSelectionSuppressed,
  updateEdgeStyles,
  validateConnection,
  isConnecting,
  isLargeCanvasConnectionMode,
  findNode,
  connectSelectedNodesToTarget,
  getEligibleGroupChildSourceNodes,
  connectGroupChildrenToTarget,
  connectGroupAggregateToTarget,
  connectSourceNodesToTarget,
  addEdges,
  propagateDataFlow,
  saveHistory,
  syncTargetNodePrompt,
  project,
  vueFlowRef,
  createRuntimeId,
  edgeStyle,
  removeEdges,
  addNodes,
  pendingInvalidConnectionMessageRef: {
    get value() { return flowConnections.pendingInvalidConnectionMessage },
    set value(v) { flowConnections.pendingInvalidConnectionMessage = v },
  },
})

// ==================== Generation Pipeline ====================
const {
  isRepairingGeneratingNodes,
  promptRegenerateCount,
  ensureCanStartRegenerate,
  focusReeditNode,
  triggerNodeReEdit,
  triggerNodeRegenerate,
  resolveCompletedResultAsset,
  handleRepairGeneratingNodes,
  repairResultNodeById,
  handleForceRepairSelectedNodes,
  applyRecordToExistingResultNode,
  replaceGeneratingNodesWithResultCards,
  fillResultPlaceholders,
  applyCompleteResult,
  _applyCompleteResultInner,
  handleGenerate,
} = useGenerationPipeline({
  nodes,
  edges,
  selectedPanelNode,
  panelVisible,
  panelSwitchLockUntil: { get value() { return panelSwitchLockUntilRef.value }, set value(v) { panelSwitchLockUntilRef.value = v } },
  panelSwitchLockedNodeId: { get value() { return panelSwitchLockedNodeIdRef.value }, set value(v) { panelSwitchLockedNodeIdRef.value = v } },
  _pendingRegenHadResult,
  _pendingRegenHadRecordId,
  _activeGenerationTargetBySource,
  _activeGenerationSessionBySource,
  _generationSlotByTaskId,
  emit,
  findNode,
  createConnectedAssetNode,
  getNodeBoxSize,
  getSelectedNodes,
  addSelectedNodes,
  removeSelectedNodes,
  updateNodeInternals,
  taskQueueStore,
  nodeTypes: props.nodeTypes,
  canOpenGenerationPanel,
  hasNodeResultUrl,
  isFileInputNodeType,
  propagateDataFlow,
  isValidFlowEdge,
  createRuntimeId,
  createEdgeId,
  syncNodeEdgeHandles,
  cloneIncomingEdgeToTarget,
  connectReferenceItemsToNode,
  resolveNodeReferenceItems,
  ensureReferenceCardsForNode,
  extractUrl,
  extractPreviewUrl,
  normalizeResultItems,
  getResultItemNodeType,
  getResultRecordId,
  buildResultNodeData,
  getNodeDataRecordId,
  getNodeRepairRecordId,
  applyResolvedAssetToNodeData,
  extractEventRecordId,
  applyRecordIdToNodeData,
  buildResultCardLabel,
  ensureResolvedResultTitle,
  clearGenerationTaskMarkers,
  removeGeneratingPlaceholderNodes,
  nodeHasResolvedResult,
  nodeHasGenerationContext,
  buildDetachedCopyLabel,
  getDetachedCopyPosition,
  createDetachedGenerationNode,
  getNodeStoredModelDisplayName,
  resolveNodeModelDisplayName,
  inferMediaType,
  markRegenerateSubmitCooldown,
  buildNodeRegenerateContext,
  createGenerationTargetForExistingResult,
  resolveGenerateTargetNodeId,
  resolveOriginalNodeId,
  getActiveGenerationTargetNodeId,
  getGenerationSourceKey,
  markGenerationTaskCompleted,
  getGenerationSlotNodes,
  canUseSourceNodeAsGenerationSlot,
  registerSourceNodeAsGenerationSlot,
  createGenerationSlotForTask,
  assignTaskToIndexedGenerationSlot,
  assignTaskToGenerationSlot,
  bindGenerationTaskToSlot,
  resolveGenerationSlotByTaskId,
  nodeOwnsGenerationTask,
  clearGenerationTaskBinding,
  attachTaskIdToGenerationState,
  shouldCreateSeparateResultCardPerTask,
  createGeneratingResultPlaceholders,
  createRegenCard,
  syncGeneratedResultNodes,
  restoreRecordIdAndCleanup,
  showGenerationPanel,
  hideGenerationPanel,
  fixedSizeTypes,
  createGeneration,
  subscribeTaskEvents,
  findTeamonesAigcRecord,
  buildRuntimeWorkflowNodeData,
  buildReferenceOrderFromNodeAndUrls,
  sanitizeWorkflowRequestParams,
  assignToGroupIfOverlapping,
  saveHistory,
  addLog,
  triggerNodeInferUpstream,
  closeContextMenu,
  isRepairableGeneratingNode,
  isRepairableMissingResultNode,
  isRepairableResultThumbnailNode,
  updateWorkflowNodeState,
  extractGenerateFailReason,
})

// 闁搞儱澧芥晶?閻熸瑥妫濋。鍓佺磼閸℃艾螡闂傚牄鍨哄?
const {
  detailModalVisible,
  detailImages,
  detailImageInfo,
  detailIsVideo,
  detailIs360,
  detailNodeData,
  detailNodeId,
  detailRecordId,
  detailHistoryOverride,
  detailIsFavorited,
  referenceEditSourceNodeId,
  editingImageUrl,
  editingImageFile,
  editingVideoUrl,
  editingVideoFile,
  openEditorForNode,
  openDetailModal,
  openDetailModalForNodes,
  handleSelectHistoryFromPreview,
  handleDetailReEdit,
  handleDetailRegenerate,
  handleDetailDelete,
  handleDetailFavorite,
  handleDetailEditImage,
  handleDetailEditVideo,
  closeImageEditor,
  closeVideoEditor,
  onDetailImageEditApply,
  onDetailVideoEditApply,
  onVideoEditorCaptureFrame,
  hasPrevRecord,
  hasNextRecord,
  goToPrevRecord,
  goToNextRecord,
} = useMediaPreview({
  nodes,
  edges,
  emit,
  findNode,
  saveHistory,
  isImageLikeNode,
  isVideoLikeNode,
  getNodeMediaType,
  hasNodeResultUrl,
  getNodeDataRecordId,
  removeSelection: (opts) => { const fn = _fwdRemoveSelection.current; return fn ? fn(opts) : false },
  triggerNodeRegenerate,
  focusReeditNode,
  triggerNodeReEdit,
  createConnectedAssetNode,
  getAssetNodePositionBelow,
  getNodeBoxSize,
})

late.openDetailModalForNodes = openDetailModalForNodes

const { handleApply: onDetailImageEditApplyWrapped } = useReferenceEditApply(
  {
    nodes,
    edges,
    emit,
    findNode,
    saveHistory,
    createConnectedAssetNode,
    getUpstreamAssetNodePosition,
    getPrimaryPortId,
    syncNodeEdgeHandles,
    createEdgeId,
    edgeStyle,
    propagateDataFlow,
    updateNodeInternals,
  },
  { referenceEditSourceNodeId, detailNodeId, detailNodeData, closeImageEditor, onDetailImageEditApply },
)

watch([editingImageUrl, editingVideoUrl], ([img, vid]) => {
  imageEditorVisible.value = !!(img || vid)
}, { immediate: true })

// 监听任意 grid 分组的 gridOrder 变化（用户拖动换位 / 删格 / 拖入补位），
// 触发 propagateDataFlow 让下游生成面板按新的从左到右顺序刷新参考。
watch(
  () => nodes.value
    .filter((n: any) => n?.type === 'groupNode' && n?.data?.layoutMode === 'grid')
    .map((g: any) => `${g.id}:${Array.isArray(g.data?.gridOrder) ? g.data.gridOrder.join(',') : ''}`)
    .join('||'),
  () => {
    // 先把"上游 gridOrder 已变"信号传给下游生成节点：清掉它们持久化的 referenceOrder，
    // 否则 injectUpstreamMedia 会按旧 referenceOrder 重排，参考区看不到新顺序。
    const groupChildNodeIds = new Set<string>()
    nodes.value.forEach((g: any) => {
      if (g?.type !== 'groupNode' || g?.data?.layoutMode !== 'grid') return
      const order: string[] = Array.isArray(g.data?.gridOrder) ? g.data.gridOrder : []
      order.forEach((id: string) => id && groupChildNodeIds.add(id))
    })
    if (groupChildNodeIds.size) {
      nodes.value.forEach((n: any) => {
        if (!n || n.type === 'groupNode') return
        const inputs = n.data?._upstreamInputs
        if (!inputs) return
        const touched = ['images', 'videos', 'audios', 'models3d'].some((k) =>
          Array.isArray(inputs[k]) && inputs[k].some((m: any) => m?.nodeId && groupChildNodeIds.has(m.nodeId)),
        )
        if (!touched) return
        if (n.data?._genState?.referenceOrder) n.data._genState.referenceOrder = undefined
        if (n.data?.referenceOrder) n.data.referenceOrder = undefined
      })
    }
    propagateDataFlow()
  },
  { flush: 'post' },
)

type SplitUploadItem = {
  url: string
  thumbUrl: string
  index: number
}

function openSplitUploadMessage(message: string) {
  return ElMessage({ message, type: 'info', duration: 0 })
}

function buildSplitUploadMessage(completed: number, total: number): string {
  const safeTotal = Math.max(1, total)
  const percent = Math.round((completed / safeTotal) * 100)
  return `正在上传拆分图片 ${completed}/${safeTotal}（${percent}%）`
}

async function uploadSplitPiecesWithProgress(
  sourceLabel: string,
  rows: number,
  cols: number,
  pieces: { url: string; blob: Blob; index?: number }[],
  onProgress?: (completed: number, total: number) => void,
): Promise<PromiseSettledResult<SplitUploadItem>[]> {
  let completed = 0
  let messageHandler = openSplitUploadMessage(buildSplitUploadMessage(completed, pieces.length))
  const updateProgress = () => {
    completed += 1
    onProgress?.(completed, pieces.length)
    messageHandler.close()
    messageHandler = openSplitUploadMessage(buildSplitUploadMessage(completed, pieces.length))
  }

  try {
    return await Promise.allSettled(
      pieces.map(async (piece, i) => {
        const pieceIndex = piece.index ?? i
        const idx = pieceIndex + 1
        const padded = String(idx).padStart(2, '0')
        const fileName = `${sourceLabel}_拆分_${rows}x${cols}_${padded}.png`
        const file = new File([piece.blob], fileName, { type: 'image/png' })
        try {
          const url = await uploadFileToCosUrl(file, fileName)
          const thumbFile = await createThumbnailFileIfNeeded(file)
          const thumbUrl = thumbFile ? await uploadFileToCosUrl(thumbFile, thumbFile.name) : url
          return { url, thumbUrl, index: pieceIndex }
        } finally {
          updateProgress()
        }
      }),
    )
  } finally {
    messageHandler.close()
  }
}

const handleSplitResult = async (data: {
  sourceNodeId?: string
  mode: { rows: number; cols: number }
  pieces: { url: string; blob: Blob; index?: number }[]
  sourceImageSize?: { width: number; height: number }
  onProgress?: (completed: number, total: number) => void
  onSettled?: () => void
}) => {
  const sourceNodeId = data.sourceNodeId || detailNodeId.value || detailNodeData.value?.nodeId
  const sourceNode = sourceNodeId ? findNode(sourceNodeId) : null
  if (!sourceNode) {
    ElMessage.error('未找到需要切分的图片节点')
    data.onSettled?.()
    return
  }
  try {
    const sourceLabel = sourceNode.data?.label || '图片'
    const sourcePos = sourceNode.position || { x: 0, y: 0 }
    const sourceSize = getNodeBoxSize(sourceNode)
    const { rows, cols } = data.mode
    const sourceMediaMeta = normalizeWorkflowMediaMeta(sourceNode.data || {})
    const sourceWidth = data.sourceImageSize?.width || sourceMediaMeta?.width || sourceSize.width
    const sourceHeight = data.sourceImageSize?.height || sourceMediaMeta?.height || sourceSize.height
    const sourceAspectRatio = data.sourceImageSize
      ? sourceWidth / Math.max(sourceHeight, 1)
      : sourceMediaMeta?.aspectRatio || sourceWidth / Math.max(sourceHeight, 1)
    const splitGroupSize = {
      width: sourceSize.width,
      height: sourceSize.width / Math.max(sourceAspectRatio, 0.01),
    }
    const tileMediaMeta = buildWorkflowMediaMeta(
      sourceWidth / Math.max(cols, 1),
      sourceHeight / Math.max(rows, 1),
      sourceAspectRatio * rows / Math.max(cols, 1),
    )
    const uploaded = await uploadSplitPiecesWithProgress(sourceLabel, rows, cols, data.pieces, data.onProgress)

    const succeeded = uploaded.filter((r): r is PromiseFulfilledResult<{ url: string; thumbUrl: string; index: number }> => r.status === 'fulfilled')
    const failed = uploaded.filter(r => r.status === 'rejected')

    if (failed.length) ElMessage.warning(`${failed.length} 张图片上传失败`)
    if (!succeeded.length) {
      ElMessage.error('全部上传失败，请重试')
      closeImageEditor()
      return
    }

    // 将上传成功的切片映射为 GridSplitPiece（行优先 index 已含在 SplitUploadItem 中）
    const pieces: GridSplitPiece[] = succeeded.map((piece) => ({
      url: piece.value.url,
      thumbUrl: piece.value.thumbUrl,
      index: piece.value.index,
      ...(tileMediaMeta ? { mediaMeta: tileMediaMeta } : {}),
    }))

    // 生成 1 个 grid 模式 groupNode + N 个 file_input 子节点（不产生边）
    createGridSplitInputGroup({
      sourceNodeId: sourceNodeId || '',
      pieces,
      rows,
      cols,
      sourcePos,
      sourceSize: splitGroupSize,
      sourceLabel,
      gap: 0,
    }, { nodes, emit })

    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    saveHistory()
    closeImageEditor()
  } finally {
    data.onSettled?.()
  }
}

const scatterBatchNodeById = (nodeId: string) => {
  const node = findNode(nodeId)
  const deps = { nodes, edges, emit, findNode, createConnectedAssetNode, getNodeBoxSize, saveHistory }
  if (node?.type === 'texture_material') {
    scatterTextureMaterialNode(nodeId, deps)
  } else {
    scatterBatchNode(nodeId, deps)
  }
}

// 组A 网格批量触发：检测生成节点是否收到来自 split-input grid 组的多输入，
// 命中则建组B + 占位 aigc_result，并 enqueue N 个独立普通生成任务。
const triggerGridSplitBatch = (genNodeId: string): boolean => {
  return triggerGridSplitBatchGeneration({
    genNodeId,
    nodes,
    edges,
    taskQueue: taskQueueStore,
    emit,
    saveHistory,
  })
}

const packSelectedToBatch = (selectedNodes: any[]) => {
  packNodesToBatch(selectedNodes, { nodes, edges, emit, findNode, createConnectedAssetNode, getNodeBoxSize, saveHistory })
}
// Note: lastMousePosition, isShiftPressed, isCtrlPressed, isCutKeyPressed and keyboard utility functions
// are now managed by useKeyboardShortcuts composable






// 闁搞儱鎼悾鍓т焊閸濆嫷鍤熼柤鍝勫€婚崑锝囩尵鐠囪尙鈧?
const selectedImageNodes = useSelectedImageNodes(selectedNodes, isImageLikeNode, getNodeMediaType)
const {
  hasSelectedResultRecords,
  areSelectedResultRecordsFavorited,
  toggleNodeResultFavorite,
  deleteNodeResultRecord,
  setSelectedResultFavorites,
  deleteSelectedResultRecords,
} = useFlowResultRecordActions({
  nodes,
  edges,
  selectedNodes,
  emit,
  saveHistory,
  assetStore,
})

const {
  prepareNodeAssetDrag,
  beginNodeAssetDrag,
  endNodeAssetDrag,
} = useFlowAssetDrag({ findNode })

// 闁告梻濮惧ù鍥熼垾宕団偓鐑藉礆濡ゅ嫨鈧?
const { consumedQueueResultKeys, dropAssetAt, connectToMatchingNodes } = useFlowCanvasLifecycle({
  models,
  saveHistory,
  clearTimers,
  props,
  nodes,
  edges,
  findNode,
  emit,
  isDraggingNode,
  isResizing,
  syncCollapsedGroupVisibility,
  skipNodesChangeRef,
  skipEdgesChangeRef,
  selectedPanelNode,
  panelVisible,
  startPanelClickOutside,
  stopPanelClickOutside,
  clearGenerationPanel,
  hideGenerationPanel,
  generationStore,
  handleCanvasPaste,
  addNodes,
  addEdges,
  applyCompleteResult,
  provided: {
    nodes,
    edges,
    viewport,
    models,
    capabilityPorts,
    renderableMediaNodeIds,
    thumbRenderableMediaNodeIds,
    fullRenderNodeIds,
    isLightweightNodeMode,
    isUltraLightCanvasMode,
    isConnecting,
    isInteractionEffectsSuppressed,
    sourceConnectionMode,
    sourceConnectionNodeIds,
    selectedNodes,
    selectedPanelNode,
    findNode,
    propagateDataFlow,
    saveHistory,
    handleCompareSelected: () => late.handleCompareSelected(),
    openEditorForNode,
    openDetailModal,
    startGroupConnectionFromZone,
    setSourceConnectionHighlight,
    clearSourceConnectionHighlight,
    collectDescendantNodeIds,
    captureExpandedGroupFrame,
    applyCollapsedGroupFrame,
    restoreExpandedGroupFrame,
    layoutGridChildren,
    resizeGroupToFitChildren,
    syncCollapsedGroupVisibility,
    updateEdgeStyles,
    scheduleRenderableMediaNodeIdsUpdate,
    updateNodeInternals,
    syncNodeEdgeHandles,
    triggerNodeReEdit,
    triggerNodeRegenerate,
    triggerNodeInferUpstream,
    repairResultNodeById,
    toggleNodeResultFavorite,
    deleteNodeResultRecord,
    createConnectedAssetNode,
    prepareNodeAssetDrag,
    beginNodeAssetDrag,
    endNodeAssetDrag,
    scatterBatchNodeById,
    triggerGridSplitBatch,
    handleImageGridSplit: (nodeId: string, result: GridSelectionResult) => (
      handleSplitResult({ ...result, sourceNodeId: nodeId })
    ),
    clearGenerationPanel,
    buildPortsForNode,
    emit,
  },
  exposed: {
    nodes,
    edges,
    findNode,
    createRuntimeId,
    buildPortsForNode,
    fixedSizeTypes,
    assignToGroupIfOverlapping,
    propagateDataFlow,
    saveHistory,
    edgeStyle,
    isImageLikeNode,
    isVideoLikeNode,
    project,
    setViewport,
    emit,
    clearGenerationPanel,
    selectedPanelNode,
  },
})

// Keyboard shortcuts are now managed by useKeyboardShortcuts composable

// ==================== Node Alignment (composable) ====================
const {
  handleAlign,
  handleDistribute,
  handleAutoLayout,
  handleTidyNodes,
  handleTidyGroupNode,
  arrangeNodes,
  handleGroupAlign,
  handleGroupDistribute,
  handleGroupAutoLayout,
  handleGroupTidyNodes,
  toggleSelectedGroupLock,
  showGroupAlignmentToolbar,
  isSelectedGroupLocked,
  isSelectedGroupCollapsed,
  selectedGroupNodeForToolbar,
  selectedGroupChildNodes,
} = useNodeAlignment({
  nodes,
  edges,
  getSelectedNodes,
  syncGroupBoundsForNodes,
  resizeGroupToFitChildren,
  getDirectChildNodes,
  fitView,
  findNode,
  viewport,
  emit,
  saveHistory,
})

late.arrangeNodes = arrangeNodes
late.handleAutoLayout = handleAutoLayout
late.handleDistribute = handleDistribute
late.handleAlign = handleAlign

// ==================== Flow Events Composable ====================
const flowEventHandlers = useFlowEvents({
  project,
  fitView,
  findNode,
  getSelectedNodes,
  addSelectedNodes,
  removeSelectedNodes,
  multiSelectionActive,
  updateNodeInternals,
  nodes,
  edges,
  contextMenu,
  connectionPopup,
  selectedPanelNode,
  showMinimap,
  shouldAutoHideMinimap,
  selectedImageNodes,
  lastMousePosition,
  hoveredNodeId,
  edgeStyle,
  isSelectionBoxActive,
  isPointSelectionSuppressed,
  isInteractionEffectsSuppressed,
  isLargeCanvasConnectionMode,
  updateEdgeStyles,
  isDraggingNode,
  isCutKeyPressed,
  cutDragStartPoint,
  cutPreviewEdgeIds,
  _pendingCutDeleteEdgeIds,
  queueCutEdgeRemoval: (ids) => queueCutEdgeRemoval(ids),
  isShiftPressed,
  isCtrlPressed,
  isConnecting,
  assignToGroupIfOverlapping,
  handleGridDrop,
  cleanupGridOrdersForDeletedNodes,
  getExpandedSelectedNodes,
  syncGroupBoundsForNodes,
  showGenerationPanel,
  hideGenerationPanel,
  clearGenerationPanel,
  panelSwitchLockUntil: { get value() { return panelSwitchLockUntilRef.value }, set value(v) { panelSwitchLockUntilRef.value = v } },
  panelSwitchLockedNodeId: { get value() { return panelSwitchLockedNodeIdRef.value }, set value(v) { panelSwitchLockedNodeIdRef.value = v } },
  closeContextMenu,
  generationStore,
  canOpenGenerationPanel,
  isImageLikeNode,
  isVideoLikeNode,
  getNodeMediaType,
  getDefaultCapabilityByNodeType,
  applyWorkflowRememberedRequest,
  applyPresetData,
  openEditorForNode,
  openDetailModal,
  createRuntimeId,
  createUploadNodesFromFiles,
  nodeTypes: props.nodeTypes,
  fixedSizeTypes,
  saveHistory,
  emit,
  selectionState,
})

const {
  onWrapperPointerDown,
  onNodeClick,
  onNodeDoubleClick,
  onSelectionStart,
  onSelectionEnd,
  onNodeDragStart,
  onNodeDragStop,
  onNodeMouseEnter,
  onNodeMouseLeave,
  removeSelection,
  onDrop,
  handleCompareSelected,
  handleFitView,
} = flowEventHandlers

// Assign forwarding refs for composables that need these functions early
_fwdRemoveSelection.current = removeSelection
_fwdHandleFitView.current = handleFitView

late.handleCompareSelected = handleCompareSelected

// ==================== 闁哄棙鎸冲﹢鍫曞棘鐟欏嫮銆?====================
const exposed = createFlowCanvasExpose({
  capabilityPorts,
  nodes,
  edges,
  emit,
  selectedPanelNode,
  clearGenerationPanel,
  viewport,
  vueFlowRef,
  setViewport,
  applyCompleteResult,
  handleRepairGeneratingNodes,
  dropAssetAt,
  connectToMatchingNodes,
  propagateDataFlow,
  findNode,
  getSelectedNodes,
  addSelectedNodes,
  removeSelectedNodes,
  fitView,
  updateNodeInternals,
})

return {
  flowCanvasWrapperRef,
  pointOverviewCanvasRef,
  isShiftPressed,
  isCutKeyPressed,
  isSpacePressed,
  isConnecting,
  isUltraLightCanvasMode,
  isViewportCanvasPreviewMode,
  isInteractionEffectsSuppressed,
  onDrop,
  onWrapperPointerDown,
  showOverviewCanvas,
  pointSelectionRectStyle,
  nodes,
  edges,
  nodeComponents,
  snapToGrid,
  onlyRenderVisibleElements,
  isDraggingNode,
  defaultEdgeOptions,
  onNodeClick,
  onNodeDoubleClick,
  onPaneClick,
  onSelectionStart,
  onSelectionEnd,
  onPaneContextMenu,
  onNodeContextMenu,
  checkValidConnection,
  onConnectStart,
  onConnectEnd,
  onNodeDragStop,
  onNodeDragStart,
  onViewportMoveStart,
  onViewportMoveEnd,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onEdgeUpdate,
  onEdgeUpdateStart,
  onEdgeUpdateEnd,
  onEdgeClick,
  showGrid,
  selectedNodes,
  selectedGroupNodeForToolbar,
  selectedGroupChildNodes,
  isSelectedGroupCollapsed,
  isSelectedGroupLocked,
  showGroupAlignmentToolbar,
  toolbarDropdown,
  groupToolbarDropdown,
  handleAlign,
  handleDistribute,
  handleAutoLayout,
  handleTidyNodes,
  handleGroupAlign,
  handleGroupDistribute,
  handleGroupAutoLayout,
  handleGroupTidyNodes,
  toggleSelectedGroupLock,
  showMinimap,
  effectiveShowMinimap,
  shouldAutoHideMinimap,
  viewport,
  handleFitView,
  zoomTo,
  contextMenu,
  ctxSubmenu,
  closeContextMenu,
  connectionPopup,
  contextMenuNodes,
  handleAddNodeFromConnection,
  activePanelNode,
  panelVisible,
  generationPanelRef,
  panelStyle,
  handleGenerate,
  hideGenerationPanel,
  handleGenerationPanelLayoutChange,
  syncUpstreamPrompt,
  handleConnectMatching,
  handleInferUpstream,
  handleWorkflowReferenceDropped,
  handleClipboardReferencePasted,
  handleRemoveUpstreamDF,
  handleReferenceUrlUpdated,
  detailModalVisible,
  detailImages,
  detailImageInfo,
  detailIsVideo,
  detailIs360,
  detailRecordId,
  detailHistoryOverride,
  detailIsFavorited,
  openDetailModalForNodes,
  handleDetailReEdit,
  handleDetailRegenerate,
  handleDetailDelete,
  handleDetailFavorite,
  handleSelectHistoryFromPreview,
  handleDetailEditImage,
  handleDetailEditVideo,
  imageCompressDialog,
  handleImageCompressDialogVisibleChange,
  handleImageCompressDialogConfirm,
  handleImageCompressDialogCancel,
  editingImageUrl,
  editingImageFile,
  closeImageEditor,
  onDetailImageEditApply: onDetailImageEditApplyWrapped,
  editingVideoUrl,
  editingVideoFile,
  closeVideoEditor,
  onDetailVideoEditApply,
  onVideoEditorCaptureFrame,
  hasPrevRecord,
  hasNextRecord,
  goToPrevRecord,
  goToNextRecord,
  handleSplitResult,
  scatterBatchNodeById,
  packSelectedToBatch,
  applyNodeHighlight,
  clearNodeHighlight,
  getNodeHighlightColor,
  multiSelectionHotspotStyle,
  multiSelectionToolbarStyle,
  multiSelectionConnectorStyle,
  sourceConnectionMode,
  connectionDragLine,
  compareDialogVisible,
  compareDialogItems,
  videoPreviewVisible,
  videoPreviewUrls,
  videoSourceNodeIds,
  onMultiSelectionCaptureFrame,
  mediaSelectionAction,
  detailSelectionAvailable,
  triggerSelectionAction,
  triggerDetailAction,
  edgeStyle,
  locationMarkerItems,
  locationMarkerNavigatorVisible,
  activeLocationMarkerIndex,
  closeLocationMarkerNavigator,
  focusLocationMarkerById,
  selectLocationMarker,
  setActiveLocationMarker,
  startMultiSelectionConnection,
  handleMultiSelectionIntentEnter,
  handleMultiSelectionIntentLeave,
  contextMenuPrimaryNodes,
  contextMenuGenerationNodes,
  contextMenuOtherNodes,
  handleAddNodeFromContext,
  handleCompareSelected,
  handleBatchInferUpstream,
  handleGroupSelected,
  handleUngroupSelected,
  handleCreateSubgraph,
  handleCreateEmptySubgraph,
  handleForceRepairSelectedNodes,
  hasSelectedResultRecords,
  areSelectedResultRecordsFavorited,
  setSelectedResultFavorites,
  deleteSelectedResultRecords,
  exposed,
}
}
