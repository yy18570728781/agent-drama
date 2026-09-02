import { reactive, watch } from 'vue'
import { usePBRStore } from '@/stores/pbr.store'
import { ALL_CHANNELS } from '@/types/pbr.types'
import type { PBRChannel } from '@/types/pbr.types'

const THUMB_SIZE = 128

export function useChannelThumbnails() {
  const store = usePBRStore()
  const urls = reactive<Record<PBRChannel, string>>({} as Record<PBRChannel, string>)
  const cache = new Map<PBRChannel, string>()
  const stopped: (() => void)[] = []

  for (const ch of ALL_CHANNELS) {
    urls[ch] = ''
  }

  function updateThumb(ch: PBRChannel) {
    const canvas = store.channels[ch]?.canvas
    if (!canvas) {
      const old = cache.get(ch)
      if (old) {
        URL.revokeObjectURL(old)
        cache.delete(ch)
      }
      urls[ch] = ''
      return
    }

    try {
      const tc = document.createElement('canvas')
      tc.width = THUMB_SIZE
      tc.height = THUMB_SIZE
      const ctx = tc.getContext('2d')!
      ctx.drawImage(canvas, 0, 0, THUMB_SIZE, THUMB_SIZE)

      tc.toBlob((blob) => {
        if (!blob) return
        const newUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          const old = cache.get(ch)
          cache.set(ch, newUrl)
          urls[ch] = newUrl
          if (old) URL.revokeObjectURL(old)
        }
        img.src = newUrl
      }, 'image/jpeg', 0.7)
    } catch {
      // ignore
    }
  }

  for (const ch of ALL_CHANNELS) {
    const stop = watch(
      () => store.channels[ch]?.canvas,
      () => updateThumb(ch),
      { immediate: true }
    )
    stopped.push(stop)
  }

  function dispose() {
    for (const s of stopped) s()
    for (const url of cache.values()) {
      URL.revokeObjectURL(url)
    }
    cache.clear()
  }

  return { urls, dispose }
}
