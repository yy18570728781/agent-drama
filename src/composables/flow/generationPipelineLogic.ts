import { useGenerationPipelineRepair } from './useGenerationPipelineRepair'
import { useGenerationPipelineCommonActions } from './useGenerationPipelineCommonActions'
import { useGenerationPipelineReedit } from './useGenerationPipelineReedit'
import { useGenerationPipelineRegenerate } from './useGenerationPipelineRegenerate'
import { useGenerationPipelineResultHandling } from './useGenerationPipelineResultHandling'
import { useGenerationPipelineEventHandling } from './useGenerationPipelineEventHandling'
import type { GenerationPipelineDeps } from './useGenerationPipeline.types'

export function useGenerationPipeline(deps: GenerationPipelineDeps) {
  const { promptRegenerateCount, ensureCanStartRegenerate, focusReeditNode } = useGenerationPipelineCommonActions(deps)
  const { triggerNodeReEdit } = useGenerationPipelineReedit(deps, { focusReeditNode })
  const {
    resolveCompletedResultAsset,
    applyRecordToExistingResultNode,
    applyCompleteResultToExistingCard,
    replaceGeneratingNodesWithResultCards,
    fillResultPlaceholders,
    applyCompleteResult,
    _applyCompleteResultInner,
  } = useGenerationPipelineResultHandling(deps)
  const { triggerNodeRegenerate } = useGenerationPipelineRegenerate(deps, {
    promptRegenerateCount,
    ensureCanStartRegenerate,
    applyCompleteResult,
  })
  const {
    isRepairingGeneratingNodes,
    handleRepairGeneratingNodes,
    normalizeSingleResultNodeById,
    repairResultNodeById,
    handleForceRepairSelectedNodes,
  } = useGenerationPipelineRepair(deps, applyRecordToExistingResultNode, applyCompleteResult)
  deps.normalizeSingleResultNodeById = normalizeSingleResultNodeById
  deps.repairResultNodeById = repairResultNodeById
  const { handleGenerate } = useGenerationPipelineEventHandling(deps, {
    applyRecordToExistingResultNode,
    applyCompleteResultToExistingCard,
    replaceGeneratingNodesWithResultCards,
    applyCompleteResult,
  })

  return {
    isRepairingGeneratingNodes,
    promptRegenerateCount,
    ensureCanStartRegenerate,
    focusReeditNode,
    triggerNodeReEdit,
    triggerNodeRegenerate,
    resolveCompletedResultAsset,
    handleRepairGeneratingNodes,
    repairResultNodeById,
    handleForceRepairSelectedNodes,
    applyRecordToExistingResultNode,
    applyCompleteResultToExistingCard,
    replaceGeneratingNodesWithResultCards,
    fillResultPlaceholders,
    applyCompleteResult,
    _applyCompleteResultInner,
    handleGenerate,
  }
}
