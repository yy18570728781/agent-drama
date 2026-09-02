import { onUnmounted, ref, watch, type Ref } from 'vue'
import { detectNewResultEffects } from '@/composables/generation/cardViewNewResults'

interface UseCardViewResultHighlightsOptions {
  groupedAssets: Ref<any[][]>
  containerRef: Ref<HTMLElement | null>
  scheduleLayoutUpdate: () => void
  isLoadingOlder?: () => boolean
  setSelectedAssetIndex: (groupId: string | number, index: number) => void
}

function clearTimers(timers: Map<string, number>): void {
  for (const timer of timers.values()) window.clearTimeout(timer)
  timers.clear()
}

function resetTimer(
  timers: Map<string, number>,
  key: string,
  callback: () => void,
): void {
  const previousTimer = timers.get(key)
  if (previousTimer) window.clearTimeout(previousTimer)
  timers.set(key, window.setTimeout(callback, 3000))
}

export function useCardViewResultHighlights(
  options: UseCardViewResultHighlightsOptions,
): { highlightedGroupKeys: Ref<Set<string>> } {
  const highlightedGroupKeys = ref<Set<string>>(new Set())
  const timers = new Map<string, number>()
  let previousGroups: any[][] = []
  let baselineEstablished = false

  watch(() => options.groupedAssets.value, (groups) => {
    options.scheduleLayoutUpdate()
    if (!baselineEstablished) {
      previousGroups = groups
      baselineEstablished = true
      return
    }
    const effects = detectNewResultEffects(previousGroups, groups)
    previousGroups = groups
    if (!effects.hasNewResults || options.isLoadingOlder?.()) return
    for (const key of effects.selectLatestGroupKeys) {
      const index = effects.selectLatestIndices[key]
      if (index != null) options.setSelectedAssetIndex(key, index)
    }
    const nextKeys = new Set(highlightedGroupKeys.value)
    for (const key of effects.highlightGroupKeys) {
      nextKeys.add(key)
      resetTimer(timers, key, () => {
        const updatedKeys = new Set(highlightedGroupKeys.value)
        updatedKeys.delete(key)
        highlightedGroupKeys.value = updatedKeys
        timers.delete(key)
      })
    }
    highlightedGroupKeys.value = nextKeys
    if (effects.shouldScrollToBottom && options.containerRef.value) {
      options.containerRef.value.scrollTop = 0
    }
  }, { immediate: true })

  onUnmounted(() => clearTimers(timers))

  return { highlightedGroupKeys }
}
