import type { GraphNode } from '@vue-flow/core'

export const getUpstreamNodeType = (
  node: GraphNode,
  getIncomers: (node: GraphNode) => GraphNode[]
): string => {
  let sourceType = node.type

  const chainTypes = new Set(['waypoint'])
  if (chainTypes.has(sourceType || '')) {
    let currentNodes: GraphNode[] | undefined = [node]
    const visited = new Set<string>()

    while (currentNodes && currentNodes.length > 0) {
      const curr = currentNodes[0]
      if (visited.has(curr.id)) break
      visited.add(curr.id)

      if (!chainTypes.has(curr.type || '')) {
        sourceType = curr.type
        break
      }
      currentNodes = getIncomers(curr)
    }
  }

  return sourceType || 'default'
}

export const getNodeColor = (type?: string): string => {
  switch (type) {
    case 'file_input':
    case 'image_generation':
    case 'aigc_result':
      return '#34d399'
    case 'audio_generation':
      return '#fbbf24'
    case 'text_generation':
      return '#818cf8'
    case 'video_generation':
      return '#fb7185'
    case 'model_generation':
      return '#22d3ee'
    case 'cameraNode':
      return '#34d399'
    case 'groupNode':
      return '#94a3b8'
    case 'waypoint':
      return '#818cf8'
    case 'imageCompareNode':
      return '#22d3ee'
    default:
      return '#94a3b8'
  }
}
