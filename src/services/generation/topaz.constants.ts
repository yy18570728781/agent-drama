import type { ModelParamSchema, BackendModelInfo } from '@/api/models'
import { TVAI_PROC_MODEL_ID, TVAI_PROC_PARAMS, transformProcessParams } from '@/services/generation/topazProcess.constants'

export const GIGA_MODEL_ID = 'topaz-gigapixel-image-upscale'
export const TVAI_UP_MODEL_ID = 'topaz-video-video-upscale'
export const TVAI_FI_MODEL_ID = 'topaz-video-video-interpolate'

/** 前端注入的虚拟 Topaz 模型（后端未注册时自动补入模型列表） */
export const VIRTUAL_TOPAZ_MODELS: BackendModelInfo[] = [
  {
    id: TVAI_FI_MODEL_ID,
    name: TVAI_FI_MODEL_ID,
    display_name: 'Topaz 视频插帧',
    vendor: 'topaz',
    publisher: 'topaz',
    capabilities: ['video_generation'],
    vendors: ['topaz'],
    modes: [],
    params: null,
  },
  {
    id: TVAI_PROC_MODEL_ID,
    name: TVAI_PROC_MODEL_ID,
    display_name: 'Topaz 视频组合处理（放大+插帧）',
    vendor: 'topaz',
    publisher: 'topaz',
    capabilities: ['video_generation'],
    vendors: ['topaz'],
    modes: [],
    params: null,
  },
]

export function isVirtualModel(modelId: string): boolean {
  return (
    modelId === GIGA_MODEL_ID ||
    modelId === TVAI_UP_MODEL_ID ||
    modelId === TVAI_FI_MODEL_ID ||
    modelId === TVAI_PROC_MODEL_ID
  )
}

export function isGigaModel(modelId: string): boolean {
  return modelId === GIGA_MODEL_ID
}

export function isTvaiUpModel(modelId: string): boolean {
  return modelId === TVAI_UP_MODEL_ID
}

export function isTvaiFiModel(modelId: string): boolean {
  return modelId === TVAI_FI_MODEL_ID
}

export function isTvaiProcModel(modelId: string): boolean {
  return modelId === TVAI_PROC_MODEL_ID
}

const GIGA_MODEL_OPTIONS = [
  { value: 'Standard', label: '标准' },
  { value: 'High Fidelity', label: '高保真' },
  { value: 'Low Resolution', label: '低分辨率' },
  { value: 'Art & CG', label: '艺术与CG' },
  { value: 'Lines', label: '线条' },
  { value: 'Very Compressed', label: '高度压缩' },
  { value: 'Text & Shapes', label: '文字与图形' },
  { value: 'Redefine', label: '重塑细节' },
  { value: 'Recover', label: '图像恢复' },
]

export const TOPAZ_ENHANCE_MODELS_OPTIONS = [
  { value: 'prob-4', label: 'Proteus v4 (推荐)' },
  { value: 'prob-3', label: 'Proteus v3' },
  { value: 'alq-13', label: 'Artemis 低画质 v13' },
  { value: 'amq-13', label: 'Artemis 中画质 v13' },
  { value: 'ahq-12', label: 'Artemis 高画质 v12' },
  { value: 'gcg-5', label: 'Gaia CG v5' },
  { value: 'ghq-5', label: 'Gaia HQ v5' },
  { value: 'nyx-1', label: 'Nyx v1 (降噪)' },
]

export const TOPAZ_INTERP_MODELS_OPTIONS = [
  { value: 'chf-3', label: 'Chronos Fast v3 (推荐)' },
  { value: 'chf-2', label: 'Chronos Fast v2' },
  { value: 'chr-2', label: 'Chronos v2 (慢动作)' },
  { value: 'apo-8', label: 'Apollo v8' },
  { value: 'apo-7', label: 'Apollo v7' },
  { value: 'apo-6', label: 'Apollo v6' },
]

export const GIGA_PARAMS: ModelParamSchema[] = [
  { name: 'file_urls', label: '输入图片', type: 'images', min_items: 1, max_items: 1 },
  { name: 'topaz_model', label: '模型', type: 'select', default: 'Standard', options: GIGA_MODEL_OPTIONS },
  { name: 'scale', label: '放大', type: 'float', default: 2.0, min: 0.5, max: 16 },
  { name: 'noise', label: '降噪', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'sharpen', label: '锐化', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'compression', label: '压缩修复', type: 'number', default: 30, min: 0, max: 100 },
  { name: 'face_recovery', label: '人脸修复', type: 'number', default: 0, min: 0, max: 100 },
]

