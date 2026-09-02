import { reactive, nextTick } from 'vue'
import type { Ref } from 'vue'
import { uploadFileToCosUrl, getUploadErrorMessage } from '@/api/uploadHelpers'
import { createThumbnailFileIfNeeded, createVideoThumbnailFile } from '@/utils/imageThumbnail'
import { IMAGE_UPLOAD_SIZE_LIMIT, compressImageFileToLimit } from '@/utils/imageCompression'
import { getMediaFileMetrics } from '@/utils/mediaMetrics'
import { ElMessage } from 'element-plus'
import { buildWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { postMediaCache } from '@/api/mediaCache'
import { useThemeStore } from '@/styles/theme/store/theme'
import type { useNodeFactory } from './useNodeFactory'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import { getUploadLikeFileInputNodeIdsForTarget, isUploadLikeFileInputNode } from './flowReferenceNodes'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'

// ==================== 依赖接口 ====================

export interface FileUploadDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  edgeStyle: Ref<string>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
  }
  createRuntimeId: (prefix?: string) => string
  getPrimaryPortId: (nodeData: any, direction: string) => string | undefined
  syncNodeEdgeHandles: (nodeId: string) => void
  isValidFlowEdge: (edge: any) => boolean
  propagateDataFlow: () => void
  refreshOpenGenerationPanelForNode: (nodeId: string) => void
  saveHistory: () => void
  updateNodeInternals: (ids: string[]) => void
  buildRuntimeAssetNodeData: (opts: any) => any
  buildPortsForNode: typeof buildPortsForNodeContract
  getUpstreamAssetNodePosition: (targetNodeId: string, index: number, style?: any) => { x: number; y: number }
  getStackedAssetNodePosition: (basePosition: { x: number; y: number }, index: number, style?: any) => { x: number; y: number }
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  fixedSizeTypes: Record<string, any>
}

// ==================== 模块级状态 ====================

const imageCompressDialog: {
  visible: boolean
  files: File[]
  resolver: ((value: any) => void) | null
} = reactive({
  visible: false,
  files: [],
  resolver: null,
})

// ==================== 跨节点文件去重 ====================

function buildFileDedupKey(name: string, size: number): string {
  return `${name}|${size}`
}

/**
 * 上传前与画布上已有的上传型 file_input 节点做 name|size 去重。
 * 有 targetNodeId 时只对比连接到该目标节点的上游；无 targetNodeId 时对比画布上全部上传型节点。
 */
function dedupeEntriesAgainstTarget(
  entries: any[],
  targetNodeId: string | undefined,
  nodes: any[],
  edges: any[],
  findNode: (id: string) => any,
): { entries: any[]; skippedCount: number } {
  let candidateNodes: any[]
  if (targetNodeId) {
    const connectedIds = getUploadLikeFileInputNodeIdsForTarget(targetNodeId, nodes, edges)
    candidateNodes = connectedIds.map((id) => findNode(id)).filter(Boolean)
  } else {
    candidateNodes = nodes.filter((node) => isUploadLikeFileInputNode(node))
  }

  if (!candidateNodes.length) return { entries, skippedCount: 0 }

  const existingKeys = new Set<string>()
  for (const node of candidateNodes) {
    const name = String(node?.data?.sourceFileName || node?.data?.label || '')
    const size = Number(node?.data?.sourceFileSize) || 0
    if (name) existingKeys.add(buildFileDedupKey(name, size))
  }

  const kept: any[] = []
  let skippedCount = 0
  for (const entry of entries) {
    const key = buildFileDedupKey(entry.originalName, entry.originalSize)
    if (existingKeys.has(key)) {
      skippedCount += 1
      continue
    }
    existingKeys.add(key)
    kept.push(entry)
  }

  return { entries: kept, skippedCount }
}

// ==================== 组合式函数 ====================

