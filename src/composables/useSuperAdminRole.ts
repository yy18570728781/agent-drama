import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useUserStore } from '@/stores/auth.store'

/**
 * 根据当前用户的角色编码判断是否为超级管理员。
 * @returns 当前用户是否拥有 super_admin 角色。
 */
export function useSuperAdminRole(): ComputedRef<boolean> {
  const userStore = useUserStore()
  return computed(() => (
    userStore.userInfo?.role_info?.some(
      (role) => role.code.trim().toLowerCase() === 'super_admin',
    ) ?? false
  ))
}
