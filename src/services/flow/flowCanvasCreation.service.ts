import type { WorkflowRecord } from './workflow.service'
import {
  changeWorkflowAssetCover,
  queryWorkflowAssetMedia,
  removeWorkflowAssetMedia,
  updateWorkflowAssetMedia,
} from '@/api/workflowAssets'
import { uploadToCos } from '@/utils/cosUpload'
import { createWorkflow, deleteWorkflow } from './workflow.service'

export interface EmptyFlowCanvasInput {
  categoryId?: string
  coverFile: File | null
  name: string
}

/**
 * 上传并绑定画布类资产的封面。
 * @param workflowId 画布或案例资产 ID。
 * @param coverFile 待上传的封面文件。
 * @returns 新封面可直接展示的 URL。
 * @throws 上传、媒体绑定或封面设置失败时抛出异常。
 */
export async function saveFlowAssetCover(workflowId: string, coverFile: File): Promise<string> {
  const uploaded = await uploadToCos(coverFile)
  const media = { ...uploaded } as Record<string, unknown>
  delete media.is_cover
  delete media.upload_type
  media.path = uploaded.thumb
  await updateWorkflowAssetMedia(workflowId, media)
  const records = await queryWorkflowAssetMedia(workflowId)
  const cover = records.find((item) => item.md5_name === uploaded.md5_name)
  const mediaId = String(cover?.id ?? cover?.media_id ?? '').trim()
  if (!mediaId) throw new Error('画布封面上传成功但未获取到媒体 ID')
  await changeWorkflowAssetCover(workflowId, mediaId)
  return uploaded.thumb
}

/**
 * 移除画布资产当前绑定的封面媒体。
 * @param workflowId 画布资产 ID。
 * @returns 封面不存在或移除完成后无返回值。
 * @throws 媒体查询或解绑失败时抛出异常。
 */
export async function removeFlowAssetCover(workflowId: string): Promise<void> {
  const records = await queryWorkflowAssetMedia(workflowId)
  const cover = records.find((item) => String(item.is_cover ?? '') === '1')
  const mediaId = String(cover?.id ?? cover?.media_id ?? '').trim()
  if (mediaId) await removeWorkflowAssetMedia(workflowId, mediaId)
}

/**
 * 上传可选封面并创建一个可立即打开的空画布资产。
 * @param input 画布名称、封面与可选目标分类。
 * @returns 已持久化的画布记录及其初始 definition。
 * @throws 封面上传或画布资产创建失败时抛出异常。
 */
export async function createEmptyFlowCanvas(input: EmptyFlowCanvasInput): Promise<WorkflowRecord> {
  const definition = {
    activeGraphId: 'root',
    edges: [],
    nodes: [],
    subgraphs: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  const workflow = await createWorkflow({
    categoryId: input.categoryId,
    definition,
    name: input.name,
  })
  if (workflow.source === 'local') return workflow
  if (!input.coverFile) return workflow
  try {
    await saveFlowAssetCover(workflow.id, input.coverFile)
    return workflow
  } catch (error) {
    await deleteWorkflow(workflow.id).catch(() => undefined)
    throw error
  }
}
