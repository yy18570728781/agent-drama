import client from './teamonesClient'
import { getStoredAuthScope } from './tokenStorage'

/**
 * 获取用户余额
 * POST Teamones /api_assets/balance/get
 */
export async function getUserBalance(): Promise<{ balance: number }> {
  const userId = getStoredAuthScope()?.userId
  if (!userId) throw new Error('当前会话缺少 Teamones 用户 ID')
  const { data } = await client.post('/api_assets/balance/get', {
    owner_id: userId,
    owner_type: 'user',
  })
  const payload = data?.data || data
  return { balance: Number(payload?.balance ?? payload?.user?.balance ?? 0) }
}
