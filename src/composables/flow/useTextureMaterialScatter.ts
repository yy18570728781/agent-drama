import { collectDownstreamTargets, buildDownstreamEdges } from './useBatchGridNode'
import type { UseBatchGridNodeDeps } from './useBatchGridNode'
import { createFlowId } from '@/utils/flowId'
import { computeLayout, TEXTURE_MATERIAL_CONSTANTS } from '@/utils/textureMaterialLayout'
import type { TextureMaterialItem } from '@/composables/flow/textureMaterial.types'
import { buildRuntimeWorkflowNodeData } from '@/utils/workflowNodeData'

/**
 * 打散 texture_material 容器：item 存的是轻量快照，落地前按 type 重新 hydrate。
 * 直接以 { id, type, position, data: buildRuntimeWorkflowNodeData(...) } 落地为独立节点；
 * 保持网格布局位置；下游 edge 由第一个节点（通常是 albedo）承接。
 */
export function scatterTextureMaterialNode(
  nodeId: string,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes, edges, emit, findNode, saveHistory } = deps
  const tmNode = findNode(nodeId)
  if (!tmNode || tmNode.type !== 'texture_material') return

  const items: TextureMaterialItem[] = tmNode.data?.items || []
  if (!items.length) {
    nodes.value = nodes.value.filter((n: any) => n.id !== nodeId)
    edges.value = edges.value.filter((e: any) => e.target !== nodeId && e.source !== nodeId)
    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    saveHistory()
    return
  }

  const layout = computeLayout(items.length)
  const { cols, gap } = layout

  const sourceEdges = edges.value.filter((e: any) => e.target === nodeId)
  const upstreamNodeId = sourceEdges[0]?.source || ''
  const downstreamTargets = collectDownstreamTargets(edges.value, nodeId)

  const batchPos = tmNode.position || { x: 0, y: 0 }
  const { ITEM_SIZE, HEADER_H, PADDING } = TEXTURE_MATERIAL_CONSTANTS
  const baseX = batchPos.x + PADDING
  const baseY = batchPos.y + PADDING + HEADER_H

  const newNodes: any[] = []
  const createdIds: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const r = Math.floor(i / cols)
    const c = i % cols
    newNodes.push({
      id: item.id,
      type: String(item.type || 'aigc_result'),
      position: { x: baseX + c * (ITEM_SIZE + gap), y: baseY + r * (ITEM_SIZE + gap) },
      data: buildRuntimeWorkflowNodeData(item.data || {}, String(item.type || 'aigc_result')),
      style: { width: `${ITEM_SIZE}px`, height: `${ITEM_SIZE}px` },
    })
    createdIds.push(item.id)
  }

  // 上游 edge 仅接到首个节点（通常为 albedo），避免重复拉多条同源线
  const newEdges: any[] = []
  if (upstreamNodeId && createdIds.length) {
    newEdges.push({
      id: createFlowId('edge'),
      source: upstreamNodeId,
      sourceHandle: 'image',
      target: createdIds[0],
      targetHandle: 'image',
    })
  }

  nodes.value = [...nodes.value.filter((n: any) => n.id !== nodeId), ...newNodes]
  edges.value = edges.value.filter((e: any) => e.target !== nodeId && e.source !== nodeId)
  edges.value = [...edges.value, ...newEdges]
  if (downstreamTargets.length && createdIds.length) {
    edges.value = [...edges.value, ...buildDownstreamEdges(createdIds, downstreamTargets)]
  }

  emit('update:modelNodes', nodes.value)
  emit('update:modelEdges', edges.value)
  saveHistory()
}
