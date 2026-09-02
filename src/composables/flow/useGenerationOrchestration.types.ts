import type { Ref, ComputedRef } from 'vue'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'
import type { WorkflowMediaType } from '@/utils/workflowNodeData'

export interface GenerationOrchestrationDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  selectedPanelNode: Ref<any>
  panelVisible: Ref<boolean>
  generationPanelRef: Ref<any>
  generationPanelLayoutTick: Ref<number>
  activePanelNode: ComputedRef<any>
  flowCanvasWrapperRef: Ref<any>
  generationPanelViewportAdjustFrame: { value: number }
  panelSwitchLockUntil: { value: number }
  panelSwitchLockedNodeId: { value: string }
  _panelClickOutsideHandler: { value: any }
  _activeGenerationTargetBySource: Map<string, string>
  _activeGenerationSessionBySource: Map<string, any>
  _generationSlotByTaskId: Map<string, string>
  _pendingRegenHadResult: Map<string, boolean>
  _pendingRegenHadRecordId: Map<string, boolean>
  generationStore: { isGenerating: boolean }
  assetStore: any
  PANEL_WIDTH: number
  PANEL_HEIGHT_FALLBACK: number
  PANEL_VIEWPORT_MARGIN: number
  fixedSizeTypes: Record<string, any>
  edgeStyle: Ref<string>
  viewport: Ref<any>
  setViewport: (vp: { x: number; y: number; zoom: number }) => void
  project: (pos: { x: number; y: number }) => { x: number; y: number }
  findNode: (id: string) => any
  updateNodeInternals: (ids: string[]) => void
  emit: (event: string, ...args: any[]) => void
  saveHistory: () => void
  propagateDataFlow: () => void
  syncTargetNodePrompt: (nodeId: string) => void
  getUpstreamPrompt: (nodeId: string) => string
  nodeSupportsFileUrls: (data: any) => boolean
  isImageLikeNode: (node: any) => boolean
  isVideoLikeNode: (node: any) => boolean
  getNodeMediaReferenceKey: (node: any) => string
  canOpenGenerationPanel: (node: any) => boolean
  hasNodeResultUrl: (node: any) => boolean
  inferNodeOutputMediaType: (type: string, data: any) => WorkflowMediaType
  createRuntimeId: (prefix: string) => string
  createEdgeId: (prefix: string) => string
  syncNodeEdgeHandles: (nodeId: string) => void
  cloneIncomingEdgeToTarget: (edge: any, targetNode: any) => any
  buildPortsForNode: typeof buildPortsForNodeContract
  normalizeResultItems: (result: any) => any[]
  buildResultNodeData: (sourceData: any, item: any, result: any, index: number) => any
  getResultItemNodeType: (item: any, sourceType: string) => string
  extractPreviewUrl: (item: any) => string | null
  getResultRecordId: (result: any, item: any, index: number) => string | null
  getNodeDataRecordId: (data: any) => string
  buildRegenerateContextFromRecord: (record: any, node: any) => any
  nodeHasGenerationContext: (data: any) => boolean
  getCachedAllowGenerateCountSchema: (modelId: string, mode: string, capability: string) => any
  getRememberedGenerateCount: (modelId: string, capability: string) => number | null
  markRegenerateSubmitCooldown: (count: number) => void
  buildResultCardLabel: (id: string, displayName?: string) => string
  createDetachedGenerationNode: (sourceNode: any) => any
  getDetachedCopyPosition: (sourceNode: any) => { x: number; y: number }
  buildDetachedCopyLabel: (label: string, nodeType: string) => string
  buildRuntimeWorkflowNodeData: (data: any, nodeType: string, typeDef: any) => any
  ensureResolvedResultTitle: (data: any, recordId: string) => any
  cloneGenerationState: (state: any) => any
  removeGeneratingPlaceholderNodes: (nodeId: string) => void
  nodeHasResolvedResult: (data: any) => boolean
  applyResolvedAssetToNodeData: (data: any, resolved: any) => any
  applyRecordIdToNodeData: (data: any, recordId: string) => any
  inferRegenerateType: (data: any) => string
  createGeneration: (request: any) => Promise<any>
  subscribeTaskEvents: (taskId: string, handlers: any) => void
}
