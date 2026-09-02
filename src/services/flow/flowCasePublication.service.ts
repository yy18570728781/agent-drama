import { createFlowCaseAsset, type FlowCaseAsset } from '@/api/flowCases'
import { deleteWorkflowAsset } from '@/api/workflowAssets'
import { saveFlowAssetCover } from './flowCanvasCreation.service'
import { saveFlowCanvasDefinition } from './flowCanvasStorage.service'
import { getWorkflow } from './workflow.service'

export interface PublishFlowCaseInput {
  categoryId: string
  coverFile: File | null
  name: string
  sourceWorkflowId: string
}

function createCaseCode(): string {
  return `canvas_case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 将已保存画布复制为 category_type 14 下的独立案例资产。
 * @param input 源画布、目标目录、案例名称与可选封面。
 * @returns 新创建的案例资产。
 * @throws 源画布读取、资产创建、快照复制或封面保存失败时抛出异常。
 */
export async function publishFlowCase(input: PublishFlowCaseInput): Promise<FlowCaseAsset> {
  const source = await getWorkflow(input.sourceWorkflowId)
  const code = createCaseCode()
  let created: FlowCaseAsset | null = null
  try {
    created = await createFlowCaseAsset(input.name, code, input.categoryId)
    await saveFlowCanvasDefinition(created.code, source.definition)
    if (input.coverFile) await saveFlowAssetCover(created.id, input.coverFile)
    return created
  } catch (error) {
    if (created?.id) await deleteWorkflowAsset(created.id).catch(() => undefined)
    throw error
  }
}
