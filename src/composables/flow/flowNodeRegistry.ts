import { computed, defineAsyncComponent, markRaw } from 'vue'
import type { Ref } from 'vue'
import { Type, Image as ImageIcon, Video, Music, Box, Camera, Monitor } from '@/components/common/icon/lucide'
import GenerateNodeCard from '@/components/flow/GenerateNodeCard.vue'
import FileInputNode from '@/components/flow/nodes/FileInputNode.vue'
import AigcResultNode from '@/components/flow/nodes/AigcResultNode.vue'
import GenerationNode from '@/components/flow/nodes/GenerationNode.vue'
import TextNode from '@/components/flow/nodes/TextNode.vue'
import ImageNode from '@/components/flow/nodes/ImageNode.vue'
import AnnotationNode from '@/components/flow/nodes/AnnotationNode.vue'
import GroupNode from '@/components/flow/nodes/GroupNode.vue'
import SubgraphNode from '@/components/flow/nodes/SubgraphNode.vue'
import WaypointNode from '@/components/flow/nodes/WaypointNode.vue'
import ImageCompareNode from '@/components/flow/nodes/ImageCompareNode.vue'
import Director3DNode from '@/components/flow/nodes/Director3DNode.vue'
import LocationMarkerNode from '@/components/flow/nodes/LocationMarkerNode.vue'
import BatchGridNode from '@/components/flow/nodes/BatchGridNode.vue'
import TextureMaterialNode from '@/components/flow/nodes/TextureMaterialNode.vue'

const CameraNode = defineAsyncComponent(() => import('@/components/flow/nodes/CameraNode.vue'))

export const fixedSizeTypes: Record<string, any> = {
  file_input: { width: '320px', height: '180px' },
  audio_generation: { width: '320px', height: '180px' },
  aigc_result: { width: '320px', height: '180px' },
  text_generation: { width: '320px', height: '180px' },
  image_generation: { width: '320px', height: '180px' },
  video_generation: { width: '320px', height: '180px' },
  model_generation: { width: '320px', height: '180px' },
  camera_input: { width: '640px', height: '480px' },
  image_compare: { width: '320px' },
  director_3d: { width: '320px', height: '180px' },
  location_marker: { width: '64px', height: '76px' },
  texture_material: { width: '300px', height: '228px' },
}

export const defaultMediaNodes = [
  { key: 'text_generation', type: 'text_generation', label: '文本生成', icon: Type, color: 'text-indigo-400', mediaType: 'text', defaultCapability: 'chat' },
  { key: 'image_generation', type: 'image_generation', label: '图片生成', icon: ImageIcon, color: 'text-emerald-400', mediaType: 'image', defaultCapability: 'image_generation' },
  { key: 'video_generation', type: 'video_generation', label: '视频生成', icon: Video, color: 'text-rose-400', mediaType: 'video', defaultCapability: 'video_generation' },
  { key: 'model_generation', type: 'model_generation', label: '模型生成', icon: Box, color: 'text-cyan-400', mediaType: '3d_model', defaultCapability: 'model_generation' },
  { key: 'audio_generation', type: 'audio_generation', label: '音频生成', icon: Music, color: 'text-amber-400', mediaType: 'audio', defaultCapability: 'audio_generation' },
  { key: 'camera_input', type: 'camera_input', label: '摄影机参数', icon: Camera, color: 'text-emerald-400', mediaType: 'text' },
  { key: 'director_3d', type: 'director_3d', label: '3D导演台', icon: Monitor, color: 'text-cyan-400', mediaType: 'text' },
]

export const HIDDEN_NODE_TYPES = new Set(['text_input', 'image_input', 'video_input', 'generate', 'llm', 'output_gallery', 'output_text', 'location_marker', 'batch_grid'])

export const nodeComponents: Record<string, any> = {
  file_input: markRaw(FileInputNode),
  aigc_result: markRaw(AigcResultNode),
  annotation_note: markRaw(AnnotationNode),
  text_generation: markRaw(GenerationNode),
  image_generation: markRaw(GenerationNode),
  video_generation: markRaw(GenerationNode),
  model_generation: markRaw(GenerationNode),
  audio_generation: markRaw(GenerationNode),
  generate: markRaw(GenerateNodeCard),
  llm: markRaw(GenerateNodeCard),
  output_gallery: markRaw(ImageNode),
  output_text: markRaw(TextNode),
  camera_input: markRaw(CameraNode),
  groupNode: markRaw(GroupNode),
  subgraph: markRaw(SubgraphNode),
  waypoint: markRaw(WaypointNode),
  image_compare: markRaw(ImageCompareNode),
  director_3d: markRaw(Director3DNode),
  location_marker: markRaw(LocationMarkerNode),
  batch_grid: markRaw(BatchGridNode),
  texture_material: markRaw(TextureMaterialNode),
}

export function useSelectedImageNodes(selectedNodes: Ref<any[]>, isImageLikeNode: (node: any) => boolean, getNodeMediaType: (node: any) => string) {
  return computed(() => selectedNodes.value.filter((n: any) => isImageLikeNode(n) && getNodeMediaType(n) === 'image'))
}
