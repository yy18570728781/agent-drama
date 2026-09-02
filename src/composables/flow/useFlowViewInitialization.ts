import type { FlowTabLoadOptions } from '@/composables/flow/flowCore.types'
import { onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { getNodeTypes } from '@/api/workflows'
import {
  capabilityPorts,
  mergeBuiltinWorkflowNodeTypes,
  nodeTypes,
  setInitialized,
} from '@/composables/flow/useFlowCore'

type AsyncAction = () => Promise<unknown> | unknown

interface UseFlowViewInitializationOptions {
  addNewTab: () => void
  handleBeforeUnload: () => void
  hasOpenTabs: () => boolean
  initialWorkflowId: string
  loadDefinition: (definition: unknown) => Promise<void>
  loadDraft: AsyncAction
  loadProjectExamples: () => void
  loadTabs: (loadOptions?: FlowTabLoadOptions) => Promise<boolean>
  onLoad: (workflowId: string, loadOptions?: { forceReload?: boolean }) => Promise<unknown>
  onNewWorkflow: () => void
  recordTabHistory: () => void
  saveDraft: AsyncAction
  startNew: boolean
  performanceNodeCount: number
  syncCanvasCapabilityPorts: (ports: Record<string, unknown>) => Promise<void>
}

async function loadCanvasCapabilities(
  syncCanvasCapabilityPorts: UseFlowViewInitializationOptions['syncCanvasCapabilityPorts'],
): Promise<void> {
  try {
    const result = await getNodeTypes()
    nodeTypes.value = mergeBuiltinWorkflowNodeTypes(result.nodeTypes)
    capabilityPorts.value = result.capabilityPorts
    await syncCanvasCapabilityPorts(result.capabilityPorts)
  } catch (error) {
    console.error('加载节点类型失败:', error)
  }
}

async function openInitialEntry(options: UseFlowViewInitializationOptions): Promise<void> {
  if (import.meta.env.DEV && options.performanceNodeCount > 0) {
    const { createFlowPerformanceFixture } = await import('./flowPerformanceFixture.mock')
    options.onNewWorkflow()
    await options.loadDefinition(createFlowPerformanceFixture(options.performanceNodeCount))
    return
  }
  if (options.initialWorkflowId) {
    await options.onLoad(options.initialWorkflowId, { forceReload: true })
    return
  }
  if (!options.startNew) return
  options.onNewWorkflow()
  options.addNewTab()
}

/**
 * 装配画布编辑器的启动、路由入口和离开保存生命周期。
 * @param options 编辑器现有 persistence、tabs 与桥接动作。
 * @returns 无返回值，生命周期随页面组件自动注册。
 */
export function useFlowViewInitialization(options: UseFlowViewInitializationOptions): void {
  const isPerformanceFixture = import.meta.env.DEV && options.performanceNodeCount > 0
  onBeforeRouteLeave(() => {
    if (!isPerformanceFixture) options.handleBeforeUnload()
  })

  onMounted(async () => {
    if (!isPerformanceFixture) {
      window.addEventListener('beforeunload', options.handleBeforeUnload)
    }
    options.loadProjectExamples()
    await loadCanvasCapabilities(options.syncCanvasCapabilityPorts)
    const hasExplicitEntry = !!options.initialWorkflowId
      || options.startNew
      || isPerformanceFixture
    const tabsLoaded = isPerformanceFixture
      ? false
      : (options.hasOpenTabs()
          ? true
          : await options.loadTabs({ activate: !hasExplicitEntry }))
    if (!tabsLoaded && !hasExplicitEntry) await options.loadDraft()
    await openInitialEntry(options)
    setInitialized(true)
    options.recordTabHistory()
  })

  onUnmounted(() => {
    if (isPerformanceFixture) return
    window.removeEventListener('beforeunload', options.handleBeforeUnload)
    if (options.hasOpenTabs()) void options.saveDraft()
  })
}
