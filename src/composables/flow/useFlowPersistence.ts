import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '@/services/flow/workflow.service'
import {
  buildPersistedWorkflowNodeData,
} from '@/utils/workflowNodeData'
import {
  buildPersistedWorkflowTaskData,
} from './workflowTaskState'
import {
  nodes,
  edges,
  selectedNode,
  nodeTypes,
  capabilityPorts,
  isLoadingWorkflow,
  loadProgress,
  loadProgressText,
  canvasRef,
  activeWorkflowId,
  activeWorkflowName,
  edgeStyle,
  initialized,
  setInitialized,
  setLoadAbortController,
  loadAbortController,
  DRAFT_STORAGE_KEY,
  ROOT_GRAPH_ID,
  cloneSerializable,
  isPlainObject,
  filterPersistedEdges,
  filterPersistedNodes,
  getActiveCanvasNodesSnapshot,
  getActiveCanvasEdgesSnapshot,
  workflowTabs,
  activeTabId,
  showWorkflowPicker,
  isWorkflowSwitching,
} from './useFlowCore'
import { normalizeWorkflowTabId } from './flowTabIdentity'
import { idbGet, idbSet, idbRemove } from '@/utils/indexedDBStorage'
import { normalizeFlowEdgeId, normalizeFlowNodeId } from '@/utils/flowId'
import {
  flattenWorkflowDefinition,
  hydrateFlattenedWorkflowDefinition,
  isFlattenedWorkflowDefinition,
  normalizePersistedSubgraphs,
  serializePersistedSubgraphs,
} from './flowSubgraphPersistence.utils'
import { injectSubgraphCards, stripSubgraphCards } from './flowSubgraphCreation.utils'
import { hasFlowFileName, normalizeFlowFileName, REQUIRED_FLOW_FILE_NAME_MESSAGE } from './flowNameValidation'
import { useSingleWorkflowLoader } from './useSingleWorkflowLoader'
import { useFlowJsonImport } from './useFlowJsonImport'
import { prepareFlowRuntime, restoreAndSettleFlowRuntime } from './flowDefinitionRuntime'
import { extractRequestErrorMessage } from '@/utils/requestErrorMessage'
import { toArrayIndex, toFlowEdge, toFlowNode, toFlowViewport } from './flowDefinitionValues'
import type { WorkflowRecord } from '@/services/flow/workflow.service'
import type {
  FlowEdge,
  FlowDefinitionLoadOptions,
  FlowNode,
  PendingWorkflowSave,
  PersistedWorkflowDefinition,
  PersistedWorkflowSubgraph,
  WorkflowDefinition,
  WorkflowSubgraph,
  WorkflowTab,
} from './flowCore.types'
import type { FlowPersistenceDeps } from './flowRuntime.types'

