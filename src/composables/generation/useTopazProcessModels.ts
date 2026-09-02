import { ref, onMounted, type Ref } from 'vue'
import * as topazService from '@/services/generation/topazProcess.service'
import {
  FALLBACK_UPSCALE_MODELS,
  FALLBACK_INTERP_MODELS,
  FALLBACK_ENCODERS,
  FALLBACK_RESOLUTIONS,
  FALLBACK_SCALES,
  FALLBACK_FPS_PRESETS,
} from '@/services/generation/topazProcess.constants'

export interface UseTopazProcessModelsReturn {
  upscaleModels: Ref<Record<string, string>>
  interpModels: Ref<Record<string, string>>
  encoders: Ref<Record<string, string>>
  resolutions: Ref<Record<string, string>>
  scales: Ref<number[]>
  fpsPresets: Ref<number[]>
  loading: Ref<boolean>
  refresh: () => Promise<void>
}

export function useTopazProcessModels(): UseTopazProcessModelsReturn {
  const upscaleModels = ref<Record<string, string>>(FALLBACK_UPSCALE_MODELS)
  const interpModels = ref<Record<string, string>>(FALLBACK_INTERP_MODELS)
  const encoders = ref<Record<string, string>>(FALLBACK_ENCODERS)
  const resolutions = ref<Record<string, string>>(FALLBACK_RESOLUTIONS)
  const scales = ref<number[]>(FALLBACK_SCALES)
  const fpsPresets = ref<number[]>(FALLBACK_FPS_PRESETS)
  const loading = ref(false)

  async function loadModels() {
    loading.value = true
    try {
      const data = await topazService.fetchModels()
      upscaleModels.value = data.upscale || FALLBACK_UPSCALE_MODELS
      interpModels.value = data.interpolate || FALLBACK_INTERP_MODELS
      encoders.value = data.encoders || FALLBACK_ENCODERS

      const resKeys = Object.keys(data.resolutions || {})
      if (resKeys.length > 0) {
        const resMap: Record<string, string> = {}
        for (const key of resKeys) {
          const dims = data.resolutions[key]
          const label = `${dims[0]}×${dims[1]}`
          resMap[label] = key
        }
        resolutions.value = resMap
      }

      scales.value = data.scales || FALLBACK_SCALES
      fpsPresets.value = data.fps_presets || FALLBACK_FPS_PRESETS
    } catch {
      /* keep fallback values */
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    await loadModels()
  }

  onMounted(() => {
    void loadModels()
  })

  return {
    upscaleModels,
    interpModels,
    encoders,
    resolutions,
    scales,
    fpsPresets,
    loading,
    refresh,
  }
}
