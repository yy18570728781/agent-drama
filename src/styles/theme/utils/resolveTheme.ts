import type { ResolvedThemeMode, ThemeMode } from '@/styles/theme/types/theme'
import { DEFAULT_RESOLVED_THEME_MODE, THEME_MEDIA_QUERY } from '@/styles/theme/utils/themeStorage'

export function getSystemThemeMode(): ResolvedThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_RESOLVED_THEME_MODE
  }

  return window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemMode: ResolvedThemeMode = getSystemThemeMode(),
): ResolvedThemeMode {
  return mode === 'system' ? systemMode : mode
}

export function watchSystemThemeMode(onChange: (mode: ResolvedThemeMode) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY)
  const handler = () => onChange(mediaQuery.matches ? 'dark' : 'light')

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }

  mediaQuery.addListener(handler)
  return () => mediaQuery.removeListener(handler)
}