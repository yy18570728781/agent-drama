import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref } from 'vue'
import { listRoleResourceCodes } from '@/api/resourcePermissions'
import { logger } from '@/utils/logger'

interface UseTeamonesResourcePermissionsReturn {
  hasResourcePermission: ComputedRef<boolean>
  isResourcePermissionLoading: Ref<boolean>
  resourceCodes: Ref<string[]>
  refreshResourcePermissions: () => Promise<void>
}

/**
 * 加载并管理当前角色在指定 Teamones 应用下的资源权限。
 * @param appCode Teamones 权限应用编码。
 * @param resourceCode 需要验证的 Teamones 资源码。
 * @returns 资源码、加载状态、资源存在性与刷新方法。
 */
export function useTeamonesResourcePermissions(
  appCode: string,
  resourceCode: string,
): UseTeamonesResourcePermissionsReturn {
  const resourceCodes = ref<string[]>([])
  const isResourcePermissionLoading = ref(false)
  const hasResourcePermission = computed(() => resourceCodes.value.includes(resourceCode))

  async function refreshResourcePermissions(): Promise<void> {
    if (isResourcePermissionLoading.value) return
    isResourcePermissionLoading.value = true
    try {
      resourceCodes.value = await listRoleResourceCodes(appCode)
    } catch (cause) {
      resourceCodes.value = []
      logger.warn('permissions', `${appCode} 权限资源加载失败`, cause)
    } finally {
      isResourcePermissionLoading.value = false
    }
  }

  onMounted(() => {
    void refreshResourcePermissions()
  })

  return {
    hasResourcePermission,
    isResourcePermissionLoading,
    resourceCodes,
    refreshResourcePermissions,
  }
}
