import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import type { FlowCanvasCreateDraft } from '@/components/flow/library/flowLibrary.types'
import type { ComputedRef, Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import {
  deleteWorkflowAsset,
  toggleWorkflowAssetFavorite,
  updateWorkflowAsset,
} from '@/api/workflowAssets'
import {
  removeFlowAssetCover,
  saveFlowAssetCover,
} from '@/services/flow/flowCanvasCreation.service'

interface UseFlowCanvasCardActionsOptions {
  canDelete: ComputedRef<boolean>
  canEdit: ComputedRef<boolean>
  patchCanvas: (canvasId: string, patch: Partial<FlowLibraryCanvas>) => void
  removeCanvas: (canvasId: string) => void
}

interface UseFlowCanvasCardActionsReturn {
  deleteCanvas: (canvas: FlowLibraryCanvas) => Promise<void>
  confirmEditCanvas: (draft: FlowCanvasCreateDraft) => Promise<void>
  editCanvas: (canvas: FlowLibraryCanvas) => Promise<void>
  editDialogVisible: Ref<boolean>
  editingCanvas: Ref<FlowLibraryCanvas | null>
  favoritePendingIds: Ref<Set<string>>
  isEditingCanvas: Ref<boolean>
  toggleCanvasFavorite: (canvas: FlowLibraryCanvas) => Promise<void>
}

async function confirmCanvasDeletion(canvas: FlowLibraryCanvas): Promise<boolean> {
  try {
    await ElMessageBox.confirm(`确定要删除画布【${canvas.name}】吗？`, '提示', {
      cancelButtonText: '取消',
      confirmButtonText: '确定',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

/**
 * 管理画布列表卡片的编辑、删除与收藏流程。
 * @param options 权限状态与列表局部更新函数。
 * @returns 卡片动作及收藏请求中状态。
 */
export function useFlowCanvasCardActions(
  options: UseFlowCanvasCardActionsOptions,
): UseFlowCanvasCardActionsReturn {
  const editDialogVisible = ref(false)
  const editingCanvas = ref<FlowLibraryCanvas | null>(null)
  const favoritePendingIds = ref(new Set<string>())
  const isEditingCanvas = ref(false)

  function setFavoritePending(canvasId: string, pending: boolean): void {
    const nextIds = new Set(favoritePendingIds.value)
    if (pending) nextIds.add(canvasId)
    else nextIds.delete(canvasId)
    favoritePendingIds.value = nextIds
  }

  async function editCanvas(canvas: FlowLibraryCanvas): Promise<void> {
    if (!options.canEdit.value) return
    editingCanvas.value = canvas
    editDialogVisible.value = true
  }

  async function confirmEditCanvas(draft: FlowCanvasCreateDraft): Promise<void> {
    const canvas = editingCanvas.value
    if (!canvas || isEditingCanvas.value) return
    const name = draft.name.trim()
    const hasCoverChange = !!draft.coverFile || !!draft.removeCover
    if (!name) return
    if (name === canvas.name && !hasCoverChange) {
      editDialogVisible.value = false
      return
    }
    isEditingCanvas.value = true
    try {
      if (name !== canvas.name) await updateWorkflowAsset(canvas.id, name)
      let cover = canvas.cover
      if (draft.coverFile) cover = await saveFlowAssetCover(canvas.id, draft.coverFile)
      else if (draft.removeCover) {
        await removeFlowAssetCover(canvas.id)
        cover = ''
      }
      options.patchCanvas(canvas.id, { cover, name, updatedAt: new Date().toISOString() })
      editDialogVisible.value = false
      ElMessage.success('画布已更新')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '画布更新失败')
    } finally {
      isEditingCanvas.value = false
    }
  }

  async function deleteCanvas(canvas: FlowLibraryCanvas): Promise<void> {
    if (!options.canDelete.value || !await confirmCanvasDeletion(canvas)) return
    try {
      await deleteWorkflowAsset(canvas.id)
      options.removeCanvas(canvas.id)
      ElMessage.success('画布已删除')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '画布删除失败')
    }
  }

  async function toggleCanvasFavorite(canvas: FlowLibraryCanvas): Promise<void> {
    if (favoritePendingIds.value.has(canvas.id)) return
    const nextFavorite = !canvas.isFavorite
    setFavoritePending(canvas.id, true)
    options.patchCanvas(canvas.id, { isFavorite: nextFavorite })
    try {
      await toggleWorkflowAssetFavorite(canvas.id)
      ElMessage.success(nextFavorite ? '收藏成功' : '取消收藏成功')
    } catch (error) {
      options.patchCanvas(canvas.id, { isFavorite: canvas.isFavorite })
      ElMessage.error(error instanceof Error ? error.message : '收藏操作失败')
    } finally {
      setFavoritePending(canvas.id, false)
    }
  }

  return {
    confirmEditCanvas,
    deleteCanvas,
    editCanvas,
    editDialogVisible,
    editingCanvas,
    favoritePendingIds,
    isEditingCanvas,
    toggleCanvasFavorite,
  }
}
