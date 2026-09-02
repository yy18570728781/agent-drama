import { watch } from 'vue'
import { useUIRememberPersistence } from './useUIRememberPersistence'
import { useUIRememberReferences } from './useUIRememberReferences'
import { useUIRememberRestore } from './useUIRememberRestore'
import type {
  RememberDebugLog,
  UseUIRememberOptions,
  UseUIRememberReturn,
} from './uiRemember.types'

export type { UseUIRememberOptions } from './uiRemember.types'

function createDebugLogger(): RememberDebugLog {
  return () => undefined
}

/**
 * 编排生成 UI 的引用资源、延迟持久化和异步状态恢复。
 * @param options 生成 UI 状态及模型、参数和引用资源依赖。
 * @returns UI 记忆的保存、加载、请求构建和引用资源方法。
 */
export function useUIRemember(options: UseUIRememberOptions): UseUIRememberReturn {
  const logDebug = createDebugLogger()
  const references = useUIRememberReferences(options)
  const persistence = useUIRememberPersistence(options, references, logDebug)
  const restore = useUIRememberRestore(options, references, persistence, logDebug)

  watch(
    [
      options.selectedModelId,
      options.selectedCapability,
      options.selectedMode,
      options.prompt,
      options.paramValues,
      options.refImages,
    ],
    () => {
      if (!options.selectedModelId.value && !options.refImages.value.length) return
      if (restore.isLoaded()) persistence.saveUIRemember()
      options.emit?.('request-payload-change', persistence.buildCurrentRequestPayloadCustom())
    },
    { deep: true },
  )

  return {
    ...references,
    ...persistence,
    applyRememberedState: restore.applyRememberedState,
    loadUIRemember: restore.loadUIRemember,
    buildRememberedReferenceImage: options.buildRememberedReferenceImage,
  }
}
