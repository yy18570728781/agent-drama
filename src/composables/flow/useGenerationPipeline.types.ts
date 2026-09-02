import type { Ref } from 'vue'
import type { useTaskQueueStore } from '@/stores/task-queue'
import type { GenerationDataPatcherDeps } from './generationNodeDataPatcher'
import type { UseBatchGridNodeDeps } from './useBatchGridNode'
import type { OrdinaryTaskFallbackDeps } from './useOrdinaryGenerationTaskFallback'

export interface GenerationRegenerateContext {
  capability: string
  countConfig?: {
    defaultValue: number
    label: string
    max?: number
    min: number
  }
  genType?: 'video' | 'audio' | 'model' | 'text' | 'image'
  mode?: string
  model?: string
  modelId: string
  prompt?: string
  requestParams?: Record<string, unknown>
}

export interface GenerationPipelinePayload {
  _batchGridBatchId?: unknown
  _pbrBatchId?: unknown
  _requestIndex?: number
  batchInfo?: Record<string, unknown>
  error?: unknown
  model?: string
  modelDisplayName?: string
  modelId?: string | number
  nodeId?: string
  prompt?: string
  recordId?: string | number
  references?: unknown[]
  result?: Record<string, unknown>
  state?: unknown
  task?: Record<string, unknown>
  taskId?: string | number
  type?: string
  [key: string]: unknown
}

export interface GenerationPipelineDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  selectedPanelNode: Ref<any>
  panelVisible: Ref<boolean>
  panelSwitchLockUntil: { get value(): number; set value(v: number) }
  panelSwitchLockedNodeId: { get value(): string; set value(v: string) }
  _pendingRegenHadResult: Map<string, boolean>
  _pendingRegenHadRecordId: Map<string, boolean>
  _activeGenerationTargetBySource: Map<string, string>
  _activeGenerationSessionBySource: Map<string, any>
  _generationSlotByTaskId: Map<string, string>
  emit: any
  findNode: UseBatchGridNodeDeps['findNode']
  createConnectedAssetNode: UseBatchGridNodeDeps['createConnectedAssetNode']
  getNodeBoxSize: UseBatchGridNodeDeps['getNodeBoxSize']
  getSelectedNodes: Ref<any[]>
  addSelectedNodes: Function
  removeSelectedNodes: Function
  updateNodeInternals: Function
  taskQueueStore: ReturnType<typeof useTaskQueueStore>
  nodeTypes: any[]
  canOpenGenerationPanel: Function
  hasNodeResultUrl: Function
  isFileInputNodeType: Function
  propagateDataFlow: Function
  isValidFlowEdge: (edge: any) => boolean
  createRuntimeId: Function
  createEdgeId: Function
  syncNodeEdgeHandles: Function
  cloneIncomingEdgeToTarget: Function
  connectReferenceItemsToNode: Function
  resolveNodeReferenceItems: Function
  ensureReferenceCardsForNode: Function
  extractUrl: Function
  extractPreviewUrl: Function
  normalizeResultItems: NonNullable<GenerationDataPatcherDeps['normalizeResultItems']>
  getResultItemNodeType: Function
  getResultRecordId: Function
  buildResultNodeData: Function
  getNodeDataRecordId: Function
  getNodeRepairRecordId: Function
  applyResolvedAssetToNodeData: Function
  extractEventRecordId: NonNullable<GenerationDataPatcherDeps['extractEventRecordId']>
  applyRecordIdToNodeData: GenerationDataPatcherDeps['applyRecordIdToNodeData']
  buildResultCardLabel: GenerationDataPatcherDeps['buildResultCardLabel']
  ensureResolvedResultTitle: Function
  clearGenerationTaskMarkers: Function
  removeGeneratingPlaceholderNodes: Function
  nodeHasResolvedResult: Function
  nodeHasGenerationContext: Function
  buildDetachedCopyLabel: Function
  getDetachedCopyPosition: Function
  createDetachedGenerationNode: Function
  getNodeStoredModelDisplayName: Function
  resolveNodeModelDisplayName: NonNullable<GenerationDataPatcherDeps['resolveNodeModelDisplayName']>
  inferMediaType: Function
  markRegenerateSubmitCooldown: Function
  buildNodeRegenerateContext: (node: unknown) => Promise<GenerationRegenerateContext>
  createGenerationTargetForExistingResult: Function
  resolveGenerateTargetNodeId: Function
  resolveOriginalNodeId: Function
  getActiveGenerationTargetNodeId: Function
  getGenerationSourceKey: Function
  markGenerationTaskCompleted: Function
  getGenerationSlotNodes: Function
  canUseSourceNodeAsGenerationSlot: Function
  registerSourceNodeAsGenerationSlot: Function
  createGenerationSlotForTask: Function
  assignTaskToIndexedGenerationSlot: Function
  assignTaskToGenerationSlot: Function
  bindGenerationTaskToSlot: Function
  resolveGenerationSlotByTaskId: Function
  nodeOwnsGenerationTask: Function
  clearGenerationTaskBinding: Function
  attachTaskIdToGenerationState: OrdinaryTaskFallbackDeps['attachTaskIdToGenerationState']
  shouldCreateSeparateResultCardPerTask: Function
  createGeneratingResultPlaceholders: Function
  createRegenCard: Function
  syncGeneratedResultNodes: Function
  restoreRecordIdAndCleanup: Function
  normalizeSingleResultNodeById?: Function
  repairResultNodeById?: Function
  showGenerationPanel: Function
  hideGenerationPanel: Function
  fixedSizeTypes: Record<string, any>
  createGeneration: Function
  subscribeTaskEvents: Function
  findTeamonesAigcRecord: NonNullable<GenerationDataPatcherDeps['findTeamonesAigcRecord']>
  buildRuntimeWorkflowNodeData: Function
  buildReferenceOrderFromNodeAndUrls: Function
  sanitizeWorkflowRequestParams: Function
  assignToGroupIfOverlapping: Function
  saveHistory: UseBatchGridNodeDeps['saveHistory']
  addLog: Function
  triggerNodeInferUpstream: Function
  closeContextMenu: Function
  isRepairableGeneratingNode: Function
  isRepairableMissingResultNode: Function
  isRepairableResultThumbnailNode: Function
  updateWorkflowNodeState: Function
  extractGenerateFailReason: NonNullable<GenerationDataPatcherDeps['extractGenerateFailReason']>
  generationPanelLayoutTick?: Ref<number>
  scheduleGenerationPanelViewportAdjustment?: () => void
}
