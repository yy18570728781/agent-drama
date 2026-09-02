function refreshNodeInternals(deps: any): void {
  const nodeIds = deps.nodes.value.map((node: any) => node.id).filter(Boolean)
  if (nodeIds.length) deps.updateNodeInternals?.(nodeIds)
}

function updateNodeData(deps: any, nodeId: string, data: any): void {
  const index = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
  if (index < 0) return
  deps.nodes.value[index].data = { ...deps.nodes.value[index].data, ...data }
  deps.nodes.value = [...deps.nodes.value]
  deps.emit('update:modelNodes', deps.nodes.value)
}

function removeNode(deps: any, nodeId: string): void {
  if (deps.selectedPanelNode.value?.id === nodeId) deps.clearGenerationPanel(nodeId)
  deps.nodes.value = deps.nodes.value.filter((node: any) => node.id !== nodeId)
  deps.edges.value = deps.edges.value.filter((edge: any) => (
    edge.source !== nodeId && edge.target !== nodeId
  ))
}

function focusNodeById(deps: any, nodeId: string): void {
  const node = deps.findNode?.(nodeId)
    || deps.nodes.value.find((item: any) => item.id === nodeId)
  if (!node?.id) return
  deps.removeSelectedNodes?.(deps.getSelectedNodes?.value || [])
  deps.addSelectedNodes?.([node])
  deps.updateNodeInternals?.([node.id])
  deps.fitView?.({ nodes: [node.id], padding: 0.28, duration: 260, maxZoom: 1.25 })
  deps.emit('node-select', node)
}

/**
 * 创建供父组件调用的 FlowCanvas 公共接口。
 * @param deps 画布状态和 Vue Flow 操作依赖。
 * @returns 画布查询、更新、定位与数据流操作接口。
 */
export function createFlowCanvasExpose(deps: any) {
  return {
    setCapabilityPorts: (ports: any) => { deps.capabilityPorts.value = ports },
    getNodes: () => deps.nodes.value,
    getEdges: () => deps.edges.value,
    refreshNodeInternals: () => refreshNodeInternals(deps),
    updateNodeData: (nodeId: string, data: any) => updateNodeData(deps, nodeId, data),
    removeNode: (nodeId: string) => removeNode(deps, nodeId),
    getViewport: () => ({
      zoom: deps.viewport.value.zoom,
      x: deps.viewport.value.x,
      y: deps.viewport.value.y,
    }),
    isViewportReady: () => !!deps.vueFlowRef.value,
    setViewport: (viewport: any) => {
      if (!viewport) return
      deps.setViewport({
        x: viewport.x || 0,
        y: viewport.y || 0,
        zoom: viewport.zoom || 1,
      })
    },
    applyCompleteResult: deps.applyCompleteResult,
    repairGeneratingNodes: deps.handleRepairGeneratingNodes,
    dropAssetAt: (assetInfo: any, screenX: number, screenY: number, canvasX: number, canvasY: number) => (
      deps.dropAssetAt(assetInfo, screenX, screenY, canvasX, canvasY)
    ),
    focusNodeById: (nodeId: string) => focusNodeById(deps, nodeId),
    connectToMatchingNodes: (targetNodeId: string, urls: string[]) => (
      deps.connectToMatchingNodes(targetNodeId, urls)
    ),
    propagateDataFlow: () => deps.propagateDataFlow?.(),
  }
}
