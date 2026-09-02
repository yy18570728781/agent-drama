import { nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { normalizeWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { GROUP_AGGREGATE_SOURCE_HANDLE, GROUP_EXPANDED_SOURCE_HANDLE } from '@/composables/flow/groupConnection.constants'
import { syncTextureMaterialConnection } from './textureMaterialConsumerLinks'

export function useFlowCanvasEdgeInteractions(deps: any) {
  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeUpdateStart,
    onEdgeUpdate,
    onEdgeUpdateEnd,
    onEdgeClick,
    onEdgeDoubleClick,
    skipNodesChangeRef,
    skipEdgesChangeRef,
    isDraggingNode,
    isResizing,
    emit,
    nodes,
    edges,
    getSelectedNodes,
    isPointSelectionSuppressed,
    updateEdgeStyles,
    validateConnection,
    isConnecting,
    isLargeCanvasConnectionMode,
    findNode,
    connectSelectedNodesToTarget,
    connectGroupChildrenToTarget,
    connectGroupAggregateToTarget,
    addEdges,
    propagateDataFlow,
    saveHistory,
    syncTargetNodePrompt,
    project,
    vueFlowRef,
    createRuntimeId,
    edgeStyle,
    removeEdges,
    addNodes,
  } = deps

  function applyManualSizeChanges(changes: any[]) {
    let changed = false
    changes.forEach((change) => {
      if (change?.type !== 'dimensions' || change?.resizing !== false || !change?.id) return
      const index = nodes.value.findIndex((node: any) => node.id === change.id)
      if (index < 0) return
      const currentNode = nodes.value[index]
      const dims = change.dimensions
      let width = Number(dims?.width || currentNode?.dimensions?.width || 0)
      let height = Number(dims?.height || currentNode?.dimensions?.height || 0)
      if (!(width > 0) || !(height > 0)) return
      const mediaType = String(currentNode?.data?.mediaType || '')
      const aspectRatio = Number(
        normalizeWorkflowMediaMeta(currentNode?.data)?.aspectRatio
        || currentNode?.data?.aspect_ratio
        || currentNode?.data?.aspectRatio
        || 0,
      )
      if ((mediaType === 'image' || mediaType === 'video') && aspectRatio > 0) {
        height = Math.round(width / aspectRatio)
      }

      nodes.value[index] = {
        ...currentNode,
        data: { ...(currentNode.data || {}), _manualSize: true },
        style: { ...(currentNode.style || {}), width: `${width}px`, height: `${height}px` },
      }
      changed = true
    })
    return changed
  }

  onNodesChange((changes: any[]) => {
    if (skipNodesChangeRef.value) return
    const hasDimStart = changes.some((c: any) => c?.type === 'dimensions' && c?.resizing === true)
    const hasDimEnd = changes.some((c: any) => c?.type === 'dimensions' && c?.resizing === false)
    if (hasDimStart) isResizing.value = true
    if (hasDimEnd) isResizing.value = false
    const hasManualSizeChange = applyManualSizeChanges(changes)
    const hasPositionChange = changes.some((change) => change.type === 'position')
    if (hasManualSizeChange || (hasPositionChange && !isDraggingNode.value && !isResizing.value)) {
      emit('update:modelNodes', nodes.value)
    }
  })

  onEdgesChange((changes: any[]) => {
    if (changes.some((change) => change.type === 'select' || change.type === 'remove')) {
      updateEdgeStyles()
    }
    if (skipEdgesChangeRef.value) return
    emit('update:modelEdges', edges.value)
  })

  watch(
    () => getSelectedNodes.value.map((node: any) => node.id).join(','),
    () => {
      if (isPointSelectionSuppressed.value) return
      updateEdgeStyles()
    }
  )

  const checkValidConnection = (connection: any) => validateConnection(connection, {
    deferGraphChecks: isConnecting.value && isLargeCanvasConnectionMode.value,
  })

  onConnect(async (params: any) => {
    deps.pendingInvalidConnectionMessageRef.value = ''
    const sourceNode = findNode(params.source)
    if (deps.isEmptyGenerationSourceNode(sourceNode)) {
      ElMessage.warning('该节点尚未生成结果，无法作为连接来源')
      return
    }
    if (!validateConnection(params)) {
      if (deps.pendingInvalidConnectionMessageRef.value) {
        ElMessage.warning(deps.pendingInvalidConnectionMessageRef.value)
        deps.pendingInvalidConnectionMessageRef.value = ''
      }
      return
    }

    const selectedSourceIds = new Set(getSelectedNodes.value.map((node: any) => node.id))
    const shouldBatchConnectSelected = (
      !!sourceNode
      && selectedSourceIds.size > 1
      && selectedSourceIds.has(params.source)
      && sourceNode.type !== 'groupNode'
      && sourceNode.type !== 'waypoint'
    )
    if (shouldBatchConnectSelected) {
      if (connectSelectedNodesToTarget(params.target, {
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      })) {
        return
      }
    }

    if (sourceNode?.type === 'groupNode' && params.sourceHandle === GROUP_EXPANDED_SOURCE_HANDLE) {
      await connectGroupChildrenToTarget(sourceNode.id, params.target, {
        targetHandle: params.targetHandle,
      })
      return
    }

    if (sourceNode?.type === 'groupNode' && params.sourceHandle === GROUP_AGGREGATE_SOURCE_HANDLE) {
      await connectGroupAggregateToTarget(sourceNode.id, params.target, {
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      })
      return
    }

    addEdges([params])
    nextTick(() => {
      updateEdgeStyles()
      const textureChanged = syncTextureMaterialConnection(params, deps)
      if (textureChanged) emit('update:modelNodes', nodes.value)
      emit('update:modelEdges', edges.value)
      syncTargetNodePrompt(params.target)
      const targetNode = nodes.value.find((node: any) => node.id === params.target)
      if (targetNode?.data?._blockedUpstreamNodeIds) {
        const blocked = targetNode.data._blockedUpstreamNodeIds
        const idx = blocked.indexOf(params.source)
        if (idx >= 0) blocked.splice(idx, 1)
        if (!blocked.length) delete targetNode.data._blockedUpstreamNodeIds
      }
      propagateDataFlow()
      saveHistory()
    })
  })

  let edgeUpdateSuccessful = false

  onEdgeUpdateStart(() => {
    edgeUpdateSuccessful = false
  })

  onEdgeUpdate(({ edge, connection }: any) => {
    edgeUpdateSuccessful = true
    edges.value = edges.value.map((item: any) => {
      if (item.id === edge.id) {
        return {
          ...item,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        }
      }
      return item
    })
    const textureChanged = syncTextureMaterialConnection(connection, deps)
    if (textureChanged) emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    saveHistory()
  })

  onEdgeUpdateEnd(({ edge }: any) => {
    if (!edgeUpdateSuccessful) {
      edges.value = edges.value.filter((item: any) => item.id !== edge.id)
      emit('update:modelEdges', edges.value)
      saveHistory()
    }
  })

  onEdgeClick(({ event, edge }: any) => {
    if (event.altKey) {
      edges.value = edges.value.filter((item: any) => item.id !== edge.id)
      emit('update:modelEdges', edges.value)
      saveHistory()
    }
  })

  onEdgeDoubleClick(({ edge, event }: any) => {
    const flowEl = vueFlowRef.value
    if (!flowEl) return
    const bounds = flowEl.getBoundingClientRect()
    if (event.clientX === undefined || event.clientY === undefined) return
    const pos = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })

    const waypointId = createRuntimeId('waypoint')
    const waypoint = {
      id: waypointId,
      type: 'waypoint',
      position: { x: pos.x - 7, y: pos.y - 7 },
      data: { label: '' },
      style: { width: '14px', height: '14px' },
    }

    const sourceEdge = {
      id: createRuntimeId('edge'),
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: waypointId,
      type: edgeStyle.value,
      animated: edge.animated,
      style: edge.style,
    }
    const targetEdge = {
      id: createRuntimeId('edge'),
      source: waypointId,
      target: edge.target,
      targetHandle: edge.targetHandle,
      type: edgeStyle.value,
      animated: edge.animated,
      style: edge.style,
    }

    skipEdgesChangeRef.value = true
    removeEdges([edge.id])
    addNodes([waypoint])
    addEdges([sourceEdge, targetEdge])

    nextTick(() => {
      const createdNode = findNode(waypointId)
      const resolvedTargetHandle = createdNode?.handleBounds?.target?.[0]?.id
      const resolvedSourceHandle = createdNode?.handleBounds?.source?.[0]?.id
      if (resolvedTargetHandle || resolvedSourceHandle) {
        edges.value = edges.value.map((item: any) => {
          if (item.id === sourceEdge.id && resolvedTargetHandle) {
            return { ...item, targetHandle: resolvedTargetHandle }
          }
          if (item.id === targetEdge.id && resolvedSourceHandle) {
            return { ...item, sourceHandle: resolvedSourceHandle }
          }
          return item
        })
      }
      skipEdgesChangeRef.value = false
      emit('update:modelNodes', nodes.value)
      emit('update:modelEdges', edges.value)
      propagateDataFlow()
      saveHistory()
    })
  })

  return {
    checkValidConnection,
  }
}
