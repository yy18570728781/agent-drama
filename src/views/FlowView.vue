<template>
  <div
    class="flow-view"
    :class="{ 'json-drop-active': isJsonDragging }"
    @dragover.prevent="onJsonDragOver"
    @dragleave="onJsonDragLeave"
    @drop.prevent="onJsonDrop"
  >

    <!-- 标签栏、弹窗、菜单全部由 FlowTabBar 接管 -->
    <FlowTabBar
      :has-unsaved-changes="currentHasUnsavedChanges"
      :hydrate-workflow-definition="persistence.hydrateWorkflowDefinition"
      :save-state="flowSaveState"
      :showWorkflowsPanel="showWorkflowsPanel"
      @update:showWorkflowsPanel="onUpdateShowWorkflowsPanel"
      :wfSortOrder="wfSortOrder" @update:wfSortOrder="updateWfSortOrder"
      :sortedWorkflows="sortedWorkflows" :workflows="workflows" :activeWorkflowId="activeWorkflowId"
      :workflowTabs="workflowTabs" :activeTabId="activeTabId" :tabContextMenu="tabContextMenu"
      :showRenameModal="showRenameModal" :renameValue="renameValue"
      :showNewWfModal="showNewWfModal" :newWfName="newWfName" :newWfModalTitle="newWfModalTitle"
      :pendingJsonImportData="pendingJsonImportData" :showDuplicateModal="showDuplicateModal"
      :duplicateWorkflowName="duplicateWorkflowName" :showUnsavedModal="showUnsavedModal"
      :showExportSaveModal="showExportSaveModal"
      :showDeleteSubgraphModal="showDeleteSubgraphModal" :deleteSubgraphModalLabel="deleteSubgraphModalLabel"
      @update:showRenameModal="onUpdateShowRenameModal" @update:renameValue="onUpdateRenameValue"
      @update:newWfName="onUpdateNewWfName"
      @update:showDuplicateModal="onUpdateShowDuplicateModal"
      @load-workflow="onLoadWorkflow" @delete-workflow="onDeleteWorkflow"
      @add-new-tab="addNewTab"
      @switch-tab="switchTab" @tab-close-direct="onTabCloseDirect"
      @tab-export="onTabExport" @tab-import="onTabImport" @tab-rename="onTabRename"
      @tab-close="onTabClose" @confirm-rename="confirmRename" @confirm-new-wf="confirmNewWf"
      @cancel-new-wf="cancelNewWf" @save-with-suffix="saveWithSuffix" @save-with-overwrite="saveWithOverwrite"
      @cancel-close="cancelClose" @close-without-save="closeWithoutSave" @save-and-close-tab="saveAndCloseTab"
      @cancel-export-save="cancelExportSave" @confirm-export-save="confirmExportSave"
      @export-without-save="exportWithoutSave"
      @close-delete-subgraph-modal="closeDeleteSubgraphModal"
      @confirm-delete-subgraph-remove-all="confirmDeleteSubgraphRemoveAll"
      @confirm-delete-subgraph-dissolve="confirmDeleteSubgraphDissolve" @import-json="importJSON" ref="flowTabBarRef" />

    <FlowWorkspace
      ref="flowWorkspaceRef" :model-nodes="nodes" :model-edges="edges" :node-types="nodeTypes"
      :shortcuts="shortcuts" :active-graph-id="activeGraphId" :active-workflow-id="activeWorkflowId"
      :current-canvas-node-count="currentCanvasNodeCount"
      :is-repairing-generating-cards="isRepairingGeneratingCards"
      :repair-button-title="repairButtonTitle"
      :subgraph-definitions="activeCanvasSubgraphDefinitions" :allow-subgraph-create="true"
      :outline-expanded-keys="outlineExpandedKeys" :outline-path-labels="outlinePathLabels" :outline-tree="outlineTree"
      :is-loading-workflow="isLoadingWorkflow" :load-progress="loadProgress"
      :load-progress-text="loadProgressText"
      :workflows="sortedWorkflows"
      :project-examples="projectExamples"
      @drop-asset="onDropAsset" @update:shortcuts="onUpdateShortcuts" @outline-select="handleOutlineSelect"
      @repair-generating-cards="handleRepairGeneratingCards"
      @outline-refresh="handleOutlineRefresh"
      @save-example="onSaveExample" @load-example="onLoadExample"
      @overwrite-example="onOverwriteExample" @delete-example="onDeleteExample"
      @rename-example="onRenameExample"
      @update:model-nodes="handleCanvasNodesUpdate" @update:model-edges="handleCanvasEdgesUpdate"
      @node-select="selectedNode = $event" @pane-click="handlePaneClick" @param-change="onParamUpdate"
      @save-request="onSave" @undo-request="handleCanvasUndoRequest" @redo-request="handleCanvasRedoRequest"
      @record-tab-history="tabs.recordTabHistory()"
      @paste-subgraphs="handlePasteSubgraphs" @node-data-update="onNodeDataUpdate" @repair-progress="handleRepairProgress"
      @draft-save="handleCanvasDraftSave" @create-subgraph="handleCreateSubgraph" @open-subgraph="handleOpenSubgraph"
      @rename-subgraph="handleRenameSubgraph" @dissolve-subgraph="handleDissolveSubgraph"
      @delete-subgraph-request="handleDeleteSubgraphRequest" @cancel-load="cancelLoadWorkflow" />

    <Director3DOverlay
      v-if="director3DOverlayVisible"
      :visible="director3DOverlayVisible"
      :node-ref="director3DActiveNode"
      @close="director3DOverlayVisible = false; director3DActiveNodeId = ''; director3DActiveNode = null"
      @snapshot-created="handleDirector3DSnapshot"
      @remove-upstream="handleDirector3DRemoveUpstream"
      @request-propagate="handleDirector3DRequestPropagate"
    />

  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import FlowTabBar from '@/components/flow/FlowTabBar.vue'
