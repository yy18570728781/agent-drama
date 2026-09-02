import { nextTick } from 'vue'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'
import type { WorkflowMediaType } from '@/utils/workflowNodeData'

interface SlotCardManagerDeps {
  nodes: { value: any[] }
  edges: { value: any[] }
  selectedPanelNode?: { value: any }
  panelVisible?: { value: boolean }
  emit: (event: string, payload: any) => void
  fixedSizeTypes: Record<string, any>
  createRuntimeId: (prefix: string) => string
  inferNodeOutputMediaType: (nodeType: string, data: any) => WorkflowMediaType
  buildPortsForNode: typeof buildPortsForNodeContract
  nodeSupportsFileUrls: (data: any) => boolean
  cloneIncomingEdgeToTarget: (edge: any, node: any) => any
  updateNodeInternals: (ids: string[]) => void
  syncNodeEdgeHandles: (nodeId: string) => void
}

interface SlotCardManagerHelpers {
  buildGenerationSlotStatus: (sourceNode: any) => Record<string, any>
  getResultSlotStep: (sourceNode: any) => number
}

interface EnsureSlotOptions {
  nodeId: string
  totalExpectedItems: number
  hadResultsBefore: boolean
  removeSourceNode?: boolean
  sourceNodeIds?: string[]
  pbrChannels?: string[]
}

