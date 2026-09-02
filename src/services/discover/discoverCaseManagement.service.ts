import type { DiscoverCaseDetail } from '@/components/discover/discover.types'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import { getFlowCaseCarouselIds, saveFlowCaseCarouselIds } from '@/api/flowCases'
import { deleteWorkflowAsset, updateWorkflowAsset } from '@/api/workflowAssets'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import {
  removeFlowAssetCover,
  saveFlowAssetCover,
} from '@/services/flow/flowCanvasCreation.service'

function assertManagePermission(detail: DiscoverCaseDetail): void {
  if (detail.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
    throw new Error('只有管理权限可以编辑或删除案例')
  }
}

function withCover(
  detail: DiscoverCaseDetail,
  coverUrl: string,
): DiscoverCaseDetail {
  return {
    ...detail,
    image: coverUrl,
    imageAlt: `${detail.title}案例封面`,
    video: undefined,
  }
}

/**
 * Update a managed case's name and optional cover.
 * @param detail Current case detail including its effective permission.
 * @param draft Edited name and cover selection.
 * @returns Updated case detail for immediate UI synchronization.
 * @throws When permission, asset update, or cover persistence fails.
 */
export async function updateManagedDiscoverCase(
  detail: DiscoverCaseDetail,
  draft: FlowCanvasCreateDraft,
): Promise<DiscoverCaseDetail> {
  assertManagePermission(detail)
  const name = draft.name.trim()
  if (!name) throw new Error('请输入案例名称')
  if (name !== detail.title) await updateWorkflowAsset(detail.id, name)

  let updated: DiscoverCaseDetail = {
    ...detail,
    imageAlt: `${name}案例封面`,
    title: name,
  }
  if (draft.coverFile) {
    updated = withCover(updated, await saveFlowAssetCover(detail.id, draft.coverFile))
  } else if (draft.removeCover) {
    await removeFlowAssetCover(detail.id)
    updated = withCover(updated, '')
  }
  return updated
}

/**
 * Set a cover directly from the empty-cover state.
 * @param detail Current case detail including its effective permission.
 * @param coverFile Image selected by the manager.
 * @returns Updated case detail containing the new cover URL.
 * @throws When permission or cover persistence fails.
 */
export async function setManagedDiscoverCaseCover(
  detail: DiscoverCaseDetail,
  coverFile: File,
): Promise<DiscoverCaseDetail> {
  assertManagePermission(detail)
  if (!coverFile.type.startsWith('image/')) throw new Error('请选择图片文件作为案例封面')
  const coverUrl = await saveFlowAssetCover(detail.id, coverFile)
  return withCover(detail, coverUrl)
}

async function removeDeletedCaseRecommendation(caseId: string): Promise<void> {
  const ids = await getFlowCaseCarouselIds()
  if (!ids.includes(caseId)) return
  await saveFlowCaseCarouselIds(ids.filter((id) => id !== caseId))
}

/**
 * Delete a managed case asset and best-effort clean its recommendation entry.
 * @param detail Current case detail including its effective permission.
 * @returns Resolves after the asset has been deleted.
 * @throws When permission validation or asset deletion fails.
 */
export async function deleteManagedDiscoverCase(
  detail: DiscoverCaseDetail,
): Promise<void> {
  assertManagePermission(detail)
  await deleteWorkflowAsset(detail.id)
  await removeDeletedCaseRecommendation(detail.id).catch((error: unknown) => {
    console.warn('[discover-case] cleanup deleted recommendation failed', error)
  })
}
