import { ref, provide, computed, nextTick } from 'vue'
import type { Ref } from 'vue'
import type { GridSelectionResult } from '@/composables/flow/useImageGridSelection'
import type { NodeDropDirection } from '@/composables/flow/useGenerationPipelineRegenerate'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'

export interface FlowProvidesDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  viewport: Ref<any>
  models: Ref<any[]>
  capabilityPorts: Ref<any>
  renderableMediaNodeIds: Ref<Set<string>>
  thumbRenderableMediaNodeIds: Ref<Set<string>>
  fullRenderNodeIds: Ref<Set<string>>
  isLightweightNodeMode: Ref<boolean>
  isUltraLightCanvasMode: Ref<boolean>
  isConnecting: Ref<boolean>
  isInteractionEffectsSuppressed: Ref<boolean>
  sourceConnectionMode: Ref<string>
  sourceConnectionNodeIds: Ref<string[]>
  selectedNodes: Ref<any[]>
  selectedPanelNode: Ref<any>
  findNode: (id: string) => any
  propagateDataFlow: () => void
  saveHistory: () => void
  handleCompareSelected: () => void
  openEditorForNode: (opts: any) => void
  openDetailModal: (opts: any) => void
  startGroupConnectionFromZone: (id: string, evt: any, handleId?: string) => void
  setSourceConnectionHighlight: (ids: string[], mode?: string) => void
  clearSourceConnectionHighlight: () => void
  collectDescendantNodeIds: (parentId: string) => Set<string>
  captureExpandedGroupFrame: (node: any) => void
  applyCollapsedGroupFrame: (node: any) => void
  restoreExpandedGroupFrame: (node: any) => boolean
  layoutGridChildren: (groupId: string) => boolean
  resizeGroupToFitChildren: (parentId: string, opts?: any) => void
  syncCollapsedGroupVisibility: () => void
  updateEdgeStyles: () => void
  scheduleRenderableMediaNodeIdsUpdate: () => void
  updateNodeInternals: (ids: string[]) => void
  syncNodeEdgeHandles: (nodeId: string) => void
  triggerNodeReEdit: (nodeId: string, direction?: NodeDropDirection) => Promise<void>
  triggerNodeRegenerate: (nodeId: string, direction?: NodeDropDirection) => Promise<void>
  triggerNodeInferUpstream: (nodeId: string) => void
  repairResultNodeById: (nodeId: string) => Promise<any>
  toggleNodeResultFavorite: (nodeId: string) => Promise<void>
  deleteNodeResultRecord: (nodeId: string) => Promise<void>
  createConnectedAssetNode: (sourceNodeId: string, options: any) => any
  prepareNodeAssetDrag: (nodeId: string) => void
  beginNodeAssetDrag: (event: DragEvent, nodeId: string) => boolean
  endNodeAssetDrag: (event: DragEvent, nodeId: string) => void
  scatterBatchNodeById: (nodeId: string) => void
  triggerGridSplitBatch: (genNodeId: string) => boolean
  handleImageGridSplit: (nodeId: string, result: GridSelectionResult) => Promise<void>
  clearGenerationPanel: (nodeId?: string) => void
  buildPortsForNode: typeof buildPortsForNodeContract
  emit: (event: string, ...args: any[]) => void
}

