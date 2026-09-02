import teamonesClient from './teamonesClient'
import { invalidateWorkflowAssetDetail } from './workflowAssetDetails'

type UnknownRecord = Record<string, unknown>

interface WorkflowAssetMediaMutation {
  add: UnknownRecord[]
  delete: number[]
}

async function mutateWorkflowAssetMedia(
  assetId: string,
  media: WorkflowAssetMediaMutation,
): Promise<void> {
  await teamonesClient.post('/api_assets/asset/update_asset_media', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { asset_id: Number(assetId), media },
  })
  invalidateWorkflowAssetDetail(assetId)
}

/**
 * 将已上传的封面媒体绑定到画布资产。
 * @param assetId 画布资产 ID。
 * @param media 待新增的 Teamones 媒体元数据。
 * @returns 无返回值。
 * @throws 媒体绑定接口失败时抛出请求异常。
 */
export async function updateWorkflowAssetMedia(
  assetId: string,
  media: UnknownRecord,
): Promise<void> {
  await mutateWorkflowAssetMedia(assetId, { add: [media], delete: [] })
}

/**
 * 解除指定媒体与画布资产的绑定。
 * @param assetId 画布资产 ID。
 * @param mediaId 待解除绑定的媒体 ID。
 * @returns 无返回值。
 * @throws 媒体解绑接口失败时抛出请求异常。
 */
export async function removeWorkflowAssetMedia(assetId: string, mediaId: string): Promise<void> {
  await mutateWorkflowAssetMedia(assetId, { add: [], delete: [Number(mediaId)] })
}

/**
 * 将指定媒体设置为画布资产封面。
 * @param assetId 画布资产 ID。
 * @param mediaId 媒体 ID。
 * @returns 无返回值。
 * @throws 设置封面接口失败时抛出请求异常。
 */
export async function changeWorkflowAssetCover(assetId: string, mediaId: string): Promise<void> {
  await teamonesClient.post('/api_assets/asset/change_asset_cover', {
    _isNotCancel: true,
    isThrowError: 'yes',
    data: { asset_id: Number(assetId), media_id: Number(mediaId) },
  })
  invalidateWorkflowAssetDetail(assetId)
}
