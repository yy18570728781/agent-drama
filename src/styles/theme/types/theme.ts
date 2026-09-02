export const themeModes = ['system', 'light', 'dark'] as const
export const resolvedThemeModes = ['light', 'dark'] as const
export const themeBrands = ['default', 'graphite', 'warm'] as const
export const themeDensities = ['comfortable', 'compact'] as const
export const edgeStyles = ['default', 'simplebezier', 'smoothstep', 'step', 'straight', 'manhattan', 'metro', 'er'] as const
export const edgeColorModes = ['uniform', 'byType'] as const
export const edgeVisualStyles = ['plain', 'tech'] as const
export const edgeAnimStyles = ['none', 'flow', 'trail', 'pulse', 'blink'] as const
export const flowDropDirections = ['vertical', 'horizontal'] as const

export type ThemeMode = (typeof themeModes)[number]
export type ResolvedThemeMode = (typeof resolvedThemeModes)[number]
export type ThemeBrand = (typeof themeBrands)[number]
export type ThemeDensity = (typeof themeDensities)[number]
export type EdgeStyle = (typeof edgeStyles)[number]
export type EdgeColorMode = (typeof edgeColorModes)[number]
export type EdgeVisualStyle = (typeof edgeVisualStyles)[number]
export type EdgeAnimStyle = (typeof edgeAnimStyles)[number]
export type FlowDropDirection = (typeof flowDropDirections)[number]

export interface ThemeDomState {
  mode: ResolvedThemeMode
  brand: ThemeBrand
  density: ThemeDensity
}
