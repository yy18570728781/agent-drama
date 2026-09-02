import { ref, reactive, shallowRef, type Ref, type ShallowRef, type UnwrapNestedRefs } from 'vue'
import * as topazService from '@/services/generation/topazProcess.service'
import {
  PROC_DEFAULT_PARAMS,
  TOOLS_BASE_URL,
  withWorkerRetry,
  transformProcessParams,
} from '@/services/generation/topazProcess.constants'
import type {
  TopazProcessParams,
  PresetDetail,
  EstimateResponse,
  ProcessProgressData,
  ProcessResultResponse,
} from '@/services/generation/topazProcess.types'

export interface UseTopazProcessReturn {
  params: UnwrapNestedRefs<TopazProcessParams>
  progress: UnwrapNestedRefs<ProcessProgressData>
  result: ShallowRef<ProcessResultResponse | null>
  estimating: Ref<boolean>
  estimateInfo: Ref<EstimateResponse | null>
  applyPreset: (detail: PresetDetail) => void
  runEstimate: (videoUrl: string, videoPath: string, workerBase?: string) => Promise<void>
  submit: (
    videoUrl: string,
    videoPath: string,
    onProgress?: (data: ProcessProgressData) => void,
  ) => Promise<ProcessResultResponse>
}

export function useTopazProcess(baseUrl?: string): UseTopazProcessReturn {
  const base = baseUrl || TOOLS_BASE_URL

  const params = reactive<TopazProcessParams>({ ...PROC_DEFAULT_PARAMS })
  const progress = reactive<ProcessProgressData>({
    status: 'pending',
    progress: 0,
    message: '',
    current_frame: 0,
    total_frames: 0,
  })
  const result = shallowRef<ProcessResultResponse | null>(null)
  const estimating = ref(false)
  const estimateInfo = ref<EstimateResponse | null>(null)

  function applyPreset(detail: PresetDetail) {
    if (detail.enable_enhance !== undefined) {
      params.enable_enhance = detail.enable_enhance
    }
    if (detail.enable_interpolate !== undefined) {
      params.enable_interpolate = detail.enable_interpolate
    }
    if (detail.upscale_model) params.upscale_model = detail.upscale_model
    if (detail.compression !== undefined) params.compression = roundParam(detail.compression)
    if (detail.preblur !== undefined) params.preblur = roundParam(detail.preblur)
    if (detail.blur !== undefined) params.blur = roundParam(detail.blur)
    if (detail.noise !== undefined) params.noise = roundParam(detail.noise)
    if (detail.halo !== undefined) params.halo = roundParam(detail.halo)
    if (detail.details !== undefined) params.details = roundParam(detail.details)
    if (detail.blend !== undefined) params.blend = roundParam(detail.blend)
    if (detail.estimate !== undefined) params.estimate = detail.estimate
    if (detail.output_resolution !== undefined) {
      const res = detail.output_resolution.trim()
      const match = res.match(/^(\d+)\s*x\s*(\d+)$/i)
      if (match) {
        params.output_resolution = 'custom'
        params.custom_width = parseInt(match[1], 10)
        params.custom_height = parseInt(match[2], 10)
      } else if (detail.custom_width && detail.custom_height) {
        params.output_resolution = 'custom'
        params.custom_width = detail.custom_width
        params.custom_height = detail.custom_height
      } else {
        params.output_resolution = res
      }
    }
    if (detail.lock_aspect_ratio !== undefined) {
      params.lock_aspect_ratio = detail.lock_aspect_ratio
    }
    if (detail.fi_model) params.fi_model = detail.fi_model
    if (detail.fps !== undefined) params.fps = detail.fps
    if (detail.slowmo !== undefined) params.slowmo = detail.slowmo
    if (detail.rdt !== undefined) params.rdt = detail.rdt
    if (detail.duplicate !== undefined) params.duplicate = detail.duplicate
    if (detail.duplicate_threshold !== undefined) {
      params.duplicate_threshold = detail.duplicate_threshold
    }
    if (detail.scene_split !== undefined) params.scene_split = detail.scene_split
    if (detail.video_encoder) params.video_encoder = detail.video_encoder
    if (detail.video_bitrate !== undefined) params.video_bitrate = detail.video_bitrate
    if (detail.output_format) params.output_format = detail.output_format
    if (detail.audio_codec) params.audio_codec = detail.audio_codec
    if (detail.audio_bitrate !== undefined) params.audio_bitrate = detail.audio_bitrate
  }

  async function runEstimate(videoUrl: string, videoPath: string, workerBase?: string) {
    const estimateBase = workerBase || base
    estimating.value = true
    try {
      const resp = await topazService.estimateParams(estimateBase, {
        video_url: videoUrl,
        video_path: videoPath,
        topaz_model: params.upscale_model,
        topaz_path: params.topaz_path,
      })
      estimateInfo.value = resp
      const ep = resp.params
      params.compression = ep.compression
      params.details = ep.details
      params.blur = ep.blur
      params.noise = ep.noise
      params.halo = ep.halo
      params.preblur = ep.preblur
      params.blend = ep.blend
    } finally {
      estimating.value = false
    }
  }

  async function submit(
    videoUrl: string,
    videoPath: string,
    onProgress?: (data: ProcessProgressData) => void,
  ): Promise<ProcessResultResponse> {
    const transformed = transformProcessParams({ ...params })
    const requestParams = {
      ...transformed,
      video_url: videoUrl,
      video_path: videoPath,
    }

    let workerBase = ''
    const { task_id } = await withWorkerRetry(async (w) => {
      workerBase = w
      return topazService.runAsync(w, requestParams)
    })

    progress.status = 'processing'
    progress.message = '任务已提交'

    await new Promise<void>((resolve, reject) => {
      const close = topazService.subscribeProgress(
        workerBase,
        task_id,
        (data) => {
          progress.status = data.status
          progress.progress = data.progress
          progress.message = data.message
          progress.current_frame = data.current_frame
          progress.total_frames = data.total_frames
          if (onProgress) onProgress(data)
          if (data.status === 'completed') {
            close()
            resolve()
          } else if (data.status === 'error') {
            close()
            reject(new Error(data.message || '处理失败'))
          }
        },
        (err) => {
          close()
          reject(new Error('SSE 连接中断'))
        },
      )
    })

    const resultData = await topazService.fetchResult(workerBase, task_id)
    result.value = resultData
    progress.status = 'completed'
    progress.progress = 100
    return resultData
  }

  return {
    params,
    progress,
    result,
    estimating,
    estimateInfo,
    applyPreset,
    runEstimate,
    submit,
  }
}

function roundParam(val: number): number {
  return Math.round(val * 100)
}
