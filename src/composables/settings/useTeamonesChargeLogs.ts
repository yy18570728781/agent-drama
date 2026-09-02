import { nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { getGroup } from '@/services/teamones/teamonesPoints.service'
import { useChargeLogOwnerFilter, type ChargeLogOwnerOption } from '@/composables/settings/useChargeLogOwnerFilter'
import {
  queryChargeLogs,
  type TeamonesChargeLogQueryPayload,
  type TeamonesChargeLogRecord,
} from '@/services/teamones/teamonesChargeLog.service'

interface UseTeamonesChargeLogsReturn {
  activeBizType: Ref<number | null>
  activeOwnerKey: Ref<string | null>
  balanceDisplay: ComputedRef<string>
  billingOwnerTypeText: (row: TeamonesChargeLogRecord) => string
  currentPage: Ref<number>
  errorMessage: Ref<string>
  handleCurrentChange: (page: number) => void
  handleSizeChange: (size: number) => void
  loadCurrentUserPoints: (force?: boolean) => Promise<void>
  loadLogs: () => Promise<void>
  loading: Ref<boolean>
  logs: Ref<TeamonesChargeLogRecord[]>
  ownerLoading: Ref<boolean>
  ownerOptions: Ref<ChargeLogOwnerOption[]>
  pageSize: Ref<number>
  resetFilters: () => void
  setBizType: (value: number | null) => void
  setOwnerKey: (value: string | null) => void
  total: Ref<number>
  totalConsumedDisplay: ComputedRef<string>
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return '消耗记录加载失败'
  return error.message || '消耗记录加载失败'
}

function sortLogs(items: TeamonesChargeLogRecord[]): TeamonesChargeLogRecord[] {
  return [...items].sort((left, right) => {
    const timeDiff = new Date(right.created ?? 0).getTime() - new Date(left.created ?? 0).getTime()
    return timeDiff || Number(right.id ?? 0) - Number(left.id ?? 0)
  })
}

/**
 * 管理积分流水列表、筛选、分页及账户积分摘要。
 * @returns 页面所需的响应式状态与操作。
 */
export function useTeamonesChargeLogs(): UseTeamonesChargeLogsReturn {
  const loading = ref(false)
  const errorMessage = ref('')
  const logs = ref<TeamonesChargeLogRecord[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(100)
  const groupNames = ref<Record<number, string>>({})
  const activeBizType = ref<number | null>(null)
  const ownerFilter = useChargeLogOwnerFilter()
  const {
    activeOwnerKey,
    balanceDisplay,
    loadOwnerOptions,
    ownerLoading,
    ownerOptions,
    selectedOwner,
    setOwnerKey: setOwnerFilterKey,
    totalConsumedDisplay,
  } = ownerFilter

  function buildPayload(): TeamonesChargeLogQueryPayload {
    const filter: NonNullable<TeamonesChargeLogQueryPayload['filter']> = {}
    if (selectedOwner.value) {
      filter.billing_owner_type = selectedOwner.value.ownerType
      filter.billing_owner_id = selectedOwner.value.ownerId
    }
    if (activeBizType.value !== null) filter.biz_type = activeBizType.value
    return {
      filter: Object.keys(filter).length ? filter : undefined,
      page: [currentPage.value, pageSize.value],
      order: 'id DESC',
    }
  }

  async function loadCurrentUserPoints(force = false): Promise<void> {
    await loadOwnerOptions(force)
  }

  function collectGroupIds(items: TeamonesChargeLogRecord[]): number[] {
    const ids = items
      .filter((item) => item.billing_owner_type === 'group')
      .map((item) => Number(item.billing_owner_id))
      .filter((id) => Number.isInteger(id) && id > 0 && !groupNames.value[id])
    return [...new Set(ids)]
  }

  async function loadGroupNames(items: TeamonesChargeLogRecord[]): Promise<void> {
    const ids = collectGroupIds(items)
    if (!ids.length) return
    const names: Record<number, string> = {}
    await Promise.all(ids.map(async (id) => {
      try {
        const group = await getGroup(id)
        if (group?.name?.trim()) names[id] = group.name.trim()
      } catch (error) {
        console.warn('[TeamonesChargeLogList] 获取计费归属分组失败:', error)
      }
    }))
    groupNames.value = { ...groupNames.value, ...names }
  }

  async function loadLogs(): Promise<void> {
    if (!selectedOwner.value) await loadOwnerOptions()
    loading.value = true
    errorMessage.value = ''
    try {
      const response = await queryChargeLogs(buildPayload())
      logs.value = sortLogs(response.items || [])
      total.value = response.total > 0 ? response.total : logs.value.length
    } catch (error) {
      logs.value = []
      total.value = 0
      errorMessage.value = errorText(error)
    } finally {
      loading.value = false
    }
    if (logs.value.length) {
      await nextTick()
      window.setTimeout(() => void loadGroupNames(logs.value), 0)
    }
  }

  function setBizType(value: number | null): void {
    activeBizType.value = value
    currentPage.value = 1
    void loadLogs()
  }

  function resetFilters(): void {
    activeBizType.value = null
    setOwnerFilterKey(ownerOptions.value[0]?.value ?? null)
    currentPage.value = 1
    void loadLogs()
  }

  function setOwnerKey(value: string | null): void {
    setOwnerFilterKey(value)
    currentPage.value = 1
    void loadLogs()
  }

  function handleCurrentChange(page: number): void {
    currentPage.value = page
    void loadLogs()
  }

  function handleSizeChange(size: number): void {
    pageSize.value = size
    currentPage.value = 1
    void loadLogs()
  }

  function billingOwnerTypeText(row: TeamonesChargeLogRecord): string {
    if (row.billing_owner_type === 'user') return '个人'
    if (row.billing_owner_type !== 'group') return '-'
    const id = Number(row.billing_owner_id)
    return groupNames.value[id] || row.billing_owner?.name?.trim() || `组#${row.billing_owner_id || '-'}`
  }

  return {
    activeBizType, activeOwnerKey, balanceDisplay, billingOwnerTypeText, currentPage, errorMessage,
    handleCurrentChange, handleSizeChange, loadCurrentUserPoints, loadLogs,
    loading, logs, ownerLoading, ownerOptions, pageSize, resetFilters, setBizType,
    setOwnerKey, total, totalConsumedDisplay,
  }
}
