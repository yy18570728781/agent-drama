import { getModelReservePoints, getTeamonesModels, type ReservePointsRequestItem } from '@/api/models'
import { getUserBalance } from '@/services/teamones/teamonesPoints.service'
import { normalizeBillingModeValue } from '@/services/teamones/teamonesPoints.constants'
import type {
  GeneratorPointsDeps,
  GeneratorPointRuntime,
  GeneratorPointState,
} from '@/composables/generation/generatorPoints.types'

function getPayloadParams(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) return {}
  const params = (payload as Record<string, unknown>).params
  return typeof params === 'object' && params !== null && !Array.isArray(params)
    ? params as Record<string, unknown> : {}
}

function clearPointBalances(state: GeneratorPointState): void {
  Object.assign(state, { currentBillingMode: null, currentUserPoints: null, currentGroupPoints: null })
}

async function resolveReserveModelId(deps: GeneratorPointsDeps): Promise<number | null> {
  const info = deps.getSelectedModelInfo()
  const directId = toPositivePointInteger(info?.teamones_model_id)
  if (directId) return directId
  const modelName = deps.getSelectedModelId().trim().toLowerCase()
  const displayName = String(info?.display_name || '').trim().toLowerCase()
  if (!modelName && !displayName) return null
  try {
    const rows = await getTeamonesModels()
    const matched = rows.find((row) => {
      const rowName = String(row.name || '').trim().toLowerCase()
      const rowDisplayName = String(row.display_name || '').trim().toLowerCase()
      return (!!modelName && rowName === modelName) || (!!displayName && rowDisplayName === displayName)
    })
    return toPositivePointInteger(matched?.id)
  } catch (error: unknown) {
    console.warn('[GeneratorInput] 解析 Teamones 模型主键失败:', error)
    return null
  }
}

/** 将未知值收敛为可用的正整数主键。 */
export function toPositivePointInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * 刷新当前账户的个人与组积分。
 * @param deps 用户与认证状态读取器。
 * @param state 可写积分状态。
 * @param runtime 请求竞态令牌。
 */
export async function refreshGeneratorPointInfo(
  deps: GeneratorPointsDeps,
  state: GeneratorPointState,
  runtime: GeneratorPointRuntime,
): Promise<void> {
  const requestToken = ++runtime.pointFetchToken
  const userId = toPositivePointInteger(deps.getUserId())
  if (!userId || deps.getAuthStatus() !== 'ready') {
    clearPointBalances(state)
    state.currentSingleReservePoints = null
    state.pointsLoading = false
    return
  }
  state.pointsLoading = true
  try {
    const balance = await getUserBalance(userId)
    if (runtime.pointFetchToken !== requestToken) return
    const group = balance.group && typeof balance.group === 'object' && !Array.isArray(balance.group)
      ? balance.group : null
    state.currentBillingMode = normalizeBillingModeValue(group?.billing_mode)
    state.currentUserPoints = typeof balance.user?.balance === 'number' ? balance.user.balance : null
    state.currentGroupPoints = typeof group?.balance === 'number' ? group.balance : null
  } catch (error: unknown) {
    if (runtime.pointFetchToken !== requestToken) return
    clearPointBalances(state)
    console.warn('[GeneratorInput] 获取账户积分信息失败:', error)
  } finally {
    if (runtime.pointFetchToken === requestToken) state.pointsLoading = false
  }
}

/**
 * 根据当前生成请求刷新预计消耗。
 * @param deps 模型、模式与请求负载读取器。
 * @param state 可写积分状态。
 * @param runtime 恢复标记、签名缓存与竞态令牌。
 */
export async function refreshGeneratorReservePoints(
  deps: GeneratorPointsDeps,
  state: GeneratorPointState,
  runtime: GeneratorPointRuntime,
): Promise<void> {
  const requestToken = ++runtime.reservePointFetchToken
  const invalidContext = runtime.uiRememberRestoring || deps.getIsRestoringModelSelection()
    || !toPositivePointInteger(deps.getUserId()) || deps.getAuthStatus() !== 'ready'
  if (invalidContext) {
    state.currentSingleReservePoints = null
    state.reservePointsLoading = false
    return
  }
  const modelId = await resolveReserveModelId(deps)
  if (runtime.reservePointFetchToken !== requestToken) return
  if (!modelId) {
    state.currentSingleReservePoints = null
    state.reservePointsLoading = false
    return
  }
  const capability = deps.getSelectedCapability()
  const mode = deps.getSelectedMode()
  const requestItem: ReservePointsRequestItem = {
    model_id: modelId, capability, mode, type: capability,
    param: { capability, mode, params: { ...getPayloadParams(deps.buildCurrentRequestPayload()) } },
  }
  const signature = JSON.stringify(requestItem)
  if (signature === runtime.lastReservePointsSignature && state.currentSingleReservePoints !== null) return
  state.reservePointsLoading = true
  try {
    const reserveData = await getModelReservePoints([requestItem])
    if (runtime.reservePointFetchToken !== requestToken) return
    const value = reserveData[String(modelId)]
    state.currentSingleReservePoints = typeof value === 'number' ? value : null
    runtime.lastReservePointsSignature = signature
  } catch (error: unknown) {
    if (runtime.reservePointFetchToken !== requestToken) return
    state.currentSingleReservePoints = null
    console.warn('[GeneratorInput] 获取本次消耗失败:', error)
  } finally {
    if (runtime.reservePointFetchToken === requestToken) state.reservePointsLoading = false
  }
}
