import type { QueueTask, TaskQueueStatus } from '@/stores/task-queue'
import type {
  GlobalTaskQueueIndicatorState,
  UseGlobalTaskQueueIndicatorReturn,
} from '@/components/generation/globalTaskQueue.types'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useTaskQueueStore } from '@/stores/task-queue'

type TaskStatusSnapshot = Pick<QueueTask, 'id' | 'status'>

const COMPLETION_FEEDBACK_MS = 4_000

/**
 * 派生全局任务队列入口的唯一视觉状态，并捕获运行期内的新完成事件。
 * @returns 队列入口的状态、数量和辅助说明。
 * @throws 不主动抛出异常；任务状态缺失时回退为空闲态。
 */
export function useGlobalTaskQueueIndicator(): UseGlobalTaskQueueIndicatorReturn {
  const store = useTaskQueueStore()
  const completionFeedbackActive = ref(false)
  const previousStatuses = new Map<number, TaskQueueStatus>()
  let completionTimer: number | null = null

  const failedCount = computed<number>(() => store.tasks.filter(
    (task: QueueTask): boolean => task.status === 'failed' || task.status === 'cancelled',
  ).length)
  const runningCount = computed<number>(() => store.tasks.filter(
    (task: QueueTask): boolean => task.status === 'running',
  ).length)
  const queuedCount = computed<number>(() => store.tasks.filter(
    (task: QueueTask): boolean => task.status === 'waiting_submit' || task.status === 'queued',
  ).length)
  const activeCount = computed<number>(() => runningCount.value + queuedCount.value)
  const statusSummary = computed<string>(() => {
    const segments: string[] = []
    if (failedCount.value > 0) segments.push(`${failedCount.value} 个任务失败`)
    if (runningCount.value > 0) segments.push(`${runningCount.value} 个任务生成中`)
    if (queuedCount.value > 0) segments.push(`${queuedCount.value} 个任务等待中`)
    return segments.join('，')
  })

  function replaceStatusSnapshot(snapshots: TaskStatusSnapshot[]): void {
    previousStatuses.clear()
    snapshots.forEach((snapshot: TaskStatusSnapshot): void => {
      previousStatuses.set(snapshot.id, snapshot.status)
    })
  }

  function hasNewCompletion(snapshots: TaskStatusSnapshot[]): boolean {
    return snapshots.some((snapshot: TaskStatusSnapshot): boolean => {
      const previousStatus = previousStatuses.get(snapshot.id)
      return previousStatus !== undefined
        && previousStatus !== 'completed'
        && snapshot.status === 'completed'
    })
  }

  function startCompletionFeedback(): void {
    completionFeedbackActive.value = true
    if (completionTimer !== null) window.clearTimeout(completionTimer)
    completionTimer = window.setTimeout((): void => {
      completionFeedbackActive.value = false
      completionTimer = null
    }, COMPLETION_FEEDBACK_MS)
  }

  function handleStatusChange(snapshots: TaskStatusSnapshot[]): void {
    const completedNow = hasNewCompletion(snapshots)
    replaceStatusSnapshot(snapshots)
    if (completedNow) startCompletionFeedback()
  }

  const indicatorState = computed<GlobalTaskQueueIndicatorState>(() => {
    if (failedCount.value > 0) return 'failed'
    if (completionFeedbackActive.value) return 'completed'
    if (runningCount.value > 0) return 'running'
    if (queuedCount.value > 0) return 'queued'
    return 'idle'
  })

  const indicatorCount = computed<number>(() => {
    if (indicatorState.value === 'failed') return failedCount.value
    if (indicatorState.value === 'running' || indicatorState.value === 'queued') return activeCount.value
    return 0
  })

  const indicatorLabel = computed<string>(() => {
    if (indicatorState.value === 'completed') {
      return statusSummary.value
        ? `生成队列：任务已完成；${statusSummary.value}`
        : '生成队列：任务已完成'
    }
    if (statusSummary.value) return `生成队列：${statusSummary.value}`
    return '打开生成队列'
  })

  watch(
    (): TaskStatusSnapshot[] => store.tasks.map((task: QueueTask): TaskStatusSnapshot => ({
      id: task.id,
      status: task.status,
    })),
    (snapshots: TaskStatusSnapshot[]): void => handleStatusChange(snapshots),
    { immediate: true },
  )

  onUnmounted((): void => {
    if (completionTimer !== null) window.clearTimeout(completionTimer)
  })

  return { indicatorCount, indicatorLabel, indicatorState }
}
