import type { TopazProcessParams } from '@/services/generation/topazProcess.types'
import type { ModelParamSchema } from '@/api/models'

export const TVAI_PROC_MODEL_ID = 'topaz-video-video-process'

/** AIGC 工作机 tools-server 地址列表（3 台 GPU 机器） */
export const TOPAZ_WORKERS = [
  'http://10.2.10.251:8189/topaz-video/process',
  'http://10.2.10.252:8189/topaz-video/process',
  'http://10.2.10.253:8189/topaz-video/process',
]

let _rrIndex = 0

/** 轮询获取下一个 worker URL */
export function nextWorker(): string {
  const worker = TOPAZ_WORKERS[_rrIndex % TOPAZ_WORKERS.length]
  _rrIndex++
  return worker
}

/** 依次尝试每台 worker 直到成功，全部失败则抛最后一个错误 */
export async function withWorkerRetry<T>(
  fn: (base: string) => Promise<T>,
): Promise<T> {
  let lastErr: unknown
  for (const base of TOPAZ_WORKERS) {
    try {
      return await fn(base)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/** 同步别名，兼容残留引用 */
export const TOOLS_BASE_URL = TOPAZ_WORKERS[0]

/** localStorage 配置存储 key */
export const CONFIGS_STORAGE_KEY = 'topaz_process_configs'

/** 默认工具服务器配置 */
export const DEFAULT_TOOLS_CONFIG = {
  name: 'AIGC-251（默认）',
  url: TOOLS_BASE_URL,
  topaz_path: '',
}

/** 需要从 0-100 整数转换为 0-1 浮点的放大参数字段 */
export const RATIO_PARAM_FIELDS = [
  'noise',
  'details',
  'halo',
  'preblur',
  'blur',
  'compression',
  'blend',
] as const

/** 组合管线全参数默认值（对齐 processor.py ProcessRequest 默认值） */
export const PROC_DEFAULT_PARAMS: TopazProcessParams = {
  enable_enhance: true,
  enable_interpolate: true,
  upscale_model: 'prob-4',
  scale: 2,
  output_resolution: '',
  custom_width: 1920,
  custom_height: 1080,
  estimate: 0,
  preblur: 0,
  noise: 0,
  details: 0,
  halo: 0,
  blur: 0,
  compression: 0,
  blend: 20,
  lock_aspect_ratio: true,
  fi_model: 'apo-8',
  fps: 60,
  slowmo: 1.0,
  rdt: 0.01,
  duplicate: true,
  duplicate_threshold: 10,
  scene_split: false,
  output_format: 'mp4',
  video_encoder: 'h264_nvenc',
  video_bitrate: 24,
  audio_codec: 'copy',
  audio_bitrate: 320,
  topaz_path: '',
}

// ── /models 拉取失败时的兜底常量（值抄自 upscaler.py / interpolator.py / processor.py）──

export const FALLBACK_UPSCALE_MODELS: Record<string, string> = {
  'Proteus v4 (推荐)': 'prob-4',
  'Proteus v3': 'prob-3',
  'Artemis 低画质 v13': 'alq-13',
  'Artemis 中画质 v13': 'amq-13',
  'Artemis 高画质 v12': 'ahq-12',
  'Gaia CG v5': 'gcg-5',
  'Gaia HQ v5': 'ghq-5',
  'Iris v1 (人脸)': 'iris-1',
  'Nyx v1 (降噪)': 'nyx-1',
  'Rhea v1 (AI重塑)': 'rhea-1',
}

export const FALLBACK_INTERP_MODELS: Record<string, string> = {
  'Chronos Fast v3 (推荐)': 'chf-3',
  'Chronos Fast v2': 'chf-2',
  'Chronos v2 (慢动作)': 'chr-2',
  'Chronos v1 (慢动作)': 'chr-1',
  'Apollo v8': 'apo-8',
  'Apollo v7': 'apo-7',
  'Apollo v6': 'apo-6',
  'Apollo v5': 'apo-5',
}

export const FALLBACK_ENCODERS: Record<string, string> = {
  'h264_nvenc (NVIDIA)': 'h264_nvenc',
  'h264_amf (AMD)': 'h264_amf',
  'h264_qsv (Intel)': 'h264_qsv',
  'libx264 (CPU)': 'libx264',
  'hevc_nvenc (NVIDIA HEVC)': 'hevc_nvenc',
  'hevc_amf (AMD HEVC)': 'hevc_amf',
  'hevc_qsv (Intel HEVC)': 'hevc_qsv',
  'libx265 (CPU HEVC)': 'libx265',
  'prores_ks (ProRes)': 'prores_ks',
}

export const FALLBACK_RESOLUTIONS: Record<string, string> = {
  '640x480 (SD NTSC)': '640x480',
  '768x576 (SD PAL)': '768x576',
  '1280x720 (HD)': '1280x720',
  '1920x1080 (FHD)': '1920x1080',
  '3840x2160 (4K)': '3840x2160',
  '7680x4320 (8K)': '7680x4320',
}

export const FALLBACK_SCALES = [1, 2, 4]
export const FALLBACK_FPS_PRESETS = [25, 30, 60, 120]

export const AUDIO_CODEC_OPTIONS = [
  { value: 'copy', label: 'copy (不变)' },
  { value: 'aac', label: 'AAC' },
  { value: 'libmp3lame', label: 'MP3' },
  { value: 'libopus', label: 'Opus' },
  { value: 'none', label: 'none (无音频)' },
]

export const OUTPUT_FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mov', label: 'MOV (ProRes)' },
]

export const OUTPUT_RESOLUTION_OPTIONS = [
  { value: '', label: '倍率模式' },
  { value: '1', label: '1x (原始)' },
  { value: '2', label: '2x Upscale' },
  { value: '4', label: '4x Upscale' },
  { value: '640x480', label: '640×480 (SD NTSC)' },
  { value: '768x576', label: '768×576 (SD PAL)' },
  { value: '1280x720', label: '1280×720 (HD)' },
  { value: '1920x1080', label: '1920×1080 (FHD)' },
  { value: '3840x2160', label: '3840×2160 (4K)' },
  { value: '7680x4320', label: '7680×4320 (8K)' },
  { value: 'custom', label: '自定义分辨率' },
]

/** 组合管线 UI 参数 schema（用于 getVirtualModelParams） */
export const TVAI_PROC_PARAMS: ModelParamSchema[] = [
  { name: 'file_urls', label: '输入视频', type: 'files', min_items: 1, max_items: 1, accept: ['video/*'] },
  { name: 'enable_enhance', label: '启用放大', type: 'boolean', default: true },
  { name: 'enable_interpolate', label: '启用插帧', type: 'boolean', default: true },
]

/**
 * 将 UI 参数（0-100 整数）转换为后端期望的范围（0-1 浮点）。
 * 处理 scale 类型转换和 output_resolution 互斥逻辑。
 */
export function transformProcessParams(
  params: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = { ...params }

  for (const key of RATIO_PARAM_FIELDS) {
    if (typeof result[key] === 'number') {
      result[key] = result[key] / 100
    }
  }

  if (result.scale !== undefined && result.scale !== null && result.scale !== '') {
    result.scale = parseInt(String(result.scale), 10)
  }

  const outputRes = result.output_resolution
  if (outputRes && outputRes !== '') {
    result.scale = 0
  }

  return result
}
