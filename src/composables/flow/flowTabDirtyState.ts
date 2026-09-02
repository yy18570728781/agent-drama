import { hasDefinitionChanges } from './flowDirtyCheck'
import type { WorkflowDefinition, WorkflowTab } from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  canvasRef,
  cloneSerializable,
  edges as activeCanvasEdges,
  isWorkflowSwitching,
  nodes as activeCanvasNodes,
} from './useFlowCore'

interface FlowTabDirtyOptions {
  deps: FlowTabsDeps
  getGraphIdToSync: () => string
}

interface DirtyCacheEntry {
  currentEdges: unknown
  currentNodes: unknown
  currentSubgraphs: unknown
  graphId: string
  historyIndex: number
  savedEdges: unknown
  savedNodes: unknown
  savedSubgraphs: unknown
  value: boolean
}

const dirtyCache = new WeakMap<WorkflowTab, DirtyCacheEntry>()

function hasSameDirtyInputs(previous: DirtyCacheEntry, next: DirtyCacheEntry): boolean {
  return previous.currentNodes === next.currentNodes
    && previous.currentEdges === next.currentEdges
    && previous.currentSubgraphs === next.currentSubgraphs
    && previous.savedNodes === next.savedNodes
    && previous.savedEdges === next.savedEdges
    && previous.savedSubgraphs === next.savedSubgraphs
    && previous.graphId === next.graphId
    && previous.historyIndex === next.historyIndex
}

function buildCurrentDefinition(
  options: FlowTabDirtyOptions,
  tab: WorkflowTab,
  graphId: string,
): Partial<WorkflowDefinition> {
  const liveNodes = options.deps.getActiveCanvasNodesSnapshot()
  const liveEdges = options.deps.getActiveCanvasEdgesSnapshot(liveNodes)
  const snapshotTab = cloneSerializable(tab)
  options.deps.syncSubgraphCardPositions(snapshotTab, graphId, liveNodes)
  const contentNodes = options.deps.stripSubgraphCards(liveNodes)
  options.deps.setTabGraph(snapshotTab, graphId, {
    id: graphId,
    name: graphId === ROOT_GRAPH_ID ? '主画布' : (snapshotTab.subgraphs?.[graphId]?.name || '子图'),
    nodes: options.deps.serializeNodes(contentNodes),
    edges: options.deps.serializeEdges(liveEdges, contentNodes),
    viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 },
  })
  return {
    nodes: snapshotTab.nodes,
    edges: snapshotTab.edges,
    subgraphs: snapshotTab.subgraphs,
  }
}

/**
 * 比较标签当前内容与最近保存基线，并缓存未变化输入的结果。
 * @param options 脏检查所需的标签和画布依赖。
 * @param tab 待检查标签。
 * @returns 存在需要保存的内容变化时返回 true。
 */
export function hasFlowTabUnsavedChanges(
  options: FlowTabDirtyOptions,
  tab: WorkflowTab | null,
): boolean {
  if (!tab || isWorkflowSwitching.value) return false
  const active = tab.id === activeTabId.value
  const graphId = active ? options.getGraphIdToSync() : (tab.activeGraphId || ROOT_GRAPH_ID)
  const cacheEntry: DirtyCacheEntry = {
    currentEdges: active ? activeCanvasEdges.value : tab.edges,
    currentNodes: active ? activeCanvasNodes.value : tab.nodes,
    currentSubgraphs: tab.subgraphs,
    graphId,
    historyIndex: tab.__historyIndex ?? -1,
    savedEdges: tab.savedEdges,
    savedNodes: tab.savedNodes,
    savedSubgraphs: tab.savedSubgraphs,
    value: false,
  }
  const previous = dirtyCache.get(tab)
  if (previous && hasSameDirtyInputs(previous, cacheEntry)) return previous.value
  const currentDefinition = active
    ? buildCurrentDefinition(options, tab, graphId)
    : { nodes: tab.nodes, edges: tab.edges, subgraphs: tab.subgraphs }
  cacheEntry.value = hasDefinitionChanges(
    options.deps.normalizeWorkflowDefinition,
    currentDefinition,
    {
      nodes: tab.savedNodes || [],
      edges: tab.savedEdges || [],
      subgraphs: tab.savedSubgraphs || {},
    },
  )
  dirtyCache.set(tab, cacheEntry)
  return cacheEntry.value
}
