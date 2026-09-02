import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import App from '@/App.vue'
import router from '@/router'
import { initTheme } from '@/app/initTheme'
import { environmentPlugin } from '@/app/environment'
import directivesPlugin from '@/directives'
import { setupErrorInterceptor } from '@/utils/errorInterceptor'
import { initStorage, indexedDbStorageLike } from '@/utils/storage'

function preserveDevtoolsShortcuts(): void {
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    const key = String(event.key || '').toLowerCase()
    const hasModifier = event.ctrlKey || event.metaKey
    const isDevtoolsShortcut = key === 'f12' || (hasModifier && event.shiftKey && key === 'i')
    if (!isDevtoolsShortcut) return
    event.stopImmediatePropagation()
  }, true)
}

function handleApplicationError(error: unknown): void {
  if (error instanceof TypeError && error.message.includes('parentNode')) return
  console.error(error)
}

/**
 * Creates and mounts the Vue application after persistent storage is ready.
 *
 * @returns A promise that resolves after the router is ready and the app is mounted.
 * @throws Re-throws initialization failures so the host can surface startup errors.
 */
export async function bootstrapApplication(): Promise<void> {
  preserveDevtoolsShortcuts()
  await initStorage()

  const pinia = createPinia()
  pinia.use(createPersistedState({ storage: indexedDbStorageLike }))

  const app = createApp(App)
  app.use(pinia)
  initTheme(pinia)
  app.use(router)
  app.use(ElementPlus)
  app.use(environmentPlugin)
  app.use(directivesPlugin)
  setupErrorInterceptor()
  app.config.errorHandler = handleApplicationError

  await router.isReady()
  app.mount('#app')
}
