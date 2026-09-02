import { appendDebugFileLog } from '@/utils/debugFileLog'
import { isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'

export interface WorkflowGenerationPanelEventState {
  isInitializingPanel: boolean
  lastRefCount: number
  capturedNodeId: string | null
  completedViaMainPath: boolean
}

export interface WorkflowGenerationPanelEventDeps {
  props: any
  emit: (...args: any[]) => void
  state: WorkflowGenerationPanelEventState
  saveNodeState: () => void
  extractCompletedItems: (result: any) => any[]
  extractCompletedAigcRecordIds: (result: any, items?: any[]) => string[]
  filterReferencesToActiveUpstream: (references?: Array<Record<string, any>>) => Array<Record<string, any>>
  buildNodeStateFromRequestPayload: (payload: any) => any
  saveWorkflowCapabilityRemember: (state: any) => void
  emitStateChange: (nodeId: string | undefined, state: any) => void
}

/**
 * Keeps panel event translation separate from state restoration and generator wiring.
 */
export function useWorkflowGenerationPanelEvents(deps: WorkflowGenerationPanelEventDeps) {
  const onGenerateStart = (task: any) => {
    if (isWorkflowGenerationResultNode(deps.props.node)) {
      appendDebugFileLog('flow-event', 'drop-result-node-start', {
        nodeId: deps.props.node?.id,
        nodeType: deps.props.node?.type,
        nodeKind: deps.props.node?.data?.nodeKind,
      })
      return
    }
    deps.state.completedViaMainPath = false
    deps.state.capturedNodeId = deps.props.node?.id || null

    if (deps.props.node?.id) {
      deps.saveNodeState()
    }
    if (!task?._batchGridBatchId) {
      if (task?._pbrBatchId) {
        console.log('[pbr-prepare] emit-prepare', {
          nodeId: deps.state.capturedNodeId,
          pbrBatchId: task._pbrBatchId,
        })
      }
      deps.emit('generate', { type: 'prepare', task, nodeId: deps.state.capturedNodeId })
    }
    deps.emit('generate', { type: 'start', task, nodeId: deps.state.capturedNodeId })
    deps.emit('close')
  }

  const onGenerateCreated = (data: any) => {
    const info = Array.isArray(data?.formattedData)
      ? data.formattedData[0]
      : data?.formattedData || data?.rawResult?.formatted_data || (Array.isArray(data) ? data[0] : data)

    const taskId = String(data?.taskId || '').trim()
    if (!deps.state.capturedNodeId || !taskId) {
      return
    }
    deps.emit('generate', {
      type: 'created',
      taskId,
      recordId: data?.recordId,
      queueRecordId: data?.queueRecordId,
      _requestIndex: data?._requestIndex,
      prompt: data?.prompt || '',
      _pbrBatchId: data?._pbrBatchId,
      _batchGridBatchId: data?._batchGridBatchId,
      model: data?.model || '',
      modelDisplayName: data?.modelDisplayName || '',
      nodeId: deps.state.capturedNodeId,
      result: info || data?.rawResult || {},
    })
  }

  const onQueueTaskAssigned = (data: any) => {
    const queueRecordId = Number(data?.queueRecordId || 0)
    if (!deps.state.capturedNodeId || !queueRecordId) return
    deps.emit('generate', {
      type: 'queue-bind',
      nodeId: deps.state.capturedNodeId,
      queueRecordId,
      _requestIndex: data?._requestIndex,
      _pbrBatchId: data?._pbrBatchId,
      _batchGridBatchId: data?._batchGridBatchId,
    })
  }

  const onGenerateProgress = (data: any) => {
    deps.emit('generate', {
      type: 'progress',
      result: data,
      nodeId: deps.state.capturedNodeId,
      taskId: data?.task_id || data?.taskId,
      queueRecordId: data?.queueRecordId,
      _requestIndex: data?._requestIndex,
      _pbrBatchId: data?._pbrBatchId,
      _batchGridBatchId: data?._batchGridBatchId,
    })
  }

  const onGenerateComplete = (result: any) => {
    deps.state.completedViaMainPath = true
    if (!result) {
      deps.emit('generate', { type: 'complete', result: null, nodeId: deps.state.capturedNodeId })
      return
    }

    const items = deps.extractCompletedItems(result)
    const aigcRecordIds = result?.aigcRecordIds?.length
      ? result.aigcRecordIds.map(String)
      : deps.extractCompletedAigcRecordIds(result, items)

    if (aigcRecordIds.length && deps.state.capturedNodeId) {
      deps.emit('generate', {
        type: 'aigc-record-ready',
        taskId: result?.taskId || result?.task_id,
        queueRecordId: result?.queueRecordId,
        _requestIndex: result?._requestIndex,
        aigcRecordId: result?.aigcRecordId || aigcRecordIds[0],
        aigcRecordIds,
        nodeId: deps.state.capturedNodeId,
        _pbrBatchId: result?._pbrBatchId,
        _batchGridBatchId: result?._batchGridBatchId,
      })
    }

    deps.emit('generate', {
      type: 'complete',
      taskId: result?.taskId || result?.task_id,
      queueRecordId: result?.queueRecordId,
      _requestIndex: result?._requestIndex,
      _pbrBatchId: result?._pbrBatchId,
      _batchGridBatchId: result?._batchGridBatchId,
      result: {
        ...result,
        items: result.items || items,
        aigcRecordId: result.aigcRecordId || aigcRecordIds[0],
        aigcRecordIds,
      },
      nodeId: deps.state.capturedNodeId,
    })
  }

  const onGenerateError = (error: string, batchInfo?: any) => {
    deps.emit('generate', {
      type: 'error',
      error,
      nodeId: deps.state.capturedNodeId,
      batchInfo,
      queueRecordId: batchInfo?.queueRecordId,
      _pbrBatchId: batchInfo?._pbrBatchId,
      _batchGridBatchId: batchInfo?._batchGridBatchId,
    })
  }

  const onCapabilityChange = (capId: string) => {
    if (deps.state.isInitializingPanel) return
    deps.saveNodeState()
    deps.emit('generate', { type: 'capability-change', capId, nodeId: deps.state.capturedNodeId || deps.props.node?.id })
  }

  const onRequestPayloadChange = (payload: any) => {
    if (deps.state.isInitializingPanel) {
      const referenceItems = deps.filterReferencesToActiveUpstream(Array.isArray(payload?.referenceItems) ? payload.referenceItems : [])
      deps.state.lastRefCount = referenceItems.length
      return
    }

    const nextState = deps.buildNodeStateFromRequestPayload(payload)
    if (deps.props.node?.data && nextState) {
      const restoredRecordId = deps.props.node.data._genState?._restoredAigcRecordId
      deps.props.node.data._genState = {
        ...nextState,
        ...(restoredRecordId ? { _restoredAigcRecordId: restoredRecordId } : {}),
      }
      if (Array.isArray(deps.props.node.data._genState.referenceOrder) && deps.props.node.data._genState.referenceOrder.length) {
        deps.props.node.data.referenceOrder = [...deps.props.node.data._genState.referenceOrder]
      } else {
        delete deps.props.node.data.referenceOrder
      }
      deps.saveWorkflowCapabilityRemember(deps.props.node.data._genState)
      deps.emitStateChange(deps.props.node?.id, deps.props.node.data._genState)
    } else {
      deps.saveNodeState()
    }

    const referenceItems = deps.filterReferencesToActiveUpstream(Array.isArray(payload?.referenceItems) ? payload.referenceItems : [])
    deps.state.lastRefCount = referenceItems.length
  }

  const onClipboardReferencePasted = (payload: { files?: File[] }) => {
    const files = Array.isArray(payload?.files) ? payload.files.filter((file) => file instanceof File) : []
    if (!deps.props.node?.id || !files.length) return
    deps.emit('clipboard-reference-pasted', { nodeId: deps.props.node.id, files })
  }

  const onFilesDropped = (payload: { files?: File[]; urls?: string[]; referenceNames?: string[]; assetInfo?: unknown; replaceIndex?: number }) => {
    const files = Array.isArray(payload?.files) ? payload.files.filter((file) => file instanceof File) : []
    const urls = Array.isArray(payload?.urls)
      ? payload.urls.filter((url): url is string => typeof url === 'string' && !!url.trim())
      : []
    if (!deps.props.node?.id || (!files.length && !urls.length && !payload?.assetInfo)) return
    deps.emit('files-dropped', {
      nodeId: deps.props.node.id,
      files,
      urls,
      referenceNames: payload?.referenceNames,
      assetInfo: payload?.assetInfo,
      replaceIndex: payload?.replaceIndex,
    })
  }

  return {
    onGenerateStart,
    onQueueTaskAssigned,
    onGenerateCreated,
    onGenerateProgress,
    onGenerateComplete,
    onGenerateError,
    onCapabilityChange,
    onRequestPayloadChange,
    onClipboardReferencePasted,
    onFilesDropped,
  }
}
