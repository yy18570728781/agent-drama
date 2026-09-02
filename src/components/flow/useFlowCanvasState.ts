import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useAssetStore } from '@/stores/assets.store'
import { useVisibleElementCulling } from '@/composables/flow/useVisibleElementCulling'

export interface FlowCanvasStateApi {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  models: Ref<any[]>
  capabilityPorts: Ref<Record<string, unknown>>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  pointOverviewCanvasRef: Ref<HTMLCanvasElement | null>
  isDraggingNode: Ref<boolean>
  isResizing: Ref<boolean>
  toolbarDropdown: Ref<unknown>
  groupToolbarDropdown: Ref<string | null>
  ctxSubmenu: Ref<unknown>
  showGrid: Ref<boolean>
  showMinimap: Ref<boolean>
  snapToGrid: Ref<boolean>
  shouldAutoHideMinimap: ComputedRef<boolean>
  effectiveShowMinimap: ComputedRef<boolean>
  onlyRenderVisibleElements: ComputedRef<boolean>
  selectedPanelNode: Ref<any>
  panelVisible: Ref<boolean>
  generationPanelRef: Ref<any>
  generationPanelLayoutTick: Ref<number>
  generationPanelViewportAdjustFrame: { value: number }
  panelSwitchLockUntilRef: { value: number }
  panelSwitchLockedNodeIdRef: { value: string }
  panelSwitchLockUntilAccessor: { get value(): number; set value(v: number) }
  panelSwitchLockedNodeIdAccessor: { get value(): string; set value(v: string) }
  panelClickOutsideHandler: { value: unknown }
  activePanelNode: ComputedRef<any>
  pendingRegenHadResult: Map<string, boolean>
  pendingRegenHadRecordId: Map<string, boolean>
  activeGenerationTargetBySource: Map<string, string>
  activeGenerationSessionBySource: Map<string, any>
  generationSlotByTaskId: Map<string, string>
  assetStore: ReturnType<typeof useAssetStore>
  fwdRemoveSelection: {
    current: ((options?: { reason?: string }) => boolean) | undefined
  }
  fwdHandleFitView: { current: (() => void) | undefined }
  skipEdgesChangeRef: { get value(): boolean; set value(v: boolean) }
  skipNodesChangeRef: { get value(): boolean; set value(v: boolean) }
}

function createCanvasCoreState() {
  const nodes = ref<any[]>([])
  let skipEdgesChange = false
  let skipNodesChange = false
  return {
    nodes,
    edges: ref<any[]>([]),
    models: ref<any[]>([]),
    capabilityPorts: ref<Record<string, unknown>>({}),
    flowCanvasWrapperRef: ref<HTMLElement | null>(null),
    pointOverviewCanvasRef: ref<HTMLCanvasElement | null>(null),
    isDraggingNode: ref(false),
    isResizing: ref(false),
    toolbarDropdown: ref<unknown>(null),
    groupToolbarDropdown: ref<string | null>(null),
    ctxSubmenu: ref<unknown>(null),
    skipEdgesChangeRef: {
      get value() { return skipEdgesChange },
      set value(value: boolean) { skipEdgesChange = value },
    },
    skipNodesChangeRef: {
      get value() { return skipNodesChange },
      set value(value: boolean) { skipNodesChange = value },
    },
  }
}

function createCanvasDisplayState(nodes: Ref<any[]>) {
  const showGrid = ref(true)
  const showMinimap = ref(true)
  const shouldAutoHideMinimap = computed(() => false)
  return {
    showGrid,
    showMinimap,
    snapToGrid: ref(true),
    shouldAutoHideMinimap,
    effectiveShowMinimap: computed(() => showMinimap.value && !shouldAutoHideMinimap.value),
    onlyRenderVisibleElements: useVisibleElementCulling(nodes),
  }
}

function createGenerationPanelState(findNode: (id: string) => any) {
  const selectedPanelNode = ref<any>(null)
  const panelSwitchLockUntilRef = { value: 0 }
  const panelSwitchLockedNodeIdRef = { value: '' }
  return {
    selectedPanelNode,
    panelVisible: ref(false),
    generationPanelRef: ref<any>(null),
    generationPanelLayoutTick: ref(0),
    generationPanelViewportAdjustFrame: { value: 0 },
    panelClickOutsideHandler: { value: null as unknown },
    panelSwitchLockUntilRef,
    panelSwitchLockedNodeIdRef,
    panelSwitchLockUntilAccessor: {
      get value() { return panelSwitchLockUntilRef.value },
      set value(value: number) { panelSwitchLockUntilRef.value = value },
    },
    panelSwitchLockedNodeIdAccessor: {
      get value() { return panelSwitchLockedNodeIdRef.value },
      set value(value: string) { panelSwitchLockedNodeIdRef.value = value },
    },
    activePanelNode: computed(() => {
      if (!selectedPanelNode.value?.id) return null
      return findNode(selectedPanelNode.value.id) || selectedPanelNode.value
    }),
  }
}

function createGenerationTrackingState() {
  return {
    pendingRegenHadResult: new Map<string, boolean>(),
    pendingRegenHadRecordId: new Map<string, boolean>(),
    activeGenerationTargetBySource: new Map<string, string>(),
    activeGenerationSessionBySource: new Map<string, any>(),
    generationSlotByTaskId: new Map<string, string>(),
  }
}

/**
 * Centralizes mutable canvas refs so the setup file can focus on wiring composables together.
 */
export function useFlowCanvasState(findNode: (id: string) => any): FlowCanvasStateApi {
  const core = createCanvasCoreState()

  return {
    ...core,
    ...createCanvasDisplayState(core.nodes),
    ...createGenerationPanelState(findNode),
    ...createGenerationTrackingState(),
    assetStore: useAssetStore(),
    fwdRemoveSelection: { current: undefined },
    fwdHandleFitView: { current: undefined },
  }
}
