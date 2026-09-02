import { onUnmounted, watch } from 'vue'
import { useTaskQueueStore } from '@/stores/task-queue'
import { useUserStore } from '@/stores/auth.store'
import type { TaskQueueStatus } from '@/stores/task-queue/taskQueue.types'

const TERMINAL_TASK_STATUSES = new Set<TaskQueueStatus>(['completed', 'failed', 'cancelled'])
const BALANCE_REFRESH_DELAY_MS = 240

interface GenerationTaskSnapshot {
  id: number
  status: TaskQueueStatus
}

interface UseGenerationBalanceSyncReturn {
  refreshBalance: () => Promise<void>
}

function hasNewTerminalTask(
  current: GenerationTaskSnapshot[],
  previous: GenerationTaskSnapshot[],
): boolean {
  const previousStatuses = new Map(previous.map((task) => [task.id, task.status]))
  return current.some((task) => (
    TERMINAL_TASK_STATUSES.has(task.status)
    && previousStatuses.get(task.id) !== task.status
  ))
}

/**
 * 在生成任务结算后同步全局个人积分，供侧栏等跨页面区域实时显示。
 * @returns 可供调用方手动触发的积分刷新方法。
 * @throws 不主动抛出异常；余额请求失败由用户 store 统一降级处理。
 */
export function useGenerationBalanceSync(): UseGenerationBalanceSyncReturn {
  const taskQueueStore = useTaskQueueStore()
  const userStore = useUserStore()
  let refreshTimer: number | null = null
  let refreshing = false
  let refreshPending = false

  async function refreshBalance(): Promise<void> {
    if (refreshing) {
      refreshPending = true
      return
    }
    refreshing = true
    try {
      do {
        refreshPending = false
        await userStore.fetchBalance(true)
      } while (refreshPending)
    } finally {
      refreshing = false
    }
  }

  function scheduleBalanceRefresh(): void {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      void refreshBalance()
    }, BALANCE_REFRESH_DELAY_MS)
  }

  watch(
    () => taskQueueStore.tasks.map((task) => ({ id: task.id, status: task.status })),
    (current, previous) => {
      if (hasNewTerminalTask(current, previous || [])) scheduleBalanceRefresh()
    },
  )

  onUnmounted(() => {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer)
  })

  return { refreshBalance }
}
