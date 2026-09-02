import { handleBatchGridGenerationEvent, canBeBatchGridGenerationEvent } from '@/composables/flow/useBatchGridGenerationProcessor'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import {
  patchDataOnCreated,
  patchDataOnProgress,
  patchDataOnError,
} from '@/composables/flow/generationNodeDataPatcher'
import { useOrdinaryGenerationTaskFallback } from './useOrdinaryGenerationTaskFallback'
import type {
  GenerationPipelineDeps,
  GenerationPipelinePayload,
} from './useGenerationPipeline.types'
import type { useGenerationPipelineResultHandling } from './useGenerationPipelineResultHandling'

type EventHandlingHelpers = Pick<
  ReturnType<typeof useGenerationPipelineResultHandling>,
  | 'applyRecordToExistingResultNode'
  | 'applyCompleteResultToExistingCard'
  | 'replaceGeneratingNodesWithResultCards'
  | 'applyCompleteResult'
>

export function useGenerationPipelineEventHandling(
  deps: GenerationPipelineDeps,
  helpers: EventHandlingHelpers,
) {
  const {
    applyRecordToExistingResultNode,
    applyCompleteResultToExistingCard,
    replaceGeneratingNodesWithResultCards,
    applyCompleteResult,
  } = helpers
  const ordinaryTaskFallback = useOrdinaryGenerationTaskFallback(deps, {
    applyRecordToExistingResultNode,
  })

  function logPipelineEvent(stage: string, payload: any): void {
    const type = String(payload?.type || '').trim()
    if (type && !['complete', 'error', 'aigc-record-ready'].includes(type)) return
    appendDebugFileLog('flow-event', stage, {
      type,
      nodeId: payload?.nodeId,
      taskId: payload?.taskId || payload?.result?.taskId || payload?.result?.task_id,
      pbrBatchId: payload?._pbrBatchId || payload?.result?._pbrBatchId || payload?.batchInfo?._pbrBatchId || payload?.task?._pbrBatchId,
      batchGridBatchId: payload?._batchGridBatchId || payload?.result?._batchGridBatchId || payload?.task?._batchGridBatchId,
    })
  }

  async function normalizeCompletedNode(nodeId: string): Promise<void> {
    if (!nodeId) return
    await deps.normalizeSingleResultNodeById?.(nodeId)
  }

  function hasResolvedResult(data: any): boolean {
    if (typeof deps.nodeHasResolvedResult === 'function') return deps.nodeHasResolvedResult(data)
    return !!(
      data?.recordId
      || data?.url
      || data?.preview
      || data?.imageUrl
      || data?.videoUrl
      || data?.audioUrl
    )
  }

  function ensureIndexedGenerationSlot(nodeId: string, requestIndex: number): any {
    if (!nodeId || requestIndex < 0) return null
    const findSlot = () => deps.getGenerationSlotNodes?.(nodeId)
      ?.find((node: any) => Number(node?.data?._requestIndex) === requestIndex)
    const currentSlot = findSlot()
    if (currentSlot) return currentSlot
    const sourceNode = deps.nodes.value.find((node: any) => node.id === nodeId)
    const sourceData = sourceNode?.data || {}
    const hadResultsBefore = sourceData._hadResultsBefore === true || hasResolvedResult(sourceData)
    deps.createGeneratingResultPlaceholders?.(nodeId, requestIndex + 1, hadResultsBefore)
    return findSlot()
  }

  function findIndexedGenerationSlot(nodeId: string, requestIndex: number): any {
    if (!nodeId || requestIndex < 0) return null
    return deps.getGenerationSlotNodes?.(nodeId)
      ?.find((node: any) => Number(node?.data?._requestIndex) === requestIndex) || null
  }

  async function handleGenerate(payload: GenerationPipelinePayload): Promise<void> {
    logPipelineEvent('in', payload)
    if (payload?.type === 'state-change') {
      const directNodeId = String(payload?.nodeId || '').trim()
      if (!directNodeId) return
      deps.updateWorkflowNodeState(directNodeId, payload.state)
      return
    }

    if (payload?.type === 'queue-bind' && payload?._batchGridBatchId) {
      await handleBatchGridGenerationEvent(payload, deps)
      return
    }

    if (payload?.type === 'queue-bind' && !payload?._pbrBatchId) return

    // 同步预检：只有可能是 batch-grid 事件才 await，避免对普通事件让出微任务导致 queue-bind 插队。
    if (canBeBatchGridGenerationEvent(payload, deps.nodes.value)) {
      if (await handleBatchGridGenerationEvent(payload, deps)) {
        if (String(payload?.type || '') === 'start') {
          appendDebugFileLog('flow-route', 'start-intercepted-by-batch-grid', {
            nodeId: payload?.nodeId,
            pbrBatchId: payload?.task?._pbrBatchId || payload?._pbrBatchId,
          })
        }
        return
      }
    }
    // 优先使用 payload 中的 nodeId；如果缺失或面板已切换，则按 taskId 回找对应节点
    let nodeId = deps.resolveGenerateTargetNodeId(payload)
    if (!nodeId) {
      return
    }
    // 溯源到原始节点，避免在占位节点上再建占位节点
    const eventSourceNodeId = nodeId
    const payloadType = payload?.type
    if (payloadType !== 'start' && deps._activeGenerationTargetBySource.has(nodeId)) {
      const mappedNodeId = deps._activeGenerationTargetBySource.get(nodeId)
      if (mappedNodeId && deps.nodes.value.some(node => node.id === mappedNodeId)) {
        nodeId = mappedNodeId
      }
    }
    const originalNodeId = deps.resolveOriginalNodeId(nodeId)
    if (originalNodeId !== nodeId) {
      nodeId = originalNodeId
    }

    if (payloadType !== 'start') {
      const currentNode = deps.nodes.value.find((node) => node.id === nodeId)
      const activeTargetNodeId = deps.getActiveGenerationTargetNodeId(eventSourceNodeId) || deps.getActiveGenerationTargetNodeId(nodeId)
      if (
        activeTargetNodeId
        && activeTargetNodeId !== nodeId
        && !currentNode?.data?._resultPlaceholderForNodeId
      ) {
        nodeId = activeTargetNodeId
      }
    }

    const { type, result, task } = payload
    if (type !== 'progress') {
      appendDebugFileLog('flow-route', 'resolved-target', {
        type,
        inputNodeId: payload?.nodeId,
        eventSourceNodeId,
        nodeId,
        taskId: payload?.taskId || payload?.result?.taskId || payload?.result?.task_id,
      })
    }

    // 在 start 时记住节点是否有结果（模块级变量，不受节点数据影响）
    if (type === 'start') {
      const node = deps.nodes.value.find(n => n.id === nodeId)
      const startIdx = deps.nodes.value.findIndex((n) => n.id === nodeId)
      if (startIdx >= 0) {
        const currentData = deps.nodes.value[startIdx].data || {}
        const displayName = deps.getNodeStoredModelDisplayName(currentData) || String(task?.model || task?.modelId || task?.modelDisplayName || '').trim()
        if (displayName && !currentData.model) {
          deps.nodes.value[startIdx] = {
            ...deps.nodes.value[startIdx],
            data: {
              ...currentData,
              model: currentData.model || displayName,
            },
          }
          deps.nodes.value = [...deps.nodes.value]
          deps.emit('update:modelNodes', deps.nodes.value)
        }
      }
      if (deps.hasNodeResultUrl(node)) {
        const targetNodeId = deps.createGenerationTargetForExistingResult(node)
        if (targetNodeId && targetNodeId !== nodeId) {
          deps._activeGenerationTargetBySource.set(eventSourceNodeId, targetNodeId)
          nodeId = targetNodeId
        }
      }
      const previousSession = deps._activeGenerationSessionBySource.get(eventSourceNodeId)
      const incomingTotal = Number(payload?.task?.totalExpectedItems || 1) || 1
      const sessionTotal = Math.max(incomingTotal, Number(previousSession?.totalExpectedItems || 0))
      deps._activeGenerationSessionBySource.set(eventSourceNodeId, {
        targetNodeId: nodeId,
        totalExpectedItems: sessionTotal,
        completedCount: 0,
      })
    }

    if (type === 'start') {
      const node = deps.nodes.value.find(n => n.id === nodeId)
      const hadResult = !!(node?.data?.preview || node?.data?.imageUrl || node?.data?.videoUrl || node?.data?.audioUrl)
      deps._pendingRegenHadResult.set(nodeId, hadResult)
      const hadRecordId = !!node?.data?.recordId
      deps._pendingRegenHadRecordId.set(nodeId, hadRecordId)
    }

    if (type === 'reference-change') {
      deps.ensureReferenceCardsForNode(nodeId, payload.references)
      return
    }

    if (type === 'created') {
      const taskId = String(payload.taskId || '').trim()
      const createdRecordId = payload.recordId == null ? '' : String(payload.recordId)
      const requestIndex = typeof payload?._requestIndex === 'number' ? payload._requestIndex : -1
      if (createdRecordId && requestIndex < 0) {
        const sourceIdx = deps.nodes.value.findIndex((n) => n.id === nodeId)
        if (sourceIdx >= 0) {
          const currentData = deps.nodes.value[sourceIdx].data || {}
          deps.nodes.value[sourceIdx] = {
            ...deps.nodes.value[sourceIdx],
            data: patchDataOnCreated(currentData, payload, deps, { nodeId }),
          }
        }
      }
      let assignedSlotId = ''
      if (requestIndex >= 0) {
        ensureIndexedGenerationSlot(nodeId, requestIndex)
        assignedSlotId = deps.assignTaskToIndexedGenerationSlot?.(nodeId, taskId, createdRecordId, requestIndex) || ''
        if (!assignedSlotId) return
      }
      if (requestIndex < 0 && !assignedSlotId && deps.canUseSourceNodeAsGenerationSlot(nodeId, taskId)) {
        assignedSlotId = deps.registerSourceNodeAsGenerationSlot(nodeId, taskId, createdRecordId)
      } else if (requestIndex < 0 && !assignedSlotId) {
        assignedSlotId = deps.assignTaskToGenerationSlot(nodeId, taskId, createdRecordId)
      }
      if (!assignedSlotId) return
      const slotIdx = deps.nodes.value.findIndex((n) => n.id === assignedSlotId)
      const slotPrompt = String(payload?.prompt || '').trim()
      if (slotIdx >= 0) {
        const currentData = deps.nodes.value[slotIdx].data || {}
        const createdData = patchDataOnCreated(currentData, payload, deps, { nodeId: assignedSlotId })
        const displayName = deps.resolveNodeModelDisplayName(assignedSlotId, currentData) || String(payload.model || payload.modelId || payload.modelDisplayName || '').trim()
        deps.nodes.value[slotIdx] = {
          ...deps.nodes.value[slotIdx],
          data: {
            ...createdData,
            ...(displayName ? { model: displayName } : {}),
            ...(createdRecordId && displayName ? { label: deps.buildResultCardLabel(createdRecordId, displayName) } : {}),
            ...(slotPrompt ? { prompt: slotPrompt } : {}),
          },
        }
      }
      deps.bindGenerationTaskToSlot(taskId, assignedSlotId)
      ordinaryTaskFallback.trackOrdinaryTaskFallback({
        taskId,
        slotNodeId: assignedSlotId,
      })
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
      return
    }

    if (type === 'aigc-record-ready') {
      const recordId = deps.extractEventRecordId(payload)
      if (!recordId) return
      const requestIndex = typeof payload?._requestIndex === 'number' ? payload._requestIndex : -1
      const indexedSlot = requestIndex >= 0 ? ensureIndexedGenerationSlot(nodeId, requestIndex) : null
      const targetNodeId = requestIndex >= 0 ? indexedSlot?.id : nodeId
      if (!targetNodeId) return
      const ridx = deps.nodes.value.findIndex((n) => n.id === targetNodeId)
      if (ridx < 0) return
      const nextData = deps.applyRecordIdToNodeData(deps.nodes.value[ridx].data || {}, recordId)
      deps.nodes.value[ridx] = {
        ...deps.nodes.value[ridx],
        data: deps.attachTaskIdToGenerationState({
          ...nextData,
          ...(payload?.taskId ? { taskId: String(payload.taskId), _activeTaskId: String(payload.taskId) } : {}),
          nodeKind: 'aigc_result',
        }, payload?.taskId == null ? undefined : String(payload.taskId)),
      }
      if (payload?.taskId) ordinaryTaskFallback.markOrdinaryTaskSignal(String(payload.taskId))
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
      return
    }

    // 直接在 FlowCanvas 内部更新节点数据（FlowCanvas.nodes 始终与 VueFlow 同步，
    // 而 FlowView.nodes 可能缺少拖入的新节点），更新后同步给 FlowView
    const idx = deps.nodes.value.findIndex((n) => n.id === nodeId)
    const missingSourceRequestIndex = typeof payload?._requestIndex === 'number' ? payload._requestIndex : -1
    const existingSlotsForMissingSource = deps.getGenerationSlotNodes?.(nodeId) || []
    const hasIndexedSlotForMissingSource = missingSourceRequestIndex >= 0
      && deps.getGenerationSlotNodes?.(nodeId)?.some((node: any) => Number(node?.data?._requestIndex) === missingSourceRequestIndex)
    const hasAnySlotForMissingSource = existingSlotsForMissingSource.length > 0
    if (idx < 0 && payload?.type === 'start' && hasAnySlotForMissingSource) {
      appendDebugFileLog('flow-route', 'missing-source-start-allowed', {
        nodeId,
        slotCount: existingSlotsForMissingSource.length,
      })
    } else if (idx < 0 && !hasIndexedSlotForMissingSource) {
      appendDebugFileLog('flow-route', 'drop-missing-source', {
        type: payload?.type,
        nodeId,
        requestIndex: missingSourceRequestIndex,
        taskId: payload?.taskId,
      })
      // 事件被丢弃：源节点已删且找不到匹配的 indexed slot。保留一条精简日志便于排查。
      // eslint-disable-next-line no-console
      console.warn('[flow] event dropped: source and slots missing', {
        type: payload?.type,
        nodeId,
        requestIndex: missingSourceRequestIndex,
        taskId: payload?.taskId,
      })
      return
    }

    if (type === 'prepare') {
      const sourceNode = deps.nodes.value[idx]
      const incomingTotal = Number(task?.totalExpectedItems || 1) || 1
      const existingSlotCount = (deps.getGenerationSlotNodes?.(nodeId) || [])
        .filter((slot: any) => slot?.id !== nodeId)
        .length
      const totalExpectedItems = Math.max(incomingTotal, existingSlotCount)
      const isDetachedReeditNode = Boolean(sourceNode?.data?._reeditSourceNodeId)
      const shouldRemoveSourceNode = isDetachedReeditNode
        || (
          sourceNode?.type !== 'batch_grid'
          && sourceNode?.type !== 'texture_material'
        )
      const nodeData = sourceNode?.data || {}
      const hadResultsBefore = !!(
        nodeData.preview
        || nodeData.imageUrl
        || nodeData.videoUrl
        || nodeData.audioUrl
      )
      if (shouldRemoveSourceNode || hadResultsBefore) {
        const sourceNodeIds = Array.isArray(task?.sourceNodeIds)
          ? task.sourceNodeIds.map((item: any) => String(item || '').trim()).filter(Boolean)
          : []
        const pbrChannels = Array.isArray(task?._textureMaterialChannels)
          ? task._textureMaterialChannels.map((item: any) => String(item || '').trim())
          : []
        deps.createGeneratingResultPlaceholders(
          nodeId,
          totalExpectedItems,
          hadResultsBefore,
          shouldRemoveSourceNode,
          sourceNodeIds,
          pbrChannels,
        )
      }
      return
    }

    if (type === 'start') {
      const sourceNode = idx >= 0 ? deps.nodes.value[idx] : null
      const prevTotal = sourceNode?.data?._totalExpectedItems
      const prevCount = sourceNode?.data?._multiResultCount || 0
      const incomingTotal = Number(task?.totalExpectedItems || 1) || 1
      const existingSlotCount = (deps.getGenerationSlotNodes?.(nodeId) || [])
        .filter((slot: any) => slot?.id !== nodeId)
        .length
      const totalExpectedItems = Math.max(incomingTotal, existingSlotCount)
      // 新一轮生成 = 从没设过 _totalExpectedItems，或上一批已完成（count >= total）
      const isNewGeneration = prevTotal == null || prevCount >= prevTotal

      if (isNewGeneration) {
        // 清除上一轮的多结果节点（只清理仍在生成中的，保留已完成的结果）
        const oldExtraIds = deps.nodes.value
          .filter(n => {
            const data = n.data || {}
            const belongsToNode = data._multiResultForNodeId === nodeId || data._generatedFromNodeId === nodeId || data._resultPlaceholderForNodeId === nodeId
            const managedIndexedSlot = data._resultPlaceholderForNodeId === nodeId && Number.isFinite(Number(data._requestIndex))
            const hasResult = hasResolvedResult(data)
            const isPendingSlot = data.status === 'running' || data.status === 'queued' || data.status === 'waiting_submit' || data.isGenerating
            return belongsToNode && !managedIndexedSlot && isPendingSlot && !hasResult
          })
          .map(n => n.id)
        if (oldExtraIds.length) {
          deps.nodes.value = deps.nodes.value.filter(n => !oldExtraIds.includes(n.id))
          deps.edges.value = deps.edges.value.filter(e => !oldExtraIds.includes(e.source) && !oldExtraIds.includes(e.target))
          deps.emit('update:modelEdges', deps.edges.value)
        }
      }

      const startIdx = deps.nodes.value.findIndex((n) => n.id === nodeId)
      if (startIdx < 0) {
        if (existingSlotsForMissingSource.length) {
          deps.addLog('info', `节点 ${nodeId} 开始生成...`, nodeId)
        }
        return
      }
      deps.addLog('info', `节点 ${nodeId} 开始生成...`, nodeId)
      // 在 start 时记录节点是否已有结果（用于 complete 时决定是否创建新卡片）
      const nodeData = deps.nodes.value[startIdx]?.data || {}
      const hadResultsBefore = !!(
        nodeData.preview
        || nodeData.imageUrl
        || nodeData.videoUrl
        || nodeData.audioUrl
      )
      deps.nodes.value[startIdx] = {
        ...deps.nodes.value[startIdx],
        data: deps.attachTaskIdToGenerationState({
          ...deps.nodes.value[startIdx].data,
          ...(payload?.taskId ? { taskId: String(payload.taskId), _activeTaskId: String(payload.taskId) } : {}),
          _hadResultsBefore: hadResultsBefore,
          ...(isNewGeneration ? { _multiResultCount: 0 } : {}),
          ...(task?.totalExpectedItems != null ? { _totalExpectedItems: totalExpectedItems } : {}),
        }, payload?.taskId == null ? undefined : String(payload.taskId)),
      }
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
      return
    }

    if (type === 'progress') {
      const taskId = String(payload?.taskId || '').trim()
      const requestIndex = typeof payload?._requestIndex === 'number' ? payload._requestIndex : -1
      let progressTargetNodeId = nodeId
      if (requestIndex >= 0) {
        const indexedSlot = findIndexedGenerationSlot(nodeId, requestIndex)
        if (!indexedSlot?.id) return
        progressTargetNodeId = indexedSlot.id
      } else if (taskId) {
        const mappedSlotId = deps.nodeOwnsGenerationTask(nodeId, taskId)
          ? nodeId
          : (deps.resolveGenerationSlotByTaskId(taskId) || '')
        if (mappedSlotId) progressTargetNodeId = mappedSlotId
      }
      const pidx = deps.nodes.value.findIndex((n: any) => n.id === progressTargetNodeId)
      if (pidx < 0) return
      const currentData = deps.nodes.value[pidx].data || {}
      const patchedData = patchDataOnProgress(currentData, payload, deps)
      deps.nodes.value[pidx] = { ...deps.nodes.value[pidx], data: patchedData }
      try {
        // eslint-disable-next-line no-console
        console.log('[flow-route] ordinary-progress', {
          sourceNodeId: nodeId,
          targetNodeId: progressTargetNodeId,
          taskId,
          progress: patchedData?.progress,
          status: patchedData?.status,
        })
      } catch {}
      if (taskId) ordinaryTaskFallback.markOrdinaryTaskSignal(taskId)
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
      return
    }

    if (type === 'complete' && result) {
      deps.addLog('success', `节点 ${nodeId} 生成完成`, nodeId)

      // 通过 taskId 找到对应的占位节点，确保重复生成时结果写到新占位节点而非覆盖原节点
      let completeTargetNodeId = nodeId
      const taskId = String(payload?.taskId || '').trim()
      const requestIndex = typeof payload?._requestIndex === 'number' ? payload._requestIndex : -1
      if (requestIndex >= 0) {
        const indexedSlot = findIndexedGenerationSlot(nodeId, requestIndex)
        if (!indexedSlot?.id) {
          appendDebugFileLog('flow-route', 'drop-complete-missing-slot', {
            nodeId,
            taskId,
          })
          return
        }
        completeTargetNodeId = indexedSlot.id
      }
      const mappedSlotId = deps.nodeOwnsGenerationTask(nodeId, taskId) ? nodeId : deps.resolveGenerationSlotByTaskId(taskId)
      if (requestIndex < 0 && mappedSlotId) {
        completeTargetNodeId = mappedSlotId
      }
      if (requestIndex < 0 && taskId && completeTargetNodeId === nodeId) {
        const matchedByTaskId = deps.nodes.value.find((n) => {
          if (n.id === nodeId) return false
          const data = n.data || {}
          return String(data.taskId || data._genState?.task_id || data._genState?.taskId || data._activeTaskId || '').trim() === taskId
        })
        if (matchedByTaskId) {
          completeTargetNodeId = matchedByTaskId.id
        }
      }
      if (completeTargetNodeId === nodeId && requestIndex < 0 && !taskId && !deps.nodeOwnsGenerationTask(nodeId, taskId)) {
        const placeholder = deps.nodes.value.find((n) => n.data?._resultPlaceholderForNodeId === nodeId)
        if (placeholder) {
          completeTargetNodeId = placeholder.id
        }
      }
      appendDebugFileLog('flow-route', 'complete-target', {
        nodeId,
        taskId,
        targetNodeId: completeTargetNodeId,
      })
      if (taskId) ordinaryTaskFallback.clearOrdinaryTaskFallback(taskId)

      const isPlaceholderTarget = completeTargetNodeId !== nodeId
      const generationSourceKey = deps.getGenerationSourceKey(eventSourceNodeId, nodeId)

      // preRecordId 从目标节点取，不是原节点
      const preRecordId = deps.getNodeDataRecordId(deps.nodes.value.find((n) => n.id === completeTargetNodeId)?.data)

      const completedNode = deps.nodes.value.find((n) => n.id === completeTargetNodeId)
      const completedItems = deps.normalizeResultItems(result)
      const incomingPrimaryRecordId = deps.getResultRecordId(result, completedItems[0], 0)
      const targetRecordId = deps.getNodeDataRecordId(completedNode?.data)
      const targetHasVisualResult = !!(
        completedNode?.data?.preview
        || completedNode?.data?.url
        || completedNode?.data?.imageUrl
      )
      if (targetHasVisualResult && targetRecordId && incomingPrimaryRecordId && incomingPrimaryRecordId !== targetRecordId) {
        deps.createRegenCard(completeTargetNodeId, result)
        await normalizeCompletedNode(completeTargetNodeId)
        deps._pendingRegenHadResult.delete(nodeId)
        deps._pendingRegenHadRecordId.delete(nodeId)
        deps.markGenerationTaskCompleted(generationSourceKey, eventSourceNodeId)
        return
      }
      if (completedNode && (
        completedNode.data?.status === 'running'
        || completedNode.data?.status === 'queued'
        || completedNode.data?.status === 'waiting_submit'
        || completedNode.data?.isGenerating
        || (!completedNode.data?.recordId && !completedNode.data?.preview)
      )) {
        if (isPlaceholderTarget) {
          appendDebugFileLog('flow-route', 'apply-existing-enter', {
            nodeId,
            targetNodeId: completeTargetNodeId,
            taskId,
          })
        }
        const applyToExisting = isPlaceholderTarget ? await applyCompleteResultToExistingCard?.(completeTargetNodeId, result) : false
        if (isPlaceholderTarget && applyToExisting) {
          await deps.normalizeSingleResultNodeById?.(completeTargetNodeId)
          deps._pendingRegenHadResult.delete(nodeId)
          deps._pendingRegenHadRecordId.delete(nodeId)
          deps.markGenerationTaskCompleted(generationSourceKey, eventSourceNodeId)
          return
        }
        const replaceResult = await replaceGeneratingNodesWithResultCards(completeTargetNodeId, completedNode, result)
        if (replaceResult) {
          await normalizeCompletedNode(completeTargetNodeId)
          if (!isPlaceholderTarget) deps.restoreRecordIdAndCleanup(completeTargetNodeId, preRecordId)
          deps._pendingRegenHadResult.delete(nodeId)
          deps._pendingRegenHadRecordId.delete(nodeId)
          deps.markGenerationTaskCompleted(generationSourceKey, eventSourceNodeId)
          return
        }
      }
      await applyCompleteResult(completeTargetNodeId, result)
      await deps.normalizeSingleResultNodeById?.(completeTargetNodeId)
      if (!isPlaceholderTarget) deps.restoreRecordIdAndCleanup(completeTargetNodeId, preRecordId)
      deps._pendingRegenHadResult.delete(nodeId)
      deps._pendingRegenHadRecordId.delete(nodeId)
      deps.clearGenerationTaskBinding(taskId, completeTargetNodeId)
      deps.markGenerationTaskCompleted(generationSourceKey, eventSourceNodeId)
      return
    }

    if (type === 'error') {
      const taskId = String(payload?.taskId || '').trim()
      const requestIndex = typeof payload?.batchInfo?._requestIndex === 'number' ? payload.batchInfo._requestIndex : -1
      const failReason = deps.extractGenerateFailReason(payload.error)
      if (taskId) ordinaryTaskFallback.clearOrdinaryTaskFallback(taskId)
      // 按 taskId 定位 slot 节点并标记 failed 态
      if (taskId || requestIndex >= 0) {
        const indexedSlot = requestIndex >= 0 ? findIndexedGenerationSlot(nodeId, requestIndex) : null
        const slotIdx = indexedSlot?.id
          ? deps.nodes.value.findIndex((n: any) => n.id === indexedSlot.id)
          : deps.nodes.value.findIndex((n: any) => {
          const d = n.data || {}
          return String(d.taskId || d._activeTaskId || '').trim() === taskId
        })
        if (slotIdx >= 0) {
          deps.nodes.value[slotIdx] = {
            ...deps.nodes.value[slotIdx],
            data: patchDataOnError(deps.nodes.value[slotIdx].data || {}, payload, deps),
          }
          deps.nodes.value = [...deps.nodes.value]
          deps.emit('update:modelNodes', deps.nodes.value)
        }
      }

      deps.addLog('error', `节点 ${nodeId} 生成失败: ${failReason}`, nodeId)
      deps._pendingRegenHadResult.delete(nodeId)
      deps._pendingRegenHadRecordId.delete(nodeId)
      deps.clearGenerationTaskBinding(taskId, nodeId)
      const generationSourceKey = deps.getGenerationSourceKey(eventSourceNodeId, nodeId)
      deps._activeGenerationSessionBySource.delete(generationSourceKey)
      deps._activeGenerationTargetBySource.delete(generationSourceKey)
      deps._activeGenerationTargetBySource.delete(eventSourceNodeId)
    }
  }

  return { handleGenerate }
}
