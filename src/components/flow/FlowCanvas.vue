<template>
  <div
    ref="flowCanvasWrapperRef"
    class="flow-canvas-wrapper"
    :class="{
      'group-select-mode': isShiftPressed,
      'cut-mode': isCutKeyPressed,
      'is-space-pan-mode': isSpacePressed,
      'connection-intent': isConnecting,
      'is-ultra-light-mode': isUltraLightCanvasMode,
      'is-viewport-canvas-preview-mode': isViewportCanvasPreviewMode,
      'is-effects-suppressed': isInteractionEffectsSuppressed,
    }"
    @drop="onDrop"
    @dragover.prevent
    @dragenter.prevent
    @contextmenu.prevent
    @pointerdown="onWrapperPointerDown"
    @wheel.capture="onViewportMoveStart"
  >
    <canvas
      v-show="showOverviewCanvas"
      ref="pointOverviewCanvasRef"
      class="point-overview-canvas"
    ></canvas>
    <div
      v-if="pointSelectionRectStyle"
      class="point-selection-rect"
      :style="pointSelectionRectStyle"
    ></div>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeComponents"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
      :snap-to-grid="snapToGrid"
      :only-render-visible-elements="onlyRenderVisibleElements"
      :snap-grid="[20, 20]"
      :min-zoom="getCanvasMinimumZoom(nodes.length)"
      :max-zoom="4"
      :delete-key-code="null"
      selection-mode="partial"
      :pan-on-drag="isSpacePressed ? [0, 1, 2] : [1, 2]"
      :selection-key-code="!isSpacePressed"
      :pan-activation-key-code="null"
      :multi-selection-key-code="['Shift', 'Control']"
      :elements-selectable="true"
      :nodes-draggable="!isCutKeyPressed && !isSpacePressed"
      :class="{ 'is-dragging-node': isDraggingNode }"
      :default-edge-options="defaultEdgeOptions"
      @node-click="onNodeClick"
      @node-double-click="onNodeDoubleClick"
      @pane-click="onPaneClick"
      @selection-start="onSelectionStart"
      @selection-end="onSelectionEnd"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      connection-mode="strict"
      :is-valid-connection="checkValidConnection"
      @connect-start="onConnectStart"
      @connect-end="onConnectEnd"
      @node-drag-stop="onNodeDragStop"
      @node-drag-start="onNodeDragStart"
      @node-drag="onNodeDrag"
      @move-start="onViewportMoveStart"
      @move="onViewportMoveStart"
      @move-end="onViewportMoveEnd"
      @node-mouse-enter="onNodeMouseEnter"
      @node-mouse-leave="onNodeMouseLeave"
      @edge-update="onEdgeUpdate"
      @edge-update-start="onEdgeUpdateStart"
      @edge-update-end="onEdgeUpdateEnd"
      @edge-click="onEdgeClick"
    >
      <Background v-if="showGrid" pattern-color="#3f3f46" :gap="20" :size="1" />

      <!-- 底部右侧：小地图 + 控制条 -->
      <FlowControlsPanel
        :showMinimap="showMinimap"
        :showGrid="showGrid"
        :isUltraLightCanvasMode="isUltraLightCanvasMode"
        :isViewportCanvasPreviewMode="isViewportCanvasPreviewMode"
        :effectiveShowMinimap="effectiveShowMinimap"
        :shouldAutoHideMinimap="shouldAutoHideMinimap"
        :viewport="viewport"
        :minZoom="getCanvasMinimumZoom(nodes.length)"
        :locationMarkerItems="locationMarkerItems"
        @update:showMinimap="showMinimap = $event"
        @update:showGrid="showGrid = $event"
        @fitView="handleFitView"
        @zoomTo="zoomTo($event)"
        @viewportMoveStart="onViewportMoveStart"
        @viewportMoveEnd="onViewportMoveEnd"
        @locationMarkerSelect="focusLocationMarkerById"
      />

      <template #edge-smoothstep="edgeProps">
        <ColoredSmoothStepEdge v-bind="edgeProps" />
      </template>
      <template #edge-straight="edgeProps">
        <StraightEdge v-bind="edgeProps" />
      </template>
      <template #edge-default="edgeProps">
        <ColoredBezierEdge v-bind="edgeProps" />
      </template>
      <template #edge-simplebezier="edgeProps">
        <FlowSimpleBezierEdge v-bind="edgeProps" />
      </template>
      <template #edge-step="edgeProps">
        <FlowStepEdge v-bind="edgeProps" />
      </template>
      <template #edge-manhattan="edgeProps">
        <FlowManhattanEdge v-bind="edgeProps" />
      </template>
      <template #edge-metro="edgeProps">
        <FlowMetroEdge v-bind="edgeProps" />
      </template>
      <template #edge-er="edgeProps">
        <FlowErEdge v-bind="edgeProps" />
      </template>
    </VueFlow>

    <Transition name="fade">
      <div v-if="pendingToolboxFiles.length" class="toolbox-placement-hint">
        <span>点击画布选择放置位置（{{ pendingToolboxFiles.length }} 个文件）</span>
        <button class="toolbox-placement-cancel" @click="clearPendingToolboxFiles">取消</button>
      </div>
    </Transition>

    <!-- 右键菜单 -->
    <FlowContextMenu
      :contextMenu="contextMenu"
      :ctxSubmenu="ctxSubmenu"
      :selectedNodes="selectedNodes"
      :batchInferUpstream="handleBatchInferUpstream"
      :ungroupSelected="handleUngroupSelected"
      :groupSelected="handleGroupSelected"
      :packToBatch="packSelectedToBatch"
      :createSubgraph="handleCreateSubgraph"
      :createEmptySubgraph="handleCreateEmptySubgraph"
      :forceRepairSelectedNodes="handleForceRepairSelectedNodes"
      :addNodeFromContext="handleAddNodeFromContext"
      :contextMenuPrimaryNodes="contextMenuPrimaryNodes"
      :contextMenuOtherNodes="contextMenuOtherNodes"
      :contextMenuGenerationNodes="contextMenuGenerationNodes"
      :allowSubgraphCreate="allowSubgraphCreate"
      @update:ctxSubmenu="ctxSubmenu = $event"
      @close="closeContextMenu"
    />

    <!-- 连接弹窗 -->
    <FlowConnectionPopup
      :connectionPopup="connectionPopup"
      :contextMenuNodes="[...contextMenuGenerationNodes, ...contextMenuPrimaryNodes]"
      :addNodeFromConnection="handleAddNodeFromConnection"
    />

    <!-- 节点点击后的浮动生成面板 -->
    <WorkflowGenerationPanel
      v-if="activePanelNode"
      v-show="panelVisible && !isDraggingNode"
      ref="generationPanelRef"
      :node="activePanelNode"
      :style="panelStyle"
      @generate="handleGenerate"
      @close="hideGenerationPanel"
      @focus-panel="handleGenerationPanelLayoutChange"
      @sync-upstream="syncUpstreamPrompt"
      @connect-matching="handleConnectMatching"
      @infer-upstream="handleInferUpstream"
      @files-dropped="handleWorkflowReferenceDropped"
      @clipboard-reference-pasted="handleClipboardReferencePasted"
      @remove-upstream="handleRemoveUpstreamDF"
      @reference-url-updated="handleReferenceUrlUpdated"
    />

    <!-- 图片/视频预览模态框（与资产界面一致） -->
    <ImagePreviewModal
      v-model:visible="detailModalVisible"
      :images="detailImages"
      :initial-index="0"
      :image-info="detailImageInfo"
      :is-video="detailIsVideo"
      :is-360="detailIs360"
      :record-id="detailRecordId"
      :history-items-override="detailHistoryOverride"
      :full-mode="true"
      :show-inspector="true"
      :show-actions="true"
      :show-ai-tools="true"
      :show-workflow-actions="false"
      :show-favorite="true"
      :show-share="false"
      :show-delete="true"
      :is-favorited="detailIsFavorited"
      :show-record-nav="true"
      :has-prev-record="hasPrevRecord"
      :has-next-record="hasNextRecord"
      @re-edit="handleDetailReEdit"
      @regenerate="handleDetailRegenerate"
      @delete="handleDetailDelete"
      @favorite="handleDetailFavorite"
      @select-history="handleSelectHistoryFromPreview"
      @edit-image="handleDetailEditImage"
      @edit-video="handleDetailEditVideo"
      @prev-record="goToPrevRecord"
      @next-record="goToNextRecord"
    />

    <Teleport to="body">
      <ImageCompressDialog
        :visible="imageCompressDialog.visible"
        :files="imageCompressDialog.files"
        @update:visible="handleImageCompressDialogVisibleChange"
        @confirm="handleImageCompressDialogConfirm"
        @cancel="handleImageCompressDialogCancel"
      />
      <ImageReferenceEditor
        v-if="editingImageUrl && editingImageFile"
        :image-url="editingImageUrl"
        :image-file="editingImageFile"
        :current-index="0"
        :total-count="1"
        @close="closeImageEditor"
        @apply="onDetailImageEditApply"
        @splitResult="handleSplitResult"
      />
      <VideoReferenceEditor
        v-if="editingVideoUrl && editingVideoFile"
        :video-url="editingVideoUrl"
        :video-file="editingVideoFile"
        :current-index="0"
        :total-count="1"
        @close="closeVideoEditor"
        @apply="onDetailVideoEditApply"
        @capture-frame="onVideoEditorCaptureFrame"
      />
    </Teleport>

    <!-- 选择工具栏：多选时跟随连接锚点下方；组选中时顶部居中 -->
    <FlowSelectionToolbar
      :selectedNodes="selectedNodes"
      :selectedGroupNodeForToolbar="selectedGroupNodeForToolbar"
      :selectedGroupChildNodes="selectedGroupChildNodes"
      :isSelectedGroupCollapsed="isSelectedGroupCollapsed"
      :showGroupAlignmentToolbar="showGroupAlignmentToolbar"
      :multiSelectionToolbarStyle="multiSelectionToolbarStyle"
      @align="handleAlign"
      @distribute="handleDistribute"
      @autoLayout="handleAutoLayout"
      @tidyNodes="handleTidyNodes"
      @applyHighlight="applyNodeHighlight"
      @clearHighlight="() => clearNodeHighlight(selectedNodes.map(n => n.id))"
      @groupAlign="handleGroupAlign"
      @groupDistribute="handleGroupDistribute"
      @groupAutoLayout="handleGroupAutoLayout"
      @groupTidyNodes="handleGroupTidyNodes"
    />

    <FlowMultiSelectionConnector
      v-if="!isUltraLightCanvasMode"
      :multiSelectionHotspotStyle="multiSelectionHotspotStyle"
      :multiSelectionConnectorStyle="multiSelectionConnectorStyle"
      :selectedNodeCount="selectedNodes.length"
      :actionKind="mediaSelectionAction?.kind || ''"
      :actionTitle="mediaSelectionAction?.title || ''"
      :detailAvailable="detailSelectionAvailable"
      :sourceConnectionMode="sourceConnectionMode"
      :isUltraLightCanvasMode="isUltraLightCanvasMode"
      :connectionDragLine="connectionDragLine"
      :edgeStyle="edgeStyle"
      :showResultRecordActions="hasSelectedResultRecords && !selectedGroupNodeForToolbar"
      @media-action="triggerSelectionAction"
      @detail-action="triggerDetailAction"
      @favorite-result-records="setSelectedResultFavorites(true)"
      @unfavorite-result-records="setSelectedResultFavorites(false)"
      @delete-result-records="deleteSelectedResultRecords"
      @intent-enter="handleMultiSelectionIntentEnter"
      @intent-leave="handleMultiSelectionIntentLeave"
      @start-connection="startMultiSelectionConnection"
    />
    <FlowMultiSelectionMediaDialogHost
      :compareVisible="compareDialogVisible"
      :compareItems="compareDialogItems"
      :videoVisible="videoPreviewVisible"
      :videoUrls="videoPreviewUrls"
      :videoSourceNodeIds="videoSourceNodeIds"
      @update:compareVisible="compareDialogVisible = $event"
      @update:videoVisible="videoPreviewVisible = $event"
      @capture-frame="onMultiSelectionCaptureFrame"
    />
    <FlowLocationMarkerNavigator
      :visible="locationMarkerNavigatorVisible"
      :items="locationMarkerItems"
      :active-index="activeLocationMarkerIndex"
      @close="closeLocationMarkerNavigator"
      @select="selectLocationMarker"
      @hover="setActiveLocationMarker"
    />
  </div>
