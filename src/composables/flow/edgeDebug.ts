import { logger } from '@/utils/logger'
import type { FlowEdge, FlowNode } from './flowCore.types'

function summarizeEdge(edge: FlowEdge) {
  return {
    id: edge?.id || '',
    source: edge?.source || '',
    target: edge?.target || '',
    sourceHandle: edge?.sourceHandle || '',
    targetHandle: edge?.targetHandle || '',
  }
}

function summarizeNode(node: FlowNode | undefined) {
  return {
    id: node?.id || '',
    type: node?.type || '',
    recordId: String(node?.data?.recordId || '').trim(),
    status: String(node?.data?.status || '').trim(),
    activeTaskId: String(node?.data?._activeTaskId || '').trim(),
  }
}

export function logFlowEdgeSnapshot(
  stage: string,
  focusNodeId: string,
  nodes: FlowNode[] = [],
  edges: FlowEdge[] = [],
  extra: Record<string, unknown> = {},
): void {
  const relatedEdges = edges.filter((edge) => edge?.source === focusNodeId || edge?.target === focusNodeId)
  const focusNode = nodes.find((node) => node?.id === focusNodeId)
  logger.debug('FlowEdgeDebug', stage, {
    focusNode: summarizeNode(focusNode),
    incomingEdges: relatedEdges.filter((edge) => edge.target === focusNodeId).map(summarizeEdge),
    outgoingEdges: relatedEdges.filter((edge) => edge.source === focusNodeId).map(summarizeEdge),
    totalNodes: nodes.length,
    totalEdges: edges.length,
    ...extra,
  })
}

export function logPersistedEdgeFiltering(
  allEdges: FlowEdge[] = [],
  persistedEdges: FlowEdge[] = [],
  nodes: FlowNode[] = [],
): void {
  if (persistedEdges.length === allEdges.length) return
  const persistedNodeIds = new Set((nodes || []).map((node) => node?.id).filter(Boolean))
  const droppedEdges = allEdges
    .filter((edge) => !persistedNodeIds.has(edge?.source || '') || !persistedNodeIds.has(edge?.target || ''))
    .map((edge) => ({
      ...summarizeEdge(edge),
      missingSource: !persistedNodeIds.has(edge?.source || ''),
      missingTarget: !persistedNodeIds.has(edge?.target || ''),
    }))

  logger.warn('FlowEdgeDebug', 'Persisted edge filtering removed edges', {
    totalEdges: allEdges.length,
    keptEdges: persistedEdges.length,
    droppedEdges,
  })
}
