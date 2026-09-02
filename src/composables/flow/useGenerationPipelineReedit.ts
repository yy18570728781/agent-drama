import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import type { NodeDropDirection } from './useGenerationPipelineRegenerate'
import type { FlowEdge, FlowNode } from './flowCore.types'
import type { GenerationPipelineDeps } from './useGenerationPipeline.types'
import type { useGenerationPipelineCommonActions } from './useGenerationPipelineCommonActions'

type ReeditHelpers = Pick<
  ReturnType<typeof useGenerationPipelineCommonActions>,
  'focusReeditNode'
>

function resolveReeditTemplateNode(deps: any, sourceNode: any) {
  const sourceData = sourceNode?.data || {}
  const placeholderForNodeId = String(sourceData._resultPlaceholderForNodeId || '').trim()
  if (!sourceData._managedGenerationSlot || !placeholderForNodeId) {
    return sourceNode
  }
  return deps.nodes.value.find((node: any) => node.id === placeholderForNodeId) || sourceNode
}

async function focusNodeAfterUpstreamSync(deps: any, focusReeditNode: Function, node: any): Promise<void> {
  deps.propagateDataFlow?.()
  deps.emit?.('update:modelNodes', deps.nodes.value)
  await nextTick()
  deps.propagateDataFlow?.()
  await focusReeditNode(node)
}

