/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARENT_ORIGINS?: string
  readonly VITE_SIDECAR_API_PORT?: string
  readonly VITE_TEAMONES_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
