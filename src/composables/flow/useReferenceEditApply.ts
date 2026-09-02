import type { Ref } from 'vue'
import { uploadFileToCosUrl, getUploadErrorMessage } from '@/api/uploadHelpers'
import { createThumbnailFileIfNeeded } from '@/utils/imageThumbnail'

type FlowNode = {
  id: string
  data?: Record<string, unknown>
}

type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
}

type ImageEditApplyData = {
  file: File
  url: string
}

export interface ReferenceEditApplyDeps {
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  emit: {
    (e: 'update:modelNodes', value: FlowNode[]): void
    (e: 'update:modelEdges', value: FlowEdge[]): void
  }
  findNode: (id: string) => FlowNode | null | undefined
  saveHistory: () => void
  createConnectedAssetNode: (sourceNodeId: string, options: Record<string, unknown>) => FlowNode | null
  getUpstreamAssetNodePosition: (
    targetNodeId: string,
    index: number,
    style?: Record<string, unknown>,
  ) => { x: number; y: number }
  getPrimaryPortId: (nodeData: unknown, direction: 'input' | 'output') => string | undefined
  syncNodeEdgeHandles: (nodeId: string) => void
  createEdgeId: () => string
  edgeStyle: Ref<string>
  propagateDataFlow: () => void
  updateNodeInternals: (ids: string[]) => void
}

export interface ReferenceEditApplyParams {
  referenceEditSourceNodeId: Ref<string | null>
  detailNodeId: Ref<string | null>
  detailNodeData: Ref<Record<string, unknown> | null>
  closeImageEditor: () => void
  onDetailImageEditApply: (data: ImageEditApplyData) => void
}

/**
 * Applies edits made from an embedded reference image by replacing the old
 * upstream reference edge with a newly created edited asset node.
 *
 * @param deps Flow graph operations required to create and connect the edited node.
 * @param params Reactive editor state and the default non-reference apply handler.
 * @returns A wrapped apply handler for the image editor.
 */
export function useReferenceEditApply(
  deps: ReferenceEditApplyDeps,
  params: ReferenceEditApplyParams,
): { handleApply: (data: ImageEditApplyData) => void } {
  function handleApply(data: ImageEditApplyData): void {
    if (!params.referenceEditSourceNodeId.value) {
      params.onDetailImageEditApply(data)
      return
    }
    applyReferenceEdit(data)
  }

  function applyReferenceEdit(data: ImageEditApplyData): void {
    const targetNodeId = params.detailNodeId.value || String(params.detailNodeData.value?.nodeId || '')
    if (!targetNodeId) {
      params.closeImageEditor()
      return
    }
    const targetNode = deps.nodes.value.find((node) => node.id === targetNodeId)
    if (!targetNode) {
      params.closeImageEditor()
      return
    }
    const createdNode = createEditedNode(targetNode, targetNodeId, data)
    if (!createdNode?.id) {
      params.closeImageEditor()
      return
    }
    replaceReferenceEdge(params.referenceEditSourceNodeId.value, targetNodeId, createdNode.id)
    uploadEditedMedia(createdNode.id, data)
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.propagateDataFlow()
    deps.saveHistory()
    params.closeImageEditor()
  }

  function createEditedNode(
    targetNode: FlowNode,
    targetNodeId: string,
    data: ImageEditApplyData,
  ): FlowNode | null {
    const style = { width: '320px', height: '180px' }
    const createdNode = deps.createConnectedAssetNode('', {
      label: `${String(targetNode.data?.label || '图片')} - 编辑`,
      url: data.url,
      mediaType: 'image',
      style,
      position: deps.getUpstreamAssetNodePosition(targetNodeId, 0, style),
    })
    if (createdNode?.data) {
      createdNode.data.disableInferUpstream = true
      createdNode.data.uploadStatus = 'uploading'
      createdNode.data.uploadError = ''
    }
    return createdNode
  }

  function replaceReferenceEdge(
    oldSourceNodeId: string | null,
    targetNodeId: string,
    createdNodeId: string,
  ): void {
    const targetNode = deps.findNode(targetNodeId)
    const createdNode = deps.findNode(createdNodeId)
    deps.edges.value = deps.edges.value.filter(
      (edge) => !(oldSourceNodeId && edge.source === oldSourceNodeId && edge.target === targetNodeId),
    )
    if (!deps.edges.value.some((edge) => edge.source === createdNodeId && edge.target === targetNodeId)) {
      deps.edges.value = [
        ...deps.edges.value,
        {
          id: deps.createEdgeId(),
          source: createdNodeId,
          sourceHandle: deps.getPrimaryPortId(createdNode?.data, 'output'),
          target: targetNodeId,
          targetHandle: deps.getPrimaryPortId(targetNode?.data, 'input'),
          type: deps.edgeStyle.value,
        },
      ]
    }
    deps.emit('update:modelEdges', deps.edges.value)
    deps.updateNodeInternals([createdNodeId, targetNodeId])
    deps.syncNodeEdgeHandles(createdNodeId)
    deps.syncNodeEdgeHandles(targetNodeId)
  }

  function uploadEditedMedia(nodeId: string, data: ImageEditApplyData): void {
    uploadFileToCosUrl(data.file, data.file.name)
      .then((uploadedUrl) => patchNodeUrl(nodeId, uploadedUrl, 'uploaded', ''))
      .catch((error: unknown) => {
        console.warn('[FlowCanvas] failed to upload edited reference image:', error)
        patchNodeUrl(nodeId, null, 'local', getUploadErrorMessage(error))
      })

    createThumbnailFileIfNeeded(data.file)
      .then((thumbFile) => (thumbFile ? uploadFileToCosUrl(thumbFile, thumbFile.name) : null))
      .then((thumbUrl) => {
        if (thumbUrl) patchNodeThumb(nodeId, thumbUrl)
      })
      .catch(() => {})
  }

  function patchNodeUrl(
    nodeId: string,
    uploadedUrl: string | null,
    status: string,
    error: string,
  ): void {
    const node = deps.nodes.value.find((item) => item.id === nodeId)
    if (!node?.data) return
    if (uploadedUrl) {
      const previousUrl = String(node.data.url || '')
      if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
      node.data.url = uploadedUrl
      node.data.sourceUrl = uploadedUrl
    }
    node.data.uploadStatus = status
    node.data.uploadError = error
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  function patchNodeThumb(nodeId: string, thumbUrl: string): void {
    const node = deps.nodes.value.find((item) => item.id === nodeId)
    if (!node?.data) return
    node.data.thumb = thumbUrl
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  return { handleApply }
}
