import { nextTick } from 'vue'
import { MarkerType } from '@vue-flow/core'

export function useGenerationOrchestrationResultSync(deps: any) {
  function createRegenCard(nodeId: string, result: any) {
    const sourceNode = deps.nodes.value.find((n: any) => n.id === nodeId)
    const items = deps.normalizeResultItems(result)
    if (!sourceNode || !items.length) return

    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    const sourceWidth = sourceNode.dimensions?.width || parseInt(sourceNode.style?.width) || 320
    const nodeGap = 40
    const step = sourceWidth + nodeGap

    const sameRowNodes = deps.nodes.value.filter((n: any) => {
      const nx = n.position?.x || 0
      const ny = n.position?.y || 0
      return Math.abs(ny - baseY) < 10 && nx > baseX && n.id !== nodeId
    })
    const startX = sameRowNodes.length
      ? Math.max(...sameRowNodes.map((n: any) => n.position.x)) + step
      : baseX + step

    const upstreamEdges = deps.edges.value.filter((e: any) => e.target === nodeId && e.source)
    const newNodes: any[] = []
    const newEdges: any[] = []

    items.forEach((item: any, i: number) => {
      const preview = deps.extractPreviewUrl(item)
      if (!preview) return
      const recordId = deps.getResultRecordId(result, item, i)
      const nodeData = deps.buildResultNodeData(sourceNode.data || {}, item, result, i)
      const nodeType = deps.getResultItemNodeType(item, sourceNode.type)
      const newNodeId = deps.createRuntimeId('reg')
      const newNode = {
        id: newNodeId,
        type: nodeType,
        position: { x: startX + i * step, y: baseY },
        data: {
          ...sourceNode.data,
          ...nodeData,
          preview,
          status: 'completed',
          isGenerating: false,
          progress: undefined,
          ...(recordId ? { recordId } : {}),
        },
        ...(deps.fixedSizeTypes[nodeType] ? { style: deps.fixedSizeTypes[nodeType] } : {}),
      }
      newNodes.push(newNode)
      upstreamEdges.forEach((edge: any) => {
        const cloned = deps.cloneIncomingEdgeToTarget(edge, newNode)
        if (cloned) newEdges.push(cloned)
      })
    })

    const srcIdx = deps.nodes.value.findIndex((n: any) => n.id === nodeId)
    if (srcIdx >= 0) {
      deps.nodes.value[srcIdx] = {
        ...deps.nodes.value[srcIdx],
        data: { ...deps.nodes.value[srcIdx].data, status: 'completed', isGenerating: false, progress: undefined },
      }
    }

    if (newNodes.length) {
      deps.nodes.value = [...deps.nodes.value, ...newNodes]
      if (newEdges.length) deps.edges.value = [...deps.edges.value, ...newEdges]
      deps.emit('update:modelNodes', deps.nodes.value)
      deps.emit('update:modelEdges', deps.edges.value)
      nextTick(() => {
        deps.updateNodeInternals(newNodes.map((node: any) => node.id))
        newNodes.forEach((node: any) => deps.syncNodeEdgeHandles(node.id))
      })
      return
    }

    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  function syncGeneratedResultNodes(nodeId: string, result: any) {
    const sourceNode = deps.nodes.value.find((n: any) => n.id === nodeId)
    if (!sourceNode) return false
    const resultItems = deps.normalizeResultItems(result)
    if (!resultItems.length) return false

    const existingExtraIds = new Set(
      deps.nodes.value.filter((node: any) => node.data?._generatedFromNodeId === nodeId).map((node: any) => node.id)
    )
    if (existingExtraIds.size) {
      deps.nodes.value = deps.nodes.value.filter((node: any) => !existingExtraIds.has(node.id))
      deps.edges.value = deps.edges.value.filter((edge: any) => !existingExtraIds.has(edge.source) && !existingExtraIds.has(edge.target))
    }

    const idx = deps.nodes.value.findIndex((n: any) => n.id === nodeId)
    if (idx < 0) return false

    const firstData = deps.buildResultNodeData(sourceNode.data || {}, resultItems[0], result, 0)
    const firstPreview = firstData.preview
    deps.nodes.value[idx] = {
      ...deps.nodes.value[idx],
      type: 'aigc_result',
      data: {
        ...deps.nodes.value[idx].data,
        ...firstData,
        ...(firstPreview ? { preview: firstPreview } : {}),
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        _generatedResultCount: resultItems.length,
        request: undefined,
        _genState: undefined,
        capability: undefined,
        mode: undefined,
        model: undefined,
        params: undefined,
      },
    }

    const baseX = sourceNode.position?.x || 0
    const baseY = sourceNode.position?.y || 0
    const sourceWidth = sourceNode.dimensions?.width || parseInt(sourceNode.style?.width) || 320
    const nodeGap = 40
    const step = sourceWidth + nodeGap
    const upstreamEdges = deps.edges.value.filter((e: any) => e.target === nodeId && e.source)

    const extraNodes = resultItems.slice(1).map((item: any, extraIndex: number) => {
      const index = extraIndex + 1
      const nodeType = deps.getResultItemNodeType(item, sourceNode.type)
      const resultPreview = deps.extractPreviewUrl(item)
      return {
        id: deps.createRuntimeId('gen'),
        type: nodeType,
        position: { x: baseX + (extraIndex + 1) * step, y: baseY },
        data: {
          ...sourceNode.data,
          ...deps.buildResultNodeData(sourceNode.data || {}, item, result, index),
          preview: resultPreview,
          isGenerating: false,
          progress: undefined,
          _generatedFromNodeId: nodeId,
          _generatedIndex: index,
        },
        ...(deps.fixedSizeTypes[nodeType] ? { style: deps.fixedSizeTypes[nodeType] } : {}),
      }
    })

    const extraEdges = extraNodes.flatMap((node: any) => upstreamEdges.map((edge: any) => ({
      id: deps.createEdgeId('e'),
      source: edge.source,
      target: node.id,
      type: edge.type || deps.edgeStyle.value,
      style: edge.style ? { ...edge.style } : { stroke: '#818cf8', strokeWidth: 2 },
      animated: edge.animated !== undefined ? edge.animated : true,
      markerEnd: edge.markerEnd || MarkerType.ArrowClosed,
    })))

    if (extraNodes.length) {
      deps.nodes.value = [...deps.nodes.value, ...extraNodes]
      deps.edges.value = [...deps.edges.value, ...extraEdges]
    } else {
      deps.nodes.value = [...deps.nodes.value]
    }
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
    return true
  }

  function restoreRecordIdAndCleanup(nodeId: string, preRecordId: string) {
    void preRecordId
    const idx = deps.nodes.value.findIndex((n: any) => n.id === nodeId)
    if (idx < 0) return
    const data = deps.nodes.value[idx].data || {}
    const currentRecordId = deps.getNodeDataRecordId(data)
    if (currentRecordId) {
      if (data.request || data._genState) {
        deps.nodes.value[idx] = {
          ...deps.nodes.value[idx],
          data: { ...data, request: undefined, _genState: undefined, capability: undefined, mode: undefined, model: undefined, params: undefined },
        }
        deps.nodes.value = [...deps.nodes.value]
        deps.emit('update:modelNodes', deps.nodes.value)
      }
      return
    }
    if (!data.request && !data._genState) return
    deps.nodes.value[idx] = {
      ...deps.nodes.value[idx],
      data: {
        ...data,
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
  }

  return {
    createRegenCard,
    syncGeneratedResultNodes,
    restoreRecordIdAndCleanup,
  }
}