import FlowWorkspace from '@/components/flow/FlowWorkspace.vue'
import {
  nodes,
  edges,
  selectedNode,
  nodeTypes,
  isLoadingWorkflow,
  loadProgress,
  loadProgressText,
  activeWorkflowId,
  activeWorkflowName,
  canvasRef,
  workflowTabs,
  activeTabId,
  cloneSerializable,
  getActiveCanvasNodesSnapshot,
  getActiveCanvasEdgesSnapshot,
  filterPersistedNodes,
  director3DOverlayVisible,
  director3DActiveNodeId,
  director3DActiveNode,
} from '@/composables/flow/useFlowCore'
import { useFlowAutoSave } from '@/composables/flow/useFlowAutoSave'
import { useFlowViewCanvasSummary } from '@/composables/flow/useFlowViewCanvasSummary'
import { useFlowSubgraphOutline } from '@/composables/flow/useFlowSubgraphOutline'
import { useFlowViewBridge } from '@/composables/flow/useFlowViewBridge'
import { useProjectExamples } from '@/composables/flow/useProjectExamples'
import { useFlowViewInitialization } from '@/composables/flow/useFlowViewInitialization'
import { useFlowDirector3D } from '@/composables/flow/useFlowDirector3D'
import { useFlowViewAdapters } from '@/composables/flow/useFlowViewAdapters'
import { useFlowViewRuntime } from '@/composables/flow/useFlowViewRuntime'

const Director3DOverlay = defineAsyncComponent(() => import('@/components/director-3d/Director3DOverlay.vue'))

const props = defineProps({
  initialWorkflowId: { type: String, default: '' },
  startNew: { type: Boolean, default: false },
  performanceNodeCount: { type: Number, default: 0 },
})

// ==================== Composable 实例化 ====================

const runtime = useFlowViewRuntime()
const { deps, dragDrop, nodeData, persistence, subgraph, tabs } = runtime

const {
  examples: projectExamples,
  loadExamples: loadProjectExamples,
  saveExample,
  updateExample: doUpdateExample,
  deleteExample: doDeleteExample,
  renameExample: doRenameExample,
} = useProjectExamples()

// ==================== 模板绑定 ====================

const { isJsonDragging, onJsonDragOver, onJsonDragLeave, onJsonDrop } = dragDrop

const {
  isRepairingGeneratingCards, repairButtonTitle, activeGraphId,
  activeCanvasSubgraphDefinitions, deleteSubgraphModalLabel,
  showDeleteSubgraphModal, handleRepairGeneratingCards,
  closeDeleteSubgraphModal, confirmDeleteSubgraphRemoveAll,
  confirmDeleteSubgraphDissolve, handleCanvasNodesUpdate,
  handleCanvasEdgesUpdate, handleRepairProgress,
  handleCreateSubgraph, handleOpenSubgraph, handleRenameSubgraph,
  handleDissolveSubgraph, handleDeleteSubgraphRequest, handlePasteSubgraphs,
} = subgraph

const { currentCanvasNodeCount, currentHasUnsavedChanges, currentTab } = useFlowViewCanvasSummary({
  activeGraphId,
  getActiveTab: tabs.getActiveTab,
  hasUnsavedChanges: tabs.hasUnsavedChanges,
  nodes,
})

const {
  wfSortOrder, sortedWorkflows, tabContextMenu,
  showRenameModal, renameValue, showNewWfModal, newWfName,
  newWfModalTitle, pendingJsonImportData, showUnsavedModal,
  shortcuts, addNewTab,
  onTabCloseDirect, onTabExport, onTabImport,
  onTabRename, onTabClose, confirmRename, confirmNewWf,
  cancelNewWf, switchTab, handleCanvasUndoRequest,
  handleCanvasRedoRequest, saveAndCloseTab, closeWithoutSave,
  cancelClose, cancelExportSave, confirmExportSave, exportWithoutSave,
  showExportSaveModal, handlePaneClick,
  onUpdateShortcuts,
} = tabs

