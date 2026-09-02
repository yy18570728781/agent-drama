import type {
  FlowEdge,
  FlowNode,
  WorkflowTab,
  WorkflowTabHistorySnapshot,
  WorkflowTabWithHistory,
} from './flowCore.types'
import type { FlowTabsDeps } from './flowRuntime.types'
import { nextTick } from 'vue'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  canvasRef,
  cloneSerializable,
  edges as activeCanvasEdges,
  initialized,
  isWorkflowSwitching,
  nodes as activeCanvasNodes,
  selectedNode,
} from './useFlowCore'

const MAX_HISTORY_CACHE_ENTRIES_PER_TAB = 40

interface FlowTabHistoryControllerOptions {
  deps: FlowTabsDeps
  getActiveTab: () => WorkflowTab | null
}

export interface FlowTabHistoryController {
  handleCanvasRedoRequest: () => void
  handleCanvasUndoRequest: () => void
  recordTabHistory: (tab?: WorkflowTab | null) => void
}

function ensureHistory(tab: WorkflowTab | null): WorkflowTabWithHistory | null {
  if (!tab) return null
  if (!Array.isArray(tab.__history)) tab.__history = []
  if (typeof tab.__historyIndex !== 'number') tab.__historyIndex = -1
  return tab as WorkflowTabWithHistory
}

function buildSnapshot(
  tab: WorkflowTab,
  deps: FlowTabsDeps,
): WorkflowTabHistorySnapshot {
  const canvasCache = buildCanvasCache(tab, deps)
  if (canvasCache) deps.syncCurrentGraphToActiveTab()
  const serialized = JSON.stringify(
    deps.normalizeWorkflowDefinition(deps.buildTabDefinition(tab)),
  )
  return {
    canvasCache,
    definition: JSON.parse(serialized),
    activeGraphId: tab.activeGraphId || ROOT_GRAPH_ID,
    name: tab.name || '工作流',
    workflowId: tab.workflowId || null,
    signature: createSnapshotSignature(serialized),
  }
}

function buildCanvasCache(
  tab: WorkflowTab,
  deps: FlowTabsDeps,
): WorkflowTabHistorySnapshot['canvasCache'] {
  if (tab.id !== activeTabId.value) return undefined
  const liveNodes = deps.getActiveCanvasNodesSnapshot()
  const liveEdges = deps.getActiveCanvasEdgesSnapshot(liveNodes)
  return {
    edges: cloneSerializable(liveEdges),
    graphId: deps.renderedGraphId.value || deps.activeGraphId.value || ROOT_GRAPH_ID,
    nodes: cloneSerializable(liveNodes),
  }
}

function createSnapshotSignature(serialized: string): string {
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }
  return `${serialized.length}:${first >>> 0}:${second >>> 0}`
}

function isSameSnapshot(
  previous: WorkflowTabHistorySnapshot | undefined,
  next: WorkflowTabHistorySnapshot,
): boolean {
  if (!previous) return false
  return previous.activeGraphId === next.activeGraphId
    && previous.name === next.name
    && (previous.workflowId || null) === (next.workflowId || null)
    && (previous.signature || createSnapshotSignature(JSON.stringify(previous.definition || {}))) === next.signature
}

function applySnapshot(
  options: FlowTabHistoryControllerOptions,
  tab: WorkflowTab,
  snapshot: WorkflowTabHistorySnapshot,
): boolean {
  const canvasCache = snapshot.canvasCache
  if (!canvasCache || canvasCache.graphId !== snapshot.activeGraphId) return false
  const definition = options.deps.hydrateWorkflowDefinition(snapshot.definition || {})
  tab.name = snapshot.name || tab.name || '工作流'
  tab.workflowId = snapshot.workflowId || null
  tab.nodes = definition.nodes || []
  tab.edges = definition.edges || []
  tab.viewport = canvasRef.value?.getViewport?.() || definition.viewport || { zoom: 1, x: 0, y: 0 }
  tab.subgraphs = definition.subgraphs || {}
  tab.activeGraphId = snapshot.activeGraphId || ROOT_GRAPH_ID
  if (tab.id === activeTabId.value) {
    activeWorkflowId.value = tab.workflowId || ''
    activeWorkflowName.value = tab.name || ''
    options.deps.activeGraphId.value = tab.activeGraphId
    options.deps.renderedGraphId.value = tab.activeGraphId
    activeCanvasNodes.value = cloneCachedNodes(canvasCache.nodes)
    activeCanvasEdges.value = cloneCachedEdges(canvasCache.edges)
    selectedNode.value = null
  }
  return true
}

function cloneCachedNodes(nodes: FlowNode[]): FlowNode[] {
  return cloneSerializable(nodes).map((node) => ({
    ...node,
    dragging: false,
    resizing: false,
    selected: false,
  }))
}

function cloneCachedEdges(edges: FlowEdge[]): FlowEdge[] {
  return cloneSerializable(edges).map((edge) => ({
    ...edge,
    selected: false,
  }))
}

function recordHistory(
  options: FlowTabHistoryControllerOptions,
  tab: WorkflowTab | null,
): void {
  if (!initialized.value || isWorkflowSwitching.value || !tab) return
  const historyTab = ensureHistory(tab)
  if (!historyTab) return
  const snapshot = buildSnapshot(tab, options.deps)
  const currentSnapshot = historyTab.__history[historyTab.__historyIndex]
  if (isSameSnapshot(currentSnapshot, snapshot)) return
  historyTab.__history = historyTab.__history.slice(0, historyTab.__historyIndex + 1)
  historyTab.__history.push(snapshot)
  if (historyTab.__history.length > MAX_HISTORY_CACHE_ENTRIES_PER_TAB) {
    historyTab.__history.splice(
      0,
      historyTab.__history.length - MAX_HISTORY_CACHE_ENTRIES_PER_TAB,
    )
  }
  historyTab.__historyIndex = historyTab.__history.length - 1
}

async function moveHistory(options: FlowTabHistoryControllerOptions, offset: -1 | 1): Promise<void> {
  const historyTab = ensureHistory(options.getActiveTab())
  if (!historyTab) return
  const nextIndex = historyTab.__historyIndex + offset
  if (nextIndex < 0 || nextIndex >= historyTab.__history.length) return
  if (!applySnapshot(options, historyTab, historyTab.__history[nextIndex])) return
  historyTab.__historyIndex = nextIndex
  await nextTick()
  await options.deps.saveDraft()
  await options.deps.saveTabs()
}

/**
 * 创建每个工作流标签独立的撤销与重做历史控制器。
 * @param options 标签历史依赖
 * @returns 历史记录操作集合
 */
export function createFlowTabHistoryController(
  options: FlowTabHistoryControllerOptions,
): FlowTabHistoryController {
  return {
    handleCanvasRedoRequest: () => { void moveHistory(options, 1) },
    handleCanvasUndoRequest: () => { void moveHistory(options, -1) },
    recordTabHistory: (tab = options.getActiveTab()) => recordHistory(options, tab),
  }
}
