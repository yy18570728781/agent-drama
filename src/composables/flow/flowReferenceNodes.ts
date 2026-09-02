function hasDirectEdgeToTarget(nodeId: string, targetId: string, edges: any[] = []): boolean {
  return edges.some((edge) => edge?.source === nodeId && edge?.target === targetId)
}

/**
 * 没有 recordId 的媒体 file_input，一律按上传节点处理，不再额外挂 reference 元数据。
 */
export function isUploadLikeFileInputNode(node: any): boolean {
  const recordId = String(node?.data?.recordId || '').trim()
  const mediaUrl = String(
    node?.data?.url
    || node?.data?.preview
    || node?.data?.imageUrl
    || node?.data?.videoUrl
    || node?.data?.audioUrl
    || '',
  ).trim()

  return node?.type === 'file_input' && !recordId && !!mediaUrl
}

/**
 * 通过直接入边找到挂在目标节点上的上传型 file_input 节点。
 */
export function getUploadLikeFileInputNodeIdsForTarget(targetId: string, nodes: any[] = [], edges: any[] = []): string[] {
  return nodes
    .filter((node) => !!node?.id && isUploadLikeFileInputNode(node) && hasDirectEdgeToTarget(node.id, targetId, edges))
    .map((node) => node.id)
}

/**
 * 只有彻底脱离连接关系的上传型 file_input 节点才会被真正删除，避免误删共享节点。
 */
export function getOrphanedUploadLikeFileInputNodeIds(nodeIds: string[] = [], edges: any[] = []): string[] {
  const candidates = new Set(nodeIds.filter(Boolean))
  return [...candidates].filter((nodeId) => !edges.some((edge) => edge?.source === nodeId || edge?.target === nodeId))
}