export function useFileUpload(deps: FileUploadDeps) {
  const {
    nodes,
    edges,
    findNode,
    edgeStyle,
    emit,
    createRuntimeId,
    getPrimaryPortId,
    syncNodeEdgeHandles,
    isValidFlowEdge,
    propagateDataFlow,
    refreshOpenGenerationPanelForNode,
    saveHistory,
    updateNodeInternals,
    buildRuntimeAssetNodeData,
    buildPortsForNode,
    getUpstreamAssetNodePosition,
    getStackedAssetNodePosition,
    assignToGroupIfOverlapping,
    fixedSizeTypes,
  } = deps

  // ==================== 文件分类 ====================

  function classifyUploadFile(file: File) {
    const mimeType = file?.type || ''
    const fileName = file?.name || ''
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    if (mimeType.startsWith('image/')) {
      return { mediaType: 'image', label: '图片上传', textContent: '' }
    }
    if (mimeType.startsWith('video/')) {
      return { mediaType: 'video', label: '视频上传', textContent: '' }
    }
    if (mimeType.startsWith('audio/')) {
      return { mediaType: 'audio', label: '音频上传', textContent: '' }
    }
    if (['glb', 'gltf', 'fbx', 'obj', 'usdz', 'blend'].includes(ext)) {
      return { mediaType: '3d_model', label: fileName, textContent: '' }
    }
    if (mimeType.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) {
      return { mediaType: 'text', label: fileName, textContent: null }
    }
    return null
  }

  // ==================== 图片压缩对话框 ====================

  function handleImageCompressDialogVisibleChange(value: boolean) {
    imageCompressDialog.visible = !!value
    if (!value && imageCompressDialog.resolver) {
      imageCompressDialog.resolver(null)
      imageCompressDialog.resolver = null
    }
  }

  function handleImageCompressDialogCancel() {
    if (imageCompressDialog.resolver) {
      imageCompressDialog.resolver(null)
      imageCompressDialog.resolver = null
    }
    imageCompressDialog.visible = false
    imageCompressDialog.files = []
  }

  function handleImageCompressDialogConfirm(files: File[]) {
    if (imageCompressDialog.resolver) {
      imageCompressDialog.resolver(Array.isArray(files) ? files : [])
      imageCompressDialog.resolver = null
    }
    imageCompressDialog.visible = false
    imageCompressDialog.files = []
  }

  async function maybeCompressImageFilesBeforeUpload(files: File[]) {
    const themeStore = useThemeStore()
    const maxBytes = themeStore.compressThresholdMb * 1024 * 1024
    const originalFiles = Array.isArray(files) ? files.filter((file) => file instanceof File) : []
    const oversizeImages = originalFiles.filter((file) => file.type?.startsWith('image/') && file.size > maxBytes)
    if (!oversizeImages.length) return originalFiles

    const imageFiles = originalFiles.filter((file) => file.type?.startsWith('image/'))

    if (themeStore.autoCompressOriginalRatio) {
      const loadingMessage = ElMessage({
        message: `正在自动原比例压缩 ${imageFiles.length} 张图片...`,
        type: 'info',
        duration: 0,
      })
      let processedImages: File[]
      try {
        processedImages = await Promise.all(
          imageFiles.map((file) => compressImageFileToLimit(file, { lockRatio: true, maxBytes })),
        )
      } catch {
        loadingMessage.close()
        return null
      }
      loadingMessage.close()
      let imageIndex = 0
      return originalFiles.map((file) => {
        if (!file.type?.startsWith('image/')) return file
        const replacement = processedImages[imageIndex]
        imageIndex += 1
        return replacement instanceof File ? replacement : file
      })
    }

    const processedImages = await new Promise((resolve) => {
      imageCompressDialog.files = imageFiles
      imageCompressDialog.visible = true
      imageCompressDialog.resolver = resolve
    })

    if (!processedImages) return null
    const nextImages = Array.isArray(processedImages) ? processedImages : imageFiles
    let imageIndex = 0
    return originalFiles.map((file) => {
      if (!file.type?.startsWith('image/')) return file
      const replacement = nextImages[imageIndex]
      imageIndex += 1
      return replacement instanceof File ? replacement : file
    })
  }

  // ==================== 上传并创建节点 ====================

  async function createUploadNodesFromFiles(files: File[], position: { x: number; y: number }, loadingText = '', options: any = {}) {
    if (!files?.length) return []

    const rawFiles = Array.from(files)
    const preparedFiles = await maybeCompressImageFilesBeforeUpload(rawFiles)
    if (!preparedFiles?.length) return []

    const supportedEntries: any[] = []
    for (let i = 0; i < preparedFiles.length; i++) {
      const file = preparedFiles[i]
      const rawFile = rawFiles[i]
      const classified = classifyUploadFile(file)
      if (!classified) continue
      const thumbFile = classified.mediaType === 'image'
        ? await createThumbnailFileIfNeeded(file).catch(() => null)
        : classified.mediaType === 'video'
          ? await createVideoThumbnailFile(file).catch(() => null)
          : null
      supportedEntries.push({
        file,
        fileName: file.name || 'pasted-file',
        originalName: rawFile?.name || file.name || 'pasted-file',
        originalSize: rawFile?.size || file.size || 0,
        mediaType: classified.mediaType,
        label: classified.label,
        textContent: classified.textContent === null ? await file.text() : classified.textContent,
        metrics: ['image', 'video'].includes(classified.mediaType) ? await getMediaFileMetrics(file, classified.mediaType) : null,
        thumbFile,
      })
    }

    if (!supportedEntries.length) return []

    const dedupTargetNodeId = typeof options?.targetNodeId === 'string' ? options.targetNodeId : undefined
    const { entries: dedupedEntries, skippedCount: crossNodeDuplicates } =
      dedupeEntriesAgainstTarget(supportedEntries, dedupTargetNodeId, nodes.value, edges.value, findNode)
    if (crossNodeDuplicates > 0) {
      ElMessage.warning(`检测到 ${crossNodeDuplicates} 个重复文件，已跳过`)
    }
    if (!dedupedEntries.length) return []

    const loadingMessage = ElMessage({
      message: loadingText || `正在上传 ${dedupedEntries.length} 个文件...`,
      type: 'info',
      duration: 0,
      showClose: false,
    })

    const uploadResults = await Promise.allSettled(
      dedupedEntries.map(async (entry) => ({
        url: await uploadFileToCosUrl(entry.file, entry.fileName),
        thumbUrl: entry.thumbFile ? await uploadFileToCosUrl(entry.thumbFile, entry.thumbFile.name) : '',
      }))
    )
    loadingMessage.close()

    const existingCandidateNodes = dedupTargetNodeId
      ? getUploadLikeFileInputNodeIdsForTarget(dedupTargetNodeId, nodes.value, edges.value).map((id) => findNode(id)).filter(Boolean)
      : nodes.value.filter((node) => isUploadLikeFileInputNode(node))
    const seenUploadedUrls = new Set<string>(
      existingCandidateNodes
        .map((node) => String(node?.data?.url || '').trim())
        .filter(Boolean),
    )
    const duplicateEntries = []
    const failedEntries: any[] = []
    const nodesToCreate: any[] = []

    uploadResults.forEach((result, index) => {
      const entry = dedupedEntries[index]
      if (result.status !== 'fulfilled') {
        failedEntries.push({
          fileName: entry.fileName,
          message: getUploadErrorMessage(result.reason),
        })
        return
      }

      const serverUrl = String(result.value?.url || '').trim()
      const thumbUrl = String(result.value?.thumbUrl || '').trim()
      if (!serverUrl) {
        failedEntries.push({
          fileName: entry.fileName,
          message: '上传成功但未返回有效地址',
        })
        return
      }

      if (seenUploadedUrls.has(serverUrl)) {
        duplicateEntries.push({ fileName: entry.fileName, url: serverUrl })
        return
      }
      seenUploadedUrls.add(serverUrl)

      if (thumbUrl) {
        postMediaCache({ url: serverUrl, thumb: thumbUrl }).catch((err) => {
          console.warn('[useFileUpload] write media-cache failed:', err)
        })
      }

      const nodeData = {
        ...buildRuntimeAssetNodeData({
          label: entry.label,
          nodeType: 'file_input',
          url: serverUrl,
          thumb: thumbUrl || undefined,
          content: entry.mediaType === 'text' ? entry.textContent : undefined,
          mediaType: entry.mediaType,
        }),
        url: serverUrl,
        mediaType: entry.mediaType,
        sourceFileName: entry.originalName,
        sourceFileSize: entry.originalSize,
        ports: buildPortsForNode('file_input', entry.mediaType),
        ...(buildWorkflowMediaMeta(entry.metrics?.width, entry.metrics?.height, entry.metrics?.aspectRatio)
          ? { mediaMeta: buildWorkflowMediaMeta(entry.metrics?.width, entry.metrics?.height, entry.metrics?.aspectRatio) }
          : {}),
      }

      if (entry.mediaType === 'image') {
        nodeData.preview = serverUrl
        nodeData.imageUrl = serverUrl
        if (thumbUrl) nodeData.thumb = thumbUrl
      } else if (entry.mediaType === 'video') {
        nodeData.preview = serverUrl
        nodeData.videoUrl = serverUrl
        if (thumbUrl) {
          nodeData.thumb = thumbUrl
          nodeData.thumbnail_url = thumbUrl
        }
      } else if (entry.mediaType === 'audio') {
        nodeData.audioUrl = serverUrl
      } else if (entry.mediaType === 'text') {
        nodeData.content = entry.textContent
      } else if (entry.mediaType === '3d_model') {
        nodeData.preview = serverUrl
        nodeData.imageUrl = serverUrl
      }

      nodesToCreate.push({
        type: 'file_input',
        data: nodeData,
        style: entry.metrics
          ? (() => {
              const size = getFlowMediaNodeSize({
                mediaType: entry.mediaType,
                width: entry.metrics.width,
                height: entry.metrics.height,
                aspectRatio: entry.metrics.aspectRatio,
              })
              return { width: `${size.width}px`, height: `${size.height}px` }
            })()
          : fixedSizeTypes.file_input,
      })
    })

    const targetNodeId = typeof options?.targetNodeId === 'string' ? options.targetNodeId : ''
    const targetNode = targetNodeId ? findNode(targetNodeId) : null
    const targetHandleId = getPrimaryPortId(targetNode?.data, 'input')
    const targetEdgeIndex = Number.isFinite(Number(options?.targetEdgeIndex)) ? Number(options.targetEdgeIndex) : -1
    const basePosition = { x: position.x - 80, y: position.y - 20 }
    const createdNodes = nodesToCreate.map((nodeConfig, index) => {
      const nodeId = createRuntimeId('node')
      const nodePosition = targetNodeId
        ? getUpstreamAssetNodePosition(targetNodeId, index, nodeConfig.style)
        : getStackedAssetNodePosition(basePosition, index, nodeConfig.style)
      const newNode = {
        id: nodeId,
        type: nodeConfig.type,
        position: nodePosition,
        data: nodeConfig.data,
        style: nodeConfig.style,
      }

      assignToGroupIfOverlapping(newNode, nodePosition.x, nodePosition.y)
      return newNode
    })

    if (createdNodes.length) {
      nodes.value = [...nodes.value, ...createdNodes]
      emit('update:modelNodes', nodes.value)
    }

    if (createdNodes.length && targetNodeId && targetHandleId !== undefined) {
      const nextEdges = createdNodes
        .map((node) => ({
          id: createRuntimeId('edge'),
          source: node.id,
          sourceHandle: getPrimaryPortId(node.data, 'output'),
          target: targetNodeId,
          targetHandle: targetHandleId,
          type: edgeStyle.value,
        }))
        .filter((edge) => isValidFlowEdge(edge))

      if (nextEdges.length) {
        if (targetEdgeIndex >= 0) {
          const nextAllEdges = [...edges.value]
          nextAllEdges.splice(Math.min(targetEdgeIndex, nextAllEdges.length), 0, ...nextEdges)
          edges.value = nextAllEdges
        } else {
          edges.value = [...edges.value, ...nextEdges]
        }
        emit('update:modelEdges', edges.value)
      }
    }

    if (createdNodes.length) {
      propagateDataFlow()
      nextTick(() => {
        const ids = createdNodes.map((node) => node.id)
        if (targetNodeId) ids.unshift(targetNodeId)
        updateNodeInternals(ids)
        if (targetNodeId) syncNodeEdgeHandles(targetNodeId)
        createdNodes.forEach((node) => syncNodeEdgeHandles(node.id))
      })
      refreshOpenGenerationPanelForNode(targetNodeId)
      setTimeout(saveHistory, 50)
    }

    if (duplicateEntries.length) {
      ElMessage.warning(`检测到 ${duplicateEntries.length} 个重复资源，已跳过重复建卡`)
    }

    if (failedEntries.length) {
      ElMessage.warning(`有 ${failedEntries.length} 个文件上传失败，未创建卡片`)
      console.warn('[FlowCanvas] 外部文件上传失败:', failedEntries)
    }

    return createdNodes
  }

  return {
    imageCompressDialog,
    classifyUploadFile,
    handleImageCompressDialogVisibleChange,
    handleImageCompressDialogCancel,
    handleImageCompressDialogConfirm,
    maybeCompressImageFilesBeforeUpload,
    createUploadNodesFromFiles,
  }
}
