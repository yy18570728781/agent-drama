import { nextTick } from 'vue'
import type { Ref } from 'vue'
import { MarkerType } from '@vue-flow/core'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { createFlowEdgeId, createFlowId, createFlowNodeId, normalizeFlowNodeId } from '@/utils/flowId'
import { getMediaUrlMetrics } from '@/utils/mediaMetrics'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import { buildWorkflowMediaMeta, normalizeWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'

export interface NodeFactoryDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  edgeStyle: Ref<string>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
  }
  updateNodeInternals: (ids: string[]) => void
  buildRuntimeAssetNodeData: (opts: any) => any
  buildPortsForNode: typeof buildPortsForNodeContract
  getGenerationCardHorizontalGap: (sourceNode: any) => number
  fixedSizeTypes: Record<string, any>
}

type NodeBoxStyle = { width?: string; height?: string }
type MediaMetricsInput = { width?: number; height?: number; aspectRatio?: number }

export function useNodeFactory(deps: NodeFactoryDeps) {
  const { nodes, edges, findNode, edgeStyle, emit, updateNodeInternals, buildRuntimeAssetNodeData, buildPortsForNode, getGenerationCardHorizontalGap, fixedSizeTypes } = deps
  const { flowDropDirection } = useTheme()

  function createRuntimeId(prefix = 'node') {
    if (prefix === 'edge') return createFlowEdgeId()
    if (prefix === 'sub') return createFlowId('sub')
    return createFlowNodeId()
  }

  function createEdgeId() {
    return createFlowEdgeId()
  }

  function getPrimaryPortId(nodeData: any, direction: any) {
    const ports = direction === 'input'
      ? nodeData?.ports?.inputs
      : nodeData?.ports?.outputs
    if (!Array.isArray(ports) || !ports.length) return undefined
    const firstVisiblePort = ports.find((port) => port?.visible !== false)
    return firstVisiblePort?.id || ports[0]?.id || undefined
  }

  function syncNodeEdgeHandles(nodeId: string) {
    const node = findNode(nodeId)
    if (!node) return
    const targetHandle = getPrimaryPortId(node.data, 'input') || node.handleBounds?.target?.[0]?.id
    const sourceHandle = node.type === 'groupNode'
      ? undefined
      : getPrimaryPortId(node.data, 'output') || node.handleBounds?.source?.[0]?.id
    let changed = false
    edges.value = edges.value.map((edge) => {
      if (edge.target === nodeId && targetHandle && edge.targetHandle !== targetHandle) {
        changed = true
        return { ...edge, targetHandle }
      }
      if (edge.source === nodeId && sourceHandle && edge.sourceHandle !== sourceHandle) {
        changed = true
        return { ...edge, sourceHandle }
      }
      return edge
    })
    if (changed) emit('update:modelEdges', edges.value)
  }

  function cloneIncomingEdgeToTarget(edge: any, targetNode: any) {
    if (!edge?.source || !targetNode?.id) return null
    return {
      id: createEdgeId(),
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: targetNode.id,
      targetHandle: getPrimaryPortId(targetNode.data, 'input'),
      type: edge.type || edgeStyle.value,
      style: edge.style ? { ...edge.style } : { stroke: '#818cf8', strokeWidth: 2 },
      animated: edge.animated !== undefined ? edge.animated : true,
      markerEnd: edge.markerEnd || MarkerType.ArrowClosed,
    }
  }

  function getNodeBoxSize(node: any, fallbackStyle: NodeBoxStyle = {}) {
    return {
      width: node?.dimensions?.width || parseInt(node?.style?.width) || parseInt(fallbackStyle?.width || '') || 320,
      height: node?.dimensions?.height || parseInt(node?.style?.height) || parseInt(fallbackStyle?.height || '') || 180,
    }
  }

  function extractMetricsInput(input: any): MediaMetricsInput | null {
    const mediaMeta = normalizeWorkflowMediaMeta(input?.data || input)
    const width = Number(mediaMeta?.width || input?.width || input?.data?.width || 0)
    const height = Number(mediaMeta?.height || input?.height || input?.data?.height || 0)
    const aspectRatio = Number(mediaMeta?.aspectRatio || input?.aspectRatio || input?.aspect_ratio || input?.data?.aspect_ratio || 0)
    if (width > 0 && height > 0) return { width, height, aspectRatio: width / height }
    if (aspectRatio > 0) return { aspectRatio }
    return null
  }

  function getMediaStyle(mediaType: string, input?: MediaMetricsInput | null): NodeBoxStyle {
    if (!input || (input.width ?? 0) <= 0 && (input.height ?? 0) <= 0 && (input.aspectRatio ?? 0) <= 0) {
      return { width: '320px', height: '180px' }
    }
    const size = getFlowMediaNodeSize({
      mediaType,
      width: input.width,
      height: input.height,
      aspectRatio: input.aspectRatio,
    })
    return { width: `${size.width}px`, height: `${size.height}px` }
  }

  function patchNodeMediaMetrics(nodeId: string, mediaType: string, metrics: MediaMetricsInput | null) {
    if (!metrics?.width || !metrics?.height) return
    const index = nodes.value.findIndex((node) => node.id === nodeId)
    if (index < 0) return
    const currentNode = nodes.value[index]
    const nextStyle = getMediaStyle(mediaType, metrics)
    nodes.value[index] = {
      ...currentNode,
      data: {
        ...(currentNode.data || {}),
        mediaMeta: buildWorkflowMediaMeta(metrics.width, metrics.height, metrics.aspectRatio),
      },
      style: { ...(currentNode.style || {}), ...nextStyle },
    }
    emit('update:modelNodes', nodes.value)
    nextTick(() => updateNodeInternals([nodeId]))
  }

  async function refreshNodeMediaMetrics(nodeId: string, mediaType: string, options: any, nodeData: any) {
    const directMetrics = extractMetricsInput(options) || extractMetricsInput(nodeData)
    if (directMetrics?.width && directMetrics?.height) {
      patchNodeMediaMetrics(nodeId, mediaType, directMetrics)
      return
    }
    if (mediaType !== 'image' && mediaType !== 'video') return
    const mediaUrl = String(options?.url || nodeData?.imageUrl || nodeData?.videoUrl || nodeData?.url || '').trim()
    if (!mediaUrl) return
    const metrics = await getMediaUrlMetrics(mediaUrl, mediaType)
    if (metrics) patchNodeMediaMetrics(nodeId, mediaType, metrics)
  }

  function getConnectedAssetNodePosition(sourceNodeId: string, style: NodeBoxStyle = {}) {
    const sourceNode = sourceNodeId ? findNode(sourceNodeId) : null
    const sourceX = sourceNode?.position?.x || 0
    const sourceY = sourceNode?.position?.y || 0
    const sourceSize = getNodeBoxSize(sourceNode)
    const columnGap = getGenerationCardHorizontalGap(sourceNode)
    const verticalGap = 28
    const x = sourceX + sourceSize.width + columnGap

    const downstreamNodes = edges.value
      .filter((edge) => edge.source === sourceNodeId)
      .map((edge) => findNode(edge.target))
      .filter(Boolean)

    if (!downstreamNodes.length) {
      return { x, y: sourceY }
    }

    const maxBottom = Math.max(
      ...downstreamNodes.map((node) => {
        const nodeY = node?.position?.y || 0
        const nodeHeight = getNodeBoxSize(node).height
        return nodeY + nodeHeight
      })
    )

    return {
      x,
      y: Math.max(sourceY, maxBottom + verticalGap),
    }
  }

  function getAssetNodePositionBelow(sourceNodeId: string, style: { width?: string; height?: string } = {}) {
    const sourceNode = sourceNodeId ? findNode(sourceNodeId) : null
    if (!sourceNode) {
      return getStackedAssetNodePosition({ x: 0, y: 0 }, 0, style)
    }

    const sourceX = sourceNode.position?.x || 0
    const sourceY = sourceNode.position?.y || 0
    const sourceSize = getNodeBoxSize(sourceNode)
    const targetSize = getNodeBoxSize(null, style)
    const verticalGap = 28

    const overlappingNodes = nodes.value
      .filter((node) => node?.id !== sourceNodeId)
      .filter((node) => {
        const nodeX = node?.position?.x || 0
        const nodeSize = getNodeBoxSize(node)
        return Math.abs(nodeX - sourceX) < Math.max(nodeSize.width, targetSize.width) * 0.5
      })
      .filter((node) => {
        const nodeY = node?.position?.y || 0
        return nodeY >= sourceY + sourceSize.height
      })

    if (!overlappingNodes.length) {
      return {
        x: sourceX,
        y: sourceY + sourceSize.height + verticalGap,
      }
    }

    const maxBottom = Math.max(
      ...overlappingNodes.map((node) => {
        const nodeY = node?.position?.y || 0
        const nodeHeight = getNodeBoxSize(node).height
        return nodeY + nodeHeight
      })
    )

    return {
      x: sourceX,
      y: maxBottom + verticalGap,
    }
  }

  function getStackedAssetNodePosition(basePosition: { x: number; y: number }, index: number, style: NodeBoxStyle = {}) {
    const horizontalGap = 28
    const verticalGap = 28
    const nodeSize = getNodeBoxSize(null, style)
    if (flowDropDirection.value === 'horizontal') {
      return {
        x: basePosition.x + index * (nodeSize.width + horizontalGap),
        y: basePosition.y,
      }
    }
    return {
      x: basePosition.x,
      y: basePosition.y + index * (nodeSize.height + verticalGap),
    }
  }

  function getUpstreamAssetNodePosition(targetNodeId: string, index: number, style: NodeBoxStyle = {}) {
    const targetNode = targetNodeId ? findNode(targetNodeId) : null
    if (!targetNode) {
      return getStackedAssetNodePosition({ x: 0, y: 0 }, index, style)
    }

    const targetX = targetNode.position?.x || 0
    const targetY = targetNode.position?.y || 0
    const nodeSize = getNodeBoxSize(null, style)
    const verticalGap = 28
    const upstreamNodes = edges.value
      .filter((edge) => edge.target === targetNodeId)
      .map((edge) => findNode(edge.source))
      .filter(Boolean)

    const startY = upstreamNodes.length
      ? Math.max(
          targetY,
          Math.max(
            ...upstreamNodes.map((node) => {
              const nodeY = node?.position?.y || 0
              const nodeHeight = getNodeBoxSize(node).height
              return nodeY + nodeHeight + verticalGap
            }),
          ),
        )
      : targetY

    return {
      x: targetX - 380,
      y: startY + index * (nodeSize.height + verticalGap),
    }
  }

  function createConnectedAssetNode(sourceNodeId: string, options: any = {}) {
    const sourceNode = sourceNodeId ? findNode(sourceNodeId) : null
    const mediaType = options.mediaType || 'image'
    const label = options.label || '图片上传'
    const url = options.url || ''
    const metrics = extractMetricsInput(options)
    const style = metrics ? getMediaStyle(mediaType, metrics) : (options.style || { width: '320px', height: '180px' })
    const position = options.position || getConnectedAssetNodePosition(sourceNodeId, style)
    const newNodeId = normalizeFlowNodeId(options.id || createRuntimeId('node'))
    const newNodeData = {
      ...buildRuntimeAssetNodeData({
        label,
        nodeType: 'file_input',
        url,
        mediaType,
      }),
      url,
      mediaType,
      ports: buildPortsForNode('file_input', mediaType),
      ...(buildWorkflowMediaMeta(metrics?.width, metrics?.height, metrics?.aspectRatio)
        ? { mediaMeta: buildWorkflowMediaMeta(metrics?.width, metrics?.height, metrics?.aspectRatio) }
        : {}),
    }
    if (mediaType === 'image') {
      newNodeData.preview = url
      newNodeData.imageUrl = url
    } else if (mediaType === 'video') {
      newNodeData.preview = url
      newNodeData.videoUrl = url
    } else if (mediaType === 'audio') {
      newNodeData.audioUrl = url
    }

    const newNode = {
      id: newNodeId,
      type: 'file_input',
      position,
      data: newNodeData,
      style,
    }
    nodes.value = [...nodes.value, newNode]
    emit('update:modelNodes', nodes.value)

    if (sourceNodeId) {
      edges.value = [
        ...edges.value,
        {
          id: createEdgeId(),
          source: sourceNodeId,
          sourceHandle: getPrimaryPortId(sourceNode?.data, 'output'),
          target: newNodeId,
          targetHandle: getPrimaryPortId(newNodeData, 'input'),
          type: edgeStyle.value,
        },
      ]
      emit('update:modelEdges', edges.value)
    }
    nextTick(() => {
      updateNodeInternals(sourceNodeId ? [sourceNodeId, newNodeId] : [newNodeId])
      if (sourceNodeId) syncNodeEdgeHandles(sourceNodeId)
      syncNodeEdgeHandles(newNodeId)
    })
    void refreshNodeMediaMetrics(newNodeId, mediaType, options, newNodeData)

    return { id: newNodeId, node: newNode }
  }

  return {
    createRuntimeId,
    createEdgeId,
    cloneIncomingEdgeToTarget,
    getNodeBoxSize,
    getConnectedAssetNodePosition,
    getAssetNodePositionBelow,
    getStackedAssetNodePosition,
    getUpstreamAssetNodePosition,
    getPrimaryPortId,
    syncNodeEdgeHandles,
    createConnectedAssetNode,
  }
}