</template>

<script setup>
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import ColoredSmoothStepEdge from './edges/ColoredSmoothStepEdge.vue'
import StraightEdge from './edges/StraightEdge.vue'
import ColoredBezierEdge from './edges/ColoredBezierEdge.vue'
import FlowErEdge from './edges/FlowErEdge.vue'
import FlowManhattanEdge from './edges/FlowManhattanEdge.vue'
import FlowMetroEdge from './edges/FlowMetroEdge.vue'
import FlowSimpleBezierEdge from './edges/FlowSimpleBezierEdge.vue'
import FlowStepEdge from './edges/FlowStepEdge.vue'
import WorkflowGenerationPanel from './WorkflowGenerationPanel.vue'
import ImagePreviewModal from '@/components/common/ImagePreviewModal.vue'
import ImageCompressDialog from '@/components/common/ImageCompressDialog.vue'
import ImageReferenceEditor from '@/components/generation/ImageReferenceEditor.vue'
import VideoReferenceEditor from '@/components/generation/VideoReferenceEditor.vue'
import FlowContextMenu from './FlowContextMenu.vue'
import FlowConnectionPopup from './FlowConnectionPopup.vue'
import FlowControlsPanel from './FlowControlsPanel.vue'
import FlowMultiSelectionConnector from './FlowMultiSelectionConnector.vue'
import FlowMultiSelectionMediaDialogHost from './FlowMultiSelectionMediaDialogHost.vue'
import FlowLocationMarkerNavigator from './FlowLocationMarkerNavigator.vue'
import FlowSelectionToolbar from './FlowSelectionToolbar.vue'
import { useFlowCanvas } from './useFlowCanvas'
import { pendingToolboxFiles, clearPendingToolboxFiles } from '@/composables/flow/flowToolboxState'
import { getCanvasMinimumZoom } from '@/composables/flow/flowPerformance.constants'

