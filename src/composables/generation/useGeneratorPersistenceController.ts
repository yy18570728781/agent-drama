import { ref, type Ref } from 'vue'
import { useUIRemember, type UseUIRememberOptions } from '@/composables/useUIRemember'

export interface GeneratorRememberLate {
  getCapModelRemember: (capabilityId: string) => Record<string, unknown> | null
  saveUIRemember: () => void
}

interface UseGeneratorPersistenceControllerOptions {
  late: GeneratorRememberLate
  onRestoreComplete: () => void
  rememberOptions: UseUIRememberOptions
}

interface UseGeneratorPersistenceControllerReturn {
  isRestoring: Ref<boolean>
  loadRememberedState: () => Promise<void>
  remember: ReturnType<typeof useUIRemember>
  restoreState: (data: Record<string, unknown>) => Promise<void>
}

/**
 * 管理 GeneratorInput 的记忆加载、外部恢复及 ModeManager 延迟绑定。
 * @param options UI remember 依赖、延迟代理与恢复完成回调。
 * @returns 记忆 API、恢复状态和安全的加载方法。
 */
export function useGeneratorPersistenceController(
  options: UseGeneratorPersistenceControllerOptions,
): UseGeneratorPersistenceControllerReturn {
  const isRestoring = ref(false)
  const remember = useUIRemember(options.rememberOptions)
  options.late.saveUIRemember = remember.saveUIRemember
  options.late.getCapModelRemember = remember.getCapModelRemember

  async function loadRememberedState(): Promise<void> {
    isRestoring.value = true
    try {
      await remember.loadUIRemember()
    } finally {
      isRestoring.value = false
      options.onRestoreComplete()
    }
  }

  async function restoreState(data: Record<string, unknown>): Promise<void> {
    isRestoring.value = true
    try {
      await remember.applyRememberedState(data, { restorePrompt: true })
    } finally {
      isRestoring.value = false
      options.onRestoreComplete()
    }
  }

  return { isRestoring, loadRememberedState, remember, restoreState }
}
