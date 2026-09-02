import type { ThemeDomState } from '@/styles/theme/types/theme'

export function applyThemeAttributes(state: ThemeDomState): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.mode = state.mode
  root.dataset.brand = state.brand
  root.dataset.density = state.density
  root.classList.toggle('dark', state.mode === 'dark')
  root.style.colorScheme = state.mode
}