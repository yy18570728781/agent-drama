import { computed, onUnmounted, reactive, watch } from 'vue'
import { BillingMode } from '@/services/teamones/teamonesPoints.types'
import {
  refreshGeneratorPointInfo,
  refreshGeneratorReservePoints,
  toPositivePointInteger,
} from '@/services/generation/generatorPoints.service'
import type {
  GeneratorPointActions,
  GeneratorPointDisplayState,
  GeneratorPointRuntime,
  GeneratorPointSchedules,
  GeneratorPointsDeps,
  GeneratorPointState,
  UseGeneratorPointsReturn,
} from './generatorPoints.types'

function formatPointsValue(value: number | null): string {
  return value === null || Number.isNaN(value) ? '--' : Math.max(0, Number(value)).toLocaleString()
}

function createPointDisplay(
  deps: GeneratorPointsDeps,
  state: GeneratorPointState,
): GeneratorPointDisplayState {
  const showUserPoints = computed(() => state.currentUserPoints !== null
    && state.currentBillingMode !== BillingMode.GroupOnly)
  const showGroupPoints = computed(() => state.currentGroupPoints !== null
    && state.currentBillingMode !== BillingMode.UserOnly)
  const showReservePoints = computed(() => !!toPositivePointInteger(deps.getUserId())
    && deps.getAuthStatus() === 'ready' && !!deps.getSelectedModelId())
  const displayUserPoints = computed(() => formatPointsValue(state.currentUserPoints))
  const displayGroupPoints = computed(() => formatPointsValue(state.currentGroupPoints))
  const displayReservePoints = computed(() => formatPointsValue(state.currentSingleReservePoints))
  const pointInfoVisible = computed(() => showUserPoints.value || showGroupPoints.value || showReservePoints.value)
  const pointInfoTooltip = computed(() => {
    if (state.pointsLoading || state.reservePointsLoading) return '正在获取积分信息'
    const parts: string[] = []
    if (showUserPoints.value) parts.push(`个人积分:${displayUserPoints.value}`)
    if (showGroupPoints.value) parts.push(`组积分:${displayGroupPoints.value}`)
    if (showReservePoints.value) parts.push(`本次消耗:${displayReservePoints.value}`)
    return parts.join('  ')
  })
  return {
    showUserPoints, showGroupPoints, showReservePoints, pointInfoVisible,
    displayUserPoints, displayGroupPoints, displayReservePoints, pointInfoTooltip,
  }
}

function createPointSchedules(
  deps: GeneratorPointsDeps,
  actions: GeneratorPointActions,
  runtime: GeneratorPointRuntime,
): GeneratorPointSchedules {
  const scheduleReservePointsRefresh = (): void => {
    if (runtime.reservePointsTimer) clearTimeout(runtime.reservePointsTimer)
    if (runtime.uiRememberRestoring || deps.getIsRestoringModelSelection()) return
    runtime.reservePointsTimer = setTimeout(() => void actions.refreshReservePoints(), 280)
  }
  const schedulePointInfoRefresh = (): void => {
    if (runtime.pointInfoRefreshTimer) clearTimeout(runtime.pointInfoRefreshTimer)
    runtime.pointInfoRefreshTimer = setTimeout(() => {
      void actions.refreshPointInfo()
      scheduleReservePointsRefresh()
    }, 240)
  }
  const dispose = (): void => {
    if (runtime.pointInfoRefreshTimer) clearTimeout(runtime.pointInfoRefreshTimer)
    if (runtime.reservePointsTimer) clearTimeout(runtime.reservePointsTimer)
    Object.assign(runtime, { pointInfoRefreshTimer: null, reservePointsTimer: null })
    runtime.pointFetchToken++
    runtime.reservePointFetchToken++
  }
  return { schedulePointInfoRefresh, scheduleReservePointsRefresh, dispose }
}

function registerPointWatchers(
  deps: GeneratorPointsDeps,
  actions: GeneratorPointActions,
  schedules: GeneratorPointSchedules,
): void {
  watch(
    () => [deps.getUserId(), deps.getAuthStatus()] as const,
    () => void actions.refreshPointInfo(),
    { immediate: true },
  )
  watch(deps.getRequestState, schedules.scheduleReservePointsRefresh, { deep: true })
  watch(deps.getIsRestoringModelSelection, (restoring: boolean) => {
    if (!restoring) schedules.scheduleReservePointsRefresh()
  })
  watch(deps.getTaskSnapshots, (next, previous) => {
    const previousStatuses = new Map((previous || []).map((task) => [String(task.id), String(task.status || '')]))
    const shouldRefresh = next.some((task) => {
      const status = String(task.status || '')
      return ['completed', 'failed', 'cancelled'].includes(status)
        && previousStatuses.get(String(task.id)) !== status
    })
    if (shouldRefresh) schedules.schedulePointInfoRefresh()
  }, { deep: true })
}

/**
 * 管理生成器的账户积分、单次预估消耗及其刷新时机。
 * @param deps 由生成器注入的认证、模型、请求表单和任务状态读取器。
 * @returns 可供模板展示的响应式状态，以及手动刷新和恢复态控制方法。
 * @throws 不主动抛出接口错误；请求失败会清空对应状态并记录警告。
 */
export function useGeneratorPoints(deps: GeneratorPointsDeps): UseGeneratorPointsReturn {
  const state = reactive<GeneratorPointState>({
    pointsLoading: false, reservePointsLoading: false, currentBillingMode: null,
    currentUserPoints: null, currentGroupPoints: null, currentSingleReservePoints: null,
  })
  const runtime: GeneratorPointRuntime = {
    pointFetchToken: 0, reservePointFetchToken: 0, reservePointsTimer: null,
    pointInfoRefreshTimer: null, lastReservePointsSignature: '', uiRememberRestoring: false,
  }
  const actions: GeneratorPointActions = {
    refreshPointInfo: () => refreshGeneratorPointInfo(deps, state, runtime),
    refreshReservePoints: () => refreshGeneratorReservePoints(deps, state, runtime),
  }
  const schedules = createPointSchedules(deps, actions, runtime)
  const display = createPointDisplay(deps, state)
  registerPointWatchers(deps, actions, schedules)
  onUnmounted(schedules.dispose)
  const setUiRememberRestoring = (restoring: boolean): void => {
    runtime.uiRememberRestoring = restoring
    if (!restoring) schedules.scheduleReservePointsRefresh()
  }
  return {
    ...display,
    ...actions,
    schedulePointInfoRefresh: schedules.schedulePointInfoRefresh,
    scheduleReservePointsRefresh: schedules.scheduleReservePointsRefresh,
    setUiRememberRestoring,
  }
}
