import type { Pinia } from 'pinia'
import { watch } from 'vue'
import { useThemeStore } from '@/styles/theme/store/theme'
import { applyThemeAttributes } from '@/styles/theme/utils/applyTheme'
import { getSystemThemeMode, watchSystemThemeMode } from '@/styles/theme/utils/resolveTheme'

/**
 * Synchronizes the Pinia theme state with document and system preferences.
 *
 * @param pinia Pinia instance used to resolve the theme store before app mount.
 * @returns A cleanup function that stops all theme watchers.
 */
export function initTheme(pinia: Pinia): () => void {
  const themeStore = useThemeStore(pinia)

  const syncTheme = () => {
    themeStore.syncResolvedMode(getSystemThemeMode())
    applyThemeAttributes(themeStore.domState)
  }

  syncTheme()

  const stopThemeWatch = watch(
    () => [themeStore.mode, themeStore.brand, themeStore.density] as const,
    syncTheme,
  )

  const stopSystemWatch = watchSystemThemeMode((systemMode) => {
    if (themeStore.mode !== 'system') return
    themeStore.syncResolvedMode(systemMode)
    applyThemeAttributes(themeStore.domState)
  })

  return () => {
    stopThemeWatch()
    stopSystemWatch()
  }
}