const {
  workflows, showDuplicateModal, duplicateWorkflowName,
  saveWithSuffix, saveWithOverwrite, onSave, onDeleteWorkflow,
  importJSON, handleCanvasDraftSave,
  cancelLoadWorkflow,
} = persistence

const { onParamUpdate, onNodeDataUpdate } = nodeData
const buildCurrentDefinition = () => {
  const tab = tabs.getActiveTab(); if (tab) { tabs.syncCurrentGraphToActiveTab(); return tabs.buildTabDefinition(tab) }
  return { nodes: persistence.serializeNodes(getActiveCanvasNodesSnapshot()), edges: persistence.serializeEdges(getActiveCanvasEdgesSnapshot(), getActiveCanvasNodesSnapshot()), viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 }, subgraphs: {} }
}

function getCurrentNodeCount() {
  return filterPersistedNodes(nodes.value).filter((n) => n?.type !== 'subgraph').length
}

function onSaveExample(name) {
  const def = buildCurrentDefinition()
  saveExample(name, def, getCurrentNodeCount())
}

function onLoadExample(example) {
  tabs.createTabAndImportJson(example.definition, example.name)
}

function onOverwriteExample(id) {
  const def = buildCurrentDefinition()
  doUpdateExample(id, def, getCurrentNodeCount())
}

function onDeleteExample(id) {
  doDeleteExample(id)
}

function onRenameExample(id, name) {
  doRenameExample(id, name)
}

const {
  flowTabBarRef,
  flowWorkspaceRef,
  onDropAsset,
  onLoadWorkflow,
  onUpdateShowWorkflowsPanel,
  showWorkflowsPanel,
  syncCanvasCapabilityPorts,
} = useFlowViewBridge({
  handleLoadWorkflow: (id) => persistence.onLoad(id),
  refreshWorkflows: () => persistence.refreshWorkflows(),
  setCanvasRef: (value) => { canvasRef.value = value },
  setSidebarRef: (value) => { tabs.flowSidebarRef.value = value },
  setTabContextMenuRef: (value) => { tabs.tabContextMenuRef.value = value },
})
Object.assign(deps, {
  getCanvasApi: () => flowWorkspaceRef.value || canvasRef.value,
})
runtime.bindShowWorkflowsPanel((visible) => { showWorkflowsPanel.value = visible })
const {
  handleDirector3DRemoveUpstream,
  handleDirector3DRequestPropagate,
  handleDirector3DSnapshot,
} = useFlowDirector3D(flowWorkspaceRef)

const { outlineExpandedKeys, outlinePathLabels, outlineTree } = useFlowSubgraphOutline({
  activeGraphId,
  currentTab,
})
const { saveState: flowSaveState } = useFlowAutoSave({
  activeWorkflowId,
  buildDraftDefinition: buildCurrentDefinition,
  getChangeToken: () => tabs.getActiveTab()?.__historyIndex ?? -1,
  getDraftName: () => activeWorkflowName.value || '工作流',
  getHasUnsavedChanges: () => !!tabs.getActiveTab() && tabs.hasUnsavedChanges(tabs.getActiveTab()),
  normalizeWorkflowDefinition: persistence.normalizeWorkflowDefinition,
  onSaved: async (definition, context) => {
    const tab = tabs.getActiveTab()
    if (!tab || String(tab.workflowId || '') !== context.requestedWorkflowId) return
    const savedDefinition = persistence.hydrateWorkflowDefinition(definition)
    tab.workflowId = context.savedWorkflowId
    tab.isDraft = false
    tab.savedNodes = cloneSerializable(savedDefinition.nodes)
    tab.savedEdges = cloneSerializable(savedDefinition.edges)
    tab.savedSubgraphs = cloneSerializable(savedDefinition.subgraphs || {})
    await tabs.saveTabs()
  },
})

useFlowViewInitialization({
  addNewTab,
  handleBeforeUnload: tabs.handleBeforeUnload,
  hasOpenTabs: () => workflowTabs.value.length > 0,
  initialWorkflowId: props.initialWorkflowId,
  loadDefinition: persistence.loadDefinition,
  loadDraft: persistence.loadDraft,
  loadProjectExamples,
  loadTabs: tabs.loadTabs,
  onLoad: persistence.onLoad,
  onNewWorkflow: persistence.onNewWorkflow,
  recordTabHistory: tabs.recordTabHistory,
  saveDraft: persistence.saveDraft,
  startNew: props.startNew,
  performanceNodeCount: props.performanceNodeCount,
  syncCanvasCapabilityPorts,
})

const {
  updateWfSortOrder,
  onUpdateShowRenameModal,
  onUpdateRenameValue,
  onUpdateNewWfName,
  onUpdateShowDuplicateModal,
  handleOutlineSelect,
  handleOutlineRefresh,
} = useFlowViewAdapters({ persistence, subgraph, tabs })
</script>

<style scoped>
.flow-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--bg-base, #09090b);
  overflow: hidden;
  position: relative;
}
.flow-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}
</style>
