import { nextTick } from 'vue'
import { useGenerationPipelineResultAssets } from './useGenerationPipelineResultAssets'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import { buildWorkflowMediaMeta, normalizeWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import type { GenerationPipelineDeps } from './useGenerationPipeline.types'

type PipelineNode = GenerationPipelineDeps['nodes']['value'][number]
type PipelineEdge = GenerationPipelineDeps['edges']['value'][number]

interface PipelineRecord {
  id?: string | number
  record_id?: string | number
  [key: string]: unknown
}

interface PipelineResultItem extends PipelineRecord {
  aigc_record_id?: string | number
}

interface PipelineResult {
  items?: PipelineResultItem[]
  url?: unknown
  output?: unknown
  recordId?: string | number
  record_id?: string | number
  aigc_record_id?: string | number
  data?: { aigc_record_id?: string | number }
}

export function useGenerationPipelineResultHandling(deps: GenerationPipelineDeps) {
  const { resolveCompletedResultAsset } = useGenerationPipelineResultAssets(deps)

  function resolveNodeStyle(nodeOrStyle: any) {
    if (!nodeOrStyle) return {}
    if (nodeOrStyle.style || nodeOrStyle.dimensions) return nodeOrStyle.style || {}
    return nodeOrStyle
  }

  function resolveNodeDimensions(nodeOrStyle: any) {
    if (nodeOrStyle?.style || nodeOrStyle?.dimensions) return nodeOrStyle.dimensions || {}
    return {}
  }

  function getDisplayedNodeSize(nodeOrStyle: any) {
    const style = resolveNodeStyle(nodeOrStyle)
    const dimensions = resolveNodeDimensions(nodeOrStyle)
    const styleWidth = Number.parseFloat(String(style?.width || ''))
    const styleHeight = Number.parseFloat(String(style?.height || ''))
    const width = styleWidth > 0 ? styleWidth : Number(dimensions?.width || 0)
    const height = styleHeight > 0 ? styleHeight : Number(dimensions?.height || 0)
    return width > 0 && height > 0 ? { width, height } : null
  }

  function shouldPreserveDisplayedSize(nodeOrStyle: any, mediaType: string, width: number, height: number, aspectRatio: number) {
    if (nodeOrStyle?.data?._manualSize) return true
    return false
  }

  function buildResultNodeStyle(nodeType: string, data: any, currentNodeOrStyle: any, preserveExistingSize = false) {
    const mediaType = String(data?.mediaType || '').trim()
    const mediaMeta = normalizeWorkflowMediaMeta(data)
    const width = Number(mediaMeta?.width || 0)
    const height = Number(mediaMeta?.height || 0)
    const aspectRatio = Number(mediaMeta?.aspectRatio || 0)
    if ((mediaType === 'image' || mediaType === 'video') && (width > 0 && height > 0 || aspectRatio > 0)) {
      const size = getFlowMediaNodeSize({ mediaType, width, height, aspectRatio })
      const displayedSize = shouldPreserveDisplayedSize(currentNodeOrStyle, mediaType, width, height, aspectRatio)
        ? getDisplayedNodeSize(currentNodeOrStyle)
        : null
      const baseStyle = resolveNodeStyle(currentNodeOrStyle)
      if (preserveExistingSize && displayedSize) {
        return { ...(baseStyle || {}), width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }
      }
      return { ...(baseStyle || {}), width: `${size.width}px`, height: `${size.height}px` }
    }
    return deps.fixedSizeTypes[nodeType] ? { ...deps.fixedSizeTypes[nodeType] } : resolveNodeStyle(currentNodeOrStyle)
  }

  function withResolvedMetrics(nodeData: any, resolved: any) {
    if (!(resolved?.width > 0) || !(resolved?.height > 0)) return nodeData
    const mediaMeta = buildWorkflowMediaMeta(resolved.width, resolved.height, resolved.aspectRatio)
    return {
      ...nodeData,
      ...(mediaMeta ? { mediaMeta } : {}),
    }
  }

  async function applyRecordToExistingResultNode(
    nodeId: string,
    record: PipelineRecord,
    fallbackRecordId = '',
  ): Promise<boolean> {
    const idx = deps.nodes.value.findIndex((item) => item.id === nodeId)
    if (idx < 0) return false

    const currentNode = deps.findNode(nodeId) || deps.nodes.value[idx]
    const recordId = String(record?.id || record?.record_id || fallbackRecordId || '').trim()
    const result = {
      items: [record],
      recordId,
    }
    const resolved = await resolveCompletedResultAsset(record, result, 0)
    const resultNodeData = withResolvedMetrics(deps.applyResolvedAssetToNodeData(
      deps.buildResultNodeData(currentNode.data || {}, record, result, 0),
      { ...resolved, recordId: resolved.recordId || recordId },
    ), resolved)

    deps.nodes.value[idx] = {
      ...deps.nodes.value[idx],
      type: 'aigc_result',
      style: buildResultNodeStyle('aigc_result', resultNodeData, currentNode, true),
      data: {
        ...deps.nodes.value[idx].data,
        ...resultNodeData,
        ...deps.clearGenerationTaskMarkers({}),
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        nodeKind: 'aigc_result',
        _resultPlaceholderForNodeId: undefined,
        _generatedFromNodeId: undefined,
        _generatingForExistingResult: undefined,
        failReason: undefined,
        fail_reason: undefined,
        statusText: undefined,
      },
    }

    deps.removeGeneratingPlaceholderNodes(nodeId)
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    nextTick(() => {
      deps.updateNodeInternals([nodeId])
      deps.syncNodeEdgeHandles(nodeId)
    })
    return true
  }

  function collectGeneratingNodes(nodeId: string, sourceIdx: number) {
    const placeholderNodes = deps.nodes.value
      .filter((node) => node.data?._resultPlaceholderForNodeId === nodeId)
      .sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0))
    return [deps.nodes.value[sourceIdx], ...placeholderNodes]
  }

  function resolveFallbackPosition(oldNode: any, index: number, baseX: number, baseY: number, step: number) {
    return oldNode
      ? { ...(oldNode.position || { x: baseX + step * index, y: baseY }) }
      : { x: baseX + step * index, y: baseY }
  }

  function replaceFirstItemInPlace(sourceIdx: number, nodeData: any, oldNode: any, position: any, nodeId: string) {
    const originalPorts = deps.nodes.value[sourceIdx]?.data?.ports
    const newPorts = deps.clearGenerationTaskMarkers(nodeData).ports
    const effectivePorts = originalPorts || newPorts
    deps.nodes.value[sourceIdx] = {
      ...deps.nodes.value[sourceIdx],
      type: 'aigc_result',
      position,
      style: buildResultNodeStyle('aigc_result', nodeData, oldNode?.style),
      data: deps.ensureResolvedResultTitle({
        ...deps.clearGenerationTaskMarkers(nodeData),
        ports: effectivePorts,
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        _resultPlaceholderForNodeId: deps.nodes.value[sourceIdx]?.data?._resultPlaceholderForNodeId || undefined,
        _multiResultForNodeId: undefined,
      }, deps.getNodeDataRecordId(nodeData)),
    }
    const newInputHandle = effectivePorts?.inputs?.[0]?.id
    const newOutputHandle = effectivePorts?.outputs?.[0]?.id
    if (newInputHandle || newOutputHandle) {
      deps.edges.value = deps.edges.value.map(edge => {
        if (edge.target === nodeId && newInputHandle && edge.targetHandle !== newInputHandle) {
          return { ...edge, targetHandle: newInputHandle }
        }
        if (edge.source === nodeId && newOutputHandle && edge.sourceHandle !== newOutputHandle) {
          return { ...edge, sourceHandle: newOutputHandle }
        }
        return edge
      })
    }
  }

  function buildExtraResultNode(nodeData: any, oldNode: any, position: any, nodeId: string) {
    const newNodeId = deps.createRuntimeId('node')
    const node: any = {
      id: newNodeId,
      type: 'aigc_result',
      position,
      data: deps.ensureResolvedResultTitle({
        ...deps.clearGenerationTaskMarkers(nodeData),
        _resultPlaceholderForNodeId: oldNode?.data?._resultPlaceholderForNodeId || nodeId,
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        _multiResultForNodeId: nodeId,
      }, deps.getNodeDataRecordId(nodeData)),
      style: buildResultNodeStyle('aigc_result', nodeData, oldNode?.style),
    }
    return node
  }

  async function buildResultNodeDataForItem(item: any, result: any, index: number, sourceNode: any) {
    const resolved = await resolveCompletedResultAsset(item, result, index)
    const nodeData = deps.ensureResolvedResultTitle(withResolvedMetrics(deps.applyResolvedAssetToNodeData(
      deps.buildResultNodeData(sourceNode.data || {}, item, result, index),
      resolved,
    ), resolved), deps.getResultRecordId(result, item, index) || resolved?.recordId || '')
    return nodeData
  }

  function isManagedIndexedSlot(node: any): boolean {
    return !!node?.data?._managedGenerationSlot
      || (!!node?.data?._resultPlaceholderForNodeId && Number.isFinite(Number(node?.data?._requestIndex)))
  }

  async function applyCompleteResultToExistingCard(nodeId: string, result: any) {
    const items = deps.normalizeResultItems(result)
    const targetIdx = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
    if (targetIdx < 0) {
      appendDebugFileLog('flow-route', 'apply-existing-missing-target', { nodeId })
      return false
    }
    const directRecordId = String(
      deps.extractEventRecordId?.(result)
      || result?.recordId
      || result?.record_id
      || deps.nodes.value[targetIdx]?.data?.recordId
      || '',
    ).trim()
    if (directRecordId && typeof deps.findTeamonesAigcRecord === 'function') {
      try {
        const record = await deps.findTeamonesAigcRecord(directRecordId)
        if (record) {
          return await applyRecordToExistingResultNode(nodeId, record, directRecordId)
        }
      } catch (error) {
        console.warn('[FlowCanvas] hydrate completed placeholder by record id failed:', error)
      }
    }
    if (!items.length) {
      const eventRecordId = String(
        deps.extractEventRecordId?.(result)
        || result?.recordId
        || result?.record_id
        || '',
      ).trim()
      const targetRecordId = String(deps.nodes.value[targetIdx]?.data?.recordId || '').trim()
      const fallbackRecordId = eventRecordId || targetRecordId
      if (!fallbackRecordId || typeof deps.findTeamonesAigcRecord !== 'function') {
        appendDebugFileLog('flow-route', 'apply-existing-empty-items', { nodeId })
        return false
      }
      try {
        const record = await deps.findTeamonesAigcRecord(fallbackRecordId)
        if (!record) {
          appendDebugFileLog('flow-route', 'apply-existing-empty-items', { nodeId })
          return false
        }
        return await applyRecordToExistingResultNode(nodeId, record, fallbackRecordId)
      } catch (error) {
        console.warn('[FlowCanvas] hydrate completed placeholder without items failed:', error)
        appendDebugFileLog('flow-route', 'apply-existing-empty-items', { nodeId })
        return false
      }
    }
    const targetNode = deps.nodes.value[targetIdx]
    const resultNodeData = await buildResultNodeDataForItem(items[0], result, 0, targetNode)
    const normalizedUrl = String(
      resultNodeData?.url
      || resultNodeData?.preview
      || resultNodeData?.imageUrl
      || resultNodeData?.videoUrl
      || resultNodeData?.audioUrl
      || '',
    ).trim()
    const normalizedThumb = String(resultNodeData?.thumb || normalizedUrl).trim()
    const completedNodeData = {
      ...resultNodeData,
      ...(normalizedUrl ? { url: normalizedUrl, preview: normalizedUrl } : {}),
      ...(normalizedThumb ? { thumb: normalizedThumb } : {}),
    }
    const currentData = targetNode.data || {}
    deps.nodes.value[targetIdx] = {
      ...targetNode,
      type: 'aigc_result',
      position: targetNode.position,
      hidden: false,
      style: buildResultNodeStyle('aigc_result', completedNodeData, targetNode, true),
      data: deps.ensureResolvedResultTitle({
        ...currentData,
        ...completedNodeData,
        ...deps.clearGenerationTaskMarkers(currentData),
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        nodeKind: 'aigc_result',
        _resultPlaceholderForNodeId: undefined,
        _requestIndex: undefined,
        _managedGenerationSlot: undefined,
        _slotPosition: undefined,
        _generatedFromNodeId: currentData._resultPlaceholderForNodeId || currentData._generatedFromNodeId,
        _generatingForExistingResult: undefined,
        failReason: undefined,
        fail_reason: undefined,
        statusText: undefined,
      }, deps.getNodeDataRecordId(completedNodeData)),
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    appendDebugFileLog('flow-route', 'apply-existing-complete', {
      nodeId,
      recordId: String(deps.nodes.value[targetIdx]?.data?.recordId || ''),
      hasPreview: !!deps.nodes.value[targetIdx]?.data?.preview,
      hasUrl: !!deps.nodes.value[targetIdx]?.data?.url,
      mediaType: String(deps.nodes.value[targetIdx]?.data?.mediaType || ''),
    })
    const finalRecordId = String(deps.nodes.value[targetIdx]?.data?.recordId || '').trim()
    const finalUrl = String(deps.nodes.value[targetIdx]?.data?.url || '').trim()
    if (!finalUrl && finalRecordId && typeof deps.findTeamonesAigcRecord === 'function') {
      try {
        const record = await deps.findTeamonesAigcRecord(finalRecordId)
        if (record) {
          await applyRecordToExistingResultNode(nodeId, record, finalRecordId)
        }
      } catch (error) {
        console.warn('[FlowCanvas] hydrate completed placeholder by record failed:', error)
      }
    }
    nextTick(() => {
      deps.updateNodeInternals([nodeId])
      deps.syncNodeEdgeHandles(nodeId)
    })
    return true
  }

  async function replaceGeneratingNodesWithResultCards(
    nodeId: string,
    sourceNode: PipelineNode,
    result: PipelineResult,
  ): Promise<boolean> {
    const items = deps.normalizeResultItems(result)
    if (!items.length) return false

    const sourceIdx = deps.nodes.value.findIndex((node) => node.id === nodeId)
    if (sourceIdx < 0) return false

    const generatingNodes = collectGeneratingNodes(nodeId, sourceIdx)
    const consumedPlaceholderNodeIds = new Set()
    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    const sourceWidth = sourceNode.dimensions?.width || parseInt(sourceNode.style?.width) || 320
    const step = sourceWidth + 40

    const resultNodes = []
    for (let index = 0; index < items.length; index++) {
      const oldNode = generatingNodes[index]
      const position = resolveFallbackPosition(oldNode, index, baseX, baseY, step)
      const nodeData = await buildResultNodeDataForItem(items[index], result, index, sourceNode)

      if (index === 0) {
        replaceFirstItemInPlace(sourceIdx, nodeData, oldNode, position, nodeId)
        continue
      }
      if (oldNode?.data?._resultPlaceholderForNodeId === nodeId && !isManagedIndexedSlot(oldNode) && !deps.nodeHasResolvedResult(oldNode?.data || {})) {
        consumedPlaceholderNodeIds.add(oldNode.id)
      }
      resultNodes.push(buildExtraResultNode(nodeData, oldNode, position, nodeId))
    }

    deps.nodes.value = deps.nodes.value.filter((node) => !consumedPlaceholderNodeIds.has(node.id))
    deps.edges.value = deps.edges.value.filter((edge) => !consumedPlaceholderNodeIds.has(edge.source) && !consumedPlaceholderNodeIds.has(edge.target))
    deps.nodes.value = resultNodes.length ? [...deps.nodes.value, ...resultNodes] : [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
    return true
  }

  async function fillResultPlaceholders(
    nodeId: string,
    sourceNode: PipelineNode,
    result: PipelineResult,
  ): Promise<boolean> {
    const items = deps.normalizeResultItems(result)
    if (!items.length) return false

    const sourceIdx = deps.nodes.value.findIndex((node) => node.id === nodeId)
    if (sourceIdx < 0) return false

    const placeholderNodes = deps.nodes.value
      .filter((node) => node.data?._resultPlaceholderForNodeId === nodeId)
      .filter((node) => !isManagedIndexedSlot(node))
    const sourceKeepsExistingResult = sourceNode?.data?._hadResultsBefore === true && placeholderNodes.length > 0
    const consumedPlaceholderIds = new Set()
    if (!sourceKeepsExistingResult) {
      const firstItem = items[0]
      const firstResolved = await resolveCompletedResultAsset(firstItem, result, 0)
      const firstNodeData = deps.ensureResolvedResultTitle(withResolvedMetrics(deps.applyResolvedAssetToNodeData(
        deps.buildResultNodeData(sourceNode.data || {}, firstItem, result, 0),
        firstResolved,
      ), firstResolved), deps.getResultRecordId(result, firstItem, 0))
      deps.nodes.value[sourceIdx] = {
        ...deps.nodes.value[sourceIdx],
        type: 'aigc_result',
        style: buildResultNodeStyle('aigc_result', firstNodeData, deps.nodes.value[sourceIdx].style),
        data: deps.ensureResolvedResultTitle({
          ...deps.nodes.value[sourceIdx].data,
          ...firstNodeData,
          ...deps.clearGenerationTaskMarkers({}),
          status: 'completed',
          isGenerating: false,
          progress: undefined,
          nodeKind: 'aigc_result',
          failReason: undefined,
          fail_reason: undefined,
          statusText: undefined,
        }, deps.getNodeDataRecordId(firstNodeData)),
      }
    }

    const placeholderItems = sourceKeepsExistingResult ? items : items.slice(1)
    const placeholderOffset = sourceKeepsExistingResult ? 0 : 1

    for (const [index, item] of placeholderItems.entries()) {
      const placeholder = placeholderNodes[index]
      if (!placeholder) continue
      const targetIdx = deps.nodes.value.findIndex((node) => node.id === placeholder.id)
      if (targetIdx < 0) continue
      const resolved = await resolveCompletedResultAsset(item, result, index + placeholderOffset)
      const resultNodeData = deps.ensureResolvedResultTitle(withResolvedMetrics(deps.applyResolvedAssetToNodeData(
        deps.buildResultNodeData(sourceNode.data || {}, item, result, index + placeholderOffset),
        resolved,
      ), resolved), deps.getResultRecordId(result, item, index + placeholderOffset))
      consumedPlaceholderIds.add(placeholder.id)
      deps.nodes.value[targetIdx] = {
        ...deps.nodes.value[targetIdx],
        type: 'aigc_result',
        style: buildResultNodeStyle('aigc_result', resultNodeData, deps.nodes.value[targetIdx].style),
        data: deps.ensureResolvedResultTitle({
          ...deps.nodes.value[targetIdx].data,
          ...resultNodeData,
          ...deps.clearGenerationTaskMarkers({}),
          status: 'completed',
          isGenerating: false,
          progress: undefined,
          _resultPlaceholderForNodeId: undefined,
          _generatedFromNodeId: nodeId,
          _generatingForExistingResult: undefined,
          failReason: undefined,
          fail_reason: undefined,
          statusText: undefined,
        }, deps.getNodeDataRecordId(resultNodeData)),
      }
    }

    const unusedPlaceholderIds = placeholderNodes
      .filter((node) => !isManagedIndexedSlot(node) && !consumedPlaceholderIds.has(node.id))
      .map((node) => node.id)

    if (unusedPlaceholderIds.length) {
      deps.nodes.value = deps.nodes.value.filter((node) => !unusedPlaceholderIds.includes(node.id))
      deps.edges.value = deps.edges.value.filter((edge) => !unusedPlaceholderIds.includes(edge.source) && !unusedPlaceholderIds.includes(edge.target))
      deps.emit('update:modelEdges', deps.edges.value)
    }

    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    return true
  }

  function cleanupCompletedNodeState(nodeId: string, result: unknown): void {
    const index = deps.nodes.value.findIndex((node) => node.id === nodeId)
    if (index < 0) return

    const data = deps.nodes.value[index].data || {}
    const currentRecordId = deps.getNodeDataRecordId(data)
    const firstResultItem = deps.normalizeResultItems(result)[0]
    const resultRecordId = deps.getResultRecordId(result, firstResultItem, 0)
    const nextRecordId = currentRecordId || String(resultRecordId || '').trim()
    const needsCleanup = Boolean(data.request || data._genState)
    if (!nextRecordId && !needsCleanup) return

    deps.nodes.value[index] = {
      ...deps.nodes.value[index],
      data: {
        ...data,
        ...(nextRecordId ? { recordId: nextRecordId } : {}),
        request: undefined,
        _genState: undefined,
        capability: undefined,
        mode: undefined,
        model: undefined,
        params: undefined,
        _resultPlaceholderForNodeId: undefined,
        _generatingForExistingResult: undefined,
      },
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  async function applyCompleteResult(nodeId: string, result: PipelineResult): Promise<void> {
    const sourceNode = deps.nodes.value.find((n) => n.id === nodeId)
    if (!sourceNode) return

    try {
      await _applyCompleteResultInner(nodeId, result, sourceNode)
    } finally {
      cleanupCompletedNodeState(nodeId, result)
    }
  }

  async function _applyCompleteResultInner(
    nodeId: string,
    result: PipelineResult,
    sourceNode: PipelineNode,
  ): Promise<void> {
    const totalExpected = sourceNode?.data?._totalExpectedItems
    const isMultiResult = totalExpected != null && totalExpected > 1
    const hasExistingResult =
      deps._pendingRegenHadResult.get(nodeId) === true
      || sourceNode?.data?._hadResultsBefore === true
      || deps._pendingRegenHadRecordId.get(nodeId) === true
      || !!(sourceNode?.data?.preview || sourceNode?.data?.imageUrl || sourceNode?.data?.videoUrl || sourceNode?.data?.audioUrl)

    if (!hasExistingResult) {
      if (await replaceGeneratingNodesWithResultCards(nodeId, sourceNode, result)) {
        return
      }
    }

    if (await fillResultPlaceholders(nodeId, sourceNode, result)) {
      return
    }

    // Path A: 只清理真正孤儿的占位卡（无结果、未在生成、未绑定 task）。
    // 之前的 removeGeneratingPlaceholderNodes 会无差别清掉所有 _resultPlaceholderForNodeId === nodeId 的占位卡，
    // 导致多结果批处理中一个空 complete 事件误删兄弟占位卡（仍持有 taskId / recordId 的活跃卡）。
    const orphanPlaceholderIds = deps.nodes.value
      .filter((n: any) => n.data?._resultPlaceholderForNodeId === nodeId
        && !isManagedIndexedSlot(n)
        && !n.data?.recordId
        && !n.data?.isGenerating
        && !n.data?._activeTaskId
        && !n.data?.taskId)
      .map((n: any) => n.id)
    if (orphanPlaceholderIds.length) {
      deps.nodes.value = deps.nodes.value.filter((n: any) => !orphanPlaceholderIds.includes(n.id))
      deps.edges.value = deps.edges.value.filter((e: any) => !orphanPlaceholderIds.includes(e.source) && !orphanPlaceholderIds.includes(e.target))
      deps.emit('update:modelNodes', deps.nodes.value)
      deps.emit('update:modelEdges', deps.edges.value)
    }

    if (hasExistingResult) {
      deps.createRegenCard(nodeId, result)
      return
    }

    const idx = deps.nodes.value.findIndex((n) => n.id === nodeId)
    if (idx < 0) return

    if (!isMultiResult) {
      if (deps.syncGeneratedResultNodes(nodeId, result)) {
        return
      }

      let preview = null
      if (result.items && result.items.length > 0) {
        preview = (await resolveCompletedResultAsset(result.items[0], result, 0)).preview
      } else if (result.url) {
        preview = deps.extractUrl(result.url)
      } else if (result.output) {
        preview = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
      } else if (typeof result === 'string') {
        preview = result
      }

      const resolvedRecordId = result.recordId || result.aigc_record_id || result?.data?.aigc_record_id || (result.items && result.items[0] && (result.items[0].record_id || result.items[0].aigc_record_id)) || null
      const resolvedAsset = result.items?.[0]
        ? await resolveCompletedResultAsset(result.items[0], result, 0)
        : { recordId: resolvedRecordId, preview, record: null }

      // preview 为空但有 queryId → 用 record ID 查完整结果取 URL
      const resultNodeData = deps.applyResolvedAssetToNodeData(
        deps.buildResultNodeData(sourceNode.data || {}, result.items?.[0], result, 0),
        { ...resolvedAsset, preview: resolvedAsset.preview || preview, recordId: resolvedAsset.recordId || resolvedRecordId },
      )

      deps.nodes.value[idx] = {
        ...deps.nodes.value[idx],
        type: 'aigc_result',
        data: {
          ...deps.nodes.value[idx].data,
          ...resultNodeData,
          status: 'completed',
          isGenerating: false,
          progress: undefined,
          request: undefined,
          _genState: undefined,
          capability: undefined,
          mode: undefined,
          model: undefined,
          params: undefined,
        },
      }
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
      return
    }

    const items = deps.normalizeResultItems(result)
    if (!items.length) return

    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    const existingCount = sourceNode.data?._multiResultCount || 0
    const hasSourcePreview = !!sourceNode.data?.preview
    const sourceWidth = sourceNode.dimensions?.width || parseInt(sourceNode.style?.width) || 320
    const nodeGap = 40
    const step = sourceWidth + nodeGap

    const upstreamEdges = deps.edges.value.filter(e => e.target === nodeId && e.source)
    const newNodes: PipelineNode[] = []
    const newEdges: PipelineEdge[] = []

    if (!hasSourcePreview && items.length > 0) {
      const firstItem = items[0]
      const firstResolved = await resolveCompletedResultAsset(firstItem, result, 0)
      const firstNodeData = deps.applyResolvedAssetToNodeData(
        deps.buildResultNodeData(sourceNode.data || {}, firstItem, result, 0),
        firstResolved,
      )
      const firstRecordId = firstResolved.recordId
      const srcIdx = deps.nodes.value.findIndex((n) => n.id === nodeId)
      if (srcIdx >= 0) {
        deps.nodes.value[srcIdx] = {
          ...deps.nodes.value[srcIdx],
          type: 'aigc_result',
          data: {
            ...deps.nodes.value[srcIdx].data,
            ...firstNodeData,
            ...deps.clearGenerationTaskMarkers({}),
            status: 'completed',
            isGenerating: false,
            progress: undefined,
            _multiResultCount: existingCount + items.length,
            ...(firstRecordId ? { recordId: String(firstRecordId) } : {}),
            request: undefined,
            _genState: undefined,
            capability: undefined,
            mode: undefined,
            model: undefined,
            params: undefined,
          },
        }
      }

      for (const [i, item] of items.slice(1).entries()) {
        const resolved = await resolveCompletedResultAsset(item, result, existingCount + 1 + i)
        const preview = resolved.preview
        if (!preview) continue
        const recordId = resolved.recordId
        const nodeData = deps.applyResolvedAssetToNodeData(
          deps.buildResultNodeData(sourceNode.data || {}, item, result, existingCount + 1 + i),
          resolved,
        )
        const nodeType = deps.getResultItemNodeType(item, sourceNode.type)
        const xOffset = existingCount + 1 + i
        const newNodeId = deps.createRuntimeId('multi')
        newNodes.push({
          id: newNodeId,
          type: nodeType,
          position: { x: baseX + xOffset * step, y: baseY },
          data: { ...deps.clearGenerationTaskMarkers(nodeData), status: 'completed', isGenerating: false, progress: undefined, _multiResultForNodeId: nodeId, ...(recordId ? { recordId: String(recordId) } : {}) },
          ...(deps.fixedSizeTypes[nodeType] ? { style: deps.fixedSizeTypes[nodeType] } : {}),
        })
        upstreamEdges.forEach(edge => {
          const cloned = deps.cloneIncomingEdgeToTarget(edge, newNodes[newNodes.length - 1])
          if (cloned) newEdges.push(cloned)
        })
      }
    } else {
      for (const [i, item] of items.entries()) {
        const resolved = await resolveCompletedResultAsset(item, result, existingCount + i)
        const preview = resolved.preview
        if (!preview) continue
        const recordId = resolved.recordId
        const nodeData = deps.applyResolvedAssetToNodeData(
          deps.buildResultNodeData(sourceNode.data || {}, item, result, existingCount + i),
          resolved,
        )
        const nodeType = deps.getResultItemNodeType(item, sourceNode.type)
        const xOffset = existingCount + i + 1
        const newNodeId = deps.createRuntimeId('multi')
        newNodes.push({
          id: newNodeId,
          type: nodeType,
          position: { x: baseX + xOffset * step, y: baseY },
          data: { ...deps.clearGenerationTaskMarkers(nodeData), status: 'completed', isGenerating: false, progress: undefined, _multiResultForNodeId: nodeId, ...(recordId ? { recordId: String(recordId) } : {}) },
          ...(deps.fixedSizeTypes[nodeType] ? { style: deps.fixedSizeTypes[nodeType] } : {}),
        })
        upstreamEdges.forEach(edge => {
          const cloned = deps.cloneIncomingEdgeToTarget(edge, newNodes[newNodes.length - 1])
          if (cloned) newEdges.push(cloned)
        })
      }

      const finalIdx = deps.nodes.value.findIndex((n) => n.id === nodeId)
      if (finalIdx >= 0) {
        deps.nodes.value[finalIdx] = {
          ...deps.nodes.value[finalIdx],
          data: { ...deps.clearGenerationTaskMarkers(deps.nodes.value[finalIdx].data), _multiResultCount: existingCount + items.length, status: 'completed', isGenerating: false, progress: undefined },
        }
      }
    }

    if (newNodes.length) {
      deps.nodes.value = [...deps.nodes.value, ...newNodes]
      if (newEdges.length) {
        deps.edges.value = [...deps.edges.value, ...newEdges]
        deps.emit('update:modelEdges', deps.edges.value)
      }
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    nextTick(() => {
      deps.updateNodeInternals([nodeId, ...newNodes.map((node) => node.id)])
      deps.syncNodeEdgeHandles(nodeId)
      newNodes.forEach((node) => deps.syncNodeEdgeHandles(node.id))
    })
  }
  return { resolveCompletedResultAsset, applyRecordToExistingResultNode, applyCompleteResultToExistingCard, replaceGeneratingNodesWithResultCards, fillResultPlaceholders, applyCompleteResult, _applyCompleteResultInner }
}
