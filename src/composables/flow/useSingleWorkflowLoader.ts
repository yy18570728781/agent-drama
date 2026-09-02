import { nextTick } from 'vue'
import { getWorkflow } from '@/services/flow/workflow.service'
import { createFlowId } from '@/utils/flowId'
import { normalizeWorkflowTabId } from './flowTabIdentity'
import { upsertWorkflowTab } from './flowTabCollection'
import { restoreFlowViewport } from './restoreFlowViewport'
import { stripSubgraphCards, injectSubgraphCards } from './flowSubgraphCreation.utils'
import type { WorkflowRecord } from '@/services/flow/workflow.service'
import type { WorkflowDefinition, WorkflowTab } from './flowCore.types'
import type { UseSingleWorkflowLoaderOptions } from './flowRuntime.types'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  canvasRef,
  cloneSerializable,
  edges,
  isLoadingWorkflow,
  isWorkflowSwitching,
  loadProgress,
  loadProgressText,
  nodes,
  selectedNode,
  workflowTabs,
} from './useFlowCore'

function buildLoadedWorkflowTab(
  workflow: WorkflowRecord,
  definition: WorkflowDefinition,
): WorkflowTab {
  const nodesList = cloneSerializable(definition.nodes || [])
  const edgesList = cloneSerializable(definition.edges || [])
  const subgraphs = cloneSerializable(definition.subgraphs || {})
  return {
    id: createFlowId('tab'),
    name: String(workflow.name || '').trim() || '未命名',
    isDraft: false,
    nodes: nodesList,
    edges: edgesList,
    subgraphs,
    savedNodes: cloneSerializable(nodesList),
    savedEdges: cloneSerializable(edgesList),
    savedSubgraphs: cloneSerializable(subgraphs),
    workflowId: normalizeWorkflowTabId(workflow.id) || '',
    viewport: {
      zoom: Number(definition.viewport?.zoom ?? 1),
      x: Number(definition.viewport?.x ?? 0),
      y: Number(definition.viewport?.y ?? 0),
    },
    activeGraphId: String(definition.activeGraphId || ROOT_GRAPH_ID).trim() || ROOT_GRAPH_ID,
  }
}

async function applyWorkflowTab(
  nextTab: WorkflowTab,
  options: UseSingleWorkflowLoaderOptions,
  rebaseSavedDefinition = false,
): Promise<void> {
  const targetGraphId = nextTab.activeGraphId || ROOT_GRAPH_ID
  workflowTabs.value = upsertWorkflowTab(workflowTabs.value, nextTab)
  activeTabId.value = nextTab.id
  activeWorkflowId.value = ''
  activeWorkflowName.value = ''
  selectedNode.value = null
  nodes.value = []
  edges.value = []
  options.activeGraphId.value = targetGraphId

  const subgraphsRecord = nextTab.subgraphs || {}
  const contentNodes = targetGraphId === ROOT_GRAPH_ID
    ? stripSubgraphCards(nextTab.nodes)
    : stripSubgraphCards(subgraphsRecord[targetGraphId]?.nodes || [])
  const cardNodes = injectSubgraphCards(subgraphsRecord, targetGraphId)
  const allNodes = [...cardNodes, ...contentNodes]
  const edgesSource = targetGraphId === ROOT_GRAPH_ID
    ? (Array.isArray(nextTab.edges) ? nextTab.edges : [])
    : (subgraphsRecord[targetGraphId]?.edges || [])

  const graph = options.getTabGraph(nextTab, targetGraphId)
  await nextTick()
  await restoreFlowViewport(canvasRef, options.getGraphViewport(graph))
  await options.loadDefinition({
    nodes: allNodes,
    edges: edgesSource,
    subgraphs: targetGraphId === ROOT_GRAPH_ID ? cloneSerializable(nextTab.subgraphs || {}) : undefined,
  }, { normalized: true })
  options.renderedGraphId.value = targetGraphId
  activeWorkflowId.value = nextTab.workflowId || ''
  activeWorkflowName.value = nextTab.name
  await options.saveTabs()
  if (rebaseSavedDefinition) {
    nextTab.savedNodes = cloneSerializable(nextTab.nodes)
    nextTab.savedEdges = cloneSerializable(nextTab.edges)
    nextTab.savedSubgraphs = cloneSerializable(nextTab.subgraphs || {})
    await options.saveTabs()
  }
}

/**
 * 在多标签模式下打开或复用工作流标签，避免借用子图切换链路造成保存目标串线。
 * @param options 工作流切换所需依赖
 * @returns 工作流加载入口
 */
export function useSingleWorkflowLoader(
  options: UseSingleWorkflowLoaderOptions,
): { loadWorkflowById: (id: string, loadOptions?: { forceReload?: boolean }) => Promise<boolean> } {
  let latestRequestId = 0

  async function loadWorkflowById(
    id: string,
    loadOptions: { forceReload?: boolean } = {},
  ): Promise<boolean> {
    const normalizedWorkflowId = normalizeWorkflowTabId(id)
    if (!normalizedWorkflowId) return false
    const forceReload = loadOptions.forceReload === true
    if (!forceReload && normalizeWorkflowTabId(activeWorkflowId.value) === normalizedWorkflowId) {
      options.onUpdateShowWorkflowsPanel?.(false)
      return true
    }

    const requestId = ++latestRequestId
    isWorkflowSwitching.value = true
    isLoadingWorkflow.value = true
    loadProgress.value = 0
    loadProgressText.value = '正在读取工作流...'
    await options.saveTabs()
    if (requestId !== latestRequestId) return false

    options.normalizeOpenWorkflowTabs?.()
    try {
      const openTab = workflowTabs.value.find(
        (tab) => normalizeWorkflowTabId(tab.workflowId) === normalizedWorkflowId,
      )
      if (openTab && !forceReload) {
        await applyWorkflowTab(openTab, options)
        options.onUpdateShowWorkflowsPanel?.(false)
        return true
      }
      const workflow = await getWorkflow(id)
      if (requestId !== latestRequestId) return false
      const definition = options.hydrateWorkflowDefinition(workflow.definition || {})
      const nextTab = buildLoadedWorkflowTab(workflow, definition)
      if (openTab) nextTab.id = openTab.id
      options.migrateSubgraphCards?.(nextTab)
      await applyWorkflowTab(nextTab, options, true)
      if (requestId !== latestRequestId) return false
      options.onUpdateShowWorkflowsPanel?.(false)
      return true
    } catch (error) {
      console.error('加载工作流失败:', error)
      return false
    } finally {
      if (requestId === latestRequestId) {
        await nextTick()
        isWorkflowSwitching.value = false
        isLoadingWorkflow.value = false
        loadProgress.value = 0
        loadProgressText.value = ''
      }
    }
  }

  return {
    loadWorkflowById,
  }
}
