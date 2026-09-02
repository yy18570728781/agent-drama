import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useSubjectCanvasStore, type PendingSubjectCanvasAsset } from '@/stores/subjectCanvas.store'

type AssetDropPayload = {
  asset?: unknown
  assets?: unknown[]
  clientX: number
  clientY: number
}

type UseFlowViewBridgeOptions = {
  handleLoadWorkflow: (id: string) => void
  refreshWorkflows?: () => Promise<void> | void
  setCanvasRef: (value: unknown) => void
  setSidebarRef: (value: unknown) => void
  setTabContextMenuRef: (value: unknown) => void
}

type CapabilityPortMap = Record<string, unknown>

type FlowWorkspaceBridge = {
  dropAssetAt?: (asset: unknown, clientX: number, clientY: number) => void
  setCapabilityPorts?: (ports: CapabilityPortMap) => void
}

/**
 * 收拢 FlowView 中与容器组件通信的桥接状态，避免页面继续膨胀。
 */
export function useFlowViewBridge(options: UseFlowViewBridgeOptions) {
  const subjectCanvasStore = useSubjectCanvasStore()
  const flowTabBarRef = ref<unknown>(null)
  const flowWorkspaceRef = ref<unknown>(null)
  const showWorkflowsPanel = ref(false)

  function onLoadWorkflow(id: string) {
    options.handleLoadWorkflow(id)
    showWorkflowsPanel.value = false
  }

  async function onUpdateShowWorkflowsPanel(value: boolean) {
    if (value) {
      await options.refreshWorkflows?.()
    }
    showWorkflowsPanel.value = value
  }

  function onDropAsset(payload: AssetDropPayload) {
    const workspace = flowWorkspaceRef.value as FlowWorkspaceBridge | null
    workspace?.dropAssetAt?.(payload.assets?.length ? payload.assets : payload.asset, payload.clientX, payload.clientY)
  }

  async function dropPendingSubject(instance: unknown): Promise<void> {
    const workspace = instance as FlowWorkspaceBridge | null
    if (!workspace?.dropAssetAt || !subjectCanvasStore.pendingAsset) return
    await nextTick()
    const canvas = document.querySelector<HTMLElement>('.flow-canvas-wrapper')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const asset: PendingSubjectCanvasAsset | null = subjectCanvasStore.takePendingAsset()
    if (!asset) return
    workspace.dropAssetAt(asset, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  async function syncCanvasCapabilityPorts(capabilityPortMap: CapabilityPortMap) {
    await nextTick()
    const workspace = flowWorkspaceRef.value as {
      setCapabilityPorts?: (ports: CapabilityPortMap) => void
    } | null
    workspace?.setCapabilityPorts?.(capabilityPortMap)
  }

  watch(
    flowTabBarRef,
    (instance) => {
      const tabBar = instance as { tabContextMenuRef?: unknown } | null
      options.setTabContextMenuRef(tabBar?.tabContextMenuRef ?? null)
    },
    { immediate: true },
  )

  watch(
    flowWorkspaceRef,
    (instance) => {
      options.setCanvasRef(instance)
      options.setSidebarRef(instance)
      void dropPendingSubject(instance)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    options.setCanvasRef(null)
    options.setSidebarRef(null)
    options.setTabContextMenuRef(null)
    flowWorkspaceRef.value = null
    flowTabBarRef.value = null
  })

  return {
    flowTabBarRef,
    flowWorkspaceRef,
    onDropAsset,
    onLoadWorkflow,
    onUpdateShowWorkflowsPanel,
    showWorkflowsPanel,
    syncCanvasCapabilityPorts,
  }
}
