import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { edgeStyles, type EdgeAnimStyle, type EdgeColorMode, type EdgeStyle, type EdgeVisualStyle, type FlowDropDirection, type ResolvedThemeMode, type ThemeBrand, type ThemeDensity, type ThemeDomState, type ThemeMode } from '@/styles/theme/types/theme'
import {
  DEFAULT_EDGE_ANIM_STYLE,
  DEFAULT_EDGE_COLOR_MODE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_EDGE_VISUAL_STYLE,
  DEFAULT_RESOLVED_THEME_MODE,
  DEFAULT_THEME_BRAND,
  DEFAULT_THEME_DENSITY,
  DEFAULT_THEME_MODE,
} from '@/styles/theme/utils/themeStorage'
import { resolveThemeMode } from '@/styles/theme/utils/resolveTheme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(DEFAULT_THEME_MODE)
  const brand = ref<ThemeBrand>(DEFAULT_THEME_BRAND)
  const density = ref<ThemeDensity>(DEFAULT_THEME_DENSITY)
  const edgeStyle = ref<EdgeStyle>(DEFAULT_EDGE_STYLE)
  const edgeColorMode = ref<EdgeColorMode>(DEFAULT_EDGE_COLOR_MODE)
  const edgeVisualStyle = ref<EdgeVisualStyle>(DEFAULT_EDGE_VISUAL_STYLE)
  const edgeAnimStyle = ref<EdgeAnimStyle>(DEFAULT_EDGE_ANIM_STYLE)
  const edgeArrow = ref(false)
  const edgeHighlightColor = ref('#93c5fd')
  const edgeTypeHighlightColors = ref<Record<string, string>>({})
  const mediaPreviewLimit = ref(80)
  const flowDropDirection = ref<FlowDropDirection>('vertical')
  const showNodeTitle = ref(true)
  const autoCompressOriginalRatio = ref(false)
  const compressThresholdMb = ref(10)
  const resolvedMode = ref<ResolvedThemeMode>(DEFAULT_RESOLVED_THEME_MODE)

  const domState = computed<ThemeDomState>(() => ({
    mode: resolvedMode.value,
    brand: brand.value,
    density: density.value,
  }))

  const isDark = computed(() => resolvedMode.value === 'dark')

  function setMode(nextMode: ThemeMode) {
    mode.value = nextMode
  }

  function setBrand(nextBrand: ThemeBrand) {
    brand.value = nextBrand
  }

  function setDensity(nextDensity: ThemeDensity) {
    density.value = nextDensity
  }

  function setEdgeStyle(nextEdgeStyle: EdgeStyle) {
    edgeStyle.value = nextEdgeStyle
  }

  function setEdgeColorMode(next: EdgeColorMode) {
    edgeColorMode.value = next
  }

  function setEdgeHighlightColor(next: string) {
    edgeHighlightColor.value = next
  }

  function setEdgeTypeHighlightColor(type: string, color: string) {
    edgeTypeHighlightColors.value = { ...edgeTypeHighlightColors.value, [type]: color }
  }

  function setEdgeAnimStyle(next: EdgeAnimStyle) {
    edgeAnimStyle.value = next
  }

  function setEdgeArrow(next: boolean) {
    edgeArrow.value = next
  }

  function setAutoCompressOriginalRatio(next: boolean) {
    autoCompressOriginalRatio.value = next
  }

  function setCompressThresholdMb(next: number) {
    const normalized = Number.isFinite(next) ? next : 10
    compressThresholdMb.value = Math.max(1, Math.min(10, Math.round(normalized)))
  }

  function setMediaPreviewLimit(next: number) {
    const normalized = Number.isFinite(next) ? next : 80
    mediaPreviewLimit.value = Math.max(0, Math.min(300, Math.round(normalized)))
  }

  function setFlowDropDirection(next: FlowDropDirection) {
    flowDropDirection.value = next
  }

  function setShowNodeTitle(next: boolean) {
    showNodeTitle.value = next
  }

  function setEdgeVisualStyle(next: EdgeVisualStyle) {
    edgeVisualStyle.value = next
  }

  function syncResolvedMode(systemMode?: ResolvedThemeMode) {
    resolvedMode.value = resolveThemeMode(mode.value, systemMode)
  }

  return {
    mode,
    brand,
    density,
    edgeStyle,
    edgeColorMode,
    edgeVisualStyle,
    edgeAnimStyle,
    edgeArrow,
    edgeHighlightColor,
    edgeTypeHighlightColors,
    mediaPreviewLimit,
    flowDropDirection,
    showNodeTitle,
    autoCompressOriginalRatio,
    compressThresholdMb,
    resolvedMode,
    domState,
    isDark,
    setMode,
    setBrand,
    setDensity,
    setEdgeStyle,
    setEdgeColorMode,
    setEdgeHighlightColor,
    setEdgeTypeHighlightColor,
    setEdgeAnimStyle,
    setEdgeArrow,
    setEdgeVisualStyle,
    setMediaPreviewLimit,
    setFlowDropDirection,
    setShowNodeTitle,
    setAutoCompressOriginalRatio,
    setCompressThresholdMb,
    syncResolvedMode,
  }
}, {
  persist: {
    paths: [
      'mode',
      'brand',
      'density',
      'edgeStyle',
      'edgeColorMode',
      'edgeHighlightColor',
      'edgeTypeHighlightColors',
      'edgeAnimStyle',
      'edgeArrow',
      'mediaPreviewLimit',
      'flowDropDirection',
      'showNodeTitle',
      'autoCompressOriginalRatio',
      'compressThresholdMb',
    ],
  },
})
