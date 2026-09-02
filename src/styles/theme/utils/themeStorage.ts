import type { EdgeAnimStyle, EdgeColorMode, EdgeStyle, EdgeVisualStyle, ResolvedThemeMode, ThemeBrand, ThemeDensity, ThemeMode } from '@/styles/theme/types/theme'

export const THEME_STORE_ID = 'theme'
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export const DEFAULT_THEME_MODE: ThemeMode = 'dark'
export const DEFAULT_RESOLVED_THEME_MODE: ResolvedThemeMode = 'dark'
export const DEFAULT_THEME_BRAND: ThemeBrand = 'default'
export const DEFAULT_THEME_DENSITY: ThemeDensity = 'comfortable'
export const DEFAULT_EDGE_STYLE: EdgeStyle = 'smoothstep'
export const DEFAULT_EDGE_COLOR_MODE: EdgeColorMode = 'uniform'
export const DEFAULT_EDGE_VISUAL_STYLE: EdgeVisualStyle = 'plain'
export const DEFAULT_EDGE_ANIM_STYLE: EdgeAnimStyle = 'none'
