import { watch, type Ref } from 'vue'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'

/**
 * Keeps remembered reference state and live reference manager state in sync.
 * This avoids losing persisted references when the remember layer is initialized
 * before the reference manager creates its own reactive array.
 */
export function useRememberedReferenceBridge(
  rememberedRefImages: Ref<ReferenceImage[]>,
  liveRefImages: Ref<ReferenceImage[]>,
): void {
  let syncing = false

  watch(rememberedRefImages, (nextImages) => {
    if (syncing) return
    syncing = true
    liveRefImages.value = nextImages
    queueMicrotask(() => { syncing = false })
  })

  watch(liveRefImages, (nextImages) => {
    if (syncing) return
    syncing = true
    rememberedRefImages.value = nextImages
    queueMicrotask(() => { syncing = false })
  })
}
