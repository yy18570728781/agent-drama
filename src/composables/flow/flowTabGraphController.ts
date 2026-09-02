import { nextTick } from 'vue'
import { updateWorkflow } from '@/services/flow/workflow.service'
import { restoreFlowViewport } from './restoreFlowViewport'
import { hasFlowFileName, normalizeFlowFileName } from './flowNameValidation'
import type { WorkflowDefinition, WorkflowTab } from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import {
  ROOT_GRAPH_ID,
  activeWorkflowId,
  activeWorkflowName,
  canvasRef,
  cloneSerializable,
} from './useFlowCore'

interface FlowTabGraphControllerOptions {
  deps: FlowTabsDeps
  getActiveTab: () => WorkflowTab | null
  hasUnsavedChanges: (tab: WorkflowTab | null) => boolean
}

export interface FlowTabGraphController {
  buildTabDefinition: (tab: WorkflowTab) => WorkflowDefinition
  getGraphIdToSync: () => string
  openGraphInTab: (tab: WorkflowTab, graphId?: string) => Promise<boolean>
  restoreGraphStateInTab: (tab: WorkflowTab, graphId?: string) => Promise<boolean>
  syncCurrentGraphToActiveTab: () => void
}

function buildTabDefinition(tab: WorkflowTab): WorkflowDefinition {
  return {
    nodes: tab?.nodes || [],
    edges: tab?.edges || [],
    viewport: tab?.viewport || { zoom: 1, x: 0, y: 0 },
    subgraphs: cloneSerializable(tab?.subgraphs || {}),
    activeGraphId: tab?.activeGraphId || ROOT_GRAPH_ID,
  }
}

function getGraphIdToSync(deps: FlowTabsDeps): string {
  return deps.renderedGraphId?.value || deps.activeGraphId?.value || ROOT_GRAPH_ID
}

function syncCurrentGraphToActiveTab(options: FlowTabGraphControllerOptions): void {
  const currentTab = options.getActiveTab()
  if (!currentTab) return
  const { deps } = options
  const graphId = getGraphIdToSync(deps)
  const liveNodes = deps.getActiveCanvasNodesSnapshot()
  const liveEdges = deps.getActiveCanvasEdgesSnapshot(liveNodes)
  deps.syncSubgraphCardPositions(currentTab, graphId, liveNodes)
  const contentNodes = deps.stripSubgraphCards(liveNodes)
  deps.setTabGraph(currentTab, graphId, {
    id: graphId,
    name: graphId === ROOT_GRAPH_ID ? '主画布' : (deps.ensureSubgraphsMap(currentTab)[graphId]?.name || '子图'),
    nodes: deps.serializeNodes(contentNodes),
    edges: deps.serializeEdges(liveEdges, contentNodes),
    viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 },
  })
  currentTab.name = activeWorkflowName.value
  currentTab.activeGraphId = graphId
}

async function restoreGraphState(
  options: FlowTabGraphControllerOptions,
  tab: WorkflowTab,
  graphId: string,
): Promise<boolean> {
  return renderGraph(options, tab, graphId)
}

async function renderGraph(
  options: FlowTabGraphControllerOptions,
  tab: WorkflowTab,
  graphId: string,
): Promise<boolean> {
  const { deps } = options
  const subgraphs = deps.ensureSubgraphsMap(tab)
  const sourceNodes = graphId === ROOT_GRAPH_ID ? tab.nodes : subgraphs[graphId]?.nodes
  const sourceEdges = graphId === ROOT_GRAPH_ID ? tab.edges : subgraphs[graphId]?.edges
  const contentNodes = deps.stripSubgraphCards(Array.isArray(sourceNodes) ? sourceNodes : [])
  deps.activeGraphId.value = graphId
  tab.activeGraphId = graphId
  await deps.loadDefinition({
    nodes: [...deps.injectSubgraphCards(tab, graphId), ...contentNodes],
    edges: Array.isArray(sourceEdges) ? sourceEdges : [],
    subgraphs: graphId === ROOT_GRAPH_ID ? cloneSerializable(tab.subgraphs || {}) : undefined,
  }, { normalized: true })
  deps.renderedGraphId.value = graphId
  const graph = deps.getTabGraph(tab, graphId)
  nextTick(() => restoreFlowViewport(canvasRef, graph ? deps.getGraphViewport(graph) : tab.viewport))
  return true
}

async function saveRemoteDraftBeforeGraphSwitch(
  options: FlowTabGraphControllerOptions,
  tab: WorkflowTab,
  targetGraphId: string,
): Promise<void> {
  const workflowId = String(activeWorkflowId.value || '').trim()
  const currentTab = options.getActiveTab()
  if (!workflowId || !currentTab || currentTab.id !== tab.id) return
  if (targetGraphId === getGraphIdToSync(options.deps)) return
  syncCurrentGraphToActiveTab(options)
  if (!options.hasUnsavedChanges(currentTab)) return
  const workflowName = normalizeFlowFileName(activeWorkflowName.value || currentTab.name)
  if (!hasFlowFileName(workflowName)) return
  try {
    const definition = options.deps.normalizeWorkflowDefinition(buildTabDefinition(currentTab))
    const savedWorkflow = await updateWorkflow(workflowId, {
      definition,
      historyLabel: '切换子图时保存',
      historyType: 'automatic',
      name: workflowName,
    })
    const savedWorkflowId = String(savedWorkflow?.id || workflowId).trim()
    if (savedWorkflowId) activeWorkflowId.value = currentTab.workflowId = savedWorkflowId
    currentTab.savedNodes = cloneSerializable(currentTab.nodes)
    currentTab.savedEdges = cloneSerializable(currentTab.edges)
    currentTab.savedSubgraphs = cloneSerializable(currentTab.subgraphs)
  } catch (error) {
    console.error('切换子图前自动保存草稿失败:', error)
  }
}

/**
 * 创建标签画布状态控制器，集中处理画布快照、子图渲染与远端草稿同步。
 * @param options 标签画布依赖
 * @returns 画布状态操作集合
 */
export function createFlowTabGraphController(
  options: FlowTabGraphControllerOptions,
): FlowTabGraphController {
  return {
    buildTabDefinition,
    getGraphIdToSync: () => getGraphIdToSync(options.deps),
    openGraphInTab: async (tab, graphId = ROOT_GRAPH_ID) => {
      await saveRemoteDraftBeforeGraphSwitch(options, tab, graphId)
      return renderGraph(options, tab, graphId)
    },
    restoreGraphStateInTab: (tab, graphId = ROOT_GRAPH_ID) => restoreGraphState(options, tab, graphId),
    syncCurrentGraphToActiveTab: () => syncCurrentGraphToActiveTab(options),
  }
}
