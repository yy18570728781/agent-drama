import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { logFlowEdgeSnapshot } from './edgeDebug'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'
import type { FlowEdge, FlowNode } from './flowCore.types'
import type {
  GenerationPipelineDeps,
  GenerationRegenerateContext,
} from './useGenerationPipeline.types'
import type { useGenerationPipelineCommonActions } from './useGenerationPipelineCommonActions'
import type { useGenerationPipelineResultHandling } from './useGenerationPipelineResultHandling'

export type NodeDropDirection = 'right' | 'bottom'

type RegenerateHelpers = Pick<
  ReturnType<typeof useGenerationPipelineCommonActions>,
  'promptRegenerateCount' | 'ensureCanStartRegenerate'
> & {
  applyCompleteResult: ReturnType<
    typeof useGenerationPipelineResultHandling
  >['applyCompleteResult']
}

export function useGenerationPipelineRegenerate(
  deps: GenerationPipelineDeps,
  helpers: RegenerateHelpers,
) {
  const { promptRegenerateCount, ensureCanStartRegenerate, applyCompleteResult } = helpers

  function buildReferenceOrder(referenceItems: any[]): string[] {
    return referenceItems
      .map((item: any) => {
        const sourceNodeId = String(item?.sourceNodeId || item?.nodeId || '').trim()
        return sourceNodeId ? `node:${sourceNodeId}` : ''
      })
      .filter((item: string, index: number, list: string[]) => !!item && list.indexOf(item) === index)
  }

  async function triggerNodeRegenerate(
    nodeId: string,
    direction: NodeDropDirection = 'bottom',
  ): Promise<void> {
    const node = deps.nodes.value.find(n => n.id === nodeId)
    if (!node) {
      ElMessage.warning('未找到可重新生成的节点')
      return
    }

    const context = await deps.buildNodeRegenerateContext(node).catch(() => null)
    if (!context?.modelId || !context?.capability) {
      ElMessage.warning('未找到这张卡片对应的生成参数')
      return
    }

    const count = await promptRegenerateCount(context).catch(() => null)
    if (!count) return

    try {
      await ensureCanStartRegenerate(count)
      deps.markRegenerateSubmitCooldown(count)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      ElMessage.warning(message || '当前无法提交生成任务')
      return
    }

    // Determine the node type from capability
    const cap = context.capability
    const resolvedType = cap === 'video_generation' ? 'video_generation'
      : cap === 'audio_generation' ? 'audio_generation'
      : cap === 'model_generation' ? 'model_generation'
      : cap === 'text_generation' ? 'text_generation'
      : 'image_generation'

    // Create regenerate cards below the source node, using the shared horizontal spacing.
    const sourceX = node.position?.x || 0
    const sourceY = node.position?.y || 0
    const sourceWidth = node.dimensions?.width || parseInt(node.style?.width) || 320
    const sourceHeight = node.dimensions?.height || parseInt(node.style?.height) || 180
    const nodeGap = Math.max(64, Math.min(112, Math.round(sourceWidth * 0.22)))
    const step = sourceWidth + nodeGap
    const verticalGap = 60

    function getCardPosition(index: number): { x: number; y: number } {
      if (direction === 'right') {
        return { x: sourceX + sourceWidth + nodeGap + index * step, y: sourceY }
      }
      return { x: sourceX, y: sourceY + sourceHeight + verticalGap + index * (sourceHeight + 28) }
    }

    const cardIds: string[] = []
    const upstreamEdges = deps.edges.value.filter(e => e.target === nodeId && deps.isValidFlowEdge(e))
    const clonedUpstreamInputs = node.data?._upstreamInputs
      ? JSON.parse(JSON.stringify(node.data._upstreamInputs))
      : undefined
    const currentReferenceItems = await deps.resolveNodeReferenceItems(node).catch(() => [])
    const currentReferenceUrls = currentReferenceItems
      .map((item: any) => String(item?.url || '').trim())
      .filter((url: string) => !!url)
    const currentReferenceOrder = buildReferenceOrder(currentReferenceItems)
    const blockedUpstreamNodeIds = Array.isArray(node.data?._blockedUpstreamNodeIds)
      ? [...node.data._blockedUpstreamNodeIds]
      : undefined
    const typeDef = deps.nodeTypes?.find?.((item) => item.type === resolvedType) || {}
    const requestData = {
      capability: context.capability,
      mode: context.mode || 'standard',
      params: {
        ...(context.requestParams || {}),
        ...(currentReferenceUrls.length ? { file_urls: [...currentReferenceUrls] } : {}),
        model: context.modelId,
        ...(context.prompt ? { prompt: context.prompt } : {}),
      },
      ...(currentReferenceOrder.length ? { referenceOrder: [...currentReferenceOrder] } : {}),
    }
    const pbrChannel = String(
      node.data?.pbrChannel
      || inferTextureMaterialChannel({
        prompt: context.prompt,
        request: requestData,
        params: requestData.params,
      })
      || '',
    ).trim()
    const regenerateMediaType = context.genType === 'video'
      ? 'video'
      : context.genType === 'audio'
        ? 'audio'
        : context.genType === 'model'
          ? '3d_model'
          : context.genType === 'text'
            ? 'text'
            : 'image'
    for (let i = 0; i < count; i++) {
      const cardId = deps.createRuntimeId('regen')
      cardIds.push(cardId)
      const runtimeData = deps.buildRuntimeWorkflowNodeData({
        label: deps.buildResultCardLabel(cardId, context.model),
        prompt: context.prompt || '',
        request: requestData,
        ports: node.data?.ports ? JSON.parse(JSON.stringify(node.data.ports)) : undefined,
        model: context.modelId || context.model || '',
        ...(currentReferenceOrder.length ? { referenceOrder: [...currentReferenceOrder] } : {}),
        ...(pbrChannel ? { pbrChannel } : {}),
        _regenFromNodeId: nodeId,
      }, resolvedType, typeDef)
      const newCard: FlowNode = {
        id: cardId,
        type: resolvedType,
        position: getCardPosition(i),
        data: {
          ...runtimeData,
          model: context.modelId || context.model || '',
          _upstreamInputs: clonedUpstreamInputs ? JSON.parse(JSON.stringify(clonedUpstreamInputs)) : undefined,
          ...(currentReferenceOrder.length ? { referenceOrder: [...currentReferenceOrder] } : {}),
          _blockedUpstreamNodeIds: blockedUpstreamNodeIds ? [...blockedUpstreamNodeIds] : undefined,
          preview: '',
          imageUrl: '',
          videoUrl: '',
          audioUrl: '',
          url: '',
          recordId: '',
          nodeKind: undefined,
          status: 'waiting_submit',
          isGenerating: true,
          progress: 0,
          statusText: '等待提交...',
          _regenFromNodeId: nodeId,
        },
      }
      if (deps.fixedSizeTypes[resolvedType]) {
        newCard.style = { ...deps.fixedSizeTypes[resolvedType] }
      }
      deps.assignToGroupIfOverlapping(newCard, newCard.position.x, newCard.position.y)
      deps.nodes.value.push(newCard)
    }

    const newEdges: FlowEdge[] = []
    cardIds.forEach((cardId) => {
      upstreamEdges.forEach(edge => {
        const targetNode = deps.nodes.value.find((n) => n.id === cardId)
        if (!targetNode) return
        const cloned = deps.cloneIncomingEdgeToTarget(edge, targetNode)
        if (cloned) newEdges.push(cloned)
      })
    })

    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
    if (newEdges.length) {
      deps.edges.value = [...deps.edges.value, ...newEdges]
      deps.emit('update:modelEdges', deps.edges.value)
    }
    cardIds.forEach((cardId) => {
      logFlowEdgeSnapshot('regen card created', cardId, deps.nodes.value, deps.edges.value, {
        sourceNodeId: nodeId,
        upstreamEdgeCount: upstreamEdges.length,
      })
    })
    deps.propagateDataFlow()
    nextTick(() => {
      deps.updateNodeInternals([nodeId, ...cardIds])
      deps.syncNodeEdgeHandles(nodeId)
      cardIds.forEach((cardId) => deps.syncNodeEdgeHandles(cardId))
    })

    // Submit generation tasks for each card independently through the global queue.
    const requestParams = { ...(context.requestParams || {}) }
    delete requestParams.allow_generate_count
    const request = {
      capability: context.capability,
      mode: context.mode || 'standard',
      params: {
        ...requestParams,
        ...(currentReferenceUrls.length ? { file_urls: [...currentReferenceUrls] } : {}),
        model: context.modelId,
        ...(context.prompt ? { prompt: context.prompt } : {}),
      },
      ...(currentReferenceOrder.length ? { referenceOrder: [...currentReferenceOrder] } : {}),
    }

    for (let i = 0; i < count; i++) {
      const cardId = cardIds[i]
      deps.taskQueueStore.enqueueGeneration({
        request,
        prompt: context.prompt || '',
        modelInfo: context.modelId || context.model || '',
        modelDisplayName: context.model || context.modelId || '',
        genType: regenerateMediaType,
        flowNodeId: cardId,
        requestIndex: i,
        callbacks: {
          onCreated: (_recordId, taskId, result) => {
            patchRegenerateCardCreated(cardId, context, taskId, result)
          },
          onProgress: (_recordId, percent, event) => {
            patchRegenerateCardProgress(cardId, percent, event)
          },
          onCompleted: (_recordId, event) => {
            handleRegenerateComplete(cardId, nodeId, context, event)
          },
          onError: (_recordId, message) => {
            markRegenerateCardFailed(cardId, message || '生成失败')
          },
        },
      })
    }
  }

  function patchRegenerateCardCreated(
    cardId: string,
    context: GenerationRegenerateContext,
    taskId: string,
    result: Record<string, unknown>,
  ): void {
    const createdRecordId = String(result?.record_id || result?.aigc_record_id || '').trim()
    const cardIdx = deps.nodes.value.findIndex(n => n.id === cardId)
    if (cardIdx < 0) return
    const currentData = deps.nodes.value[cardIdx].data || {}
    const nextDisplayName = context.model || currentData.model || currentData.modelDisplayName || ''
    const nextData = {
      ...currentData,
      _activeTaskId: taskId,
      model: currentData.model || context.modelId || nextDisplayName,
    }
    const normalizedData = createdRecordId
      ? {
          ...deps.applyRecordIdToNodeData(nextData, createdRecordId),
          label: deps.buildResultCardLabel(createdRecordId, nextDisplayName),
        }
      : nextData
    deps.nodes.value[cardIdx] = {
      ...deps.nodes.value[cardIdx],
      data: {
        ...normalizedData,
        status: 'queued',
        isGenerating: true,
        progress: 0,
        statusText: '排队中...',
      },
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  function patchRegenerateCardProgress(
    cardId: string,
    percent: number,
    event: Record<string, unknown>,
  ): void {
    const idx = deps.nodes.value.findIndex(n => n.id === cardId)
    if (idx < 0) return
    const progressPercent = Number(percent ?? event?.percent)
    const progressMessage = String(event?.message || '').trim()
    deps.nodes.value[idx] = {
      ...deps.nodes.value[idx],
      data: {
        ...deps.nodes.value[idx].data,
        status: 'running',
        isGenerating: true,
        progress: Number.isFinite(progressPercent)
          ? Math.max(0, Math.min(100, Math.round(progressPercent)))
          : deps.nodes.value[idx].data?.progress || 0,
        ...(progressMessage ? { statusText: progressMessage } : {}),
      },
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  function handleRegenerateComplete(
    cardId: string,
    sourceNodeId: string,
    context: GenerationRegenerateContext,
    event: Record<string, unknown>,
  ): void {
    const completedRecordId = String(event?.record_id || event?.aigc_record_id || '').trim()
    if (completedRecordId) {
      const ridx = deps.nodes.value.findIndex(n => n.id === cardId)
      if (ridx >= 0) {
        deps.nodes.value[ridx] = {
          ...deps.nodes.value[ridx],
          data: {
            ...deps.nodes.value[ridx].data,
            model: deps.nodes.value[ridx].data?.model || context.modelId || '',
            recordId: completedRecordId,
            nodeKind: 'aigc_result',
          },
        }
        deps.nodes.value = [...deps.nodes.value]
        deps.emit('update:modelNodes', deps.nodes.value)
      }
    }

    logFlowEdgeSnapshot('before applyCompleteResult', cardId, deps.nodes.value, deps.edges.value, {
      sourceNodeId,
      completedRecordId,
    })
    Promise.resolve(applyCompleteResult(cardId, event))
      .then(() => {
        logFlowEdgeSnapshot('after applyCompleteResult', cardId, deps.nodes.value, deps.edges.value, {
          sourceNodeId,
          completedRecordId,
        })
        return Promise.resolve(deps.triggerNodeInferUpstream(cardId))
      })
      .then(() => {
        logFlowEdgeSnapshot('after triggerNodeInferUpstream', cardId, deps.nodes.value, deps.edges.value, {
          sourceNodeId,
          completedRecordId,
        })
      })
      .catch((error) => {
        console.warn('[FlowEdgeDebug] completion edge trace failed:', error)
      })
  }

  function markRegenerateCardFailed(cardId: string, message: string): void {
    const idx = deps.nodes.value.findIndex(n => n.id === cardId)
    if (idx < 0) return
    deps.nodes.value[idx] = {
      ...deps.nodes.value[idx],
      data: {
        ...deps.nodes.value[idx].data,
        status: 'failed',
        isGenerating: false,
        progress: undefined,
        failReason: String(message || '生成失败'),
      },
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  return { triggerNodeRegenerate }
}
