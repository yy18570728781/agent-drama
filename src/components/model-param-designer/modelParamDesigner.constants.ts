import type { ModelParamSchema, SelectOption } from '@/api/models'
import type { PresetTemplate, ControlTemplate } from '@/components/model-param-designer/modelParamDesigner.types'

/** 生成运行态唯一标识 */
export function genParamId(): string {
  return `param_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── 预置参数选项常量 ──────────────────────────────────────

/** size 参数选项：1K / 2K / 3K / 4K */
export const SIZE_OPTIONS: SelectOption[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
  { value: '4K', label: '4K' },
]

/** resolution 参数选项：720p / 1080p / 1440p / 2K / 4K */
export const RESOLUTION_OPTIONS: SelectOption[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '1440p', label: '1440p' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
]

/** aspect_ratio 参数选项：常见比例 */
export const ASPECT_RATIO_OPTIONS: SelectOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
]

// ── 预置参数模板（固定参数名） ────────────────────────────

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: 'size',
    label: '尺寸',
    icon: 'Maximize2',
    paramName: 'size',
    create: (): ModelParamSchema => ({
      name: 'size',
      label: '尺寸',
      type: 'select',
      options: [...SIZE_OPTIONS],
      default: '1K',
    }),
  },
  {
    key: 'resolution',
    label: '分辨率',
    icon: 'Monitor',
    paramName: 'resolution',
    create: (): ModelParamSchema => ({
      name: 'resolution',
      label: '分辨率',
      type: 'select',
      options: [...RESOLUTION_OPTIONS],
      default: '1080p',
    }),
  },
  {
    key: 'prompt',
    label: '提示词',
    icon: 'Type',
    paramName: 'prompt',
    create: (): ModelParamSchema => ({
      name: 'prompt',
      label: '提示词',
      type: 'text',
      default: '',
    }),
  },
  {
    key: 'aspect_ratio',
    label: '比率',
    icon: 'RectangleHorizontal',
    paramName: 'aspect_ratio',
    create: (): ModelParamSchema => ({
      name: 'aspect_ratio',
      label: '比率',
      type: 'select',
      options: [...ASPECT_RATIO_OPTIONS],
      default: '1:1',
    }),
  },
  {
    key: 'file_urls',
    label: '文件',
    icon: 'Paperclip',
    paramName: 'file_urls',
    create: (): ModelParamSchema => ({
      name: 'file_urls',
      label: '文件',
      type: 'file_list',
      required: false,
      min_items: 1,
      max_items: 5,
      sub_params: [
        { name: 'front', label: '前视图', required: false },
        { name: 'back', label: '后视图', required: false },
      ],
      accept: ['image/*'],
    }),
  },
]

// ── 自定义控件模板（参数名可改，执行时作为透传参数） ──────────

export const CONTROL_TEMPLATES: ControlTemplate[] = [
  {
    key: 'text',
    label: '文本',
    icon: 'Type',
    create: (autoName: string): ModelParamSchema => ({
      name: autoName,
      label: '文本',
      type: 'text',
      default: '',
    }),
  },
  {
    key: 'text-array',
    label: '文本数组',
    icon: 'List',
    create: (autoName: string): ModelParamSchema => ({
      name: autoName,
      label: '文本数组',
      type: 'array',
      default: [],
      items_type: 'text',
    }),
  },
  {
    key: 'number',
    label: '数字',
    icon: 'SlidersHorizontal',
    create: (autoName: string): ModelParamSchema => ({
      name: autoName,
      label: '数字',
      type: 'number',
      default: 0,
      min: 0,
    }),
  },
  {
    key: 'number-array',
    label: '数字数组',
    icon: 'List',
    create: (autoName: string): ModelParamSchema => ({
      name: autoName,
      label: '数字数组',
      type: 'array',
      default: [],
      items_type: 'number',
    }),
  },
  {
    key: 'boolean',
    label: '布尔',
    icon: 'Check',
    create: (autoName: string): ModelParamSchema => ({
      name: autoName,
      label: '布尔',
      type: 'boolean',
      default: false,
    }),
  },
  {
    key: 'group',
    label: '组',
    icon: 'Folder',
    create: (_autoName: string): ModelParamSchema => ({
      name: '',
      label: '分组',
      type: 'text',
    }),
  },
]

/** 默认查询能力类型 */
export const DEFAULT_CAPABILITY_TYPE = 'generations'

/** 自定义参数名自动生成前缀 */
export const CUSTOM_PARAM_PREFIX = 'param'

/** 参数类型中文标签映射 */
export const TYPE_LABEL_MAP: Record<string, string> = {
  select: '下拉选择',
  number: '数字',
  text: '文本',
  boolean: '布尔',
  file: '单文件',
  float: '小数',
  integer: '整数',
  images: '图片',
  files: '文件',
  file_list: '文件列表',
  array: '数组',
}
