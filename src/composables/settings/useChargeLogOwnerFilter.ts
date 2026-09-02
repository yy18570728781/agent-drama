import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { getGroup, getUserBalance } from '@/services/teamones/teamonesPoints.service'
import { useUserStore } from '@/stores/auth.store'

export type ChargeLogOwnerType = 'user' | 'group'

export interface ChargeLogOwnerOption {
  value: string
  label: string
  ownerType: ChargeLogOwnerType
  ownerId: number
}

interface ChargeLogOwner {
  ownerType: ChargeLogOwnerType
  ownerId: number
}

interface UseChargeLogOwnerFilterReturn {
  activeOwnerKey: Ref<string | null>
  balanceDisplay: ComputedRef<string>
  loadOwnerOptions: (force?: boolean) => Promise<void>
  ownerLoading: Ref<boolean>
  ownerOptions: Ref<ChargeLogOwnerOption[]>
  selectedOwner: ComputedRef<ChargeLogOwner | null>
  setOwnerKey: (value: string | null) => void
  totalConsumedDisplay: ComputedRef<string>
}

function buildOwnerKey(ownerType: ChargeLogOwnerType, ownerId: number): string {
  return `${ownerType}:${ownerId}`
}

function parseOwnerKey(value: string | null): ChargeLogOwner | null {
  if (!value) return null
  const [ownerType, rawId] = value.split(':')
  const ownerId = Number(rawId)
  if ((ownerType !== 'user' && ownerType !== 'group') || !Number.isInteger(ownerId) || ownerId <= 0) {
    return null
  }
  return { ownerType, ownerId }
}

function formatMetric(isLoading: boolean, value: number | null): string {
  if (isLoading && value === null) return '加载中...'
  return typeof value === 'number' ? value.toLocaleString() : '-'
}

/**
 * 管理消费记录的账单主体筛选，默认当前用户，可切换到用户所属分组。
 * @returns 账单主体选项、当前选择和积分摘要。
 */
export function useChargeLogOwnerFilter(): UseChargeLogOwnerFilterReturn {
  const userStore = useUserStore()
  const ownerLoading = ref(false)
  const ownerOptions = ref<ChargeLogOwnerOption[]>([])
  const activeOwnerKey = ref<string | null>(null)
  const currentUserPoints = ref<number | null>(null)
  const currentUserTotalConsumed = ref<number | null>(null)
  const selectedOwner = computed(() => parseOwnerKey(activeOwnerKey.value))
  const balanceDisplay = computed(() => formatMetric(ownerLoading.value, currentUserPoints.value))
  const totalConsumedDisplay = computed(() => formatMetric(ownerLoading.value, currentUserTotalConsumed.value))

  async function resolveGroupOption(groupId: number | null): Promise<ChargeLogOwnerOption | null> {
    if (!groupId) return null
    try {
      const group = await getGroup(groupId)
      const name = group?.name?.trim() || `组#${groupId}`
      return { value: buildOwnerKey('group', groupId), label: `所属组：${name}`, ownerType: 'group', ownerId: groupId }
    } catch {
      return { value: buildOwnerKey('group', groupId), label: `所属组：组#${groupId}`, ownerType: 'group', ownerId: groupId }
    }
  }

  function setDefaultOwner(options: ChargeLogOwnerOption[]): void {
    if (options.some((option) => option.value === activeOwnerKey.value)) return
    activeOwnerKey.value = options[0]?.value ?? null
  }

  function buildCurrentUserOption(userId: number): ChargeLogOwnerOption {
    return {
      value: buildOwnerKey('user', userId),
      label: '我的账户',
      ownerType: 'user',
      ownerId: userId,
    }
  }

  async function loadOwnerOptions(force = false): Promise<void> {
    const userId = Number(userStore.userId)
    if (!Number.isInteger(userId) || userId <= 0 || userStore.authStatus !== 'ready') return
    if (ownerLoading.value && !force) return
    // 余额接口异常时仍保留当前用户筛选，避免查询范围下拉被锁死。
    const fallbackOptions = [buildCurrentUserOption(userId)]
    ownerOptions.value = ownerOptions.value.length ? ownerOptions.value : fallbackOptions
    setDefaultOwner(ownerOptions.value)
    ownerLoading.value = true
    try {
      const balance = await getUserBalance(userId)
      const userOwnerId = balance.user?.owner_id ?? userId
      const groupOwnerId = balance.group?.owner_id ?? null
      currentUserPoints.value = balance.user?.balance ?? null
      currentUserTotalConsumed.value = balance.user?.total_consumed ?? null
      const nextOptions = await buildOwnerOptions(userOwnerId, groupOwnerId)
      ownerOptions.value = nextOptions.length ? nextOptions : fallbackOptions
      setDefaultOwner(ownerOptions.value)
    } catch (error) {
      currentUserPoints.value = null
      currentUserTotalConsumed.value = null
      ownerOptions.value = fallbackOptions
      setDefaultOwner(fallbackOptions)
      console.warn('[TeamonesChargeLogList] 获取当前账号积分失败:', error)
    } finally {
      ownerLoading.value = false
    }
  }

  async function buildOwnerOptions(
    userOwnerId: number | null,
    groupOwnerId: number | null,
  ): Promise<ChargeLogOwnerOption[]> {
    const options: ChargeLogOwnerOption[] = []
    if (userOwnerId) {
      options.push({
        value: buildOwnerKey('user', userOwnerId),
        label: '我的账户',
        ownerType: 'user',
        ownerId: userOwnerId,
      })
    }
    const groupOption = await resolveGroupOption(groupOwnerId)
    if (groupOption) options.push(groupOption)
    return options
  }

  function setOwnerKey(value: string | null): void {
    activeOwnerKey.value = value
  }

  return {
    activeOwnerKey,
    balanceDisplay,
    loadOwnerOptions,
    ownerLoading,
    ownerOptions,
    selectedOwner,
    setOwnerKey,
    totalConsumedDisplay,
  }
}
