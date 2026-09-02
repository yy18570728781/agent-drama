import type { ComputedRef } from 'vue'

export type GlobalTaskQueueIndicatorState = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

export type GlobalTaskQueueTab = 'waiting_submit' | 'queued' | 'running' | 'failed'

export interface GlobalTaskQueueTriggerHandle {
  contains: (target: Node) => boolean
  focus: () => void
}

export interface UseGlobalTaskQueueIndicatorReturn {
  indicatorCount: ComputedRef<number>
  indicatorLabel: ComputedRef<string>
  indicatorState: ComputedRef<GlobalTaskQueueIndicatorState>
}
