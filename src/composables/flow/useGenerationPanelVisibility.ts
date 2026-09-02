import { nextTick } from 'vue'
import type { GenerationOrchestrationDeps } from './useGenerationOrchestration.types'

export interface GenerationPanelVisibilityApi {
  showGenerationPanel: (node: unknown) => void
  handleGenerationPanelLayoutChange: () => void
  hideGenerationPanel: () => void
  revealManualGenerationPanel: (nodeId: string) => void
  createGenerationTargetForExistingResult: (sourceNode: unknown) => string
  clearGenerationPanel: (nodeId?: string) => void
  stopPanelClickOutside: () => void
  startPanelClickOutside: () => void
}

/**
 * Keeps panel visibility state together so panel teardown always clears the same side effects.
 */
export function useGenerationPanelVisibility(
  deps: GenerationOrchestrationDeps,
  scheduleGenerationPanelViewportAdjustment: () => void,
): GenerationPanelVisibilityApi {
  function showGenerationPanel(node: any): void {
    if (!node?.id) return
    if (node?.type === 'batch_grid') return
    deps.propagateDataFlow()
    deps.selectedPanelNode.value = node
    deps.generationPanelLayoutTick.value += 1
    deps.panelVisible.value = true
    nextTick(() => {
      scheduleGenerationPanelViewportAdjustment()
    })
  }

  function handleGenerationPanelLayoutChange(): void {
    deps.generationPanelLayoutTick.value += 1
    nextTick(() => {
      scheduleGenerationPanelViewportAdjustment()
    })
  }

  function hideGenerationPanel(): void {
    if (deps.generationPanelViewportAdjustFrame.value) {
      cancelAnimationFrame(deps.generationPanelViewportAdjustFrame.value)
      deps.generationPanelViewportAdjustFrame.value = 0
    }
    deps.generationPanelRef.value?.closeFloatingOverlays?.()
    deps.generationPanelRef.value?.saveNodeState?.()
    deps.panelVisible.value = false
  }

  function revealManualGenerationPanel(nodeId: string): void {
    if (!nodeId) return
    nextTick(() => {
      const freshNode = deps.findNode(nodeId) || deps.nodes.value.find((node: any) => node.id === nodeId)
      if (!freshNode || !deps.canOpenGenerationPanel(freshNode)) return
      showGenerationPanel(freshNode)
      deps.emit('node-select', freshNode)
    })
  }

  function createGenerationTargetForExistingResult(sourceNode: any): string {
    if (!sourceNode || !deps.hasNodeResultUrl(sourceNode)) return sourceNode?.id || ''
    const existingTargetId = deps._activeGenerationTargetBySource.get(sourceNode.id)
    const existingTarget = deps.nodes.value.find((node: any) => node.id === existingTargetId)
    if (existingTarget && (existingTarget.data?.status === 'running' || existingTarget.data?.isGenerating)) {
      return String(existingTargetId)
    }
    const targetNode = deps.createDetachedGenerationNode(sourceNode)
    if (!targetNode?.id) return sourceNode.id
    deps._activeGenerationTargetBySource.set(sourceNode.id, targetNode.id)
    if (!deps.generationStore.isGenerating) {
      showGenerationPanel(targetNode)
    }
    return targetNode.id
  }

  function clearGenerationPanel(nodeId?: string): void {
    if (!deps.selectedPanelNode.value?.id) return
    if (nodeId && deps.selectedPanelNode.value.id !== nodeId) return
    if (deps.generationPanelViewportAdjustFrame.value) {
      cancelAnimationFrame(deps.generationPanelViewportAdjustFrame.value)
      deps.generationPanelViewportAdjustFrame.value = 0
    }
    deps.generationPanelRef.value?.closeFloatingOverlays?.()
    deps.generationPanelRef.value?.saveNodeState?.()
    deps.panelVisible.value = false
    deps.selectedPanelNode.value = null
  }

  function stopPanelClickOutside(): void {
    if (!deps._panelClickOutsideHandler.value) return
    document.removeEventListener('mousedown', deps._panelClickOutsideHandler.value, true)
    deps._panelClickOutsideHandler.value = null
  }

  function startPanelClickOutside(): void {
    stopPanelClickOutside()
    deps._panelClickOutsideHandler.value = (event: MouseEvent) => {
      if (!deps.selectedPanelNode.value || !deps.panelVisible.value) return
      if (event.button !== 0) return
      if (document.querySelector('.ref-edit-overlay, .video-ref-editor-overlay')) return
      const panelEl = deps.generationPanelRef.value?.$el
      if (panelEl && panelEl.contains(event.target)) return
      if (!(event.target instanceof Element)) return
      const nodeEl = event.target.closest?.('.vue-flow__node')
      const selectedNodeId = String(deps.selectedPanelNode.value?.id || '').trim()
      if (nodeEl instanceof HTMLElement && nodeEl.dataset.id === selectedNodeId) return
      if (event.target.closest?.('.el-select-dropdown, .el-popover, .el-popper, .el-picker-panel, .el-cascader__dropdown, .ref-edit-overlay, .video-ref-editor-overlay, .ref-menu')) return
      if (deps.generationStore.isGenerating) return
      hideGenerationPanel()
    }
    document.addEventListener('mousedown', deps._panelClickOutsideHandler.value, true)
  }

  return {
    showGenerationPanel,
    handleGenerationPanelLayoutChange,
    hideGenerationPanel,
    revealManualGenerationPanel,
    createGenerationTargetForExistingResult,
    clearGenerationPanel,
    stopPanelClickOutside,
    startPanelClickOutside,
  }
}
