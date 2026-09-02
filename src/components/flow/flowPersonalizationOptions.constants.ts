import type { EdgeColorMode, EdgeStyle, FlowDropDirection } from '@/styles/theme/types/theme'

export const EDGE_STYLE_OPTIONS: Array<{ value: EdgeStyle; label: string }> = [
  { value: 'default', label: '贝塞尔' },
  { value: 'smoothstep', label: '圆角折线' },
  { value: 'straight', label: '直线' },
]

export const EDGE_COLOR_OPTIONS: Array<{ value: EdgeColorMode; label: string; colors: string[] }> = [
  { value: 'uniform', label: '统一色', colors: ['#93c5fd', '#93c5fd', '#93c5fd'] },
  { value: 'byType', label: '按类型', colors: ['#818cf8', '#34d399', '#fb7185'] },
]

export const EDGE_TYPE_CATEGORIES = [
  { key: 'image', label: '图片', types: ['file_input', 'image_generation', 'aigc_result', 'cameraNode'], defaultColor: '#34d399' },
  { key: 'video', label: '视频', types: ['video_generation'], defaultColor: '#fb7185' },
  { key: 'audio', label: '音频', types: ['audio_generation'], defaultColor: '#fbbf24' },
  { key: 'model', label: '模型', types: ['model_generation'], defaultColor: '#22d3ee' },
  { key: 'other', label: '其他', types: ['text_generation', 'waypoint'], defaultColor: '#94a3b8' },
] as const

export const FLOW_DROP_DIRECTION_OPTIONS: Array<{ value: FlowDropDirection; label: string }> = [
  { value: 'vertical', label: '纵向排列' },
  { value: 'horizontal', label: '横向排列' },
]