export function useFlowProvides(deps: FlowProvidesDeps) {
  const groupPresetColors = ref([
    'rgba(39, 39, 42, 0.5)',
    'rgba(49, 46, 129, 0.5)',
    'rgba(6, 78, 59, 0.5)',
    'rgba(159, 18, 57, 0.5)',
    'rgba(120, 53, 15, 0.5)',
  ])
  provide('groupPresetColors', groupPresetColors)

  provide('flowUpdateGroupColor', (groupId: string, newColor: string) => {
    const targetGroupNode = deps.findNode(groupId)
    if (!targetGroupNode || targetGroupNode.type !== 'groupNode') return
    if (!targetGroupNode.data) targetGroupNode.data = {}
    targetGroupNode.data.bgColor = newColor
  })

  provide('flowModels', deps.models)
  provide('flowNodes', deps.nodes)
  provide('flowEdges', deps.edges)
  provide('flowCapabilityPorts', deps.capabilityPorts)
  provide('flowRenderableMediaNodeIds', deps.renderableMediaNodeIds)
  provide('flowThumbRenderableMediaNodeIds', deps.thumbRenderableMediaNodeIds)
  provide('flowFullRenderNodeIds', deps.fullRenderNodeIds)
  provide('flowViewportZoom', computed(() => Number(deps.viewport.value?.zoom || 1)))
  provide('flowLightweightNodeMode', deps.isLightweightNodeMode)
  provide('flowUltraLightNodeMode', deps.isUltraLightCanvasMode)
  provide('flowHasMultiSelection', computed(() => deps.selectedNodes.value.length > 1))
  provide('flowCompareSelected', deps.handleCompareSelected)
  provide('flowSaveHistory', deps.saveHistory)
  provide('flowPropagateDataFlow', deps.propagateDataFlow)
  provide('flowOnParamChange', (nodeId: string, paramName: string, value: any) => {
    deps.emit('param-change', { nodeId, paramName, value })
  })

  provide('flowOpenDetail', (data: any) => {
    const node = data.nodeId ? deps.nodes.value.find((n: any) => n.id === data.nodeId) : null
    const mediaType = data.mediaType || node?.data?.mediaType || ''
    deps.openEditorForNode({
      nodeId: data.nodeId,
      imageUrl: data.imageUrl,
      nodeType: mediaType === 'video' ? 'video_input' : 'image_input',
      mediaType,
      referenceSourceNodeId: data.referenceSourceNodeId || '',
    })
  })
  provide('flowOpenDetailModal', deps.openDetailModal)

  provide('flowStartGroupConnection', (groupNodeId: string, event: any, handleId?: string) => {
    deps.startGroupConnectionFromZone(groupNodeId, event, handleId)
  })
  provide('flowSetGroupConnectionIntent', (groupNodeId: string) => {
    if (deps.isConnecting.value || deps.isInteractionEffectsSuppressed.value || !groupNodeId) return
    deps.setSourceConnectionHighlight([groupNodeId], 'group')
  })
  provide('flowClearGroupConnectionIntent', (groupNodeId: string) => {
    if (deps.isConnecting.value || deps.isInteractionEffectsSuppressed.value || deps.sourceConnectionMode.value !== 'group') return
    if (groupNodeId && deps.sourceConnectionNodeIds.value.length === 1 && deps.sourceConnectionNodeIds.value[0] !== groupNodeId) return
    deps.clearSourceConnectionHighlight()
  })
  provide('flowToggleGroupCollapse', (groupNodeId: string) => {
    const groupNode = deps.findNode(groupNodeId)
    if (!groupNode || groupNode.type !== 'groupNode') return
    if (!groupNode.data) groupNode.data = {}
    const descendantIds = Array.from(deps.collectDescendantNodeIds(groupNode.id))
    const nextCollapsed = !groupNode.data.collapsed
    if (nextCollapsed) deps.captureExpandedGroupFrame(groupNode)
    groupNode.data.collapsed = nextCollapsed
    if (groupNode.data.collapsed) {
      deps.applyCollapsedGroupFrame(groupNode)
    } else {
      if (!deps.restoreExpandedGroupFrame(groupNode)) {
        deps.resizeGroupToFitChildren(groupNode.id, { preservePosition: true })
      }
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.syncCollapsedGroupVisibility()
    deps.updateEdgeStyles()
    deps.scheduleRenderableMediaNodeIdsUpdate()
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
    nextTick(() => {
      deps.updateNodeInternals([groupNode.id, ...descendantIds])
      descendantIds.forEach((nodeId) => deps.syncNodeEdgeHandles(nodeId))
      deps.scheduleRenderableMediaNodeIdsUpdate()
    })
    setTimeout(() => deps.saveHistory(), 50)
  })

  provide('flowToggleGroupLock', (groupNodeId: string) => {
    const groupNode = deps.findNode(groupNodeId)
    if (!groupNode || groupNode.type !== 'groupNode') return
    if (!groupNode.data) groupNode.data = {}
    groupNode.data.locked = !groupNode.data.locked
    deps.emit('update:modelNodes', deps.nodes.value)
    setTimeout(() => deps.saveHistory(), 50)
  })

  // grid 模式下根据 gridSplit/gridOrder 重排子节点位置并设置组大小
  provide('flowLayoutGridChildren', (groupNodeId: string) => {
    const ok = deps.layoutGridChildren(groupNodeId)
    if (ok) {
      deps.emit('update:modelNodes', deps.nodes.value)
      nextTick(() => deps.updateNodeInternals([groupNodeId]))
    }
    return ok
  })

  provide('flowReEditNode', deps.triggerNodeReEdit)
  provide('flowRegenerateNode', deps.triggerNodeRegenerate)
  provide('flowInferUpstreamNode', (nodeId: string) => { deps.triggerNodeInferUpstream(nodeId) })
  provide('flowRepairResultNode', (nodeId: string) => deps.repairResultNodeById(nodeId))
  provide('flowToggleResultFavorite', (nodeId: string) => deps.toggleNodeResultFavorite(nodeId))
  provide('flowDeleteResultRecord', (nodeId: string) => deps.deleteNodeResultRecord(nodeId))
  provide('flowCreateConnectedAssetNode', (sourceNodeId: string, options: any) => deps.createConnectedAssetNode(sourceNodeId, options))
  provide('flowPrepareNodeAssetDrag', (nodeId: string) => deps.prepareNodeAssetDrag(nodeId))
  provide('flowBeginNodeAssetDrag', (event: DragEvent, nodeId: string) => deps.beginNodeAssetDrag(event, nodeId))
  provide('flowEndNodeAssetDrag', (event: DragEvent, nodeId: string) => deps.endNodeAssetDrag(event, nodeId))
  provide('flowScatterBatchNode', (nodeId: string) => deps.scatterBatchNodeById(nodeId))
  provide('flowTriggerGridSplitBatch', (genNodeId: string) => deps.triggerGridSplitBatch(genNodeId))
  provide('flowHandleImageGridSplit', deps.handleImageGridSplit)

  provide('flowRemoveNode', (nodeId: string) => {
    if (deps.selectedPanelNode.value?.id === nodeId) {
      deps.clearGenerationPanel(nodeId)
    }
    deps.nodes.value = deps.nodes.value.filter((n: any) => n.id !== nodeId)
    deps.edges.value = deps.edges.value.filter((e: any) => e.source !== nodeId && e.target !== nodeId)
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
  })

  provide('flowDissolveSubgraph', (payload: any) => {
    if (!payload?.nodeId || !payload?.subgraphId) return
    deps.emit('dissolve-subgraph', {
      nodeId: payload.nodeId,
      subgraphId: payload.subgraphId,
      label: payload.label || '子图',
    })
  })

  provide('flowOpenSubgraph', (payload: any) => {
    if (!payload?.subgraphId) return
    deps.emit('open-subgraph', { nodeId: payload.nodeId, subgraphId: payload.subgraphId, label: payload.label || '子图' })
  })

  provide('flowRenameSubgraph', (payload: any) => {
    if (!payload?.nodeId || !payload?.subgraphId) return
    deps.emit('rename-subgraph', payload)
  })

  provide('flowConvertNode', (nodeId: string, newType: string, newDataFields: any, { mergeOnly = false } = {}) => {
    const idx = deps.nodes.value.findIndex((n: any) => n.id === nodeId)
    if (idx < 0) return
    const old = deps.nodes.value[idx]
    const oldData = old.data || {}
    const nextType = 'file_input'
    const nextMediaType = newDataFields?.mediaType || oldData.mediaType || 'image'

    let updatedData
    if (mergeOnly) {
      updatedData = { ...oldData, ...newDataFields, ...(nextType === 'file_input' ? { mediaType: nextMediaType } : {}) }
    } else {
      for (const k of ['imageUrl', 'videoUrl', 'audioUrl']) {
        if (oldData[k]?.startsWith('blob:')) URL.revokeObjectURL(oldData[k])
      }
      const clean = { ...oldData }
      delete clean.imageUrl
      delete clean.videoUrl
      delete clean.audioUrl
      delete clean.mediaType
      delete clean.content
      updatedData = {
        ...clean,
        ...newDataFields,
        ...(nextType === 'file_input' ? { mediaType: nextMediaType } : {}),
        ...(nextMediaType === 'image' ? { label: '图片上传' } : {}),
      }
    }

    updatedData.ports = deps.buildPortsForNode(nextType, nextMediaType)

    const updated = { ...old, type: nextType, data: updatedData }
    deps.nodes.value = [
      ...deps.nodes.value.slice(0, idx),
      updated,
      ...deps.nodes.value.slice(idx + 1),
    ]
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
    nextTick(() => {
      deps.updateNodeInternals([nodeId])
      deps.syncNodeEdgeHandles(nodeId)
    })
  })
}
