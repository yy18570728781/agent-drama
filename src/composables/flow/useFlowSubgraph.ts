import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  nodes,
  edges,
  selectedNode,
  canvasRef,
  activeWorkflowId,
  activeWorkflowName,
  cloneSerializable,
  filterPersistedNodes,
  filterPersistedEdges,
  getActiveCanvasNodesSnapshot,
  getActiveCanvasEdgesSnapshot,
  ROOT_GRAPH_ID,
  normalizeSubgraphName,
  getRootSubgraphNodes,
} from './useFlowCore'
import {
  buildSubgraphCardNode,
  stripSubgraphCards,
  injectSubgraphCards,
  syncSubgraphCardPositions,
} from './flowSubgraphCreation.utils'
import { useFlowSubgraphCreation } from './useFlowSubgraphCreation'
import type {
  FlowEdge,
  FlowNode,
  FlowPosition,
  FlowViewport,
  WorkflowDefinition,
  WorkflowSubgraph,
  WorkflowTab,
} from './flowCore.types'
import type {
  FlowRepairProgress,
  FlowSubgraphDeps,
  PastedSubgraphsPayload,
  SubgraphActionPayload,
  SubgraphDeleteRequest,
} from './flowRuntime.types'

export function useFlowSubgraph(deps: FlowSubgraphDeps) {
  const activeGraphId = deps.activeGraphId || ref(ROOT_GRAPH_ID)
  const renderedGraphId = deps.renderedGraphId || ref(ROOT_GRAPH_ID)
  const showDeleteSubgraphModal = ref(false)
  const pendingDeleteSubgraphs = ref<SubgraphActionPayload[]>([])
  const isRepairingGeneratingCards = ref(false)
  const repairProgressCurrent = ref(0)
  const repairProgressTotal = ref(0)

  // ==================== Computed ====================

  const activeGraphLabel = computed(() => {
    if (activeGraphId.value === ROOT_GRAPH_ID) return '主画布'
    const currentTab = deps.getActiveTab()
    return currentTab?.subgraphs?.[activeGraphId.value]?.name || '子图'
  })

  const activeCanvasSubgraphDefinitions = computed(() => {
    const currentTab = deps.getActiveTab()
    return currentTab?.subgraphs || {}
  })

  const deleteSubgraphModalLabel = computed(() => {
    if (pendingDeleteSubgraphs.value.length === 1) {
      return `子图"${pendingDeleteSubgraphs.value[0]?.label || '子图'}"`
    }
    return `选中的 ${pendingDeleteSubgraphs.value.length} 个子图`
  })

  const repairButtonTitle = computed(() => {
    if (isRepairingGeneratingCards.value && repairProgressTotal.value > 0) {
      return `修复中 ${repairProgressCurrent.value}/${repairProgressTotal.value}`
    }
    return isRepairingGeneratingCards.value ? '修复中...' : '修复'
  })

  // ==================== 子图工具 ====================

  function ensureSubgraphsMap(target: WorkflowTab): Record<string, WorkflowSubgraph> {
    if (!target.subgraphs || typeof target.subgraphs !== 'object' || Array.isArray(target.subgraphs)) {
      target.subgraphs = {}
    }
    return target.subgraphs
  }

  function migrateSubgraphCards(tab: WorkflowTab): boolean {
    if (!tab) return false
    const subgraphs = ensureSubgraphsMap(tab)
    let migrated = false

    const extractFromList = (nodeList: FlowNode[], parentGraphId: string): FlowNode[] => {
      const kept: FlowNode[] = []
      for (const node of nodeList) {
        if (node?.type !== 'subgraph' || !node?.data?.subgraphId) {
          kept.push(node)
          continue
        }
        const subgraphId = String(node.data.subgraphId).trim()
        if (!subgraphId) { kept.push(node); continue }
        const def = subgraphs[subgraphId]
        if (!def) { kept.push(node); continue }
        def.parentGraphId = parentGraphId
        def.cardPosition = {
          x: node.position?.x || 0,
          y: node.position?.y || 0,
        }
        if (node.data?.label) def.name = String(node.data.label).trim() || def.name || '子图'
        migrated = true
      }
      return kept
    }

    if (Array.isArray(tab.nodes)) {
      tab.nodes = extractFromList(tab.nodes, ROOT_GRAPH_ID)
    }
    Object.keys(subgraphs).forEach((graphId) => {
      const def = subgraphs[graphId]
      if (def && Array.isArray(def.nodes)) {
        def.nodes = extractFromList(def.nodes, graphId)
      }
    })

    return migrated
  }

  function hasDuplicateSubgraphName(tab: WorkflowTab, name: string, excludeSubgraphId = ''): boolean {
    const normalized = normalizeSubgraphName(name)
    if (!normalized) return false
    return Object.entries(ensureSubgraphsMap(tab)).some(([subgraphId, subgraph]) => {
      if (subgraphId === excludeSubgraphId) return false
      return normalizeSubgraphName(subgraph?.name) === normalized
    })
  }

  function getGraphViewport(graph: WorkflowDefinition | WorkflowSubgraph): FlowViewport {
    return graph?.viewport || { zoom: 1, x: 0, y: 0 }
  }

  function getTabGraph(tab: WorkflowTab, graphId = ROOT_GRAPH_ID): WorkflowSubgraph | null {
    if (!tab) return null
    if (graphId === ROOT_GRAPH_ID) {
      return {
        id: ROOT_GRAPH_ID,
        name: '主画布',
        nodes: tab.nodes || [],
        edges: tab.edges || [],
        viewport: getGraphViewport(tab),
      }
    }
    return ensureSubgraphsMap(tab)[graphId] || null
  }

  function setTabGraph(
    tab: WorkflowTab,
    graphId: string,
    graph: WorkflowDefinition | WorkflowSubgraph,
  ): void {
    if (!tab || !graphId || !graph) return
    if (graphId === ROOT_GRAPH_ID) {
      tab.nodes = graph.nodes || []
      tab.edges = graph.edges || []
      tab.viewport = getGraphViewport(graph)
      return
    }
    const previousGraph = ensureSubgraphsMap(tab)[graphId] || {}
    ensureSubgraphsMap(tab)[graphId] = {
      ...previousGraph,
      id: graphId,
      name: graph.name || '子图',
      nodes: graph.nodes || [],
      edges: graph.edges || [],
      viewport: getGraphViewport(graph),
    }
  }

  function expandSelectedGroupNodeIds(nodeIds: string[], liveNodes: FlowNode[]): Set<string> {
    const expanded = new Set<string>(nodeIds)
    let changed = true
    while (changed) {
      changed = false
      for (const node of liveNodes) {
        if (node?.parentNode && expanded.has(node.parentNode) && !expanded.has(node.id)) {
          expanded.add(node.id)
          changed = true
        }
      }
    }
    return expanded
  }

  // ==================== 子图操作 ====================

  function handleOpenSubgraph(payload: SubgraphActionPayload): void {
    const subgraphId = payload?.subgraphId
    const currentTab = deps.getActiveTab()
    if (!subgraphId || !currentTab) {
      ElMessage.warning('未找到这张子图对应的内部画布')
      return
    }
    if (!currentTab.subgraphs?.[subgraphId]) {
      ensureSubgraphsMap(currentTab)[subgraphId] = {
        id: subgraphId,
        name: String(payload?.label || '').trim() || '子图',
        parentGraphId: activeGraphId.value || ROOT_GRAPH_ID,
        nodes: [],
        edges: [],
        viewport: { zoom: 1, x: 0, y: 0 },
      }
      deps.saveDraft()
      deps.saveTabs()
    }
    deps.syncCurrentGraphToActiveTab()
    deps.openGraphInTab(currentTab, subgraphId)
  }

  function handleRenameSubgraph(payload: SubgraphActionPayload): void {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return
    const subgraphId = String(payload?.subgraphId || '').trim()
    if (!subgraphId) return
    const nextLabel = String(payload?.label || '').trim() || '子图'
    const previousLabel = String(payload?.previousLabel || '').trim() || '子图'

    if (hasDuplicateSubgraphName(currentTab, nextLabel, subgraphId)) {
      const subgraph = ensureSubgraphsMap(currentTab)[subgraphId]
      if (subgraph) subgraph.name = previousLabel
      ElMessage.warning(`已存在同名子图："${nextLabel}"`)
      return
    }

    const subgraph = ensureSubgraphsMap(currentTab)[subgraphId]
    if (subgraph) subgraph.name = nextLabel

    // Update live canvas card nodes to reflect the rename
    nodes.value = nodes.value.map((node) => {
      if (node?.type !== 'subgraph' || node?.data?.subgraphId !== subgraphId) return node
      return {
        ...node,
        data: {
          ...(node.data || {}),
          label: nextLabel,
        },
      }
    })

    deps.saveDraft()
    deps.recordTabHistory(currentTab)
    deps.saveTabs()
  }

  async function dissolveSubgraphIntoRoot(
    currentTab: WorkflowTab,
    payload: SubgraphActionPayload,
  ): Promise<boolean> {
    const subgraphId = payload?.subgraphId
    const subgraph = currentTab.subgraphs?.[subgraphId]
    if (!subgraphId || !subgraph) {
      ElMessage.warning('未找到要解散的子图')
      return false
    }

    const parentGraphId = String(subgraph.parentGraphId || ROOT_GRAPH_ID).trim() || ROOT_GRAPH_ID
    const parentNodes = parentGraphId === ROOT_GRAPH_ID
      ? (Array.isArray(currentTab.nodes) ? currentTab.nodes : [])
      : (Array.isArray(currentTab.subgraphs?.[parentGraphId]?.nodes) ? currentTab.subgraphs[parentGraphId].nodes : [])
    const parentEdges = parentGraphId === ROOT_GRAPH_ID
      ? (Array.isArray(currentTab.edges) ? currentTab.edges : [])
      : (Array.isArray(currentTab.subgraphs?.[parentGraphId]?.edges) ? currentTab.subgraphs[parentGraphId].edges : [])

    // 将待解散子图内的嵌套子图归属到父图
    Object.values(currentTab.subgraphs || {}).forEach((child) => {
      if (String(child?.parentGraphId || '').trim() === subgraphId) {
        child.parentGraphId = parentGraphId
      }
    })

    const innerNodes = cloneSerializable(subgraph.nodes || [])
    const innerEdges = cloneSerializable(subgraph.edges || [])
    if (!innerNodes.length) {
      if (parentGraphId === ROOT_GRAPH_ID) {
        currentTab.nodes = parentNodes
        currentTab.edges = parentEdges
      } else if (currentTab.subgraphs?.[parentGraphId]) {
        currentTab.subgraphs[parentGraphId].nodes = parentNodes
        currentTab.subgraphs[parentGraphId].edges = parentEdges
      }
      delete currentTab.subgraphs[subgraphId]
      await deps.openGraphInTab(currentTab, parentGraphId)
      return true
    }

    const innerNodeMap = new Map<string, FlowNode>(innerNodes.map((node) => [node.id, node]))
    const localAbsoluteMap = new Map<string, FlowPosition>()
    const resolveLocalAbsolute = (nodeId: string): FlowPosition => {
      const cachedPosition = localAbsoluteMap.get(nodeId)
      if (cachedPosition) return cachedPosition
      const node = innerNodeMap.get(nodeId)
      if (!node) return { x: 0, y: 0 }
      const ownPosition = node.position || { x: 0, y: 0 }
      if (!node.parentNode || !innerNodeMap.has(node.parentNode)) {
        const result = { x: ownPosition.x || 0, y: ownPosition.y || 0 }
        localAbsoluteMap.set(nodeId, result)
        return result
      }
      const parentPosition = resolveLocalAbsolute(node.parentNode)
      const result = {
        x: parentPosition.x + (ownPosition.x || 0),
        y: parentPosition.y + (ownPosition.y || 0),
      }
      localAbsoluteMap.set(nodeId, result)
      return result
    }

    let minX = Infinity
    let minY = Infinity
    innerNodes.forEach((node) => {
      const absolute = resolveLocalAbsolute(node.id)
      minX = Math.min(minX, absolute.x)
      minY = Math.min(minY, absolute.y)
    })
    if (!Number.isFinite(minX)) minX = 0
    if (!Number.isFinite(minY)) minY = 0

    const anchorX = subgraph.cardPosition?.x || 0
    const anchorY = subgraph.cardPosition?.y || 0
    const restoredNodes = innerNodes.map((node) => {
      const nextNode = cloneSerializable(node)
      if (!node.parentNode || !innerNodeMap.has(node.parentNode)) {
        const absolute = resolveLocalAbsolute(node.id)
        nextNode.position = {
          x: anchorX + (absolute.x - minX),
          y: anchorY + (absolute.y - minY),
        }
      }
      return nextNode
    })

    const nextParentNodes = [
      ...parentNodes,
      ...restoredNodes,
    ]
    const nextParentEdges = [
      ...parentEdges,
      ...innerEdges,
    ]

    if (parentGraphId === ROOT_GRAPH_ID) {
      currentTab.nodes = nextParentNodes
      currentTab.edges = nextParentEdges
    } else if (currentTab.subgraphs?.[parentGraphId]) {
      currentTab.subgraphs[parentGraphId].nodes = nextParentNodes
      currentTab.subgraphs[parentGraphId].edges = nextParentEdges
    }
    delete currentTab.subgraphs[subgraphId]
    await deps.openGraphInTab(currentTab, parentGraphId)
    return true
  }

  async function deleteSubgraphWithContents(
    currentTab: WorkflowTab,
    payload: SubgraphActionPayload,
  ): Promise<boolean> {
    const subgraphId = payload?.subgraphId
    if (!subgraphId) {
      ElMessage.warning('未找到要删除的子图')
      return false
    }

    const subgraph = currentTab.subgraphs?.[subgraphId]
    if (!subgraph) return false

    const parentGraphId = String(subgraph.parentGraphId || ROOT_GRAPH_ID).trim() || ROOT_GRAPH_ID

    // 将待删除子图内的嵌套子图归属到父图
    Object.values(currentTab.subgraphs || {}).forEach((child) => {
      if (String(child?.parentGraphId || '').trim() === subgraphId) {
        child.parentGraphId = parentGraphId
      }
    })

    if (currentTab.subgraphs?.[subgraphId]) {
      delete currentTab.subgraphs[subgraphId]
    }
    deps.openGraphInTab(currentTab, parentGraphId)
    return true
  }

  async function handleDissolveSubgraph(payload: SubgraphActionPayload): Promise<void> {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return

    deps.syncCurrentGraphToActiveTab()

    const subgraph = currentTab.subgraphs?.[payload?.subgraphId]
    if (!subgraph) {
      ElMessage.warning('未找到要解散的子图')
      return
    }
    const innerNodeCount = filterPersistedNodes(subgraph.nodes || []).length
    if (innerNodeCount === 0) {
      const changed = await deleteSubgraphWithContents(currentTab, payload)
      if (!changed) return
      deps.recordTabHistory(currentTab)
      deps.saveDraft()
      deps.saveTabs()
      ElMessage.success(`已删除空子图：${payload?.label || subgraph.name || '子图'}`)
      return
    }

    try {
      await ElMessageBox.confirm(
        `解散后，子图"${payload?.label || subgraph.name || '子图'}"里的节点和连线都会回到当前父画布，且无法自动恢复为原子图结构。是否继续？`,
        '确认解散子图',
        {
          confirmButtonText: '解散',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
        }
      )
    } catch {
      return
    }
    const changed = await dissolveSubgraphIntoRoot(currentTab, payload)
    if (!changed) return
    deps.recordTabHistory(currentTab)
    deps.saveDraft()
    deps.saveTabs()
    ElMessage.success(`已解散子图：${payload?.label || subgraph.name || '子图'}`)
  }

  function closeDeleteSubgraphModal() {
    showDeleteSubgraphModal.value = false
    pendingDeleteSubgraphs.value = []
  }

  async function confirmDeleteSubgraphDissolve() {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return closeDeleteSubgraphModal()
    deps.syncCurrentGraphToActiveTab()
    const subgraphs = pendingDeleteSubgraphs.value.slice().filter(Boolean)
    if (!subgraphs.length) return closeDeleteSubgraphModal()

    let changed = false
    for (const item of subgraphs) {
      changed = (await dissolveSubgraphIntoRoot(currentTab, item)) || changed
    }
    if (changed) {
      deps.recordTabHistory(currentTab)
      deps.saveDraft()
      deps.saveTabs()
      ElMessage.success('已打散子图')
    }
    closeDeleteSubgraphModal()
  }

  async function confirmDeleteSubgraphRemoveAll(): Promise<void> {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return closeDeleteSubgraphModal()
    deps.syncCurrentGraphToActiveTab()
    const subgraphs = pendingDeleteSubgraphs.value.slice().filter(Boolean)
    if (!subgraphs.length) return closeDeleteSubgraphModal()

    let changed = false
    for (const item of subgraphs) {
      changed = (await deleteSubgraphWithContents(currentTab, item)) || changed
    }
    if (changed) {
      deps.recordTabHistory(currentTab)
      deps.saveDraft()
      deps.saveTabs()
      ElMessage.success('已删除子图及内部节点')
    }
    closeDeleteSubgraphModal()
  }

  async function handleDeleteSubgraphRequest(payload: SubgraphDeleteRequest): Promise<void> {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return

    deps.syncCurrentGraphToActiveTab()
    const subgraphs = Array.isArray(payload?.subgraphs) ? payload.subgraphs.filter(Boolean) : []
    const reason = payload?.reason || 'delete'
    if (!subgraphs.length) return
    if (reason === 'cut') {
      let changed = false
      for (const item of subgraphs) {
        changed = (await deleteSubgraphWithContents(currentTab, item)) || changed
      }
      if (changed) {
        deps.recordTabHistory(currentTab)
        deps.saveDraft()
        deps.saveTabs()
        ElMessage.success('已剪切子图')
      }
      return
    }
    const hasInnerNodes = subgraphs.some((item) => {
      const subgraphId = String(item?.subgraphId || '').trim()
      if (!subgraphId) return false
      const subgraph = currentTab.subgraphs?.[subgraphId]
      return filterPersistedNodes(subgraph?.nodes || []).length > 0
    })
    if (!hasInnerNodes) {
      let changed = false
      for (const item of subgraphs) {
        changed = (await deleteSubgraphWithContents(currentTab, item)) || changed
      }
      if (changed) {
        deps.recordTabHistory(currentTab)
        deps.saveDraft()
        deps.saveTabs()
      ElMessage.success('已删除空子图')
      }
      return
    }
    pendingDeleteSubgraphs.value = subgraphs
    showDeleteSubgraphModal.value = true
  }

  async function handleRepairGeneratingCards() {
    if (isRepairingGeneratingCards.value) return
    const canvasApi = deps.getCanvasApi?.() || canvasRef.value
    const repair = canvasApi?.repairGeneratingNodes
    if (typeof repair !== 'function') {
      ElMessage.warning('当前画布暂不支持修复生成卡')
      return
    }

    isRepairingGeneratingCards.value = true
    try {
      await repair()
    } finally {
      isRepairingGeneratingCards.value = false
    }
  }

  function handleRepairProgress(payload: FlowRepairProgress): void {
    repairProgressCurrent.value = Number(payload?.current || 0)
    repairProgressTotal.value = Number(payload?.total || 0)
    if (!payload?.active) {
      setTimeout(() => {
        repairProgressCurrent.value = 0
        repairProgressTotal.value = 0
      }, 600)
    }
  }

  function navigateToRootGraph() {
    const currentTab = deps.getActiveTab()
    if (!currentTab || activeGraphId.value === ROOT_GRAPH_ID) return
    deps.syncCurrentGraphToActiveTab()
    deps.openGraphInTab(currentTab, ROOT_GRAPH_ID)
  }

  function handleCanvasNodesUpdate(nextNodes: FlowNode[]): void {
    nodes.value = filterPersistedNodes(nextNodes)
    const currentTab = deps.getActiveTab()
    if (!currentTab) return
    syncSubgraphCardPositions(ensureSubgraphsMap(currentTab), nodes.value)
    const contentNodes = stripSubgraphCards(nodes.value)
    if (activeGraphId.value === ROOT_GRAPH_ID) {
      currentTab.nodes = deps.serializeNodes(contentNodes)
      return
    }
    const activeSubgraph = ensureSubgraphsMap(currentTab)[activeGraphId.value]
    if (activeSubgraph) {
      activeSubgraph.nodes = deps.serializeNodes(contentNodes)
    }
  }

  function handleCanvasEdgesUpdate(nextEdges: FlowEdge[]): void {
    edges.value = nextEdges
    const currentTab = deps.getActiveTab()
    if (!currentTab || activeGraphId.value === ROOT_GRAPH_ID) return
    const activeSubgraph = ensureSubgraphsMap(currentTab)[activeGraphId.value]
    if (!activeSubgraph) return
    activeSubgraph.edges = deps.serializeEdges(nextEdges, nodes.value)
  }

  function handlePasteSubgraphs(payload: PastedSubgraphsPayload): void {
    const currentTab = deps.getActiveTab()
    if (!currentTab) return
    const pastedSubgraphs = isPlainObjectInCore(payload?.subgraphs) ? payload.subgraphs : {}
    if (!Object.keys(pastedSubgraphs).length) return
    const subgraphs = ensureSubgraphsMap(currentTab)
    Object.entries(pastedSubgraphs).forEach(([subgraphId, subgraphDef]) => {
      const normalizedId = String(subgraphId || '').trim()
      if (!normalizedId) return
      subgraphs[normalizedId] = cloneSerializable(subgraphDef)
      subgraphs[normalizedId].id = normalizedId
    })
  }

  // Helper - isPlainObject is imported from core but we need it here for handlePasteSubgraphs
  function isPlainObjectInCore(value: unknown): value is Record<string, WorkflowSubgraph> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
  }

  const {
    promptSubgraphName,
    handleCreateSubgraph,
  } = useFlowSubgraphCreation({
    activeGraphId,
    getActiveTab: deps.getActiveTab,
    ensureSubgraphsMap,
    hasDuplicateSubgraphName,
    setTabGraph,
    expandSelectedGroupNodeIds,
    serializeNodes: deps.serializeNodes,
    serializeEdges: deps.serializeEdges,
    openGraphInTab: deps.openGraphInTab,
    recordTabHistory: deps.recordTabHistory,
    saveDraft: deps.saveDraft,
    saveTabs: deps.saveTabs,
  })

  return {
    // State
    activeGraphId,
    renderedGraphId,
    showDeleteSubgraphModal,
    pendingDeleteSubgraphs,
    isRepairingGeneratingCards,
    repairProgressCurrent,
    repairProgressTotal,

    // Computed
    activeGraphLabel,
    activeCanvasSubgraphDefinitions,
    deleteSubgraphModalLabel,
    repairButtonTitle,

    // Functions
    ensureSubgraphsMap,
    hasDuplicateSubgraphName,
    getGraphViewport,
    getTabGraph,
    setTabGraph,
    migrateSubgraphCards,
    injectSubgraphCards: (tab: WorkflowTab, graphId: string) => injectSubgraphCards(ensureSubgraphsMap(tab), graphId),
    syncSubgraphCardPositions: (tab: WorkflowTab, _graphId: string, liveNodes: FlowNode[]) => syncSubgraphCardPositions(ensureSubgraphsMap(tab), liveNodes),
    stripSubgraphCards,
    expandSelectedGroupNodeIds,
    promptSubgraphName,
    handleCreateSubgraph,
    handleOpenSubgraph,
    handleRenameSubgraph,
    dissolveSubgraphIntoRoot,
    deleteSubgraphWithContents,
    handleDissolveSubgraph,
    closeDeleteSubgraphModal,
    confirmDeleteSubgraphDissolve,
    confirmDeleteSubgraphRemoveAll,
    handleDeleteSubgraphRequest,
    handleRepairGeneratingCards,
    handleRepairProgress,
    navigateToRootGraph,
    handleCanvasNodesUpdate,
    handleCanvasEdgesUpdate,
    handlePasteSubgraphs,
  }
}