export const TVAI_UP_PARAMS: ModelParamSchema[] = [
  { name: 'file_urls', label: '输入视频', type: 'files', min_items: 1, max_items: 1, accept: ['video/*'] },
  { name: 'topaz_model', label: '模型', type: 'select', default: 'prob-4', options: TOPAZ_ENHANCE_MODELS_OPTIONS },
  { name: 'scale', label: '放大倍数', type: 'select', default: '2',
    options: [{ value: '1', label: '1x' }, { value: '2', label: '2x' }, { value: '4', label: '4x' }] },
  { name: 'noise', label: '降噪', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'details', label: '恢复细节', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'estimate', label: '估计帧数', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'blur', label: '锐化', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'halo', label: '光晕', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'preblur', label: '抗锯齿/去模糊', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'compression', label: '压缩修复', type: 'number', default: 0, min: 0, max: 100 },
  { name: 'blend', label: '细节还原', type: 'number', default: 20, min: 0, max: 100 },
  { name: 'output_resolution', label: '输出分辨率', type: 'select', default: '',
    options: [
      { value: '', label: '倍率模式' },
      { value: '1920x1080', label: '1080P' },
      { value: '3840x2160', label: '4K' },
      { value: 'custom', label: '自定义' },
    ] },
  { name: 'custom_width', label: '自定义宽度', type: 'number', default: 1920, min: 1, max: 7680 },
  { name: 'custom_height', label: '自定义高度', type: 'number', default: 1080, min: 1, max: 4320 },
  { name: 'output_format', label: '输出格式', type: 'select', default: 'mp4',
    options: [{ value: 'mp4', label: 'MP4' }, { value: 'mov', label: 'MOV' }] },
]

export const TVAI_FI_PARAMS: ModelParamSchema[] = [
  { name: 'file_urls', label: '输入视频', type: 'files', min_items: 1, max_items: 1, accept: ['video/*'] },
  { name: 'topaz_model', label: '模型', type: 'select', default: 'chf-3', options: TOPAZ_INTERP_MODELS_OPTIONS },
  { name: 'fps', label: '目标帧率', type: 'number', default: 60, min: 1, max: 240 },
  { name: 'slowmo', label: '慢动作', type: 'float', default: 1.0, min: 1.0, max: 10 },
  { name: 'rdt', label: 'RDT', type: 'float', default: 0.01, min: 0, max: 1 },
  { name: 'output_format', label: '输出格式', type: 'select', default: 'mp4',
    options: [{ value: 'mp4', label: 'MP4' }, { value: 'mov', label: 'MOV' }] },
]

export function getVirtualModelParams(modelId: string): ModelParamSchema[] {
  if (modelId === GIGA_MODEL_ID) return GIGA_PARAMS
  if (modelId === TVAI_UP_MODEL_ID) return TVAI_UP_PARAMS
  if (modelId === TVAI_FI_MODEL_ID) return TVAI_FI_PARAMS
  if (modelId === TVAI_PROC_MODEL_ID) return TVAI_PROC_PARAMS
  return []
}

export function getVirtualModelDefaults(modelId: string): Record<string, any> {
  const params = getVirtualModelParams(modelId)
  const defaults: Record<string, any> = {}
  for (const p of params) {
    if (p.default !== undefined) defaults[p.name] = p.default
  }
  return defaults
}

const TVAI_UP_RATIO_PARAMS = ['noise', 'details', 'halo', 'preblur', 'blur', 'compression', 'blend']

/**
 * 将 tvai_up 的 UI 参数（0-100 整数）转换为工具服务器期望的范围（-1~1 / 0~1 浮点）。
 * 同时处理 scale 类型转换和 scale/output_resolution 互斥逻辑。
 * giga 和 tvai_fi 参数已与工具服务器匹配，直接透传。
 */
export function transformVirtualModelParams(
  modelId: string,
  params: Record<string, any>,
): Record<string, any> {
  if (modelId === TVAI_UP_MODEL_ID) {
    const result: Record<string, any> = { ...params }

    for (const key of TVAI_UP_RATIO_PARAMS) {
      if (typeof result[key] === 'number') {
        result[key] = result[key] / 100
      }
    }

    if (result.scale !== undefined && result.scale !== null) {
      result.scale = parseInt(String(result.scale), 10)
    }

    if (result.output_resolution && result.output_resolution !== '') {
      result.scale = 0
    }

    return result
  }

  if (modelId === TVAI_PROC_MODEL_ID) {
    return transformProcessParams(params)
  }

  return params
}
