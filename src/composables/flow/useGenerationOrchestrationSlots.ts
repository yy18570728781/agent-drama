import { nextTick } from 'vue'
import { createGenerationSlotCardManager } from './generationSlotCardManager'

export function useGenerationOrchestrationSlots(deps: any, helpers: any) {
  const { attachTaskIdToGenerationState, getGenerationCardHorizontalGap } = helpers

  function buildGenerationSlotStatus(sourceNode: any) {
    // 槽位初始默认"等待提交"——队列并发外的任务不该被画成"生成中"。
    // 真正进入 running 由 progress 事件驱动；created 会先翻成 queued。
    // 之前默认 running 会导致 6 任务并发 2 时，4 个还在排队的槽也显示"生成中 0%"。
    void sourceNode
    return {
      status: 'waiting_submit',
      isGenerating: true,
      progress: 0,
      statusText: '等待提交...',
    }
  }

  function readNodeWidth(node: any, fallback = 320): number {
    const rawWidth = node?.dimensions?.width || node?.style?.width || fallback
    const width = typeof rawWidth === 'number' ? rawWidth : Number.parseFloat(String(rawWidth))
    return Number.isFinite(width) && width > 0 ? width : fallback
  }

  function getResultSlotStep(sourceNode: any): number {
    const resultStyle = deps.fixedSizeTypes?.aigc_result || {}
    const sourceWidth = readNodeWidth(sourceNode)
    const resultWidth = readNodeWidth({ style: resultStyle })
    const nodeGap = Math.max(64, getGenerationCardHorizontalGap(sourceNode) || 0)
    return Math.max(sourceWidth, resultWidth) + nodeGap
  }

  const slotCardManager = createGenerationSlotCardManager(deps, {
    buildGenerationSlotStatus,
    getResultSlotStep,
  })

  function createGeneratingResultPlaceholders(
    nodeId: string,
    totalExpectedItems: number,
    hadResultsBefore: boolean,
    removeSourceNode = false,
    sourceNodeIds: string[] = [],
    pbrChannels: string[] = [],
  ) {
    slotCardManager.ensureResultPlaceholders({
      nodeId,
      totalExpectedItems,
      hadResultsBefore,
      removeSourceNode,
      sourceNodeIds,
      pbrChannels,
    })
  }

  function getGenerationSlotNodes(nodeId: string) {
    const sourceNode = deps.nodes.value.find((node: any) => node.id === nodeId)
    const sourceAsSlot = sourceNode?.data?._sourceGenerationSlotForNodeId === nodeId
    const placeholderNodes = deps.nodes.value
      .filter((node: any) => node.data?._resultPlaceholderForNodeId === nodeId)
      .sort((a: any, b: any) => (a.position?.x || 0) - (b.position?.x || 0))
    return [sourceAsSlot ? sourceNode : null, ...placeholderNodes].filter(Boolean)
  }

  function canUseSourceNodeAsGenerationSlot(nodeId: string, taskId: string) {
    const sourceNode = deps.nodes.value.find((node: any) => node.id === nodeId)
    if (!sourceNode) return false
    const data = sourceNode.data || {}
    if (data._activeTaskId && data._activeTaskId !== String(taskId || '')) return false
    if (data._hadResultsBefore === true) return false
    return !deps.nodeHasResolvedResult(data)
  }

  function registerSourceNodeAsGenerationSlot(nodeId: string, taskId: string, recordId: string) {
    if (!taskId) return ''
    const sourceIdx = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
    if (sourceIdx < 0) return ''
    const sourceNode = deps.nodes.value[sourceIdx]
    const sourceData = sourceNode.data || {}
    deps.nodes.value[sourceIdx] = {
      ...sourceNode,
      data: attachTaskIdToGenerationState({
        ...sourceData,
        ...buildRecordIdData(recordId),
        status: 'queued',
        isGenerating: true,
        progress: 0,
        statusText: '排队中...',
        failReason: undefined,
        fail_reason: undefined,
        taskId,
        _activeTaskId: taskId,
        _resultPlaceholderForNodeId: undefined,
        _generatingForExistingResult: undefined,
      }, taskId),
    }
    return nodeId
  }

  function buildGlobalSlotPosition(sourceNode: any, slotIndex: number) {
    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    return { x: baseX + getResultSlotStep(sourceNode) * slotIndex, y: baseY }
  }

  function buildRecordIdData(recordId: string): { recordId: string; aigc_record_id?: string } {
    const normalizedRecordId = String(recordId || '').trim()
    return normalizedRecordId
      ? { recordId: normalizedRecordId, aigc_record_id: normalizedRecordId }
      : { recordId: '' }
  }

  function createGenerationSlotForTask(nodeId: string, taskId: string, recordId: string) {
    const sourceNode = deps.nodes.value.find((node: any) => node.id === nodeId)
    if (!sourceNode || !taskId) return ''

    const placeholderCount = deps.nodes.value.filter((node: any) => node.data?._resultPlaceholderForNodeId === nodeId).length
    const slotId = deps.createRuntimeId('pending')
    const slotIndex = placeholderCount + 1
    const slotPosition = buildGlobalSlotPosition(sourceNode, slotIndex)
    const resultMediaType = deps.inferNodeOutputMediaType(sourceNode.type, sourceNode.data)
    const slotData = {
      ...sourceNode.data,
      mediaType: resultMediaType,
      ports: deps.buildPortsForNode('aigc_result', resultMediaType),
      label: sourceNode.data?.label || '生成结果',
      status: 'queued',
      isGenerating: true,
      progress: 0,
      statusText: '排队中...',
      preview: null,
      url: null,
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
      content: '',
      ...buildRecordIdData(recordId),
      nodeKind: 'aigc_result',
      taskId,
      _activeTaskId: taskId,
      _resultPlaceholderForNodeId: nodeId,
      _generatingForExistingResult: false,
      _requestIndex: slotIndex - 1,
      _managedGenerationSlot: true,
      _slotPosition: slotPosition,
    }

    const newNode: any = {
      id: slotId,
      type: 'aigc_result',
      position: slotPosition,
      data: attachTaskIdToGenerationState(slotData, taskId),
      ...(deps.fixedSizeTypes.aigc_result ? { style: deps.fixedSizeTypes.aigc_result } : {}),
    }

    deps.nodes.value = [...deps.nodes.value, newNode]
    deps.emit('update:modelNodes', deps.nodes.value)

    const upstreamEdges = deps.nodeSupportsFileUrls(sourceNode.data)
      ? deps.edges.value.filter((edge: any) => edge.target === nodeId)
      : []
    if (upstreamEdges.length) {
      deps.edges.value = [
        ...deps.edges.value,
        ...upstreamEdges.map((edge: any) => deps.cloneIncomingEdgeToTarget(edge, newNode)).filter(Boolean),
      ]
      deps.emit('update:modelEdges', deps.edges.value)
    }
    nextTick(() => {
      deps.updateNodeInternals([nodeId, slotId])
      deps.syncNodeEdgeHandles(nodeId)
      deps.syncNodeEdgeHandles(slotId)
    })
    return slotId
  }

  function shouldCreateSeparateResultCardPerTask(nodeId: string) {
    for (const [sourceId, session] of deps._activeGenerationSessionBySource.entries()) {
      if (sourceId === nodeId || session?.targetNodeId === nodeId) {
        return Number(session?.totalExpectedItems || 1) > 1
      }
    }
    return false
  }

  function assignTaskToGenerationSlot(nodeId: string, taskId: string, recordId: string) {
    if (!taskId) return ''
    const slotNodes = getGenerationSlotNodes(nodeId)
    const slot = slotNodes.find((node: any) => {
      const data = node.data || {}
      const isSourceSlot = data._sourceGenerationSlotForNodeId === nodeId
      const isManagedPlaceholder = !!data._resultPlaceholderForNodeId
      if (!isSourceSlot && !isManagedPlaceholder) return false
      if (data._activeTaskId || data.taskId) return false
      if (deps.nodeHasResolvedResult(data)) return false
      return true
    })
    if (!slot) return createGenerationSlotForTask(nodeId, taskId, recordId)
    const slotIdx = deps.nodes.value.findIndex((node: any) => node.id === slot.id)
    if (slotIdx < 0) return ''
    deps.nodes.value[slotIdx] = {
      ...deps.nodes.value[slotIdx],
      data: attachTaskIdToGenerationState({
        ...deps.nodes.value[slotIdx].data,
        status: 'queued',
        isGenerating: true,
        progress: 0,
        statusText: '排队中...',
        ...buildRecordIdData(recordId),
        taskId,
        _activeTaskId: taskId,
      }, taskId),
    }
    return slot.id
  }

  function assignTaskToIndexedGenerationSlot(nodeId: string, taskId: string, recordId: string, requestIndex: number) {
    if (!taskId || !Number.isFinite(requestIndex) || requestIndex < 0) return ''
    const slotNodes = getGenerationSlotNodes(nodeId)
    const slot = slotNodes.find((node: any) => Number(node?.data?._requestIndex) === requestIndex)
    if (!slot) return ''
    const slotIdx = deps.nodes.value.findIndex((node: any) => node.id === slot.id)
    if (slotIdx < 0) return ''
    deps.nodes.value[slotIdx] = {
      ...deps.nodes.value[slotIdx],
      data: attachTaskIdToGenerationState({
        ...deps.nodes.value[slotIdx].data,
        status: 'queued',
        isGenerating: true,
        progress: 0,
        statusText: '排队中...',
        ...buildRecordIdData(recordId),
        taskId,
        _activeTaskId: taskId,
      }, taskId),
    }
    return slot.id
  }

  function findReusablePlaceholderSlot(nodeId: string) {
    return getGenerationSlotNodes(nodeId).find((node: any) => {
      const data = node?.data || {}
      const isSourceSlot = data._sourceGenerationSlotForNodeId === nodeId
      const isManagedPlaceholder = !!data._resultPlaceholderForNodeId
      if (!isSourceSlot && !isManagedPlaceholder) return false
      if (data._activeTaskId || data.taskId) return false
      if (deps.nodeHasResolvedResult(data)) return false
      return true
    }) || null
  }

  function getSlotReferenceNode(nodeId: string) {
    return deps.nodes.value.find((node: any) => node.id === nodeId)
      || getGenerationSlotNodes(nodeId)[0]
      || null
  }

  function buildAppendedSlotPosition(nodeId: string, refNode: any) {
    const slotNodes = getGenerationSlotNodes(nodeId)
    const lastSlot = slotNodes[slotNodes.length - 1] || refNode
    const baseX = lastSlot?.position?.x || refNode?.position?.x || 0
    const baseY = lastSlot?.position?.y || refNode?.position?.y || 0
    return { x: baseX + getResultSlotStep(refNode), y: baseY }
  }

  function clearGenerationTaskMarkers(data: any) {
    const nextData = {
      ...(data || {}),
      taskId: undefined,
      _activeTaskId: undefined,
    }
    if (nextData._genState) {
      const nextGenState = deps.cloneGenerationState(nextData._genState) || {}
      delete nextGenState.taskId
      delete nextGenState.task_id
      delete nextGenState._activeTaskId
      nextData._genState = Object.keys(nextGenState).length ? nextGenState : undefined
    }
    return nextData
  }

  return {
    createGeneratingResultPlaceholders,
    getGenerationSlotNodes,
    canUseSourceNodeAsGenerationSlot,
    registerSourceNodeAsGenerationSlot,
    createGenerationSlotForTask,
    shouldCreateSeparateResultCardPerTask,
    assignTaskToIndexedGenerationSlot,
    assignTaskToGenerationSlot,
    clearGenerationTaskMarkers,
  }
}
