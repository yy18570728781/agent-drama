import { getNativeUserBalance } from '@/api/teamonesPoints'
import type { UserBalanceResult } from './teamonesPoints.types'

const userBalanceRequests = new Map<number, Promise<UserBalanceResult>>()
const userBalanceCache = new Map<number, { value: UserBalanceResult; expiresAt: number }>()
const POINT_INFO_CACHE_TTL_MS = 1000

/**
 * 查询用户积分余额，并在短时间内合并相同用户的重复请求。
 * @param userId Teamones 用户 ID。
 * @param force 是否跳过短时缓存。
 * @returns 用户及所属组的积分摘要。
 * @throws Teamones 余额接口请求失败时抛出异常。
 */
export function getUserBalance(userId: number, force = false): Promise<UserBalanceResult> {
  if (force) userBalanceCache.delete(userId)
  const cached = userBalanceCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
  const pending = userBalanceRequests.get(userId)
  if (pending) return pending
  const request = getNativeUserBalance<UserBalanceResult>(userId).then((value) => {
    userBalanceCache.set(userId, { value, expiresAt: Date.now() + POINT_INFO_CACHE_TTL_MS })
    return value
  }).finally(() => userBalanceRequests.delete(userId))
  userBalanceRequests.set(userId, request)
  return request
}
