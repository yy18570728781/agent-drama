import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/styles/theme/store/theme'
import { type ThemeMode } from '@/styles/theme/types/theme'

const themeModeCycle: ThemeMode[] = ['system', 'light', 'dark']

export function useTheme() {
  const themeStore = useThemeStore()
  const refs = storeToRefs(themeStore)

  function cycleMode() {
    const currentIndex = themeModeCycle.indexOf(themeStore.mode)
    const nextIndex = (currentIndex + 1) % themeModeCycle.length
    themeStore.setMode(themeModeCycle[nextIndex])
  }

  return {
    ...refs,
    setMode: themeStore.setMode,
    setBrand: themeStore.setBrand,
    setDensity: themeStore.setDensity,
    setEdgeStyle: themeStore.setEdgeStyle,
    setEdgeColorMode: themeStore.setEdgeColorMode,
    setEdgeHighlightColor: themeStore.setEdgeHighlightColor,
    setEdgeTypeHighlightColor: themeStore.setEdgeTypeHighlightColor,
    setEdgeAnimStyle: themeStore.setEdgeAnimStyle,
    setEdgeArrow: themeStore.setEdgeArrow,
    setMediaPreviewLimit: themeStore.setMediaPreviewLimit,
    setFlowDropDirection: themeStore.setFlowDropDirection,
    setShowNodeTitle: themeStore.setShowNodeTitle,
    setAutoCompressOriginalRatio: themeStore.setAutoCompressOriginalRatio,
    setCompressThresholdMb: themeStore.setCompressThresholdMb,
    syncResolvedMode: themeStore.syncResolvedMode,
    cycleMode,
  }
}
