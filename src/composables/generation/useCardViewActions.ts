import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useGenerationHistoryStore } from '@/stores/generationHistory.store'
import { useAssetStore } from '@/stores/assets.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import { findTeamonesAigcRecord } from '@/api/assets'
import { getTaskStatus } from '@/api/generation'
import client from '@/api/client'
import { downloadMedia } from '@/utils/download'
import { buildPendingEditFromAsset } from '@/components/generation/generationResultAdapters'
import { useAssetDragIframeBridge } from '@/composables/assets/useAssetDragIframeBridge'
import { useAssetDragOut, type AssetDragPayload } from '@/composables/assets/useAssetDragOut'
import { useAssetDeleteConfirm } from '@/composables/assets/useAssetDeleteConfirm'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'

export function useCardViewActions(params: {
  inputRef: ReturnType<typeof ref<any>>
  resolveAssetUrl: (raw: any) => string
  resolveDragAssetUrl: (asset: any) => string
}) {
  const store = useGenerationHistoryStore()
  const assetStore = useAssetStore()
  const taskQueueStore = useTaskQueueStore()
  const { inputRef, resolveAssetUrl, resolveDragAssetUrl } = params
  const iframeBridge = useAssetDragIframeBridge()
  const assetDragOut = useAssetDragOut()
  const { confirmDeleteOne } = useAssetDeleteConfirm()

  const copiedPromptAssetId = ref<any>(null)
  let copiedPromptTimer: ReturnType<typeof setTimeout> | null = null

  // ── 右键菜单 ──
  const cardContextMenu = ref({ visible: false, x: 0, y: 0, asset: null as any })

  const onCardContextMenu = (e: MouseEvent, asset: any) => {
    e.preventDefault()
    e.stopPropagation()
    cardContextMenu.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      asset,
    }
  }

  const closeCardContextMenu = () => {
    cardContextMenu.value.visible = false
  }

  function getCardAssetUrl(): string {
    const asset = cardContextMenu.value.asset
    if (!asset) return ''
    if (asset.url && typeof asset.url === 'object') {
      return asset.url.proxy_url || asset.url.origin_url || ''
    }
    return resolveAssetUrl(asset.url)
  }

  const downloadCardImage = async () => {
    closeCardContextMenu()
    const url = getCardAssetUrl()
    if (!url) { ElMessage.warning('无法获取文件链接'); return }
    const ok = await downloadMedia(url)
    if (ok) ElMessage.success('已另存为')
  }

  function normalizeAssetText(value: any): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function joinAssetKeywords(asset: any): string {
    const raw = asset?.keywords || asset?.tags || asset?.labels || []
    if (Array.isArray(raw)) return raw.map(normalizeAssetText).filter(Boolean).join(' ')
    return normalizeAssetText(raw)
  }

  function buildDragPayload(asset: any): AssetDragPayload {
    const url = resolveDragAssetUrl(asset)
    const thumb = normalizeAssetText(asset.thumb)
    const filename = normalizeAssetText(asset.filename || asset.file_name || asset.name)
    const channel = inferTextureMaterialChannel({
      ...asset,
      url,
      filename,
      keywords: joinAssetKeywords(asset),
      label: asset.label || asset.title || asset.name || asset.model,
    })
    return {
      id: asset.id,
      url,
      thumb,
      type: asset.type,
      source: asset.source,
      dragOrigin: 'generation-card',
      mediaType: asset.mediaType,
      recordId: asset.record_id || asset.aigcRecordId,
      prompt: asset.prompt,
      model: asset.model,
      ...(channel ? { pbrChannel: channel } : {}),
    }
  }

  const onCardDragPrepare = (asset: any) => {
    const dragPayload = buildDragPayload(asset)
    assetDragOut.prepare(dragPayload)
  }

  // ── 卡片拖拽 ──
  const onCardDragStart = (e: DragEvent, asset: any) => {
    assetDragOut.startDrag(e, buildDragPayload(asset))
  }

  const onCardInternalDragStart = (e: DragEvent, asset: any) => {
    if (!e.dataTransfer) return
    const payload = buildDragPayload(asset)
    if (!payload.url) return
    e.dataTransfer.setData('application/x-asset-info', JSON.stringify(payload))
    e.dataTransfer.setData('application/x-asset-url', payload.url)
    e.dataTransfer.setData('text/uri-list', payload.url)
    e.dataTransfer.setData('text/plain', payload.url)
    e.dataTransfer.effectAllowed = 'copy'
    const target = e.target as HTMLElement | null
    const media = target?.querySelector?.('img, video') as HTMLElement | null
    if (media) e.dataTransfer.setDragImage(media, 40, 40)
  }

  const onCardDragEnd = (e: DragEvent, asset: any) => {
    const dragPayload = buildDragPayload(asset)
    assetDragOut.endDrag(e, dragPayload.url ? dragPayload : null)
  }

  // ── 编辑/重新生成 ──
  async function resolveRecordForReEdit(record: any) {
    const base = record?._asset || record
    const recordId = base?.record_id || base?.aigcRecordId || record?.record_id || record?.aigcRecordId
    if (!recordId || base?.source !== 'teamones_aigc_record') return base
    try {
      const detail = await findTeamonesAigcRecord(recordId)
      if (detail) {
        return { ...base, ...detail, record_id: detail.record_id || String(recordId) }
      }
    } catch (error) {
      console.warn('[CardView] 加载重新编辑参数失败，使用当前卡片数据', error)
    }
    return base
  }

  const applyPendingEditToInput = async (pending: ReturnType<typeof buildPendingEditFromAsset>) => {
    if (!inputRef.value) return
    await inputRef.value.restoreState({
      modelId: pending.modelId,
      capability: pending.capability,
      mode: pending.mode,
      prompt: pending.prompt,
      params: pending.generateParams || {},
      referenceUrls: pending.referenceUrls || [],
    })
  }

  const handleEdit = async (record: any) => {
    const pending = buildPendingEditFromAsset(await resolveRecordForReEdit(record), false)
    await applyPendingEditToInput(pending)
  }

  const handleRegenerate = async (record: any) => {
    if (record.status === 'error') {
      store.deleteRecord(record.id)
    }
    const pending = buildPendingEditFromAsset(await resolveRecordForReEdit(record), true)
    await applyPendingEditToInput(pending)
    setTimeout(() => inputRef.value?.handleSend(), 100)
  }

  const handleAssetDelete = async (id: number | string) => {
    if (typeof id === 'string') {
      try {
        await confirmDeleteOne()
        await assetStore.doDelete(id as string)
      } catch {
      }
    }
  }

  const copyAssetPrompt = async (asset: any) => {
    const promptText = asset?.prompt?.trim?.() || ''
    if (!promptText) {
      ElMessage.info('当前卡片没有提示词')
      return
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText)
      } else {
        const ta = document.createElement('textarea')
        ta.value = promptText
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      copiedPromptAssetId.value = asset.id
      ElMessage.success('提示词已复制')
      if (copiedPromptTimer) {
        clearTimeout(copiedPromptTimer)
      }
      copiedPromptTimer = setTimeout(() => {
        copiedPromptAssetId.value = null
        copiedPromptTimer = null
      }, 1600)
    } catch (error) {
      ElMessage.error('复制失败，请稍后重试')
    }
  }

  // ── 修复任务 ──
  async function handleRepairTask(task: any) {
    if (!task?.taskId) {
      ElMessage.warning('无法修复：缺少任务ID')
      return
    }
    try {
      const status: any = await getTaskStatus(task.taskId)
      if (status.status === 'completed') {
        await assetStore.load()
        taskQueueStore.removeTask(task.id)
        ElMessage.success('任务已完成，结果已加载')
        return
      }
      if (status.status === 'failed' || status.status === 'cancelled') {
        taskQueueStore.updateTask(task.id, {
          isGenerating: false,
          status: 'failed',
          statusText: status.error || '任务失败',
          canCancel: false,
        })
        ElMessage.error('任务已失败')
        return
      }
      const res = await client.post('/api/aigc_record/latest', { task_id: task.taskId }).catch(() => null)
      if (res?.data?.data?.record_id) {
        const repairRes = await client.post(`/api/aigc_record/${encodeURIComponent(res.data.data.record_id)}/repair`)
        const body = repairRes.data?.data ?? repairRes.data
        if (body?.rescue?.rescued) {
          await assetStore.load()
          taskQueueStore.removeTask(task.id)
          ElMessage.success('修复成功')
          return
        }
      }
      ElMessage.info('任务仍在生成中，请稍后刷新查看')
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || e?.message || '修复失败')
    }
  }

  const handleCancel = async (id: string) => {
    const task = taskQueueStore.tasks.find(t => String(t.id) === id)
    if (!task) return
    await taskQueueStore.cancelTask(task.id)
  }

  function cleanupCopiedPromptTimer() {
    if (copiedPromptTimer) {
      clearTimeout(copiedPromptTimer)
      copiedPromptTimer = null
    }
  }

  return {
    copiedPromptAssetId,
    cardContextMenu,
    onCardContextMenu,
    closeCardContextMenu,
    getCardAssetUrl,
    downloadCardImage,
    onCardDragPrepare,
    onCardDragStart,
    onCardInternalDragStart,
    onCardDragEnd,
    requestScreenshot: iframeBridge.requestScreenshot,
    requestHiddenWindowScreenshot: iframeBridge.requestHiddenWindowScreenshot,
    requestVisibleWindowScreenshot: iframeBridge.requestVisibleWindowScreenshot,
    onScreenshotCallback: iframeBridge.onScreenshotCallback,
    onceScreenshotCallback: iframeBridge.onceScreenshotCallback,
    resolveRecordForReEdit,
    applyPendingEditToInput,
    handleEdit,
    handleRegenerate,
    handleAssetDelete,
    copyAssetPrompt,
    handleRepairTask,
    handleCancel,
    cleanupCopiedPromptTimer,
  }
}
