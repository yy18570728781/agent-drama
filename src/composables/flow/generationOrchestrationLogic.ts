import { nextTick, watch } from 'vue'
import { findTeamonesAigcRecord } from '@/api/assets'
import { useGenerationPanelVisibility } from './useGenerationPanelVisibility'
import { useGenerationPanelViewport } from './useGenerationPanelViewport'
import { useGenerationTaskBinding } from './useGenerationTaskBinding'
import { useGenerationOrchestrationSlots } from './useGenerationOrchestrationSlots'
import { useGenerationOrchestrationResultSync } from './useGenerationOrchestrationResultSync'
import type { GenerationOrchestrationDeps } from './useGenerationOrchestration.types'

export function useGenerationOrchestration(deps: GenerationOrchestrationDeps) {
  const {
    getGenerationPanelElement,
    ensureGenerationPanelVisibleInViewport,
    scheduleGenerationPanelViewportAdjustment,
    getConstrainedPanelPosition,
    panelStyle,
  } = useGenerationPanelViewport(deps)

  const {
    showGenerationPanel,
    handleGenerationPanelLayoutChange,
    hideGenerationPanel,
    revealManualGenerationPanel,
    createGenerationTargetForExistingResult,
    clearGenerationPanel,
    stopPanelClickOutside,
    startPanelClickOutside,
  } = useGenerationPanelVisibility(deps, scheduleGenerationPanelViewportAdjustment)

  function getPanelNodePositionSignature(): string {
    if (!deps.panelVisible.value) return ''
    const nodeId = String(deps.selectedPanelNode.value?.id || '').trim()
    if (!nodeId) return ''
    const node = deps.nodes.value.find((item: any) => item.id === nodeId)
    if (!node) return ''
    const position = node.computedPosition || node.position || {}
    return `${nodeId}:${Number(position.x || 0)}:${Number(position.y || 0)}`
  }

  // ========================================================================
  // Upstream / refresh
  // ========================================================================

  function syncUpstreamPrompt() {
    if (!deps.selectedPanelNode.value) return
    const nodeId = deps.selectedPanelNode.value.id

    deps.propagateDataFlow()

    const panelGenRef = deps.generationPanelRef.value?.generatorRef
    if (panelGenRef) {
      const upstreamPrompt = deps.getUpstreamPrompt(nodeId)
      if (upstreamPrompt) {
        deps.syncTargetNodePrompt(nodeId)
        panelGenRef.setPrompt(upstreamPrompt)
      }
    }

    if (deps.generationPanelRef.value) {
      nextTick(() => {
        deps.generationPanelRef.value.injectUpstreamMedia?.()
      })
    }
  }

  function refreshOpenGenerationPanelForNode(nodeId: string) {
    if (!nodeId || deps.selectedPanelNode.value?.id !== nodeId || !deps.panelVisible.value) return
    nextTick(() => {
      syncUpstreamPrompt()
    })
  }

  function openNodeGenerationPanel(nodeId: string) {
    if (!nodeId) return null
    const node = deps.nodes.value.find((n: any) => n.id === nodeId)
    if (!node) return null
    showGenerationPanel(node)
    return node
  }

  // ========================================================================
  // Regenerate context
  // ========================================================================

  async function buildNodeRegenerateContext(node: any) {
    const recordId = String(node?.data?.recordId || '').trim()
    let context: any = null

    if (recordId) {
      const record = await findTeamonesAigcRecord(recordId)
      if (record) {
        context = deps.buildRegenerateContextFromRecord(record, node)
      }
    }

    if (!context && deps.nodeHasGenerationContext(node?.data)) {
      context = deps.buildRegenerateContextFromRecord(null, node)
    }
    if (!context) return null

    const schema = deps.getCachedAllowGenerateCountSchema(context.modelId, context.mode, context.capability)
    const min = Math.max(1, Math.floor(schema?.min ?? 1))
    const max = schema?.max === undefined ? undefined : Math.max(min, Math.floor(schema.max))
    const defaultValueRaw = schema?.default ?? min
    const rememberedValueRaw = deps.getRememberedGenerateCount(context.modelId, context.capability)
    const defaultValueBase = rememberedValueRaw ?? defaultValueRaw
    const defaultValue = Math.max(min, max === undefined ? Math.floor(defaultValueBase) : Math.min(max, Math.floor(defaultValueBase)))

    return {
      ...context,
      countConfig: {
        label: schema?.label || '\u751f\u6210\u5f20\u6570',
        min,
        max,
        defaultValue,
      },
    }
  }

  function removeDuplicateUpstreamNodes() {
    const inputNodes = deps.nodes.value.filter((n: any) => deps.isImageLikeNode(n) || deps.isVideoLikeNode(n))
    if (inputNodes.length < 2) return

    const seen = new Map<string, string>()
    const toRemove = new Set<string>()

    for (const n of inputNodes) {
      const url = deps.getNodeMediaReferenceKey(n)
      if (!url) continue
      if (seen.has(url)) {
        toRemove.add(n.id)
      } else {
        seen.set(url, n.id)
      }
    }

    if (toRemove.size === 0) return

    for (const dupId of toRemove) {
      const inEdges = deps.edges.value.filter((e: any) => e.source === dupId)
      const originalId = seen.get(deps.getNodeMediaReferenceKey(deps.nodes.value.find((n: any) => n.id === dupId)))
      if (!originalId) continue

      for (const edge of inEdges) {
        const targetId = edge.target
        const alreadyConnected = deps.edges.value.some(
          (e: any) => e.source === originalId && e.target === targetId && e.id !== edge.id
        )
        if (!alreadyConnected) {
          deps.edges.value = deps.edges.value.map((e: any) =>
            e.id === edge.id ? { ...e, source: originalId } : e
          )
        }
      }
    }

    deps.edges.value = deps.edges.value.filter((e: any) => !toRemove.has(e.source))
    deps.nodes.value = deps.nodes.value.filter((n: any) => !toRemove.has(n.id))
  }

  const {
    resolveGenerateTargetNodeId,
    resolveOriginalNodeId,
    getGenerationSourceKey,
    markGenerationTaskCompleted,
    bindGenerationTaskToSlot,
    resolveGenerationSlotByTaskId,
    nodeOwnsGenerationTask,
    clearGenerationTaskBinding,
    attachTaskIdToGenerationState,
    getActiveGenerationTargetNodeId,
    getGenerationCardHorizontalGap,
  } = useGenerationTaskBinding(deps)

  const {
    createGeneratingResultPlaceholders,
    getGenerationSlotNodes,
    canUseSourceNodeAsGenerationSlot,
    registerSourceNodeAsGenerationSlot,
    createGenerationSlotForTask,
    shouldCreateSeparateResultCardPerTask,
    assignTaskToIndexedGenerationSlot,
    assignTaskToGenerationSlot,
    clearGenerationTaskMarkers,
  } = useGenerationOrchestrationSlots(deps, {
    attachTaskIdToGenerationState,
    getGenerationCardHorizontalGap,
  })

  const {
    createRegenCard,
    syncGeneratedResultNodes,
    restoreRecordIdAndCleanup,
  } = useGenerationOrchestrationResultSync(deps)

  // ==================== Panel Watches ====================

  watch([deps.selectedPanelNode, deps.panelVisible], ([node, visible]) => {
    if (node && visible) {
      nextTick(() => {
        startPanelClickOutside()
      })
    } else {
      stopPanelClickOutside()
    }
  })

  watch(getPanelNodePositionSignature, (signature) => {
    if (!signature) return
    deps.generationPanelLayoutTick.value += 1
  }, { flush: 'sync' })

  watch(
    () => deps.nodes.value.map(n => n.id).join('|'),
    () => {
      const panelNodeId = deps.selectedPanelNode.value?.id
      if (!panelNodeId) return
      if (!deps.nodes.value.some(n => n.id === panelNodeId)) {
        if (deps.generationStore.isGenerating) {
          hideGenerationPanel()
        } else {
          clearGenerationPanel(panelNodeId)
        }
      }
    }
  )

  // ========================================================================
  // Return all extracted functions
  // ========================================================================

  return {
    // Panel management
    showGenerationPanel,
    handleGenerationPanelLayoutChange,
    hideGenerationPanel,
    revealManualGenerationPanel,
    createGenerationTargetForExistingResult,
    clearGenerationPanel,

    // Panel lifecycle
    stopPanelClickOutside,
    startPanelClickOutside,

    // Viewport
    getGenerationPanelElement,
    ensureGenerationPanelVisibleInViewport,
    scheduleGenerationPanelViewportAdjustment,
    getConstrainedPanelPosition,
    panelStyle,

    // Upstream / refresh
    syncUpstreamPrompt,
    refreshOpenGenerationPanelForNode,
    openNodeGenerationPanel,

    // Regenerate context
    buildNodeRegenerateContext,
    removeDuplicateUpstreamNodes,

    // Generation slots
    createGeneratingResultPlaceholders,
    getGenerationSlotNodes,
    canUseSourceNodeAsGenerationSlot,
    registerSourceNodeAsGenerationSlot,
    createGenerationSlotForTask,
    shouldCreateSeparateResultCardPerTask,
    assignTaskToIndexedGenerationSlot,
    assignTaskToGenerationSlot,
    clearGenerationTaskMarkers,

    // Regen / result sync
    createRegenCard,
    syncGeneratedResultNodes,
    restoreRecordIdAndCleanup,
    resolveGenerateTargetNodeId,
    resolveOriginalNodeId,
    getGenerationSourceKey,
    markGenerationTaskCompleted,
    bindGenerationTaskToSlot,
    resolveGenerationSlotByTaskId,
    nodeOwnsGenerationTask,
    clearGenerationTaskBinding,
    attachTaskIdToGenerationState,
    getActiveGenerationTargetNodeId,
    getGenerationCardHorizontalGap,
  }
}