export function useGenerationPipelineReedit(
  deps: GenerationPipelineDeps,
  helpers: ReeditHelpers,
) {
  const { focusReeditNode } = helpers

  function getRightPosition(sourceNode: any): { x: number; y: number } {
    const sx = sourceNode?.computedPosition?.x ?? sourceNode?.position?.x ?? 0
    const sy = sourceNode?.computedPosition?.y ?? sourceNode?.position?.y ?? 0
    const sw = sourceNode?.dimensions?.width || parseInt(sourceNode?.style?.width) || 320
    const gap = Math.max(64, Math.min(112, Math.round(sw * 0.22)))
    const siblings = deps.nodes.value.filter((n: any) => n.data?._reeditSourceNodeId === sourceNode?.id)
    return { x: sx + sw + gap, y: sy + siblings.length * 28 }
  }

  function resolveReeditPosition(sourceNode: any, direction: NodeDropDirection): { x: number; y: number } {
    if (direction === 'right') return getRightPosition(sourceNode)
    return deps.getDetachedCopyPosition(sourceNode)
  }

  async function triggerNodeReEdit(
    nodeId: string,
    direction: NodeDropDirection = 'bottom',
  ): Promise<void> {
    const sourceNode = deps.nodes.value.find(n => n.id === nodeId)
    if (!sourceNode) {
      ElMessage.warning('未找到节点')
      return
    }

    const sourceData = sourceNode.data || {}
    const templateNode = resolveReeditTemplateNode(deps, sourceNode)
    const templateData = templateNode?.data || sourceData
    const recordId = sourceData.recordId
    const isSourceGenerationNode = deps.canOpenGenerationPanel(templateNode) && !deps.isFileInputNodeType(templateNode.type)

    if (isSourceGenerationNode) {
      if (!deps.nodeHasGenerationContext(templateData)) {
        ElMessage.warning('当前生成卡片没有可复用的生成配置')
        return
      }

      const duplicatedNode = deps.createDetachedGenerationNode(templateNode)
      if (!duplicatedNode) {
        ElMessage.warning('未找到可重新编辑的生成卡片')
        return
      }
      duplicatedNode.position = resolveReeditPosition(sourceNode, direction)
      const hasIncomingEdges = deps.edges.value.some(e => e.target === duplicatedNode.id)
      if (!hasIncomingEdges) {
        const refs = await deps.resolveNodeReferenceItems(templateNode)
        if (refs.length) deps.connectReferenceItemsToNode(duplicatedNode.id, refs)
      }

      await focusNodeAfterUpstreamSync(deps, focusReeditNode, duplicatedNode)
      return
    }

    // 通过 recordId 调 API find 拿完整参数
    if (recordId) {
      try {
        const record = await deps.findTeamonesAigcRecord(recordId)
        if (record?.param) {
          const gp = record.param
          const params = deps.sanitizeWorkflowRequestParams(gp.params || {})
          const capability = gp.capability || ''
          const mode = gp.mode || 'standard'
          const prompt = params.prompt || record.prompt || ''
          const fileUrls = params.file_urls || []

          // 根据 capability 确定节点类型
          const nodeType = capability === 'video_generation' ? 'video_generation'
            : capability === 'audio_generation' ? 'audio_generation'
            : capability === 'model_generation' ? 'model_generation'
            : capability === 'text_generation' ? 'text_generation'
            : 'image_generation'

          const newNodeId = deps.createRuntimeId('node')
          const detachedPosition = resolveReeditPosition(sourceNode, direction)
          const requestData = {
            capability,
            mode,
            params: { ...params },
          }
          const clonedUpstreamInputs = sourceData._upstreamInputs
            ? JSON.parse(JSON.stringify(sourceData._upstreamInputs))
            : undefined
          const referenceOrder = deps.buildReferenceOrderFromNodeAndUrls(sourceNode, fileUrls)
          const typeDef = deps.nodeTypes?.find?.((item) => item.type === nodeType) || {}
          const runtimeData = deps.buildRuntimeWorkflowNodeData({
            label: deps.buildDetachedCopyLabel(sourceData.label, nodeType),
            prompt,
            request: requestData,
            ...(referenceOrder.length ? { referenceOrder } : {}),
            ports: sourceData.ports ? JSON.parse(JSON.stringify(sourceData.ports)) : undefined,
            _reeditSourceNodeId: sourceNode.id,
          }, nodeType, typeDef)
          const newNode: FlowNode = {
            id: newNodeId,
            type: nodeType,
            position: detachedPosition,
            data: {
              ...runtimeData,
              _upstreamInputs: clonedUpstreamInputs,
              ...(referenceOrder.length ? { referenceOrder: [...referenceOrder] } : {}),
              _blockedUpstreamNodeIds: Array.isArray(sourceData._blockedUpstreamNodeIds)
                ? [...sourceData._blockedUpstreamNodeIds]
                : undefined,
              _reeditSourceNodeId: sourceNode.id,
            },
          }

          if (deps.fixedSizeTypes[nodeType]) {
            newNode.style = { ...deps.fixedSizeTypes[nodeType] }
          } else if (sourceNode.style) {
            newNode.style = { ...sourceNode.style }
          }

          deps.assignToGroupIfOverlapping(newNode, newNode.position.x, newNode.position.y)
          const incomingEdges = deps.edges.value.filter(edge => edge.target === sourceNode.id && deps.isValidFlowEdge(edge))
          const clonedIncomingEdges: FlowEdge[] = incomingEdges
            .map((edge) => ({
              ...edge,
              id: deps.createEdgeId('e'),
              target: newNodeId,
            }))
            .filter(deps.isValidFlowEdge)
          deps.nodes.value = [...deps.nodes.value, newNode]
          deps.emit('update:modelNodes', deps.nodes.value)
          if (clonedIncomingEdges.length) {
            deps.edges.value = [...deps.edges.value, ...clonedIncomingEdges]
            deps.emit('update:modelEdges', deps.edges.value)
          } else {
            const refs = await deps.resolveNodeReferenceItems(sourceNode)
            if (refs.length) deps.connectReferenceItemsToNode(newNodeId, refs)
          }
          nextTick(() => {
            deps.updateNodeInternals([sourceNode.id, newNodeId])
            deps.syncNodeEdgeHandles(sourceNode.id)
            deps.syncNodeEdgeHandles(newNodeId)
          })
          setTimeout(deps.saveHistory, 50)
          await focusNodeAfterUpstreamSync(deps, focusReeditNode, newNode)
          return
        }
      } catch (error) {
        console.warn('[FlowCanvas] re-edit from aigc record failed:', error)
      }
    }

    // 回退：从节点自身数据复制
    if (!deps.nodeHasGenerationContext(templateNode.data)) {
      ElMessage.warning('当前节点没有可复用的生成配置')
      return
    }

    const node = deps.createDetachedGenerationNode(templateNode)
    if (!node) {
      ElMessage.warning('未找到可重新编辑的节点')
      return
    }
    node.position = resolveReeditPosition(sourceNode, direction)
    const hasIncomingEdges = deps.edges.value.some(e => e.target === node.id)
    if (!hasIncomingEdges) {
      const refs = await deps.resolveNodeReferenceItems(sourceNode)
      if (refs.length) deps.connectReferenceItemsToNode(node.id, refs)
    }
    await focusNodeAfterUpstreamSync(deps, focusReeditNode, node)
  }

  return { triggerNodeReEdit }
}