export function createGenerationSlotCardManager(deps: SlotCardManagerDeps, helpers: SlotCardManagerHelpers) {
  function buildScopedUpstreamInputs(sourceData: any, sourceBatchNodeId: string) {
    const upstreamInputs = sourceData?._upstreamInputs
    if (!upstreamInputs || !sourceBatchNodeId) return sourceData?._upstreamInputs
    const pick = (items: any[] = []) => items.filter((item: any) => String(item?.nodeId || item?.sourceNodeId || '').trim() === sourceBatchNodeId)
    return {
      ...upstreamInputs,
      images: pick(Array.isArray(upstreamInputs.images) ? upstreamInputs.images : []),
      videos: pick(Array.isArray(upstreamInputs.videos) ? upstreamInputs.videos : []),
      audios: pick(Array.isArray(upstreamInputs.audios) ? upstreamInputs.audios : []),
    }
  }

  function getExistingSlots(nodeId: string): any[] {
    return deps.nodes.value
      .filter((node: any) => node.data?._resultPlaceholderForNodeId === nodeId)
      .sort((a: any, b: any) => Number(a.data?._requestIndex || 0) - Number(b.data?._requestIndex || 0))
  }

  function updateSourceAsSingleSlot(sourceIdx: number, sourceNode: any): void {
    const currentData = deps.nodes.value[sourceIdx].data || {}
    const mediaType = deps.inferNodeOutputMediaType(sourceNode.type, currentData)
    deps.nodes.value[sourceIdx] = {
      ...deps.nodes.value[sourceIdx],
      type: 'aigc_result',
      style: deps.fixedSizeTypes.aigc_result ? { ...deps.fixedSizeTypes.aigc_result } : deps.nodes.value[sourceIdx].style,
      data: {
        ...currentData,
        mediaType,
        ports: deps.buildPortsForNode('aigc_result', mediaType),
        label: '生成结果',
        ...helpers.buildGenerationSlotStatus(sourceNode),
        nodeKind: 'aigc_result',
        preview: null,
        url: null,
        imageUrl: null,
        videoUrl: null,
        audioUrl: null,
        content: '',
        recordId: '',
        failReason: undefined,
        fail_reason: undefined,
        statusText: undefined,
        _requestIndex: 0,
        _sourceGenerationSlotForNodeId: sourceNode.id,
      },
    }
  }

  function clearSourceSlotMarker(sourceIdx: number): void {
    const currentData = deps.nodes.value[sourceIdx]?.data || {}
    if (!currentData._sourceGenerationSlotForNodeId && currentData._requestIndex === undefined) return
    deps.nodes.value[sourceIdx] = {
      ...deps.nodes.value[sourceIdx],
      data: {
        ...currentData,
        _requestIndex: undefined,
        _sourceGenerationSlotForNodeId: undefined,
      },
    }
  }

  function buildPlaceholderNode(sourceNode: any, nodeId: string, requestIndex: number, positionIndex: number, hadResultsBefore: boolean, sourceNodeIds: string[] = [], pbrChannels: string[] = []) {
    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    const position = { x: baseX + helpers.getResultSlotStep(sourceNode) * positionIndex, y: baseY }
    const mediaType = deps.inferNodeOutputMediaType(sourceNode.type, sourceNode.data)
    const sourceBatchNodeId = typeof sourceNodeIds[requestIndex] === 'string' ? sourceNodeIds[requestIndex].trim() : ''
    const scopedUpstreamInputs = buildScopedUpstreamInputs(sourceNode.data, sourceBatchNodeId)
    return {
      id: deps.createRuntimeId('pending'),
      type: 'aigc_result',
      position,
      data: {
        ...sourceNode.data,
        mediaType,
        ports: deps.buildPortsForNode('aigc_result', mediaType),
        label: '生成结果',
        ...helpers.buildGenerationSlotStatus(sourceNode),
        preview: null,
        url: null,
        imageUrl: null,
        videoUrl: null,
        audioUrl: null,
        content: '',
        recordId: '',
        nodeKind: 'aigc_result',
        _resultPlaceholderForNodeId: nodeId,
        _generatingForExistingResult: hadResultsBefore,
        _requestIndex: requestIndex,
        _managedGenerationSlot: true,
        _slotPosition: position,
        _upstreamInputs: scopedUpstreamInputs,
        ...(sourceBatchNodeId ? { _sourceBatchNodeId: sourceBatchNodeId } : {}),
        ...(pbrChannels[requestIndex] ? { pbrChannel: pbrChannels[requestIndex] } : {}),
      },
      ...(deps.fixedSizeTypes.aigc_result ? { style: deps.fixedSizeTypes.aigc_result } : {}),
    }
  }

  function buildMissingSlots(sourceNode: any, options: EnsureSlotOptions, useSourceSlot: boolean): any[] {
    const expectedCount = Math.max(1, Number(options.totalExpectedItems) || 1)
    const existingIndexes = new Set(getExistingSlots(options.nodeId).map((node: any) => Number(node.data?._requestIndex)))
    const startIndex = useSourceSlot ? 1 : 0
    const missingSlots: any[] = []
    for (let requestIndex = startIndex; requestIndex < expectedCount; requestIndex += 1) {
      if (existingIndexes.has(requestIndex)) continue
      const positionIndex = useSourceSlot ? requestIndex : requestIndex
      missingSlots.push(buildPlaceholderNode(sourceNode, options.nodeId, requestIndex, positionIndex, options.hadResultsBefore, options.sourceNodeIds || [], options.pbrChannels || []))
    }
    return missingSlots
  }

  function removeSourceNode(nodeId: string, replacementNode?: any): void {
    const hasSourceNode = deps.nodes.value.some((node: any) => node.id === nodeId)
    if (!hasSourceNode) return
    if (deps.selectedPanelNode?.value?.id === nodeId) {
      if (replacementNode) {
        deps.selectedPanelNode.value = replacementNode
        if (deps.panelVisible) deps.panelVisible.value = true
      } else {
        deps.selectedPanelNode.value = null
        if (deps.panelVisible) deps.panelVisible.value = false
      }
    }
    deps.nodes.value = deps.nodes.value.filter((node: any) => node.id !== nodeId)
    deps.edges.value = deps.edges.value.filter((edge: any) => edge.source !== nodeId && edge.target !== nodeId)
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
  }

  function ensureResultPlaceholders(options: EnsureSlotOptions): void {
    const sourceNode = deps.nodes.value.find((node: any) => node.id === options.nodeId)
    if (!sourceNode) return
    const sourceIdx = deps.nodes.value.findIndex((node: any) => node.id === options.nodeId)
    const useSourceSlot = false
    const shouldRemoveSourceNode = options.removeSourceNode === true
    // 必须在 removeSourceNode 之前抓取上游边——否则再按 edge.target === nodeId
    // 过滤会得到空数组（边已经被 removeSourceNode 删了），新建的槽位就永远拿不到
    // 上游连线，表现就是"上游连线没有了"。
    const supportsFileUrls = deps.nodeSupportsFileUrls(sourceNode.data)
    const capturedUpstreamEdges = supportsFileUrls
      ? deps.edges.value.filter((edge: any) => edge.target === options.nodeId)
      : []
    if (sourceIdx >= 0) clearSourceSlotMarker(sourceIdx)
    const newNodes = buildMissingSlots(sourceNode, options, useSourceSlot)
    if (newNodes.length) deps.nodes.value = [...deps.nodes.value, ...newNodes]
    if (shouldRemoveSourceNode) removeSourceNode(options.nodeId, newNodes[0])
    deps.emit('update:modelNodes', deps.nodes.value)
    if (newNodes.length) {
      appendDebugFileLog('slot-route', 'placeholder-cards-created', {
        nodeId: options.nodeId,
        count: newNodes.length,
        slotIds: newNodes.map((node) => node.id),
      })
    }
    if (capturedUpstreamEdges.length && newNodes.length) {
      const newEdges = newNodes
        .flatMap((node) => {
          const mappedSourceNodeId = String(node?.data?._sourceBatchNodeId || '').trim()
          const candidateEdges = mappedSourceNodeId
            ? capturedUpstreamEdges.filter((edge: any) => String(edge?.source || '').trim() === mappedSourceNodeId)
            : capturedUpstreamEdges
          return candidateEdges.map((edge: any) => deps.cloneIncomingEdgeToTarget(edge, node)).filter(Boolean)
        })
      if (newEdges.length) {
        deps.edges.value = [...deps.edges.value, ...newEdges]
        deps.emit('update:modelEdges', deps.edges.value)
      }
    }
    nextTick(() => {
      deps.updateNodeInternals([options.nodeId, ...newNodes.map((node) => node.id)])
      deps.syncNodeEdgeHandles(options.nodeId)
      newNodes.forEach((node) => deps.syncNodeEdgeHandles(node.id))
    })
  }

  return {
    ensureResultPlaceholders,
  }
}