export function useFlowPersistence(deps: FlowPersistenceDeps) {
  const HIDDEN_WORKFLOW_IDS = new Set([
    '/workflows/preset_i2i',
    '/workflows/preset_t2i',
    '/workflows/preset_i2v',
  ])

  function shouldHideWorkflow(workflow: { id?: unknown }): boolean {
    const workflowId = String(workflow?.id || '').trim()
    return HIDDEN_WORKFLOW_IDS.has(workflowId)
  }

  function isEmptyDraftTab(tab: WorkflowTab | null): boolean {
    if (!tab || normalizeWorkflowTabId(tab.workflowId)) return false
    const nodesCount = Array.isArray(tab.nodes) ? tab.nodes.length : 0
    const edgesCount = Array.isArray(tab.edges) ? tab.edges.length : 0
    const subgraphsCount = tab.subgraphs && typeof tab.subgraphs === 'object'
      ? Object.keys(tab.subgraphs).length
      : 0
    return nodesCount === 0 && edgesCount === 0 && subgraphsCount === 0
  }

  function getValidWorkflowName(rawName: unknown): string {
    const normalizedName = normalizeFlowFileName(rawName)
    if (!hasFlowFileName(normalizedName)) {
      ElMessage.warning(REQUIRED_FLOW_FILE_NAME_MESSAGE)
      return ''
    }
    return normalizedName
  }

  // ==================== 序列化 ====================

  function buildNormalizedNodeIdMap(nodeList: FlowNode[] = []): Map<string, string> {
    const idMap = new Map<string, string>()
    const usedIds = new Set<string>()
    nodeList.forEach((node) => {
      const rawId = String(node?.id || '').trim()
      if (!rawId) return
      let normalizedId = normalizeFlowNodeId(rawId)
      while (usedIds.has(normalizedId)) {
        normalizedId = normalizeFlowNodeId('')
      }
      usedIds.add(normalizedId)
      idMap.set(rawId, normalizedId)
    })
    return idMap
  }

  function serializeNodes(nodeList: FlowNode[]): FlowNode[] {
    const persistedNodes = filterPersistedNodes(nodeList)
    const idMap = buildNormalizedNodeIdMap(persistedNodes)
    return persistedNodes
      .map((n) => {
        const data = {
          ...buildPersistedWorkflowNodeData(n),
          ...buildPersistedWorkflowTaskData(n.data),
        }
        const serialized: FlowNode = {
          id: idMap.get(String(n.id || '').trim()) || normalizeFlowNodeId(n.id),
          type: n.type,
          position: n.position,
          data,
        }
        if (n.parentNode) {
          const normalizedParentId = idMap.get(String(n.parentNode || '').trim())
          serialized.parentNode = normalizedParentId || normalizeFlowNodeId(n.parentNode)
        }
        if (n.extent !== undefined) serialized.extent = n.extent
        if (n.style) serialized.style = n.style
        if (n.zIndex !== undefined) serialized.zIndex = n.zIndex

        if (serialized.data) {
          Object.keys(serialized.data).forEach((key) => {
            if (serialized.data[key] === undefined) {
              delete serialized.data[key]
            }
          })
        }

        return serialized
      })
  }

  function serializeEdges(edgeList: FlowEdge[], nodeList: FlowNode[] = nodes.value): FlowEdge[] {
    const persistedNodes = filterPersistedNodes(nodeList)
    const idMap = buildNormalizedNodeIdMap(persistedNodes)
    const nodeIds = new Set(idMap.values())

    return edgeList
      .map((e) => {
        const source = idMap.get(String(e?.source || '').trim()) || ''
        const target = idMap.get(String(e?.target || '').trim()) || ''
        if (!nodeIds.has(source) || !nodeIds.has(target)) return null
        const serialized: FlowEdge = {
          id: normalizeFlowEdgeId(e?.id),
          source,
          target,
        }
        if (e.sourceHandle) serialized.sourceHandle = e.sourceHandle
        if (e.targetHandle) serialized.targetHandle = e.targetHandle
        return serialized
      })
      .filter((edge): edge is FlowEdge => edge !== null)
  }

  function buildSharedStringCounts(nodeList: unknown[] = []): Map<string, number> {
    const counts = new Map<string, number>()
    for (const node of nodeList) {
      if (!isPlainObject(node)) continue
      const data = isPlainObject(node.data) ? node.data : {}
      for (const key of ['url', 'thumb']) {
        const value = typeof data[key] === 'string' ? data[key].trim() : ''
        if (!value) continue
        counts.set(value, (counts.get(value) || 0) + 1)
      }
    }
    return counts
  }

  function buildSharedRequestCounts(nodeList: unknown[] = []): Map<string, number> {
    const counts = new Map<string, number>()
    for (const node of nodeList) {
      if (!isPlainObject(node) || !isPlainObject(node.data)) continue
      const request = node.data.request
      if (!request || typeof request !== 'object') continue
      const key = JSON.stringify(request)
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return counts
  }

  function sanitizeFlattenedWorkflowDefinition(definition: unknown): PersistedWorkflowDefinition {
    const flattenedDefinition = flattenWorkflowDefinition(definition || {}, ROOT_GRAPH_ID)
    const rawNodes = Array.isArray(flattenedDefinition?.nodes) ? flattenedDefinition.nodes : []
    const rawEdges = Array.isArray(flattenedDefinition?.edges) ? flattenedDefinition.edges : []
    const viewport = toFlowViewport(flattenedDefinition?.viewport)
    const rawSubgraphs = normalizePersistedSubgraphs(flattenedDefinition?.subgraphs)
    const extras: Record<string, unknown> = { ...(flattenedDefinition || {}) }
    delete extras.nodes
    delete extras.edges
    delete extras.viewport
    delete extras.subgraphs

    const seenNodeIds = new Set<string>()
    const normalizedNodeIdMap = new Map<string, string>()
    const sanitizedNodes: FlowNode[] = []
    for (const node of rawNodes) {
      const normalizedNode = toFlowNode(node)
      if (!normalizedNode) continue
      const rawNodeId = normalizedNode.id
      let nodeId = normalizeFlowNodeId(rawNodeId)
      while (seenNodeIds.has(nodeId)) {
        nodeId = normalizeFlowNodeId('')
      }
      seenNodeIds.add(nodeId)
      normalizedNodeIdMap.set(rawNodeId, nodeId)
      const sanitizedNode = cloneSerializable(normalizedNode)
      sanitizedNode.id = nodeId
      const rawParentId = String(sanitizedNode.parentNode || '').trim()
      if (rawParentId) {
        sanitizedNode.parentNode = normalizedNodeIdMap.get(rawParentId) || normalizeFlowNodeId(rawParentId)
      }
      sanitizedNodes.push(sanitizedNode)
    }

    const validNodeIds = new Set(sanitizedNodes.map((node) => node.id))
    const seenEdgeIds = new Set<string>()
    const sanitizedEdges: FlowEdge[] = []
    for (const edge of rawEdges) {
      const normalizedEdge = toFlowEdge(edge)
      if (!normalizedEdge) continue
      const source = normalizedNodeIdMap.get(normalizedEdge.source) || ''
      const target = normalizedNodeIdMap.get(normalizedEdge.target) || ''
      if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue
      let edgeId = normalizeFlowEdgeId(normalizedEdge.id)
      while (seenEdgeIds.has(edgeId)) {
        edgeId = normalizeFlowEdgeId('')
      }
      seenEdgeIds.add(edgeId)
      const sanitizedEdge = cloneSerializable(normalizedEdge)
      sanitizedEdge.id = edgeId
      sanitizedEdge.source = source
      sanitizedEdge.target = target
      sanitizedEdges.push(sanitizedEdge)
    }

    const sanitizedSubgraphs: Record<string, PersistedWorkflowSubgraph> = {}
    Object.entries(rawSubgraphs).forEach(([subgraphId, graphDef]) => {
      const normalizedId = String(subgraphId || '').trim()
      if (!normalizedId || !graphDef || typeof graphDef !== 'object') return
      sanitizedSubgraphs[normalizedId] = cloneSerializable({
        ...graphDef,
        id: String(graphDef.id || normalizedId).trim() || normalizedId,
        viewport: toFlowViewport(graphDef.viewport),
      })
    })

    return {
      ...extras,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      viewport,
      ...(Object.keys(sanitizedSubgraphs).length ? { subgraphs: sanitizedSubgraphs } : {}),
    }
  }

  function sanitizeWorkflowDefinition(definition: unknown, graphId = ROOT_GRAPH_ID): WorkflowDefinition {
    if (isFlattenedWorkflowDefinition(definition)) {
      const persisted = sanitizeFlattenedWorkflowDefinition(definition)
      return sanitizeWorkflowDefinition(
        hydrateFlattenedWorkflowDefinition(persisted, ROOT_GRAPH_ID),
        graphId,
      )
    }
    const source = isPlainObject(definition) ? definition : {}
    const rawNodes = Array.isArray(source.nodes) ? source.nodes : []
    const rawEdges = Array.isArray(source.edges) ? source.edges : []
    const viewport = toFlowViewport(source.viewport)
    const rawSubgraphs = isPlainObject(source.subgraphs) ? source.subgraphs : {}
    const extras: Record<string, unknown> = { ...source }
    delete extras.nodes
    delete extras.edges
    delete extras.viewport
    delete extras.subgraphs

    const seenNodeIds = new Set<string>()
    const normalizedNodeIdMap = new Map<string, string>()
    const sanitizedNodes: FlowNode[] = []
    for (const node of rawNodes) {
      const normalizedNode = toFlowNode(node)
      if (!normalizedNode) continue
      const rawNodeId = normalizedNode.id
      let nodeId = normalizeFlowNodeId(rawNodeId)
      while (seenNodeIds.has(nodeId)) {
        nodeId = normalizeFlowNodeId('')
      }
      seenNodeIds.add(nodeId)
      normalizedNodeIdMap.set(rawNodeId, nodeId)
      const sanitizedNode = cloneSerializable(normalizedNode)
      sanitizedNode.id = nodeId
      const rawParentId = String(sanitizedNode.parentNode || '').trim()
      if (rawParentId) {
        sanitizedNode.parentNode = normalizedNodeIdMap.get(rawParentId) || normalizeFlowNodeId(rawParentId)
      }
      sanitizedNodes.push(sanitizedNode)
    }

    const validNodeIds = new Set(sanitizedNodes.map((node) => node.id))
    const seenEdgeIds = new Set<string>()
    const sanitizedEdges: FlowEdge[] = []
    for (const edge of rawEdges) {
      const normalizedEdge = toFlowEdge(edge)
      if (!normalizedEdge) continue
      const source = normalizedNodeIdMap.get(normalizedEdge.source) || ''
      const target = normalizedNodeIdMap.get(normalizedEdge.target) || ''
      if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue
      let edgeId = normalizeFlowEdgeId(normalizedEdge.id)
      while (seenEdgeIds.has(edgeId)) {
        edgeId = normalizeFlowEdgeId('')
      }
      seenEdgeIds.add(edgeId)
      const sanitizedEdge = cloneSerializable(normalizedEdge)
      sanitizedEdge.id = edgeId
      sanitizedEdge.source = source
      sanitizedEdge.target = target
      sanitizedEdges.push(sanitizedEdge)
    }

    const sanitizedSubgraphs: Record<string, WorkflowSubgraph> = {}
    Object.entries(rawSubgraphs).forEach(([subgraphId, graphDef]) => {
      const normalizedId = String(subgraphId || '').trim()
      if (!normalizedId) return
      sanitizedSubgraphs[normalizedId] = sanitizeWorkflowDefinition(graphDef || {}, normalizedId)
    })

    return {
      ...extras,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      viewport,
      subgraphs: sanitizedSubgraphs,
    }
  }

  function normalizeWorkflowDefinition(definition: unknown): PersistedWorkflowDefinition {
    const sanitizedDefinition = sanitizeWorkflowDefinition(definition || {})
    const flattenedDefinition = sanitizeFlattenedWorkflowDefinition(
      flattenWorkflowDefinition(sanitizedDefinition, ROOT_GRAPH_ID),
    )
    const baseNodes = flattenedDefinition.nodes
    const baseEdges = flattenedDefinition.edges
    const viewport = flattenedDefinition.viewport
    const rawSubgraphs = normalizePersistedSubgraphs(flattenedDefinition?.subgraphs)
    const extras: Record<string, unknown> = { ...flattenedDefinition }
    delete extras.nodes
    delete extras.edges
    delete extras.viewport
    delete extras.subgraphs
    delete extras.shared
    const stringCounts = buildSharedStringCounts(baseNodes)
    const requestCounts = buildSharedRequestCounts(baseNodes)
    const strings: string[] = []
    const stringIndexMap = new Map<string, number>()
    const requests: Record<string, unknown>[] = []
    const requestIndexMap = new Map<string, number>()

    const getStringRef = (value: unknown): number | null => {
      const normalized = typeof value === 'string' ? value.trim() : ''
      if (!normalized || (stringCounts.get(normalized) || 0) < 2) return null
      if (!stringIndexMap.has(normalized)) {
        stringIndexMap.set(normalized, strings.length)
        strings.push(normalized)
      }
      return stringIndexMap.get(normalized) ?? null
    }

    const getRequestRef = (request: unknown): number | null => {
      if (!isPlainObject(request)) return null
      const key = JSON.stringify(request)
      if (!key || (requestCounts.get(key) || 0) < 2) return null
      if (!requestIndexMap.has(key)) {
        requestIndexMap.set(key, requests.length)
        requests.push(cloneSerializable(request))
      }
      return requestIndexMap.get(key) ?? null
    }

    const normalizedNodes: FlowNode[] = baseNodes.map((node) => {
      const nextNode: FlowNode = {
        ...node,
        data: { ...(node?.data || {}) },
      }
      const data = nextNode.data

      const urlRef = getStringRef(data.url)
      if (urlRef != null) {
        delete data.url
        data.urlRef = urlRef
      }

      const thumbRef = getStringRef(data.thumb)
      if (thumbRef != null) {
        delete data.thumb
        data.thumbRef = thumbRef
      }

      const requestRef = getRequestRef(data.request)
      if (requestRef != null) {
        delete data.request
        data.requestRef = requestRef
      }

      return nextNode
    })

    const normalized: PersistedWorkflowDefinition = {
      ...extras,
      nodes: normalizedNodes,
      edges: baseEdges,
      viewport,
    }

    if (Object.keys(rawSubgraphs).length) {
      normalized.subgraphs = cloneSerializable(
        serializePersistedSubgraphs(rawSubgraphs),
      )
    }

    if (strings.length || requests.length) {
      normalized.shared = {}
      if (strings.length) normalized.shared.strings = strings
      if (requests.length) normalized.shared.requests = requests
    }

    return normalized
  }

  function reparentOrphanedSubgraphs(subgraphs: Record<string, WorkflowSubgraph>): void {
    const definedIds = new Set(Object.keys(subgraphs))
    Object.values(subgraphs).forEach((graph) => {
      const parentId = String(graph?.parentGraphId || ROOT_GRAPH_ID).trim() || ROOT_GRAPH_ID
      if (parentId !== ROOT_GRAPH_ID && !definedIds.has(parentId)) {
        graph.parentGraphId = ROOT_GRAPH_ID
      }
    })
  }

  function hydrateSharedNodes(nodeList: FlowNode[], shared: unknown): FlowNode[] {
    const sharedRecord = isPlainObject(shared) ? shared : {}
    const strings = Array.isArray(sharedRecord.strings) ? sharedRecord.strings : []
    const requests = Array.isArray(sharedRecord.requests) ? sharedRecord.requests : []
    return nodeList.map((node) => {
      const data = { ...(node.data || {}) }
      const urlRef = toArrayIndex(data.urlRef)
      const thumbRef = toArrayIndex(data.thumbRef)
      const requestRef = toArrayIndex(data.requestRef)
      if (urlRef !== null && typeof strings[urlRef] === 'string') data.url = strings[urlRef]
      if (thumbRef !== null && typeof strings[thumbRef] === 'string') data.thumb = strings[thumbRef]
      if (requestRef !== null && requests[requestRef] !== undefined) {
        data.request = cloneSerializable(requests[requestRef])
      }
      delete data.urlRef
      delete data.thumbRef
      delete data.requestRef
      return { ...node, data }
    })
  }

  function hydrateWorkflowDefinition(definition: unknown): WorkflowDefinition {
    if (isFlattenedWorkflowDefinition(definition)) {
      const persisted = sanitizeFlattenedWorkflowDefinition(definition)
      const hydratedNodes = hydrateSharedNodes(persisted.nodes, persisted.shared)
      const runtimeRecord = hydrateFlattenedWorkflowDefinition(
        { ...persisted, nodes: hydratedNodes, shared: undefined },
        ROOT_GRAPH_ID,
      )
      const runtimeDefinition = sanitizeWorkflowDefinition(runtimeRecord)
      reparentOrphanedSubgraphs(runtimeDefinition.subgraphs)
      return runtimeDefinition
    }

    const source = isPlainObject(definition) ? definition : {}
    const runtimeDefinition = sanitizeWorkflowDefinition(source)
    runtimeDefinition.nodes = hydrateSharedNodes(runtimeDefinition.nodes, source.shared)
    const rawSubgraphs = isPlainObject(source.subgraphs) ? source.subgraphs : {}
    const hydratedSubgraphs = Object.fromEntries(
      Object.entries(rawSubgraphs).map(([graphId, graphDef]) => [
        graphId,
        hydrateWorkflowDefinition(graphDef),
      ]),
    )
    runtimeDefinition.subgraphs = hydratedSubgraphs
    reparentOrphanedSubgraphs(runtimeDefinition.subgraphs)
    return runtimeDefinition
  }

  // ==================== 草稿 ====================

  async function saveDraft() {
    if (isWorkflowSwitching.value) return
    try {
      const currentTab = deps.getActiveTab()
      if (currentTab) {
        deps.syncCurrentGraphToActiveTab()
      }
      const baseDefinition = currentTab
        ? deps.buildTabDefinition(currentTab)
        : {
            nodes: serializeNodes(getActiveCanvasNodesSnapshot()),
            edges: serializeEdges(getActiveCanvasEdgesSnapshot(), getActiveCanvasNodesSnapshot()),
            viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 },
            subgraphs: {},
          }
      const draft = normalizeWorkflowDefinition({
        ...baseDefinition,
        activeGraphId: deps.activeGraphId?.value || ROOT_GRAPH_ID,
        activeWorkflowId: activeWorkflowId.value,
        activeWorkflowName: activeWorkflowName.value,
        timestamp: Date.now()
      })
      await idbSet(DRAFT_STORAGE_KEY, draft)
    } catch (e) {
      console.error('保存草稿失败:', e)
    }
  }

  async function loadDraft() {
    try {
      const raw = await idbGet(DRAFT_STORAGE_KEY)
      if (!raw) return false
      const draft = hydrateWorkflowDefinition(raw)
      const draftName = normalizeFlowFileName(draft.activeWorkflowName)
      const hasDraftContent = Array.isArray(draft.nodes) && draft.nodes.length > 0
        || Array.isArray(draft.edges) && draft.edges.length > 0
        || isPlainObject(draft.subgraphs) && Object.keys(draft.subgraphs).length > 0
      if (!hasFlowFileName(draftName) && !draft.activeWorkflowId && !hasDraftContent) {
        await clearDraft()
        return false
      }
      const graphId = draft.activeGraphId || ROOT_GRAPH_ID
      const draftTab = {
        id: 'draft',
        name: draftName,
        workflowId: draft.activeWorkflowId || null,
        isDraft: true,
        activeGraphId: graphId,
        nodes: draft.nodes || [],
        edges: draft.edges || [],
        viewport: draft.viewport || { zoom: 1, x: 0, y: 0 },
        subgraphs: draft.subgraphs || {},
      }
      deps.migrateSubgraphCards(draftTab)
      workflowTabs.value = [draftTab]
      activeTabId.value = draftTab.id
      deps.openGraphInTab(draftTab, graphId)
      activeWorkflowId.value = draft.activeWorkflowId || ''
      activeWorkflowName.value = draftName
      return true
    } catch (e) {
      console.error('加载草稿失败:', e)
    }
    return false
  }

  async function clearDraft() {
    await idbRemove(DRAFT_STORAGE_KEY)
  }

  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSaveDraft() {
    if (!initialized.value || isWorkflowSwitching.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      saveDraft()
      deps.saveTabs()
    }, 800)
  }

  function handleCanvasDraftSave() {
    if (isWorkflowSwitching.value) return
    deps.recordTabHistory()
    debouncedSaveDraft()
  }

  // ==================== 保存 ====================

  const showDuplicateModal = ref(false)
  const duplicateWorkflowName = ref('')
  const pendingSaveData = ref<PendingWorkflowSave | null>(null)

  async function onSave(options: { allowCreate?: boolean } = {}): Promise<boolean> {
    const name = getValidWorkflowName(activeWorkflowName.value)
    if (!name) return false
    const currentTab = deps.getActiveTab()
    if (currentTab) {
      deps.syncCurrentGraphToActiveTab()
    }
    const definition = currentTab
      ? deps.buildTabDefinition(currentTab)
      : {
          nodes: serializeNodes(getActiveCanvasNodesSnapshot()),
          edges: serializeEdges(getActiveCanvasEdgesSnapshot(), getActiveCanvasNodesSnapshot()),
          viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 },
          subgraphs: {},
        }
    const normalizedDefinition = normalizeWorkflowDefinition(definition)
    const activeCanvasNodes = getActiveCanvasNodesSnapshot()
    console.log('[workflow-save] payload-node-count', {
      storeNodes: nodes.value.length,
      canvasNodes: activeCanvasNodes.length,
      payloadNodes: normalizedDefinition.nodes?.length || 0,
    })

    if (activeWorkflowId.value) {
      try {
        const savedWorkflow = await updateWorkflow(activeWorkflowId.value, { name, definition: normalizedDefinition })
        const savedWorkflowId = String(savedWorkflow?.id || activeWorkflowId.value || '').trim()
        if (savedWorkflowId) {
          activeWorkflowId.value = savedWorkflowId
        }
        const currentTab = workflowTabs.value.find(t => t.id === activeTabId.value)
        if (currentTab) {
          currentTab.workflowId = savedWorkflowId || currentTab.workflowId
          currentTab.name = name
          currentTab.nodes = definition.nodes
          currentTab.edges = definition.edges
          currentTab.viewport = definition.viewport
          currentTab.subgraphs = cloneSerializable(definition.subgraphs || {})
          currentTab.savedNodes = definition.nodes
          currentTab.savedEdges = definition.edges
          currentTab.savedSubgraphs = cloneSerializable(definition.subgraphs || {})
        }
        await refreshWorkflows()
        await deps.saveTabs()
        await clearDraft()
      } catch (error) {
        const detail = extractRequestErrorMessage(error, '保存工作流失败')
        if (detail.includes('404') || detail.includes('不存在')) {
          if (options.allowCreate === false) {
            console.error('保存当前工作流失败:', error)
            alert('保存失败:\n' + detail)
            return false
          }
          activeWorkflowId.value = ''
        } else {
          console.error('保存工作流失败:', error)
          alert('保存失败:\n' + detail)
          return false
        }
      }
      if (activeWorkflowId.value) return true
    }

    if (options.allowCreate === false) return false

    const existingWorkflow = workflows.value.find(wf => wf.name === name)
    if (existingWorkflow) {
      duplicateWorkflowName.value = name
      pendingSaveData.value = { name, definition, normalizedDefinition, existingId: existingWorkflow.id }
      showDuplicateModal.value = true
      return false
    }

    return await doCreateWorkflow(name, normalizedDefinition, definition)
  }

  const workflows = ref<WorkflowRecord[]>([])

  async function doCreateWorkflow(
    name: string,
    definition: PersistedWorkflowDefinition,
    runtimeDefinition: WorkflowDefinition,
  ): Promise<boolean> {
    try {
      const wf = await createWorkflow({ name, definition })
      activeWorkflowId.value = wf.id
      activeWorkflowName.value = wf.name
      const currentTab = workflowTabs.value.find(t => t.id === activeTabId.value)
      if (currentTab) {
        currentTab.workflowId = wf.id
        currentTab.name = wf.name
        currentTab.isDraft = false
        currentTab.nodes = runtimeDefinition.nodes
        currentTab.edges = runtimeDefinition.edges
        currentTab.viewport = runtimeDefinition.viewport
        currentTab.subgraphs = cloneSerializable(runtimeDefinition.subgraphs || {})
        currentTab.savedNodes = runtimeDefinition.nodes
        currentTab.savedEdges = runtimeDefinition.edges
        currentTab.savedSubgraphs = cloneSerializable(runtimeDefinition.subgraphs || {})
      }
      await refreshWorkflows()
      await deps.saveTabs()
      await clearDraft()
      return true
    } catch (error) {
      console.error('保存工作流失败:', error)
      alert('保存失败: ' + extractRequestErrorMessage(error, '保存工作流失败'))
      return false
    }
  }

  async function saveWithSuffix() {
    showDuplicateModal.value = false
    if (!pendingSaveData.value) return
    const { name, definition, normalizedDefinition } = pendingSaveData.value

    let newName = name
    let suffix = 2
    while (workflows.value.some(wf => wf.name === newName)) {
      newName = `${name} (${suffix})`
      suffix++
    }

    const ok = await doCreateWorkflow(newName, normalizedDefinition, definition)
    if (ok) {
      activeWorkflowName.value = newName
    }
    pendingSaveData.value = null
  }

  async function saveWithOverwrite() {
    showDuplicateModal.value = false
    if (!pendingSaveData.value) return false
    const { name, definition, normalizedDefinition, existingId } = pendingSaveData.value

    try {
      await updateWorkflow(existingId, { name, definition: normalizedDefinition || definition })
      activeWorkflowId.value = existingId
      activeWorkflowName.value = name
      const currentTab = workflowTabs.value.find(t => t.id === activeTabId.value)
      if (currentTab) {
        currentTab.workflowId = existingId
        currentTab.name = name
        currentTab.isDraft = false
        currentTab.nodes = definition.nodes
        currentTab.edges = definition.edges
        currentTab.viewport = definition.viewport
        currentTab.subgraphs = cloneSerializable(definition.subgraphs || {})
        currentTab.savedNodes = definition.nodes
        currentTab.savedEdges = definition.edges
        currentTab.savedSubgraphs = cloneSerializable(definition.subgraphs || {})
      }
      workflowTabs.value = workflowTabs.value.filter((tab) => tab.id === activeTabId.value || tab.workflowId !== existingId)
      await refreshWorkflows()
      await deps.saveTabs()
      await clearDraft()
      pendingSaveData.value = null
      return true
    } catch (error) {
      console.error('保存工作流失败:', error)
      alert('保存失败: ' + extractRequestErrorMessage(error, '保存工作流失败'))
      pendingSaveData.value = null
      return false
    }
  }

  // ==================== 加载 ====================

  function onNewWorkflow() {
    activeWorkflowId.value = ''
    activeWorkflowName.value = ''
    deps.activeGraphId.value = ROOT_GRAPH_ID
    workflowTabs.value = []
    activeTabId.value = ''
    nodes.value = []
    edges.value = []
    selectedNode.value = null
  }

  const { loadWorkflowById } = useSingleWorkflowLoader({
    activeGraphId: deps.activeGraphId,
    getGraphViewport: (graph) => graph
      ? deps.getGraphViewport(graph)
      : { zoom: 1, x: 0, y: 0 },
    getHasUnsavedChanges: (tab) => !!tab && !!deps.hasUnsavedChanges?.(tab),
    getTabGraph: (tab, graphId) => deps.getTabGraph(tab, graphId),
    hydrateWorkflowDefinition,
    loadDefinition,
    migrateSubgraphCards: (tab) => deps.migrateSubgraphCards?.(tab),
    normalizeOpenWorkflowTabs: () => deps.normalizeOpenWorkflowTabs?.(),
    onSave,
    onUpdateShowWorkflowsPanel: (value) => deps.onUpdateShowWorkflowsPanel?.(value),
    renderedGraphId: deps.renderedGraphId,
    restoreNodesFromAigcRecordIds: () => deps.restoreNodesFromAigcRecordIds?.(),
    saveTabs: () => deps.saveTabs(),
  })

  async function onLoad(
    id: string,
    loadOptions: { forceReload?: boolean } = {},
  ): Promise<boolean> {
    if (!id) {
      onNewWorkflow()
      return false
    }
    return loadWorkflowById(id, loadOptions)
  }

  async function onDeleteWorkflow(id: string): Promise<void> {
    if (!confirm('确定删除该工作流？')) return
    if (shouldHideWorkflow({ id })) return
    try {
      await deleteWorkflow(id)
      if (activeWorkflowId.value === id) onNewWorkflow()
      await refreshWorkflows()
    } catch (e) {
      console.error('删除失败:', e)
      ElMessage.error('删除工作流失败')
    }
  }

  async function loadDefinition(
    def: unknown,
    loadOptions: FlowDefinitionLoadOptions = {},
  ): Promise<void> {
    if (loadAbortController) loadAbortController.abort()
    const hydratedDefinition = loadOptions.normalized && isPlainObject(def)
      ? def as unknown as WorkflowDefinition
      : hydrateWorkflowDefinition(def || {})
    const hydratedSubgraphs = isPlainObject(hydratedDefinition.subgraphs) ? hydratedDefinition.subgraphs : {}
    const rootNodes = Array.isArray(hydratedDefinition.nodes) ? hydratedDefinition.nodes : []
    const renderNodes = Object.keys(hydratedSubgraphs).length
      ? [
          ...injectSubgraphCards(hydratedSubgraphs, ROOT_GRAPH_ID),
          ...stripSubgraphCards(rootNodes),
        ]
      : rootNodes
    const activeTab = workflowTabs.value.find(tab => tab.id === activeTabId.value)
    if (activeTab && Object.keys(hydratedSubgraphs).length) {
      activeTab.nodes = stripSubgraphCards(rootNodes)
      activeTab.edges = hydratedDefinition.edges || []
      activeTab.subgraphs = cloneSerializable(hydratedSubgraphs)
      activeTab.viewport = hydratedDefinition.viewport || activeTab.viewport || { zoom: 1, x: 0, y: 0 }
    }

    const sortedNodes = [...renderNodes].sort((a, b) => {
      const aIsGroup = a.type === 'groupNode' ? 0 : 1
      const bIsGroup = b.type === 'groupNode' ? 0 : 1
      return aIsGroup - bIsGroup
    })
    const controller = new AbortController()
    const showProgress = sortedNodes.length > 80
    setLoadAbortController(controller)
    isLoadingWorkflow.value = showProgress
    loadProgress.value = 0
    loadProgressText.value = showProgress ? `准备加载 ${sortedNodes.length} 个节点...` : ''
    nodes.value = []
    edges.value = []
    try {
      const prepared = await prepareFlowRuntime({
        nodes: sortedNodes,
        edges: hydratedDefinition.edges || [],
        nodeTypes: nodeTypes.value,
        edgeStyle: edgeStyle.value,
        signal: controller.signal,
        onProgress: showProgress
          ? (loaded, total) => {
              loadProgress.value = Math.round((loaded / Math.max(total, 1)) * 100)
              loadProgressText.value = `已处理 ${loaded} / ${total} 个节点`
            }
          : undefined,
      })
      if (!prepared || controller.signal.aborted) return
      nodes.value = prepared.nodes
      edges.value = prepared.edges
      selectedNode.value = null
      await restoreAndSettleFlowRuntime(deps.restoreNodesFromAigcRecordIds, prepared.nodes.length > 0, showProgress, controller.signal)
      loadProgress.value = 100
      loadProgressText.value = showProgress ? '加载完成' : ''
    } finally {
      if (loadAbortController === controller) {
        setLoadAbortController(null)
        if (!isWorkflowSwitching.value) {
          isLoadingWorkflow.value = false
          loadProgress.value = 0
          loadProgressText.value = ''
        }
      }
    }
  }

  function cancelLoadWorkflow() {
    if (loadAbortController) {
      loadAbortController.abort()
      setLoadAbortController(null)
    }
    isLoadingWorkflow.value = false
    loadProgress.value = 0
    loadProgressText.value = ''
    nodes.value = []
    edges.value = []
    selectedNode.value = null
    refreshWorkflows()
    showWorkflowPicker.value = true
  }

  async function refreshWorkflows() {
    try {
      workflows.value = (await listWorkflows()).filter((workflow) => !shouldHideWorkflow(workflow))
    } catch { /* ignore */ }
  }

  async function pickWorkflow(id: string): Promise<void> {
    showWorkflowPicker.value = false
    await onLoad(id)
  }

  function onCloseWorkflowPicker() {
    showWorkflowPicker.value = false
  }

  async function onPickWorkflow(id: string): Promise<void> {
    await pickWorkflow(id)
  }

  // ==================== 导出/导入 ====================

  function buildExportDefinition(tabId: string): Record<string, unknown> {
    const targetTab = workflowTabs.value.find(t => t.id === tabId) || workflowTabs.value.find(t => t.id === activeTabId.value)
    const isActiveTab = !!targetTab && targetTab.id === activeTabId.value
    if (isActiveTab && targetTab) {
      deps.syncCurrentGraphToActiveTab()
    }
    const targetDefinition = targetTab ? deps.buildTabDefinition(targetTab) : {
      nodes: serializeNodes(getActiveCanvasNodesSnapshot()),
      edges: serializeEdges(getActiveCanvasEdgesSnapshot(), getActiveCanvasNodesSnapshot()),
      viewport: canvasRef.value?.getViewport?.() || { zoom: 1, x: 0, y: 0 },
      subgraphs: {},
    }
    const sanitizedDefinition = normalizeWorkflowDefinition(targetDefinition)
    const exportName = isActiveTab ? activeWorkflowName.value : (targetTab?.name || activeWorkflowName.value)
    const exportWorkflowId = isActiveTab ? (activeWorkflowId.value || null) : (targetTab?.workflowId || null)
    return {
      version: '1.0',
      nodes: sanitizedDefinition.nodes || [],
      edges: sanitizedDefinition.edges || [],
      viewport: sanitizedDefinition.viewport || { zoom: 1, x: 0, y: 0 },
      ...(Object.keys(sanitizedDefinition.subgraphs || {}).length ? { subgraphs: sanitizedDefinition.subgraphs } : {}),
      ...(sanitizedDefinition.shared ? { shared: sanitizedDefinition.shared } : {}),
      name: exportName,
      workflowId: exportWorkflowId,
      exportedAt: new Date().toISOString(),
      lastNodeId: Math.max(0, ...(sanitizedDefinition.nodes || []).map(n => parseInt(String(n.id || '').replace(/\D/g, '')) || 0)),
    }
  }

  async function exportJSON(
    tabId = activeTabId.value,
    options: { skipUnsavedPrompt?: boolean } = {},
  ): Promise<void> {
    const targetTab = workflowTabs.value.find(t => t.id === tabId) || workflowTabs.value.find(t => t.id === activeTabId.value)
    if (!targetTab) return

    if (deps.hasUnsavedChanges(targetTab) && !options?.skipUnsavedPrompt) {
      deps.requestExportSave?.(targetTab.id)
      return
    }

    const definition = buildExportDefinition(targetTab.id)
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', url)
    downloadAnchorNode.setAttribute('download', `${definition.name || 'workflow'}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
    URL.revokeObjectURL(url)
  }

  const { importInputRef, importJSON, triggerImport } = useFlowJsonImport({
    activeWorkflowId,
    loadDefinition,
    saveDraft,
    saveWorkflow: () => onSave({ allowCreate: false }),
  })

  return {
    // 序列化
    serializeNodes,
    serializeEdges,
    buildSharedStringCounts,
    buildSharedRequestCounts,
    sanitizeWorkflowDefinition,
    normalizeWorkflowDefinition,
    hydrateWorkflowDefinition,

    // 草稿
    saveDraft,
    loadDraft,
    clearDraft,
    debouncedSaveDraft,
    handleCanvasDraftSave,

    // 保存相关
    showDuplicateModal,
    duplicateWorkflowName,
    pendingSaveData,
    onSave,
    doCreateWorkflow,
    saveWithSuffix,
    saveWithOverwrite,
    onNewWorkflow,
    onLoad,
    onDeleteWorkflow,
    loadDefinition,
    cancelLoadWorkflow,
    workflows,
    refreshWorkflows,
    pickWorkflow,
    onCloseWorkflowPicker,
    onPickWorkflow,

    // 导出/导入
    importInputRef,
    buildExportDefinition,
    exportJSON,
    triggerImport,
    importJSON,
  }
}
