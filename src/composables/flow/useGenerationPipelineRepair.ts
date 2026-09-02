import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { GenerationPipelineDeps } from './useGenerationPipeline.types'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import { getMediaUrlMetrics } from '@/utils/mediaMetrics'
import { buildWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'

export interface GenerationPipelineRepairApi {
  isRepairingGeneratingNodes: ReturnType<typeof ref<boolean>>
  handleRepairGeneratingNodes: () => Promise<void>
  normalizeSingleResultNodeById: (nodeId: string) => Promise<boolean>
  repairResultNodeById: (nodeId: string) => Promise<boolean>
  handleForceRepairSelectedNodes: () => Promise<void>
}

/**
 * Isolates repair flows because they mutate many nodes but don't belong to the main generate path.
 */
export function useGenerationPipelineRepair(
  deps: GenerationPipelineDeps,
  applyRecordToExistingResultNode: (nodeId: string, record: any, fallbackRecordId?: string) => Promise<boolean>,
  applyCompleteResult: (nodeId: string, result: any) => Promise<void>,
): GenerationPipelineRepairApi {
  const isRepairingGeneratingNodes = ref(false)

  function getRepairMediaUrl(data: any): string {
    return String(data?.videoUrl || data?.imageUrl || data?.url || data?.preview || '').trim()
  }

  function getRecordMetrics(record: any): { width: number; height: number; aspectRatio: number } | null {
    const media = record?.media?.[0]
    const width = Number(media?.width || record?.width || 0)
    const height = Number(media?.height || record?.height || 0)
    if (!(width > 0) || !(height > 0)) return null
    return { width, height, aspectRatio: width / height }
  }

  function canRefreshMediaMetrics(node: any): boolean {
    const mediaType = String(node?.data?.mediaType || '').trim()
    return (mediaType === 'image' || mediaType === 'video') && Boolean(getRepairMediaUrl(node?.data))
  }

  function getDisplayedNodeSize(node: any): { width: number; height: number } | null {
    const styleWidth = Number.parseFloat(String(node?.style?.width || ''))
    const styleHeight = Number.parseFloat(String(node?.style?.height || ''))
    const width = styleWidth > 0 ? styleWidth : Number(node?.dimensions?.width || 0)
    const height = styleHeight > 0 ? styleHeight : Number(node?.dimensions?.height || 0)
    return width > 0 && height > 0 ? { width, height } : null
  }

  function shouldPreserveDisplayedSize(node: any, mediaType: string, metrics: { width: number; height: number; aspectRatio: number }) {
    if (node?.data?._manualSize) return true
    return false
  }

  async function normalizeSingleResultNodeById(nodeId: string): Promise<boolean> {
    const node = deps.nodes.value.find((item) => item.id === nodeId)
    if (!node) return false
    if (Number.isFinite(Number(node.data?._requestIndex)) && node.data?._resultPlaceholderForNodeId) return false
    const recordId = deps.getNodeRepairRecordId(node.data)
    if (!recordId) return refreshNodeMediaMetrics(nodeId, undefined, true)

    const record = await deps.findTeamonesAigcRecord(recordId)
    if (!record) return false

    let changed = false
    if (deps.isRepairableMissingResultNode(node)) {
      await applyRecordToExistingResultNode(nodeId, record, recordId)
      changed = true
    }
    if (await refreshNodeMediaMetrics(nodeId, record, true)) changed = true
    if (changed) {
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
    }
    return changed
  }

  async function refreshNodeMediaMetrics(nodeId: string, record?: any, forceCorrectSize = false): Promise<boolean> {
    const index = deps.nodes.value.findIndex((item) => item.id === nodeId)
    if (index < 0) return false
    const node = deps.findNode(nodeId) || deps.nodes.value[index]
    if (!canRefreshMediaMetrics(node)) return false
    const mediaType = String(node.data?.mediaType || 'image')
    const metrics = getRecordMetrics(record) || await getMediaUrlMetrics(getRepairMediaUrl(node.data), mediaType)
    if (!metrics) return false
    const size = getFlowMediaNodeSize(metrics ? { mediaType, ...metrics } : { mediaType })
    const preserveSize = !forceCorrectSize && shouldPreserveDisplayedSize(node, mediaType, metrics)
    const displayedSize = preserveSize ? getDisplayedNodeSize(node) : null
    const nextStyle = displayedSize
      ? { ...(node.style || {}), width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }
      : { ...(deps.nodes.value[index]?.style || {}), width: `${size.width}px`, height: `${size.height}px` }
    deps.nodes.value[index] = {
      ...deps.nodes.value[index],
      data: {
        ...(deps.nodes.value[index]?.data || {}),
        mediaMeta: buildWorkflowMediaMeta(metrics.width, metrics.height, metrics.aspectRatio),
      },
      style: nextStyle,
    }
    return true
  }

  /**
   * 修复 texture_material 容器内缺 url 的 item：拉 AIGC record 后直接把 url/thumb/recordId
   * 写进 item.data。不走 applyResolvedAssetToNodeData —— 那会给 item.data 塞 ports 等运行期字段。
   */
  async function repairTextureMaterialItems(nodeId: string): Promise<number> {
    const idx = deps.nodes.value.findIndex((n) => n.id === nodeId)
    if (idx < 0) return 0
    const node = deps.nodes.value[idx]
    if (node.type !== 'texture_material') return 0
    const items = Array.isArray(node.data?.items) ? node.data.items : []
    if (!items.length) return 0

    const nextItems = [...items]
    let repairedCount = 0
    for (let i = 0; i < nextItems.length; i += 1) {
      const it = nextItems[i] || {}
      const data = it.data || {}
      if (String(data.url || '').trim()) continue
      const recordId = String(data.recordId || '').trim()
      if (!recordId) continue
      try {
        const record = await deps.findTeamonesAigcRecord(recordId)
        const media = record?.media?.[0] || record?.media_info
        const url = media?.origin_url || record?.url || ''
        if (!url) continue
        const thumb = media?.thumb || url
        nextItems[i] = {
          ...it,
          data: {
            ...data,
            url,
            thumb,
            recordId,
          },
        }
        repairedCount += 1
      } catch (error) {
        console.warn('[FlowCanvas] repair texture_material item failed:', error)
      }
    }

    if (repairedCount > 0) {
      deps.nodes.value[idx] = { ...node, data: { ...node.data, items: nextItems } }
    }
    return repairedCount
  }

  async function handleRepairGeneratingNodes(): Promise<void> {
    if (isRepairingGeneratingNodes.value) return

    const candidates = deps.nodes.value.filter((node) => (
      node.type === 'texture_material'
      || deps.isRepairableGeneratingNode(node)
      || deps.isRepairableMissingResultNode(node)
      || deps.isRepairableResultThumbnailNode(node)
      || canRefreshMediaMetrics(node)
    ))
    if (!candidates.length) {
      deps.emit('repair-progress', { active: false, current: 0, total: 0 })
      ElMessage.info('没有找到可修复的生成卡、结果缩略图或媒体尺寸')
      return
    }

    isRepairingGeneratingNodes.value = true
    let repaired = 0
    let missing = 0
    let failed = 0
    let repairedMissingResult = 0
    let repairedMediaMetrics = 0
    let repairedTmItems = 0
    deps.emit('repair-progress', { active: true, current: 0, total: candidates.length })

    try {
      for (let index = 0; index < candidates.length; index += 1) {
        const node = candidates[index]

        // texture_material 容器：走 items 补全，不走标准节点修复
        if (node.type === 'texture_material') {
          try {
            const count = await repairTextureMaterialItems(node.id)
            if (count > 0) {
              repairedTmItems += count
              repaired += 1
              deps.nodes.value = [...deps.nodes.value]
              deps.emit('update:modelNodes', deps.nodes.value)
            } else {
              missing += 1
            }
          } catch (error) {
            console.warn('[FlowCanvas] repair texture_material failed:', error)
            failed += 1
          }
          deps.emit('repair-progress', { active: true, current: index + 1, total: candidates.length })
          continue
        }

        const recordId = deps.getNodeRepairRecordId(node.data)
        if (!recordId && !canRefreshMediaMetrics(node)) {
          missing += 1
          deps.emit('repair-progress', { active: true, current: index + 1, total: candidates.length })
          continue
        }

        try {
          let changed = false
          const repairedMissingResultNode = deps.isRepairableMissingResultNode(node)
          const repairedMetricsNode = canRefreshMediaMetrics(node)
          if (await normalizeSingleResultNodeById(node.id)) changed = true
          if (changed) repaired += 1
          else missing += 1
          if (changed && repairedMissingResultNode) repairedMissingResult += 1
          if (changed && repairedMetricsNode) repairedMediaMetrics += 1

          if (deps.selectedPanelNode.value?.id === node.id) {
            const refreshedNode = deps.findNode(node.id) || deps.nodes.value.find((item) => item.id === node.id)
            if (!deps.canOpenGenerationPanel(refreshedNode)) {
              deps.hideGenerationPanel?.()
            }
          }
        } catch (error) {
          console.warn('[FlowCanvas] repair generating node failed:', error)
          failed += 1
        }
        deps.emit('repair-progress', { active: true, current: index + 1, total: candidates.length })
      }
    } finally {
      isRepairingGeneratingNodes.value = false
      deps.emit('repair-progress', { active: false, current: candidates.length, total: candidates.length })
    }

    if (repaired > 0) {
      deps.saveHistory()
    }
    ElMessage.success(
      `修复完成：成功 ${repaired}（结果补齐 ${repairedMissingResult}，媒体尺寸修复 ${repairedMediaMetrics}，材质通道补图 ${repairedTmItems}），缺失 ${missing}，失败 ${failed}`,
    )
  }

  async function repairResultNodeById(nodeId: string): Promise<boolean> {
    return normalizeSingleResultNodeById(nodeId)
  }

  async function handleForceRepairSelectedNodes(): Promise<void> {
    const selectedIds = deps.nodes.value
      .filter((node) => node.selected)
      .map((node) => node.id)
    if (!selectedIds.length) {
      ElMessage.info('请先选择要修复的节点')
      return
    }

    let repaired = 0
    let failed = 0
    for (const nodeId of selectedIds) {
      try {
        if (await repairResultNodeById(nodeId)) repaired += 1
      } catch (error) {
        console.warn('[FlowCanvas] force repair selected node failed:', error)
        failed += 1
      }
    }

    if (repaired > 0) deps.saveHistory()
    ElMessage.success(`强制修复完成：成功 ${repaired}，失败 ${failed}`)
  }

  return {
    isRepairingGeneratingNodes,
    handleRepairGeneratingNodes,
    normalizeSingleResultNodeById,
    repairResultNodeById,
    handleForceRepairSelectedNodes,
  }
}
