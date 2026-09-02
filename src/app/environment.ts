import type { App, Plugin } from 'vue'
import { useEnvironment } from '@/composables/useEnvironment'

export const environmentPlugin: Plugin = {
  install(app: App) {
    const env = useEnvironment()

    app.config.globalProperties.$isIframe = env.isIframe

    app.provide('environment', env)
  },
}
