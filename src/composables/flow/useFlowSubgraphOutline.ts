import { computed, toRaw, type ComputedRef, type Ref } from 'vue'
import { ROOT_GRAPH_ID } from './useFlowCore'
import { countGraphTotalNodes } from './flowSubgraphCreation.utils'
import { normalizePersistedSubgraphs } from './flowSubgraphPersistence.utils'

type FlowGraph = {
  name?: string
  parentGraphId?: string
  nodes?: { type?: string; data?: { label?: string; subgraphId?: string } }[]
}

type WorkflowTab = {
  nodes?: unknown[]
  subgraphs?: Record<string, FlowGraph> | FlowGraph[]
}

type OutlineNode = {
  graphId: string
  label: string
  nodeCount: number
  descendantCount: number
  children: OutlineNode[]
}

type UseFlowSubgraphOutlineOptions = {
  activeGraphId: Ref<string>
  currentTab: ComputedRef<WorkflowTab | null>
}

type UseFlowSubgraphOutlineReturn = {
  outlineExpandedKeys: ComputedRef<string[]>
  outlinePathLabels: ComputedRef<string[]>
  outlineTree: ComputedRef<OutlineNode[]>
}

function getChildSubgraphIds(tab: WorkflowTab, graphId: string): string[] {
  const subgraphs = normalizePersistedSubgraphs(tab.subgraphs) as Record<string, FlowGraph>
  return Object.entries(subgraphs)
    .filter(([, graph]) => (String(graph?.parentGraphId || ROOT_GRAPH_ID).trim() || ROOT_GRAPH_ID) === graphId)
    .map(([subgraphId]) => subgraphId)
}

function resolveSubgraphLabel(tab: WorkflowTab, subgraphId: string): string {
  const subgraphs = normalizePersistedSubgraphs(tab.subgraphs) as Record<string, FlowGraph>
  const definition = subgraphs[subgraphId]
  return String(definition?.name || '子图').trim() || '子图'
}

function buildOutlineChildren(tab: WorkflowTab, graphId: string, visited = new Set<string>()): OutlineNode[] {
  const subgraphs = normalizePersistedSubgraphs(tab.subgraphs) as Record<string, FlowGraph>
  return getChildSubgraphIds(tab, graphId)
    .filter((subgraphId) => !visited.has(subgraphId))
    .map((subgraphId) => {
      const nextVisited = new Set(visited)
      nextVisited.add(subgraphId)
      const children = buildOutlineChildren(tab, subgraphId, nextVisited)
      const descendantCount = children.reduce((total, child) => total + 1 + child.descendantCount, 0)
      return {
        graphId: subgraphId,
        label: resolveSubgraphLabel(tab, subgraphId),
        nodeCount: countGraphTotalNodes(subgraphs as never, subgraphId),
        descendantCount,
        children,
      }
    })
}

function buildOutlinePathLabels(tab: WorkflowTab | null, graphId: string): string[] {
  if (!tab || graphId === ROOT_GRAPH_ID) return []
  const labels: string[] = []
  const visited = new Set<string>()
  let currentId = graphId
  while (currentId && currentId !== ROOT_GRAPH_ID && !visited.has(currentId)) {
    visited.add(currentId)
    const subgraphs = normalizePersistedSubgraphs(tab.subgraphs) as Record<string, FlowGraph>
    const definition = subgraphs[currentId]
    if (!definition) break
    labels.unshift(resolveSubgraphLabel(tab, currentId))
    currentId = String(definition.parentGraphId || ROOT_GRAPH_ID).trim()
  }
  return labels
}

function buildExpandedKeys(tree: OutlineNode[], graphId: string, trail: string[] = []): string[] {
  for (const node of tree) {
    if (node.graphId === graphId) return trail
    const childTrail = buildExpandedKeys(node.children, graphId, [...trail, node.graphId])
    if (childTrail.length > 0) return childTrail
  }
  return []
}

function collectExpandedKeys(tree: OutlineNode[]): string[] {
  return tree.flatMap((node) => [
    node.graphId,
    ...collectExpandedKeys(node.children),
  ])
}

/**
 * 为左上角子图导航构建目录树与当前位置路径。
 */
export function useFlowSubgraphOutline(
  options: UseFlowSubgraphOutlineOptions,
): UseFlowSubgraphOutlineReturn {
  const outlineTree = computed<OutlineNode[]>(() => {
    const tab = options.currentTab.value
    if (!tab) return []
    return buildOutlineChildren(toRaw(tab), ROOT_GRAPH_ID)
  })

  const outlinePathLabels = computed<string[]>(() => {
    if (options.activeGraphId.value === ROOT_GRAPH_ID) return ['主画布']
    const labels = buildOutlinePathLabels(
      options.currentTab.value ? toRaw(options.currentTab.value) : null,
      options.activeGraphId.value,
    )
    return labels.length > 0 ? ['主画布', ...labels] : ['主画布']
  })

  const outlineExpandedKeys = computed<string[]>(() => {
    const activeTrail = buildExpandedKeys(outlineTree.value, options.activeGraphId.value)
    return Array.from(new Set([...collectExpandedKeys(outlineTree.value), ...activeTrail]))
  })

  return {
    outlineExpandedKeys,
    outlinePathLabels,
    outlineTree,
  }
}
