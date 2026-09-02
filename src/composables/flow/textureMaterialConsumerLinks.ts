import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'

function findNode(nodes: any[], nodeId: string): any {
  return nodes.find((node: any) => node?.id === nodeId)
}

function patchNodeChannel(node: any, channel: string): boolean {
  if (!node?.data || !channel || node.data.pbrChannel === channel) return false
  node.data = { ...node.data, pbrChannel: channel }
  return true
}

function hasAlbedoInput(targetId: string, deps: any): boolean {
  return deps.edges.value.some((edge: any) => {
    if (edge?.target !== targetId) return false
    const sourceNode = findNode(deps.nodes.value, edge.source)
    return sourceNode?.data?.pbrChannel === 'albedo'
  })
}

function inferSourceChannel(sourceNode: any): string {
  return String(sourceNode?.data?.pbrChannel || inferTextureMaterialChannel(sourceNode?.data || {})).trim()
}

function createBaseColorEdge(sourceNode: any, targetId: string, params: any, deps: any): boolean {
  if (hasAlbedoInput(targetId, deps)) return false
  const incoming = deps.edges.value.find((edge: any) => edge?.target === sourceNode?.id)
  const albedoSource = incoming ? findNode(deps.nodes.value, incoming.source) : null
  if (!albedoSource) return false
  patchNodeChannel(albedoSource, 'albedo')
  deps.edges.value = [
    ...deps.edges.value,
    {
      id: deps.createRuntimeId('edge'),
      source: albedoSource.id,
      sourceHandle: incoming.sourceHandle,
      target: targetId,
      targetHandle: 'albedo',
      type: params?.type || deps.edgeStyle.value,
    },
  ]
  return true
}

/**
 * Synchronize texture-material channel metadata when a source is linked to the consumer node.
 * @param params VueFlow connection payload.
 * @param deps Flow runtime dependencies.
 * @returns True when nodes or edges changed.
 */
export function syncTextureMaterialConnection(params: any, deps: any): boolean {
  const targetNode = findNode(deps.nodes.value, params?.target)
  const sourceNode = findNode(deps.nodes.value, params?.source)
  if (targetNode?.type !== 'texture_material' || !sourceNode) return false
  const channel = inferSourceChannel(sourceNode)
  const patchedSource = patchNodeChannel(sourceNode, channel)
  const patchedBase = channel && channel !== 'albedo'
    ? createBaseColorEdge(sourceNode, targetNode.id, params, deps)
    : false
  return patchedSource || patchedBase
}
