import { getNativeGroup } from '@/api/teamonesPoints'
import type { PointGroupSummary } from './teamonesPoints.types'

/**
 * 查询积分组名称等基础信息，不加载管理端账户数据。
 * @param groupId 积分组 ID。
 * @returns 积分组基础信息。
 * @throws Teamones 组信息接口请求失败时抛出异常。
 */
export function getGroup(groupId: number): Promise<PointGroupSummary> {
  return getNativeGroup<PointGroupSummary>(groupId)
}
