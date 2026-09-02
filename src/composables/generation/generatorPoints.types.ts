import type { ComputedRef } from 'vue'

export interface GeneratorModelPointInfo {
  display_name?: string | null
  teamones_model_id?: number | null
}

export interface GeneratorTaskPointSnapshot {
  id: number | string
  status?: string | null
}

export interface GeneratorPointsDeps {
  buildCurrentRequestPayload: () => unknown
  getAuthStatus: () => string
  getIsRestoringModelSelection: () => boolean
  getRequestState: () => unknown
  getSelectedCapability: () => string
  getSelectedMode: () => string
  getSelectedModelId: () => string
  getSelectedModelInfo: () => GeneratorModelPointInfo | null
  getTaskSnapshots: () => readonly GeneratorTaskPointSnapshot[]
  getUserId: () => unknown
}

export interface GeneratorPointState {
  currentBillingMode: number | null
  currentGroupPoints: number | null
  currentSingleReservePoints: number | null
  currentUserPoints: number | null
  pointsLoading: boolean
  reservePointsLoading: boolean
}

export interface GeneratorPointRuntime {
  lastReservePointsSignature: string
  pointFetchToken: number
  pointInfoRefreshTimer: ReturnType<typeof setTimeout> | null
  reservePointFetchToken: number
  reservePointsTimer: ReturnType<typeof setTimeout> | null
  uiRememberRestoring: boolean
}

export interface GeneratorPointDisplayState {
  displayGroupPoints: ComputedRef<string>
  displayReservePoints: ComputedRef<string>
  displayUserPoints: ComputedRef<string>
  pointInfoTooltip: ComputedRef<string>
  pointInfoVisible: ComputedRef<boolean>
  showGroupPoints: ComputedRef<boolean>
  showReservePoints: ComputedRef<boolean>
  showUserPoints: ComputedRef<boolean>
}

export interface GeneratorPointActions {
  refreshPointInfo: () => Promise<void>
  refreshReservePoints: () => Promise<void>
}

export interface GeneratorPointSchedules {
  dispose: () => void
  schedulePointInfoRefresh: () => void
  scheduleReservePointsRefresh: () => void
}

export type UseGeneratorPointsReturn = GeneratorPointDisplayState
  & GeneratorPointActions
  & Omit<GeneratorPointSchedules, 'dispose'>
  & { setUiRememberRestoring: (restoring: boolean) => void }
