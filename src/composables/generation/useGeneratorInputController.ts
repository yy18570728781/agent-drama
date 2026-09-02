import { getAllModels } from '@/api/models'
import { useGeneratorRuntimeController } from './useGeneratorRuntimeController'
import { useGeneratorWorkspaceController } from './useGeneratorWorkspaceController'
import { useModeManager } from './useModeManager'
import type { GeneratorRememberLate } from './useGeneratorPersistenceController'
import type { GeneratorInputEmits, GeneratorInputProps } from '@/components/generation/generatorInput.types'

type GeneratorEmit = <K extends keyof GeneratorInputEmits>(event: K, ...args: GeneratorInputEmits[K]) => void

interface UseGeneratorInputControllerReturn {
  mode: ReturnType<typeof useModeManager>
  runtime: ReturnType<typeof useGeneratorRuntimeController>
  workspace: ReturnType<typeof useGeneratorWorkspaceController>
}

function createRememberLate(): GeneratorRememberLate {
  return {
    getCapModelRemember: () => null,
    saveUIRemember: () => undefined,
  }
}

/**
 * 按 Mode → Workspace → Runtime 的固定顺序装配生成器，避免恢复与上传依赖的前向引用。
 * @param props GeneratorInput 的响应式属性。
 * @param emit GeneratorInput 的类型化事件出口。
 * @returns 三个职责清晰且已完成延迟绑定的控制器。
 */
export function useGeneratorInputController(
  props: GeneratorInputProps,
  emit: GeneratorEmit,
): UseGeneratorInputControllerReturn {
  const late = createRememberLate()
  let scheduleRestoreRefresh = (): void => undefined
  const mode = useModeManager({
    emit,
    props,
    saveUIRemember: () => late.saveUIRemember(),
    getCapModelRemember: (capabilityId) => late.getCapModelRemember(capabilityId),
    getAllModels,
  })
  const workspace = useGeneratorWorkspaceController({
    emit,
    late,
    mode,
    onRestoreComplete: () => scheduleRestoreRefresh(),
    props,
  })
  const runtime = useGeneratorRuntimeController({ emit, mode, props, workspace })
  scheduleRestoreRefresh = runtime.points.scheduleReservePointsRefresh
  return { mode, runtime, workspace }
}
