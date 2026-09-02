import { useSendDispatch } from './useSendDispatch'

interface UseGeneratorSubmissionControllerOptions {
  externalSendOverride?: (() => boolean | Promise<boolean>) | null
  flowNodeId?: string
  flowTriggerGridSplitBatch: ((nodeId: string) => boolean) | null
  sendOptions: Parameters<typeof useSendDispatch>[0]
}

interface UseGeneratorSubmissionControllerReturn {
  dispatch: ReturnType<typeof useSendDispatch>
  handleSendClick: () => Promise<void>
}

/**
 * 保持 Flow 外部拦截、网格批量拦截和普通生成提交的固定仲裁顺序。
 * @param options SendDispatch 依赖及两个可选外部拦截器。
 * @returns 原始提交控制器和 UI 可直接调用的发送入口。
 */
export function useGeneratorSubmissionController(
  options: UseGeneratorSubmissionControllerOptions,
): UseGeneratorSubmissionControllerReturn {
  const dispatch = useSendDispatch(options.sendOptions)

  async function handleSendClick(): Promise<void> {
    const consumed = await options.externalSendOverride?.()
    if (consumed) return
    if (options.flowNodeId && options.flowTriggerGridSplitBatch?.(options.flowNodeId)) return
    await dispatch.handleSend()
  }

  return { dispatch, handleSendClick }
}
