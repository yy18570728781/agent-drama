import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createDiscoverAmbientCanvasRuntime,
  type DiscoverAmbientCanvasRuntime,
} from '@/components/discover/discoverAmbientCanvas.runtime'
import { useTheme } from '@/styles/theme/composables/useTheme'

interface UseDiscoverAmbientCanvasReturn {
  canvas: Ref<HTMLCanvasElement | null>
}

/**
 * Connects the Discover water canvas runtime to Vue lifecycle and theme state.
 * @returns Template canvas ref managed for the component lifetime.
 */
export function useDiscoverAmbientCanvas(): UseDiscoverAmbientCanvasReturn {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const { resolvedMode } = useTheme()
  let runtime: DiscoverAmbientCanvasRuntime | null = null

  watch(resolvedMode, () => runtime?.requestDraw())

  onMounted(() => {
    if (!canvas.value) return
    runtime = createDiscoverAmbientCanvasRuntime(canvas.value, () => resolvedMode.value)
  })

  onBeforeUnmount(() => {
    runtime?.dispose()
    runtime = null
  })

  return { canvas }
}
