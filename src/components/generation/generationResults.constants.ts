import { AudioLines, Box, Grid3x3, Image, Layers, LayoutGrid, List, Video } from '@/components/common/icon/lucide'

export const DISPLAY_MODE_OPTIONS = [
  { label: '详细', value: 'detailed-card', icon: Layers },
  { label: '紧凑', value: 'compact-card', icon: Grid3x3 },
  { label: '表格', value: 'table', icon: List },
] as const

export const GENERATION_TYPE_OPTIONS = [
  { id: 'all', label: '全部结果', icon: LayoutGrid },
  { id: 'image', label: '图片结果', icon: Image },
  { id: 'video', label: '视频结果', icon: Video },
  { id: 'audio', label: '音频结果', icon: AudioLines },
  { id: 'model', label: '模型结果', icon: Box },
] as const
