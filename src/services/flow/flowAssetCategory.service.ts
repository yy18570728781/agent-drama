import { getWorkflowAssetDetail, type WorkflowAssetRecord } from '@/api/workflowAssets'

function readCategoryId(record?: WorkflowAssetRecord): string {
  if (!record) return ''
  const asset = record.asset
  const categories = record.category ?? asset?.category ?? []
  const leafCategory = categories[categories.length - 1]
  return String(
    record.category_id
      ?? record.asset_category_id
      ?? record.categoryId
      ?? asset?.category_id
      ?? asset?.asset_category_id
      ?? asset?.categoryId
      ?? leafCategory?.id
      ?? '',
  ).trim()
}

/**
 * 读取画布资产所属分类，供编辑器返回资料库或新建画布时复用。
 * @param workflowId 画布资产 ID。
 * @returns 画布所属分类 ID；资产未绑定分类时返回空字符串。
 * @throws 资产详情接口返回业务错误时抛出异常。
 */
export async function resolveFlowAssetCategoryId(workflowId: string): Promise<string> {
  const asset = await getWorkflowAssetDetail(workflowId)
  return readCategoryId(asset ?? undefined)
}
