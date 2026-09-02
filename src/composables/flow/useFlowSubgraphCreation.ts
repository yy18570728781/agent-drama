import { ElMessage, ElMessageBox } from 'element-plus'
import { createFlowId } from '@/utils/flowId'
import {
  nodes,
  selectedNode,
  canvasRef,
  filterPersistedNodes,
  getActiveCanvasEdgesSnapshot,
  ROOT_GRAPH_ID,
} from './useFlowCore'
import { normalizeFlowFileName, REQUIRED_FLOW_FILE_NAME_MESSAGE } from './flowNameValidation'
import {
  buildViewport,
  validateSubgraphSelection,
  measureSelectedNodeBounds,
  buildInnerNodes,
} from './flowSubgraphCreation.utils'
import type {
  CreateSubgraphPayload,
  FlowEdgeLike,
  FlowNodeLike,
  UseFlowSubgraphCreationDeps,
  UseFlowSubgraphCreationReturn,
  WorkflowTabLike,
} from './flowSubgraphCreation.types'

function getActiveGraphName(currentTab: WorkflowTabLike, activeGraphId: string): string {
  if (activeGraphId === ROOT_GRAPH_ID) return '主画布'
  return depsEnsureSubgraphName(currentTab, activeGraphId)
}

function depsEnsureSubgraphName(currentTab: WorkflowTabLike, activeGraphId: string): string {
  return String(currentTab.subgraphs?.[activeGraphId]?.name || '').trim() || '子图'
}

function setActiveGraphSnapshot(
  currentTab: WorkflowTabLike,
  activeGraphId: string,
  nextNodes: FlowNodeLike[],
  nextEdges: FlowEdgeLike[],
  deps: UseFlowSubgraphCreationDeps,
): void {
  deps.setTabGraph(currentTab, activeGraphId, {
    id: activeGraphId,
    name: getActiveGraphName(currentTab, activeGraphId),
    nodes: nextNodes,
    edges: nextEdges,
    viewport: buildViewport(),
  })
}

async function createEmptySubgraph(
  currentTab: WorkflowTabLike,
  payload: CreateSubgraphPayload | undefined,
  subgraphName: string,
  deps: UseFlowSubgraphCreationDeps,
): Promise<void> {
  const activeGraphId = deps.activeGraphId.value
  const subgraphId = createFlowId('sub')
  const position = payload?.position || { x: 0, y: 0 }
  deps.ensureSubgraphsMap(currentTab)[subgraphId] = {
    id: subgraphId,
    name: subgraphName,
    parentGraphId: activeGraphId,
    cardPosition: { x: position.x || 0, y: position.y || 0 },
    nodes: [],
    edges: [],
    viewport: { zoom: 1, x: 0, y: 0 },
  }

  await deps.openGraphInTab(currentTab, activeGraphId)
  deps.recordTabHistory(currentTab)
  ElMessage.success(`已创建子图：${subgraphName}`)
}

async function createSubgraphFromSelection(
  currentTab: WorkflowTabLike,
  nodeIds: string[],
  subgraphName: string,
  deps: UseFlowSubgraphCreationDeps,
): Promise<void> {
  const liveNodes = canvasRef.value?.getNodes?.() || nodes.value
  const persistedNodes = filterPersistedNodes(liveNodes)
  const liveEdges = getActiveCanvasEdgesSnapshot(persistedNodes)
  const activeGraphId = deps.activeGraphId.value
  const selectedIdSet = deps.expandSelectedGroupNodeIds(nodeIds, liveNodes)
  const selectedNodes = liveNodes.filter((node) => selectedIdSet.has(node.id))
  const validationMessage = validateSubgraphSelection(selectedNodes, selectedIdSet, liveEdges)
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }

  const { minX, minY } = measureSelectedNodeBounds(selectedNodes)
  const subgraphId = createFlowId('sub')
  const innerNodes = buildInnerNodes(selectedNodes, selectedIdSet, minX, minY, deps.serializeNodes)
  const innerEdges = deps.serializeEdges(
    liveEdges.filter((edge) => selectedIdSet.has(edge.source) && selectedIdSet.has(edge.target)),
    selectedNodes,
  )
  const nextRootNodes = deps.serializeNodes(liveNodes.filter((node) => !selectedIdSet.has(node.id)))
  const nextRootEdges = deps.serializeEdges(
    liveEdges.filter((edge) => !selectedIdSet.has(edge.source) && !selectedIdSet.has(edge.target)),
    nextRootNodes,
  )

  deps.ensureSubgraphsMap(currentTab)[subgraphId] = {
    id: subgraphId,
    name: subgraphName,
    parentGraphId: activeGraphId,
    cardPosition: { x: minX, y: minY },
    nodes: innerNodes,
    edges: innerEdges,
    viewport: { zoom: 1, x: 0, y: 0 },
  }
  setActiveGraphSnapshot(currentTab, activeGraphId, nextRootNodes, nextRootEdges, deps)
  selectedNode.value = null
  await deps.openGraphInTab(currentTab, activeGraphId)
  deps.recordTabHistory(currentTab)
  ElMessage.success(`已创建子图：${subgraphName}`)
}

/**
 * 把子图创建与命名弹窗逻辑独立出去，便于统一工作流/子图的必填校验。
 * @param deps 子图创建依赖集合
 * @returns 子图命名与创建动作
 */
export function useFlowSubgraphCreation(deps: UseFlowSubgraphCreationDeps): UseFlowSubgraphCreationReturn {
  async function promptSubgraphName(): Promise<string> {
    try {
      const result = await ElMessageBox.prompt('输入子图名称', '新建子图', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: '',
        inputPattern: /\S+/,
        inputErrorMessage: REQUIRED_FLOW_FILE_NAME_MESSAGE,
      })
      if (!result || typeof result !== 'object' || !('value' in result)) return ''
      return normalizeFlowFileName(result.value)
    } catch {
      return ''
    }
  }

  async function handleCreateSubgraph(payload?: CreateSubgraphPayload): Promise<void> {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return

    const subgraphName = await promptSubgraphName()
    if (!subgraphName) return
    if (deps.hasDuplicateSubgraphName(currentTab, subgraphName)) {
      ElMessage.warning(`已存在同名子图："${subgraphName}"`)
      return
    }

    const nodeIds = Array.isArray(payload?.nodeIds) ? payload.nodeIds.filter(Boolean) : []
    if (!nodeIds.length) {
      await createEmptySubgraph(currentTab, payload, subgraphName, deps)
      return
    }

    await createSubgraphFromSelection(currentTab, nodeIds, subgraphName, deps)
  }

  return {
    promptSubgraphName,
    handleCreateSubgraph,
  }
}
