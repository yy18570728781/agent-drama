/**
 * Topaz 视频组合管线相关类型定义。
 * 镜像 infinite_canvas-tools-server/processor.py ProcessRequest。
 */

/** 组合管线完整参数（对齐后端 ProcessRequest） */
export interface TopazProcessParams {
  /** 输入 */
  video_url?: string
  video_path?: string

  /** 模式开关 */
  enable_enhance: boolean
  enable_interpolate: boolean

  /** 放大参数 */
  upscale_model: string
  scale: number
  output_resolution: string
  custom_width: number
  custom_height: number
  estimate: number
  preblur: number
  noise: number
  details: number
  halo: number
  blur: number
  compression: number
  blend: number
  lock_aspect_ratio: boolean

  /** 插帧参数 */
  fi_model: string
  fps: number
  slowmo: number
  rdt: number
  duplicate: boolean
  duplicate_threshold: number
  scene_split: boolean

  /** 输出设置 */
  output_format: string
  video_encoder: string
  video_bitrate: number
  audio_codec: string
  audio_bitrate: number

  /** 其他 */
  topaz_path: string
}

/** GET /models 返回 */
export interface TopazModelsResponse {
  upscale: Record<string, string>
  interpolate: Record<string, string>
  encoders: Record<string, string>
  resolutions: Record<string, [number, number]>
  scales: number[]
  fps_presets: number[]
}

/** 预设列表项 */
export interface PresetInfo {
  id: string
  name: string
}

/** GET /presets 返回 */
export interface PresetListResponse {
  presets: PresetInfo[]
}

/** GET /presets/{name} 返回（load_preset 结果） */
export interface PresetDetail {
  name: string
  enable_enhance?: boolean
  enable_interpolate?: boolean
  upscale_model?: string
  compression?: number
  preblur?: number
  blur?: number
  noise?: number
  halo?: number
  details?: number
  blend?: number
  estimate?: number
  output_resolution?: string
  custom_width?: number
  custom_height?: number
  lock_aspect_ratio?: boolean
  fi_model?: string
  fps?: number
  slowmo?: number
  duplicate?: boolean
  duplicate_threshold?: number
  scene_split?: boolean
  rdt?: number
  video_encoder?: string
  video_bitrate?: number
  output_format?: string
  audio_codec?: string
  audio_bitrate?: number
}

/** POST /estimate 返回 */
export interface EstimateResponse {
  status: string
  video_info: {
    width: number
    height: number
    fps: number
    duration: number
  }
  params: {
    compression: number
    details: number
    blur: number
    noise: number
    halo: number
    preblur: number
    blend: number
  }
}

/** SSE /progress/{id} payload */
export interface ProcessProgressData {
  status: string
  progress: number
  message: string
  current_frame: number
  total_frames: number
}

/** POST /run_async 返回 */
export interface RunAsyncResponse {
  task_id: string
  queue_position?: number
}

/** POST /upload 返回 */
export interface UploadResponse {
  path: string
  filename?: string
}

/** GET /result/{id} 返回 */
export interface ProcessResultResponse {
  task_id: string
  status: string
  progress: number
  message: string
  file_url?: string
  output_path?: string
}

/** 工具服务器配置 */
export interface ToolsServerConfig {
  name: string
  url: string
  topaz_path: string
}