const props = defineProps({
  modelNodes: { type: Array, default: () => [] },
  modelEdges: { type: Array, default: () => [] },
  nodeTypes: { type: Array, default: () => [] },
  shortcuts: { type: Object, default: () => ({}) },
  activeGraphId: { type: String, default: '' },
  subgraphDefinitions: { type: Object, default: () => ({}) },
  allowSubgraphCreate: { type: Boolean, default: true },
})

const emit = defineEmits([
  'update:modelNodes', 'update:modelEdges', 'node-select', 'pane-click', 'param-change',
  'node-data-update', 'repair-progress', 'draft-save', 'save-request', 'undo-request',
  'redo-request', 'record-tab-history', 'paste-subgraphs', 'create-subgraph', 'open-subgraph', 'rename-subgraph',
  'dissolve-subgraph', 'delete-subgraph-request',
])

const { exposed, flowCanvasWrapperRef, pointOverviewCanvasRef, isShiftPressed, isCutKeyPressed, isSpacePressed, isConnecting, isUltraLightCanvasMode,
  isViewportCanvasPreviewMode, isInteractionEffectsSuppressed, onDrop, onWrapperPointerDown, showOverviewCanvas, pointSelectionRectStyle,
  nodes, edges, nodeComponents, snapToGrid, onlyRenderVisibleElements, isDraggingNode, defaultEdgeOptions, onNodeClick, onNodeDoubleClick, onPaneClick,
  onSelectionStart, onSelectionEnd, onPaneContextMenu, onNodeContextMenu, checkValidConnection, onConnectStart, onConnectEnd,
  onNodeDragStop, onNodeDragStart, onNodeDrag, onViewportMoveStart, onViewportMoveEnd, onNodeMouseEnter, onNodeMouseLeave, onEdgeUpdate,
  onEdgeUpdateStart, onEdgeUpdateEnd, onEdgeClick, showGrid, selectedNodes, selectedGroupNodeForToolbar, selectedGroupChildNodes,
  isSelectedGroupCollapsed, isSelectedGroupLocked, showGroupAlignmentToolbar,
  handleAlign, handleDistribute, handleAutoLayout, handleTidyNodes, handleGroupAlign,
  handleGroupDistribute, handleGroupAutoLayout, handleGroupTidyNodes, showMinimap, effectiveShowMinimap,
  shouldAutoHideMinimap, viewport, handleFitView, zoomTo, contextMenu, ctxSubmenu, closeContextMenu, connectionPopup,
  handleAddNodeFromConnection, activePanelNode, panelVisible, generationPanelRef, panelStyle, handleGenerate,
  hideGenerationPanel, handleGenerationPanelLayoutChange, syncUpstreamPrompt, handleConnectMatching, handleInferUpstream,
  handleWorkflowReferenceDropped, handleClipboardReferencePasted, handleRemoveUpstreamDF, handleReferenceUrlUpdated,
  detailModalVisible, detailImages, detailImageInfo, detailIsVideo, detailIs360, detailRecordId, detailIsFavorited, detailHistoryOverride, openDetailModalForNodes, handleDetailReEdit,
  handleDetailRegenerate, handleDetailDelete, handleDetailFavorite, handleSelectHistoryFromPreview, handleDetailEditImage, handleDetailEditVideo,
  hasPrevRecord, hasNextRecord, goToPrevRecord, goToNextRecord,
  handleSplitResult, scatterBatchNodeById, packSelectedToBatch,
  applyNodeHighlight, clearNodeHighlight,
  imageCompressDialog, handleImageCompressDialogVisibleChange, handleImageCompressDialogConfirm, handleImageCompressDialogCancel,
  editingImageUrl, editingImageFile, closeImageEditor, onDetailImageEditApply, editingVideoUrl, editingVideoFile,
  closeVideoEditor, onDetailVideoEditApply, onVideoEditorCaptureFrame, multiSelectionHotspotStyle, multiSelectionToolbarStyle, multiSelectionConnectorStyle,
  sourceConnectionMode, connectionDragLine, compareDialogVisible, compareDialogItems, videoPreviewVisible, videoPreviewUrls,
  videoSourceNodeIds, onMultiSelectionCaptureFrame, locationMarkerItems, locationMarkerNavigatorVisible,
  activeLocationMarkerIndex, closeLocationMarkerNavigator, focusLocationMarkerById, selectLocationMarker, setActiveLocationMarker,
  mediaSelectionAction, detailSelectionAvailable, triggerSelectionAction, triggerDetailAction, edgeStyle, startMultiSelectionConnection, handleMultiSelectionIntentEnter,
  handleMultiSelectionIntentLeave,
  contextMenuPrimaryNodes,
  contextMenuGenerationNodes, contextMenuOtherNodes, handleAddNodeFromContext,
  handleCompareSelected, handleBatchInferUpstream, handleGroupSelected, handleUngroupSelected,
  handleCreateSubgraph, handleCreateEmptySubgraph, handleForceRepairSelectedNodes,
  hasSelectedResultRecords, areSelectedResultRecordsFavorited, setSelectedResultFavorites,
  deleteSelectedResultRecords } = useFlowCanvas(props, emit)

defineExpose(exposed)
</script>

<style scoped src="./flowCanvas.css"></style>
