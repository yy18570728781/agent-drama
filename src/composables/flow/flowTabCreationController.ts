import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import type { UseFlowTabCreationDeps } from './flowRuntime.types'
import type { WorkflowTab } from './flowCore.types'
import { createEmptyFlowCanvas } from '@/services/flow/flowCanvasCreation.service'
import { createFlowId } from '@/utils/flowId'
import { upsertWorkflowTab } from './flowTabCollection'
import {
  ROOT_GRAPH_ID,
  activeTabId,
  activeWorkflowId,
  activeWorkflowName,
  workflowTabs,
} from './useFlowCore'
import { normalizeFlowCanvasName } from './flowNameValidation'

/**
 * 创建一个尚未绑定远端资产的空白画布 Tab。
 * @param name 画布名称。
 * @returns 新建的 Tab 状态。
 */
export function buildDraftWorkflowTab(name: string): WorkflowTab {
  return {
    id: createFlowId('tab'),
    name: normalizeFlowCanvasName(name),
    isDraft: true,
    activeGraphId: ROOT_GRAPH_ID,
    nodes: [],
    edges: [],
    subgraphs: {},
    savedNodes: [],
    savedEdges: [],
    savedSubgraphs: {},
    workflowId: null,
    viewport: { zoom: 1, x: 0, y: 0 },
  }
}

/**
 * 持久化新画布，并把它加入当前多 Tab 工作区。
 * @param deps Tab 创建流程依赖。
 * @param draft 新建画布弹窗数据。
 * @param name 校验后的画布名称。
 * @returns 创建与工作区同步完成后无返回值。
 */
export async function createCanvasTab(
  deps: UseFlowTabCreationDeps,
  draft: FlowCanvasCreateDraft,
  name: string,
): Promise<void> {
  const workflow = await createEmptyFlowCanvas({ ...draft, name })
  const newTab = buildDraftWorkflowTab(name)
  newTab.workflowId = workflow.id
  newTab.isDraft = false
  workflowTabs.value = upsertWorkflowTab(workflowTabs.value, newTab)
  activeTabId.value = newTab.id
  activeWorkflowId.value = workflow.id
  activeWorkflowName.value = workflow.name
  await deps.loadDefinition(workflow.definition)
  if (deps.workflows) {
    deps.workflows.value = [workflow, ...deps.workflows.value.filter((item) => item.id !== workflow.id)]
  }
  await deps.saveTabs()
}
