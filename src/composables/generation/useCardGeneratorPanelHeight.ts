import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'

const PANEL_HEIGHT_STORAGE_KEY = 'card_generator_panel_height_v1'
const MIN_PANEL_HEIGHT = 280
const VIEWPORT_TOP_GAP = 80
const FALLBACK_MAX_HEIGHT = 720

interface UseCardGeneratorPanelHeightReturn {
  height: Ref<number | undefined>
  maxHeight: Ref<number>
  minHeight: number
  setHeight: (height: number) => void
}

function getMaximumHeight(): number {
  if (typeof window === 'undefined') return FALLBACK_MAX_HEIGHT
  return Math.max(MIN_PANEL_HEIGHT, window.innerHeight - VIEWPORT_TOP_GAP)
}

function clampHeight(height: number, maximum: number): number {
  return Math.min(maximum, Math.max(MIN_PANEL_HEIGHT, Math.round(height)))
}

function readStoredHeight(maximum: number): number | undefined {
  const stored = getStorage<unknown>(PANEL_HEIGHT_STORAGE_KEY)
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return undefined
  return clampHeight(stored, maximum)
}

/**
 * Keeps the Card generator panel height within the viewport and across reloads.
 *
 * @returns Reactive height limits and the committed-height handler.
 */
export function useCardGeneratorPanelHeight(): UseCardGeneratorPanelHeightReturn {
  const maxHeight = ref(getMaximumHeight())
  const height = ref<number | undefined>(readStoredHeight(maxHeight.value))

  function setHeight(nextHeight: number): void {
    if (!Number.isFinite(nextHeight)) return
    const clamped = clampHeight(nextHeight, maxHeight.value)
    height.value = clamped
    setStorage(PANEL_HEIGHT_STORAGE_KEY, clamped)
  }

  function syncViewportLimit(): void {
    maxHeight.value = getMaximumHeight()
    if (height.value !== undefined && height.value > maxHeight.value) {
      setHeight(maxHeight.value)
    }
  }

  onMounted((): void => window.addEventListener('resize', syncViewportLimit))
  onBeforeUnmount((): void => window.removeEventListener('resize', syncViewportLimit))

  return { height, maxHeight, minHeight: MIN_PANEL_HEIGHT, setHeight }
}
