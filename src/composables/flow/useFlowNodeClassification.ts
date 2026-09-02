import type { Ref, Component } from 'vue'
import {
  buildGenerationStateFromRequest,
  inferMediaTypeFromUrl,
  getNodeTypeByMediaType,
  isFileInputNodeType,
  normalizeWorkflowRequest,
  type WorkflowMediaType,
} from '@/utils/workflowNodeData'
import { getStorage } from '@/utils/storage'
import { isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'

export interface FlowNodeClassificationDeps {
  nodeTypes: Ref<any[]>
  icons: {
    ImageIcon: Component
    FileText: Component
    Type: Component
    Video: Component
    Box: Component
    Music: Component
    Camera: Component
    Monitor: Component
    LayoutGrid: Component
    MapIcon: Component
  }
}

// ==================== 常量 ====================

export const GENERATION_PANEL_CAPABILITIES = new Set([
  'chat',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
])

export const REPAIRABLE_GENERATION_NODE_TYPES = new Set([
  'text_generation',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
])

const WORKFLOW_CAP_MODEL_KEY = 'infinite_canvas_workflow_cap_model_remember'

// ==================== Composable ====================

export function useFlowNodeClassification(deps: FlowNodeClassificationDeps) {
  const { nodeTypes, icons } = deps

  // ==================== 节点媒体类型 ====================

  function getNodeMediaType(node: any): string {
    return node?.data?.mediaType || ''
  }

  function isImageLikeNode(node: any): boolean {
    return !!node && (node.type === 'output_gallery' || (isFileInputNodeType(node.type) && ['image', '3d_model'].includes(getNodeMediaType(node))))
  }

  function isVideoLikeNode(node: any): boolean {
    return !!node && isFileInputNodeType(node.type) && getNodeMediaType(node) === 'video'
  }

  function isAudioLikeNode(node: any): boolean {
    return !!node && isFileInputNodeType(node.type) && getNodeMediaType(node) === 'audio'
  }

  function isTextLikeNode(node: any): boolean {
    return !!node && (node.type === 'output_text' || (isFileInputNodeType(node.type) && getNodeMediaType(node) === 'text'))
  }

  // ==================== 节点类型定义 ====================

  function getNodeTypeDef(type: string): any {
    return nodeTypes.value.find((t: any) => t.type === type) || {}
  }

  function applyPresetData(node: any, preset: any): any {
    if (!preset) return node
    if (preset.mediaType) node.data.mediaType = preset.mediaType
    if (preset.defaultCapability) node.data.defaultCapability = preset.defaultCapability
    return node
  }

  // ==================== 工作流记忆配置 ====================

  function getWorkflowRememberedRequest(capability: string): any {
    if (!capability) return null
    try {
      const store = getStorage<Record<string, any>>(WORKFLOW_CAP_MODEL_KEY)
      if (!store) return null
      const remembered = store?.[capability]
      if (!remembered?.modelId) return null

      const params: any = {
        ...(remembered?.params && typeof remembered.params === 'object' ? remembered.params : {}),
        model: remembered.modelId,
      }

      if (typeof remembered?.prompt === 'string' && remembered.prompt) {
        params.prompt = remembered.prompt
      }

      delete params.allow_generate_count
      delete params.file_urls
      delete params.reference_urls
      delete params.reference_files
      delete params.files
      delete params.file_url
      delete params.image_urls
      delete params.image_first_frame
      delete params.image_last_frame

      return normalizeWorkflowRequest({
        capability: remembered.capability || capability,
        mode: remembered.mode || 'standard',
        params,
      })
    } catch {
      return null
    }
  }

  function applyWorkflowRememberedRequest(node: any, capability: string): any {
    const request = getWorkflowRememberedRequest(capability)
    const nextRequest = request || normalizeWorkflowRequest({
      capability,
      mode: 'standard',
      params: {},
    })
    if (!nextRequest) return node
    node.data.request = nextRequest
    node.data._genState = buildGenerationStateFromRequest(nextRequest, node.data._genState)
    return node
  }

  // ==================== 生成能力 ====================

  function getDefaultCapabilityByNodeType(nodeType: string): string {
    const map: Record<string, string> = {
      text_generation: 'chat',
      image_generation: 'image_generation',
      video_generation: 'video_generation',
      model_generation: 'model_generation',
      audio_generation: 'audio_generation',
      file_input: 'image_generation',
    }
    return map[nodeType] || ''
  }

  function getNodeGenerationCapability(node: any): string {
    return node?.data?.request?.capability
      || node?.data?.defaultCapability
      || getDefaultCapabilityByNodeType(node?.type)
      || ''
  }

  function canOpenGenerationPanel(node: any): boolean {
    if (isWorkflowGenerationResultNode(node)) return true
    const capability = getNodeGenerationCapability(node)
    return !!capability && GENERATION_PANEL_CAPABILITIES.has(capability)
  }

  // ==================== 节点维度 ====================

  function getNodeWidth(node: any): number {
    return Number(node?.dimensions?.width) || parseInt(node?.style?.width, 10) || 320
  }

  function getNodeHeight(node: any): number {
    return Number(node?.dimensions?.height) || parseInt(node?.style?.height, 10) || 180
  }

  // ==================== 媒体节点渲染 ====================

  function isRenderableMediaNode(node: any): boolean {
    const data = node?.data || {}
    if (node?.type === 'batch_grid' || node?.type === 'texture_material') {
      return Array.isArray(data.items) && data.items.length > 0
    }

    const mediaType = String(data.mediaType || data.nodeData?.mediaType || '').trim()
    const url = String(
      data.url
      || data.preview
      || data.imageUrl
      || data.videoUrl
      || data.nodeData?.imageUrl
      || data.nodeData?.videoUrl
      || ''
    ).trim()

    const isMediaNode = [
      'file_input',
      'aigc_result',
      'image_generation',
      'video_generation',
      'output_gallery'
    ].includes(node?.type)

    return !!url && (mediaType === 'image' || mediaType === 'video' || isMediaNode)
  }

  function hasRenderableMediaThumb(node: any): boolean {
    const data = node?.data || {}
    if (node?.type === 'batch_grid' || node?.type === 'texture_material') {
      return Array.isArray(data.items) && data.items.some((item: any) => {
        const itemData = item?.data && typeof item.data === 'object' ? item.data : item
        return !!String(itemData?.thumb || itemData?.thumbnail_url || '').trim()
      })
    }

    const thumb = String(
      data.thumb
      || data.nodeData?.thumb
      || ''
    ).trim()
    return !!thumb
  }

  function isPlaceholderEligibleNode(node: any): boolean {
    const type = String(node?.type || '')
    return [
      'file_input',
      'aigc_result',
      'text_generation',
      'image_generation',
      'video_generation',
      'model_generation',
      'audio_generation',
    ].includes(type)
  }

  // ==================== 参考图 ====================

  function normalizeReferenceUrlKey(url: string): string {
    const raw = String(url || '').trim().replace(/#.*$/, '')
    if (!raw) return ''
    try {
      const parsed = new URL(raw)
      return `${parsed.origin}${parsed.pathname}${parsed.search}`
    } catch {
      return raw
    }
  }

  function getNodeMediaReferenceKey(node: any): string {
    if (!node) return ''
    return normalizeReferenceUrlKey(
      node.data?.url
      || node.data?.preview
      || node.data?.imageUrl
      || node.data?.videoUrl
      || node.data?.resultUrl
      || node.data?.params?.image_url
      || node.data?.params?.video_url
      || ''
    )
  }

  function hasNodeResultUrl(node: any): boolean {
    const data = node?.data || {}
    return !!(
      data.url
      || data.preview
      || data.imageUrl
      || data.videoUrl
      || data.audioUrl
      || data.params?.image_url
      || data.params?.video_url
      || data.request?.params?.image_url
      || data.request?.params?.video_url
    )
  }

  function isEmptyGenerationSourceNode(node: any): boolean {
    if (!node) return false
    const capability = String(
      node.type
      || node.data?.defaultCapability
      || node.data?.capability
      || node.data?._genState?.capability
      || node.data?.request?.capability
      || ''
    )
    const isGeneration = [
      'text_generation',
      'image_generation',
      'video_generation',
      'model_generation',
      'audio_generation',
    ].includes(capability)
    if (!isGeneration) return false
    return !hasNodeResultUrl(node) && !node.data?.content
  }

  // ==================== 参考图工具 ====================

  function getReferenceMediaType(reference: any): WorkflowMediaType {
    const fallback: WorkflowMediaType = reference?.isVideo ? 'video' : 'image'
    return inferMediaTypeFromUrl(String(reference?.url || ''), String(reference?.mediaType || fallback) as WorkflowMediaType)
  }

  function getReferenceLabelByMediaType(mediaType: string): string {
    if (mediaType === 'video') return '参考视频'
    if (mediaType === 'audio') return '参考音频'
    if (mediaType === '3d_model') return '参考模型'
    return '参考图'
  }

  function getReferenceNodeType(reference: any): string {
    return getNodeTypeByMediaType(getReferenceMediaType(reference) as WorkflowMediaType)
  }

  // ==================== 图标/颜色映射 ====================

  function getNodeIcon(type: string): Component {
    const map: Record<string, Component> = {
      file_input: icons.ImageIcon,
      aigc_result: icons.ImageIcon,
      annotation_note: icons.FileText,
      text_generation: icons.Type,
      image_generation: icons.ImageIcon,
      video_generation: icons.Video,
      model_generation: icons.Box,
      audio_generation: icons.Music,
      camera_input: icons.Camera,
      director_3d: icons.Monitor,
      location_marker: icons.MapIcon,
      generate: icons.ImageIcon,
      llm: icons.Type,
      output_gallery: icons.ImageIcon,
      output_text: icons.Type,
    }
    return map[type] || icons.LayoutGrid
  }

  function getNodeIconColor(type: string): string {
    const map: Record<string, string> = {
      file_input: 'text-emerald-400',
      aigc_result: 'text-emerald-400',
      annotation_note: 'text-amber-300',
      text_generation: 'text-indigo-400',
      image_generation: 'text-emerald-400',
      video_generation: 'text-rose-400',
      model_generation: 'text-cyan-400',
      audio_generation: 'text-amber-400',
      camera_input: 'text-emerald-400',
      director_3d: 'text-cyan-400',
      location_marker: 'text-orange-400',
      generate: 'text-emerald-400',
      llm: 'text-indigo-400',
      output_gallery: 'text-amber-400',
      output_text: 'text-amber-400',
    }
    return map[type] || 'text-zinc-400'
  }

  // ==================== 小地图样式 ====================

  function getNodeColor(n: any): string {
    return n.type === 'groupNode' ? 'rgba(63, 63, 70, 0.2)' : '#52525b'
  }

  function getNodeStrokeColor(n: any): string {
    return n.type === 'groupNode' ? '#52525b' : 'transparent'
  }

  function getNodeStrokeWidth(n: any): number {
    return n.type === 'groupNode' ? 2 : 0
  }

  return {
    // 常量
    GENERATION_PANEL_CAPABILITIES,
    REPAIRABLE_GENERATION_NODE_TYPES,
    // 节点媒体类型
    getNodeMediaType,
    isImageLikeNode,
    isVideoLikeNode,
    isAudioLikeNode,
    isTextLikeNode,
    // 节点类型定义
    getNodeTypeDef,
    applyPresetData,
    // 工作流记忆配置
    getWorkflowRememberedRequest,
    applyWorkflowRememberedRequest,
    // 生成能力
    getDefaultCapabilityByNodeType,
    getNodeGenerationCapability,
    canOpenGenerationPanel,
    // 节点维度
    getNodeWidth,
    getNodeHeight,
    // 媒体节点渲染
    isRenderableMediaNode,
    hasRenderableMediaThumb,
    isPlaceholderEligibleNode,
    // 参考图
    normalizeReferenceUrlKey,
    getNodeMediaReferenceKey,
    hasNodeResultUrl,
    isEmptyGenerationSourceNode,
    // 参考图工具
    getReferenceMediaType,
    getReferenceLabelByMediaType,
    getReferenceNodeType,
    // 图标/颜色映射
    getNodeIcon,
    getNodeIconColor,
    // 小地图样式
    getNodeColor,
    getNodeStrokeColor,
    getNodeStrokeWidth,
  }
}
