import { computed, ref, type ComputedRef } from 'vue'

type MediaAction = {
  kind: 'image_compare' | 'video_preview'
  label: string
  title: string
}

type CompareSelectionItem = {
  id: string
  title: string
  subtitle?: string
  image: string
  label?: string
}

type MultiSelectionMediaDeps = {
  selectedNodes: ComputedRef<any[]>
  getNodeMediaType: (node: any) => string
  openDetailForNodes?: (nodesData: any[]) => void | Promise<void>
}

function getNodeMediaUrl(node: any): string {
  return String(
    node?.data?.url
    || node?.data?.preview
    || node?.data?.imageUrl
    || node?.data?.videoUrl
    || ''
  ).trim()
}

function getNodeLabel(node: any, index: number): string {
  return String(node?.data?.label || '').trim() || `片段 ${index + 1}`
}

function getNodeSubtitle(node: any, index: number): string {
  return String(node?.data?.model || node?.data?.modelDisplayName || node?.data?.mediaType || '').trim() || `第 ${index + 1} 张`
}

function sortNodesForContext(nodes: any[]): any[] {
  return [...nodes].sort((a, b) => {
    const ay = Number(a?.position?.y || 0)
    const by = Number(b?.position?.y || 0)
    if (Math.abs(ay - by) > 80) return ay - by
    return Number(a?.position?.x || 0) - Number(b?.position?.x || 0)
  })
}

/**
 * 为多选媒体节点提供轻量上下文动作，复用已有弹层而不是继续堆叠画布逻辑。
 */
export function useFlowMultiSelectionMedia(deps: MultiSelectionMediaDeps) {
  const compareDialogVisible = ref(false)
  const compareDialogItems = ref<CompareSelectionItem[]>([])
  const videoPreviewVisible = ref(false)
  const videoPreviewUrls = ref<string[]>([])
  const videoSourceNodeIds = ref<string[]>([])

  const selectedMediaNodes = computed(() => {
    const selected = deps.selectedNodes.value.filter((node) => {
      if (!node || node.type === 'groupNode' || node.type === 'subgraph') return false
      return !!getNodeMediaUrl(node)
    })
    return sortNodesForContext(selected)
  })

  const mediaSelectionAction = computed<MediaAction | null>(() => {
    const selected = selectedMediaNodes.value
    if (selected.length < 2) return null

    const mediaTypes = new Set(selected.map((node) => deps.getNodeMediaType(node)))
    if (mediaTypes.size !== 1) return null

    const mediaType = [...mediaTypes][0]
    if (mediaType === 'image') {
      return { kind: 'image_compare', label: '快速对比', title: '快速对比所选图片' }
    }
    if (mediaType === 'video') {
      return { kind: 'video_preview', label: '多片段播放', title: '按当前多选顺序播放视频片段' }
    }
    return null
  })

  // 详情按钮：≥2 个媒体节点时即可出现，不区分类型
  const detailSelectionAvailable = computed<boolean>(() => selectedMediaNodes.value.length >= 2)

  function triggerSelectionAction(): void {
    const action = mediaSelectionAction.value
    const selected = selectedMediaNodes.value
    if (!action || selected.length < 2) return

    if (action.kind === 'image_compare') {
      compareDialogItems.value = selected.map((node, index) => ({
        id: node.id,
        title: getNodeLabel(node, index),
        subtitle: getNodeSubtitle(node, index),
        image: getNodeMediaUrl(node),
        label: getNodeLabel(node, index),
      }))
      compareDialogVisible.value = compareDialogItems.value.length > 1
      return
    }

    videoPreviewUrls.value = selected.map((node) => getNodeMediaUrl(node)).filter(Boolean)
    videoSourceNodeIds.value = selected.map((node) => node.id)
    videoPreviewVisible.value = videoPreviewUrls.value.length > 0
  }

  function triggerDetailAction(): void {
    const selected = selectedMediaNodes.value
    if (selected.length < 2) return
    if (typeof deps.openDetailForNodes !== 'function') return
    const nodesData = selected.map((node) => {
      const data = node?.data || {}
      const url = getNodeMediaUrl(node)
      const mediaType = deps.getNodeMediaType(node)
      return {
        nodeId: node?.id,
        nodeData: data,
        imageUrl: url,
        url,
        isVideo: mediaType === 'video',
        is360: false,
        recordId: data.recordId || data.record_id || '',
      }
    })
    void deps.openDetailForNodes(nodesData)
  }

  return {
    compareDialogVisible,
    compareDialogItems,
    videoPreviewVisible,
    videoPreviewUrls,
    videoSourceNodeIds,
    mediaSelectionAction,
    detailSelectionAvailable,
    triggerSelectionAction,
    triggerDetailAction,
  }
}
