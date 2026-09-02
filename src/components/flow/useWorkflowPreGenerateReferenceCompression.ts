import { computed, nextTick, type Ref } from 'vue'
import type { GraphNode } from '@vue-flow/core'
import { ElMessage } from 'element-plus'

import { uploadFileToCosUrl, getUploadErrorMessage } from '@/api/uploadHelpers'
import { postMediaCache } from '@/api/mediaCache'
import { openImageCompressDialog } from '@/utils/imageCompressDialogService'
import { createThumbnailFileIfNeeded } from '@/utils/imageThumbnail'
import { getMediaFileMetrics } from '@/utils/mediaMetrics'
import { createFlowEdgeId, createFlowId } from '@/utils/flowId'
import { compressImageFileToLimit } from '@/utils/imageCompression'
import { normalizeBatchGridItems } from '@/utils/batchGridItems'
import { resolveStoredUpstreamInputs, sanitizeStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'
import { useTheme } from '@/styles/theme/composables/useTheme'

type WorkflowNode = {
  id: string
  type?: string
  position: { x: number; y: number }
  data?: Record<string, any>
  style?: GraphNode['style']
}

type WorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
}

type MutableArrayRef<T> = { value: T[] }

type Deps = {
  nodeRef: Ref<WorkflowNode | null | undefined>
  generatorRef: Ref<any>
  findNode: (id: string) => WorkflowNode | null | undefined
  nodes: MutableArrayRef<WorkflowNode>
  edges: MutableArrayRef<WorkflowEdge>
  updateNodeInternals: (ids: string[]) => void
  createConnectedAssetNode: (sourceNodeId: string, options: Record<string, unknown>) => { id: string; node: WorkflowNode } | null
}

type ReferenceCandidate = {
  sourceNodeId: string
  url: string
  label: string
  file: File
}

type BatchGridCompressionCandidate = ReferenceCandidate & {
  index: number
}

function getTargetReferenceImages(
  node: WorkflowNode | null | undefined,
  findNode: (id: string) => WorkflowNode | null | undefined,
) {
  const images = resolveStoredUpstreamInputs(node?.data?._upstreamInputs, findNode).images
  return images
    .map((item: Record<string, any>) => ({
      sourceNodeId: String(item?.nodeId || item?.sourceNodeId || '').trim(),
      url: String(item?.url || '').trim(),
      label: String(item?.label || '').trim(),
    }))
    .filter((item: { sourceNodeId: string; url: string }) => !!item.sourceNodeId && !!item.url)
}

function buildRemoteFileName(url: string, sourceNodeId: string): string {
  const cleanUrl = String(url || '').split(/[?#]/)[0]
  const basename = cleanUrl.split('/').pop() || `${sourceNodeId}.png`
  return basename.includes('.') ? basename : `${basename}.png`
}

function appendCorsCacheBust(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('__flow_cors_ts', `${Date.now()}`)
    return parsed.toString()
  } catch {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}__flow_cors_ts=${Date.now()}`
  }
}

async function fetchReferenceBlob(url: string): Promise<Blob> {
  const requestInit: RequestInit = {
    mode: 'cors',
    cache: 'reload',
    credentials: 'omit',
  }
  try {
    const response = await fetch(url, requestInit)
    if (!response.ok) throw new Error(`下载参考图失败（${response.status}）`)
    return await response.blob()
  } catch {
    const retryUrl = appendCorsCacheBust(url)
    const response = await fetch(retryUrl, requestInit)
    if (!response.ok) throw new Error(`下载参考图失败（${response.status}）`)
    return await response.blob()
  }
}

async function fetchReferenceFile(item: { sourceNodeId: string; url: string }): Promise<File> {
  const blob = await fetchReferenceBlob(item.url)
  return new File([blob], buildRemoteFileName(item.url, item.sourceNodeId), {
    type: blob.type || 'image/png',
  })
}

async function collectReferenceCandidates(
  node: WorkflowNode | null | undefined,
  findNode: (id: string) => WorkflowNode | null | undefined,
): Promise<ReferenceCandidate[]> {
  const refs = getTargetReferenceImages(node, findNode)
  const output: ReferenceCandidate[] = []
  for (const ref of refs) {
    const file = await fetchReferenceFile(ref)
    output.push({
      ...ref,
      label: ref.label || '图片上传',
      file,
    })
  }
  return output
}

function getBatchGridSourceNode(node: WorkflowNode | null | undefined, findNode: (id: string) => WorkflowNode | null | undefined) {
  const images = resolveStoredUpstreamInputs(node?.data?._upstreamInputs, findNode).images
  const firstSourceNodeId = String(images[0]?.nodeId || images[0]?.sourceNodeId || '').trim()
  const sourceNode = firstSourceNodeId ? findNode(firstSourceNodeId) : null
  return sourceNode?.type === 'batch_grid' ? sourceNode : null
}

async function collectBatchGridCompressionCandidates(sourceBatchNode: WorkflowNode): Promise<BatchGridCompressionCandidate[]> {
  const items = Array.isArray(sourceBatchNode?.data?.items) ? sourceBatchNode.data.items : []
  const normalizedItems = normalizeBatchGridItems(items)
  const output: BatchGridCompressionCandidate[] = []
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index]
    const itemUrl = String(item?.data?.url || '').trim()
    if (!itemUrl) continue
    const file = await fetchReferenceFile({
      sourceNodeId: String(sourceBatchNode?.id || '').trim(),
      url: itemUrl,
    })
    output.push({
      index,
      sourceNodeId: String(sourceBatchNode?.id || '').trim(),
      url: itemUrl,
      label: String(item?.data?.label || '').trim() || `图片 ${index + 1}`,
      file,
    })
  }
  return output
}

async function uploadCompressedAsset(file: File) {
  const [url, rawThumbFile, metrics] = await Promise.all([
    uploadFileToCosUrl(file, file.name),
    createThumbnailFileIfNeeded(file).catch(() => null),
    getMediaFileMetrics(file, 'image').catch(() => null),
  ])
  const thumbFile = rawThumbFile && rawThumbFile.type !== 'image/webp' ? rawThumbFile : null
  const thumb = thumbFile ? await uploadFileToCosUrl(thumbFile, thumbFile.name).catch(() => '') : url
  if (thumb) {
    postMediaCache({ url, thumb }).catch(() => {})
  }
  return { url, thumb, metrics }
}

function patchTargetReferenceInputs(targetNode: WorkflowNode, replacements: Map<string, any>) {
  const targetData = targetNode.data
  const currentInputs = targetData?._upstreamInputs
  if (!currentInputs) return
  const nextImages = (Array.isArray(currentInputs.images) ? currentInputs.images : []).map((item: any) => {
    const sourceNodeId = String(item?.nodeId || item?.sourceNodeId || '').trim()
    const replacement = replacements.get(sourceNodeId)
    if (!replacement) return item
    return {
      ...item,
      nodeId: replacement.nodeId,
      sourceNodeId: replacement.nodeId,
      label: replacement.label,
    }
  })
  targetData._upstreamInputs = sanitizeStoredUpstreamInputs({
    ...currentInputs,
    images: nextImages,
  })
}

function patchTargetBatchGridInputs(targetNode: WorkflowNode, batchNodeId: string, batchItems: any[]) {
  const targetData = targetNode.data
  const currentInputs = targetData?._upstreamInputs
  if (!currentInputs) return
  const nextImages = batchItems.map((item: any) => ({
    nodeId: batchNodeId,
    sourceNodeId: batchNodeId,
    label: String(item?.data?.label || '').trim(),
    mediaType: String(item?.data?.mediaType || 'image').trim() || 'image',
  }))
  targetData._upstreamInputs = sanitizeStoredUpstreamInputs({
    ...currentInputs,
    images: nextImages,
  })
}

function rewireReferenceEdges(
  edges: MutableArrayRef<WorkflowEdge>,
  targetNodeId: string,
  oldSourceNodeId: string,
  newSourceNodeId: string,
) {
  let rewired = false
  edges.value = edges.value.map((edge) => {
    if (edge.source !== oldSourceNodeId || edge.target !== targetNodeId) return edge
    rewired = true
    return {
      ...edge,
      source: newSourceNodeId,
      sourceHandle: undefined,
    }
  })
  if (rewired || edges.value.some((edge) => edge.source === newSourceNodeId && edge.target === targetNodeId)) {
    return
  }
  const oldEdge = edges.value.find((edge) => edge.source === oldSourceNodeId && edge.target === targetNodeId)
  edges.value = [
    ...edges.value,
    {
      id: createFlowEdgeId(),
      source: newSourceNodeId,
      target: targetNodeId,
      type: oldEdge?.type,
      targetHandle: oldEdge?.targetHandle,
    },
  ]
}

function ensureCompressionSourceEdge(
  edges: MutableArrayRef<WorkflowEdge>,
  oldSourceNodeId: string,
  compressedNodeId: string,
  referenceEdge: WorkflowEdge | undefined,
) {
  if (
    !oldSourceNodeId
    || !compressedNodeId
    || edges.value.some((edge) => edge.source === oldSourceNodeId && edge.target === compressedNodeId)
  ) {
    return
  }
  edges.value = [
    ...edges.value,
    {
      id: createFlowEdgeId(),
      source: oldSourceNodeId,
      target: compressedNodeId,
      type: referenceEdge?.type,
      sourceHandle: referenceEdge?.sourceHandle,
    },
  ]
}

function syncGeneratorReferences(
  generatorRef: Ref<any>,
  targetNode: WorkflowNode | null | undefined,
  findNode: (id: string) => WorkflowNode | null | undefined,
) {
  const resolvedInputs = resolveStoredUpstreamInputs(targetNode?.data?._upstreamInputs, findNode)
  const images = resolvedInputs.images
  const videos = resolvedInputs.videos
  const audios = resolvedInputs.audios
  return generatorRef.value?.setReferenceMedia?.([
    ...images.map((item: any) => ({ url: item?.url, mediaType: 'image', nodeId: item?.nodeId || item?.sourceNodeId })),
    ...videos.map((item: any) => ({ url: item?.url, mediaType: 'video', nodeId: item?.nodeId || item?.sourceNodeId })),
    ...audios.map((item: any) => ({ url: item?.url, mediaType: 'audio', nodeId: item?.nodeId || item?.sourceNodeId })),
  ])
}

function buildCompressedBatchGridNode(sourceBatchNode: WorkflowNode, nextItems: any[]): WorkflowNode {
  return {
    id: createFlowId('node'),
    type: 'batch_grid',
    position: {
      x: Number(sourceBatchNode?.position?.x || 0) + 36,
      y: Number(sourceBatchNode?.position?.y || 0) + 36,
    },
    style: sourceBatchNode?.style ? { ...sourceBatchNode.style } : undefined,
    data: {
      ...(sourceBatchNode?.data || {}),
      label: `${String(sourceBatchNode?.data?.label || '批量节点').trim() || '批量节点'} - 压缩`,
      items: nextItems,
    },
  }
}

/**
 * Before starting workflow generation, checks upstream image references for oversize files,
 * lets the user compress them with the shared dialog, then inserts file_input nodes between
 * the original source and the generation node.
 */
export function useWorkflowPreGenerateReferenceCompression(deps: Deps) {
  const targetNodeId = computed(() => String(deps.nodeRef.value?.id || '').trim())
  const { autoCompressOriginalRatio, compressThresholdMb } = useTheme()
  const maxBytes = computed(() => compressThresholdMb.value * 1024 * 1024)

  async function resolveOversizeFiles(files: File[]): Promise<File[] | null> {
    if (autoCompressOriginalRatio.value) {
      const loadingMessage = ElMessage({
        message: `正在自动原比例压缩 ${files.length} 张图片...`,
        type: 'info',
        duration: 0,
      })
      try {
        return await Promise.all(files.map((file) => compressImageFileToLimit(file, { lockRatio: true, maxBytes: maxBytes.value })))
      } finally {
        loadingMessage.close()
      }
    }
    return openImageCompressDialog(files)
  }

  async function ensureCompressedBatchGridBeforeGenerate(
    targetNode: WorkflowNode,
    sourceBatchNode: WorkflowNode,
  ): Promise<boolean> {
    let candidates: BatchGridCompressionCandidate[] = []
    try {
      candidates = await collectBatchGridCompressionCandidates(sourceBatchNode)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '读取批量参考图失败，无法执行压缩检测')
      return false
    }
    if (!candidates.length) return true

    const oversizeCandidates = candidates.filter((item) => item.file.size > maxBytes.value)
    if (!oversizeCandidates.length) return true

    const processedFiles = await resolveOversizeFiles(oversizeCandidates.map((item) => item.file))
    if (!processedFiles) return false

    const currentItems = normalizeBatchGridItems(sourceBatchNode?.data?.items || [])
    const nextItems = currentItems.map((item) => ({
      ...item,
      data: { ...(item.data || {}) },
    }))

    for (const [index, nextFile] of processedFiles.entries()) {
      const candidate = oversizeCandidates[index]
      if (!candidate || !(nextFile instanceof File)) continue
      const uploaded = await uploadCompressedAsset(nextFile).catch((error) => {
        throw new Error(getUploadErrorMessage(error))
      })
      const currentItem = nextItems[candidate.index]
      if (!currentItem) continue
      currentItem.data = {
        ...(currentItem.data || {}),
        url: uploaded.url,
        thumb: uploaded.thumb || '',
        label: String(currentItem.data?.label || candidate.label || '').trim(),
        ...(uploaded.metrics ? { mediaMeta: uploaded.metrics } : {}),
      }
    }

    const compressedBatchNode = buildCompressedBatchGridNode(sourceBatchNode, nextItems)
    deps.nodes.value = [...deps.nodes.value, compressedBatchNode]
    const previousReferenceEdge = deps.edges.value.find(
      (edge) => edge.source === sourceBatchNode.id && edge.target === targetNodeId.value,
    )
    ensureCompressionSourceEdge(deps.edges, String(sourceBatchNode.id || '').trim(), compressedBatchNode.id, previousReferenceEdge)
    rewireReferenceEdges(deps.edges, targetNodeId.value, String(sourceBatchNode.id || '').trim(), compressedBatchNode.id)
    patchTargetBatchGridInputs(targetNode, compressedBatchNode.id, nextItems)
    await nextTick()
    await syncGeneratorReferences(deps.generatorRef, targetNode, deps.findNode)
    deps.updateNodeInternals([targetNodeId.value, compressedBatchNode.id])
    return true
  }

  async function ensureCompressedReferencesBeforeGenerate(): Promise<boolean> {
    if (!targetNodeId.value) return true
    const targetNode = deps.findNode(targetNodeId.value)
    if (!targetNode) return true
    const sourceBatchNode = getBatchGridSourceNode(targetNode, deps.findNode)
    if (sourceBatchNode) {
      return ensureCompressedBatchGridBeforeGenerate(targetNode, sourceBatchNode)
    }

    const resolvedTargetInputs = resolveStoredUpstreamInputs(targetNode?.data?._upstreamInputs, deps.findNode)
    let candidates: ReferenceCandidate[] = []
    try {
      candidates = await collectReferenceCandidates({ ...targetNode, data: { ...targetNode.data, _upstreamInputs: resolvedTargetInputs } }, deps.findNode)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '读取参考图失败，无法执行压缩检测')
      return false
    }
    if (!candidates.length) return true

    const oversizeCandidates = candidates.filter((item) => item.file.size > maxBytes.value)
    if (!oversizeCandidates.length) return true

    const processedFiles = await resolveOversizeFiles(oversizeCandidates.map((item) => item.file))
    if (!processedFiles) return false

    const replacements = new Map<string, any>()
    for (const [index, nextFile] of processedFiles.entries()) {
      if (!(nextFile instanceof File) || nextFile === oversizeCandidates[index]?.file) continue
      const candidate = oversizeCandidates[index]
      const previousReferenceEdge = deps.edges.value.find(
        (edge) => edge.source === candidate.sourceNodeId && edge.target === targetNodeId.value,
      )
      const uploaded = await uploadCompressedAsset(nextFile).catch((error) => {
        throw new Error(getUploadErrorMessage(error))
      })
      const created = deps.createConnectedAssetNode(candidate.sourceNodeId, {
        label: `${candidate.label} - 压缩`,
        url: uploaded.url,
        mediaType: 'image',
        thumb: uploaded.thumb,
        width: uploaded.metrics?.width,
        height: uploaded.metrics?.height,
        aspectRatio: uploaded.metrics?.aspectRatio,
      })
      if (!created?.id) continue
      const newNode = deps.findNode(created.id)
      if (newNode?.data) {
        newNode.data.thumb = uploaded.thumb || ''
        newNode.data.sourceUrl = uploaded.url
        newNode.data.uploadStatus = 'uploaded'
        newNode.data.uploadError = ''
      }
      ensureCompressionSourceEdge(deps.edges, candidate.sourceNodeId, created.id, previousReferenceEdge)
      rewireReferenceEdges(deps.edges, targetNodeId.value, candidate.sourceNodeId, created.id)
      replacements.set(candidate.sourceNodeId, {
        nodeId: created.id,
        url: uploaded.url,
        thumb: uploaded.thumb,
        label: `${candidate.label} - 压缩`,
      })
    }

    if (!replacements.size) return true
    patchTargetReferenceInputs(targetNode, replacements)
    await nextTick()
    await syncGeneratorReferences(deps.generatorRef, targetNode, deps.findNode)
    deps.updateNodeInternals([targetNodeId.value, ...Array.from(replacements.values()).map((item) => item.nodeId)])
    return true
  }

  return {
    ensureCompressedReferencesBeforeGenerate,
  }
}
