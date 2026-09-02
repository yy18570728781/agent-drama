import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getVendors,
  getLocalVendors,
  createVendor,
  createLocalVendor,
  updateVendor,
  updateLocalVendor,
  deleteVendor,
  deleteLocalVendor,
  type Vendor,
  type VendorListParams
} from '@/api/vendors'

export type { Vendor }

export const useVendorsStore = defineStore('vendors', () => {
  const localVendors = ref<Vendor[]>([])
  const teamonesVendors = ref<Vendor[]>([])
  const loading = ref(false)
  const localLoading = ref(false)
  const teamonesLoading = ref(false)
  const selectedVendor = ref<Vendor | null>(null)
  const selectedVendorType = ref<'local' | 'teamones' | null>(null)
  const localTotal = ref(0)
  const teamonesTotal = ref(0)
  const localCurrentPage = ref(1)
  const teamonesCurrentPage = ref(1)
  const perPage = ref(20)

  // 合并本地和 Teamones 供应商为一个统一列表（用于 VendorList 组件）
  const vendors = computed<Vendor[]>(() => {
    // 标记每个供应商的来源类型，并生成唯一键
    const localWithType = localVendors.value.map(v => ({
      ...v,
      sourceType: 'local' as const,
      uniqueKey: `local-${v.id}`
    }))
    const teamonesWithType = teamonesVendors.value.map(v => ({
      ...v,
      sourceType: 'teamones' as const,
      uniqueKey: `teamones-${v.id}`
    }))
    return [...localWithType, ...teamonesWithType] as Vendor[]
  })


  async function fetchLocalVendors(params?: VendorListParams) {
    localLoading.value = true
    try {
      const vendors = await getLocalVendors(params)
      localVendors.value = vendors
    } catch (e) {
      console.error('Failed to fetch local vendors:', e)
      localVendors.value = []
    } finally {
      localLoading.value = false
    }
  }

  async function fetchTeamonesVendors(params?: VendorListParams) {
    teamonesLoading.value = true
    try {
      const vendors = await getVendors(params)
      teamonesVendors.value = vendors
    } catch (e) {
      console.error('Failed to fetch teamones vendors:', e)
      teamonesVendors.value = []
    } finally {
      teamonesLoading.value = false
    }
  }

  async function fetchAllVendors(localParams?: VendorListParams, teamonesParams?: VendorListParams) {
    await Promise.all([
      fetchLocalVendors(localParams),
      fetchTeamonesVendors(teamonesParams)
    ])
  }

  async function createLocalVendorItem(data: {
    name: string
    vendor: string
    protocol?: string
    api_key: string
    base_url?: Record<string, string>
    icon?: string
    models?: string[]
  }) {
    const result = await createLocalVendor(data)
    await fetchLocalVendors({ page: localCurrentPage.value, per_page: perPage.value })
    return result
  }

  async function createTeamonesVendorItem(data: {
    name: string
    vendor: string
    protocol?: string
    api_key: string
    base_url?: Record<string, string>
    icon?: string
    models?: string[]
  }) {
    const result = await createVendor(data)
    await fetchTeamonesVendors({ page: teamonesCurrentPage.value, per_page: perPage.value })
    return result
  }

  async function updateLocalVendorItem(data: {
    id: number | string
    name?: string
    vendor?: string
    protocol?: string
    api_key?: string
    base_url?: Record<string, string>
    icon?: string
    status?: number
    models?: string[]
  }) {
    const result = await updateLocalVendor(data)
    await fetchLocalVendors({ page: localCurrentPage.value, per_page: perPage.value })
    return result
  }

  async function updateTeamonesVendorItem(data: {
    id: number | string
    name?: string
    vendor?: string
    protocol?: string
    api_key?: string
    base_url?: Record<string, string>
    icon?: string
    status?: number
    models?: string[]
  }) {
    const result = await updateVendor(data)
    await fetchTeamonesVendors({ page: teamonesCurrentPage.value, per_page: perPage.value })
    return result
  }

  async function deleteLocalVendorItem(id: number | string) {
    await deleteLocalVendor(id)
    await fetchLocalVendors({ page: localCurrentPage.value, per_page: perPage.value })
  }

  async function deleteTeamonesVendorItem(id: number | string) {
    await deleteVendor(id)
    await fetchTeamonesVendors({ page: teamonesCurrentPage.value, per_page: perPage.value })
  }

  function selectVendor(v: Vendor | null, type?: 'local' | 'teamones') {
    selectedVendor.value = v
    selectedVendorType.value = type || null
  }

  // 兼容 VendorList 组件的统一获取方法
  async function fetchVendors(params?: VendorListParams) {
    loading.value = true
    try {
      await Promise.all([
        fetchLocalVendors(params),
        fetchTeamonesVendors(params)
      ])
    } finally {
      loading.value = false
    }
  }

  // 兼容 VendorList 组件的删除方法（根据来源类型删除）
  async function deleteExistingVendor(id: number | string, sourceType?: 'local' | 'teamones') {
    // 如果有 sourceType，直接使用
    if (sourceType === 'local') {
      await deleteLocalVendorItem(id)
      return
    }
    if (sourceType === 'teamones') {
      await deleteTeamonesVendorItem(id)
      return
    }
    // 否则先在本地供应商中查找
    const localVendor = localVendors.value.find(v => v.id === id)
    if (localVendor) {
      await deleteLocalVendorItem(id)
      return
    }
    // 否则在 Teamones 供应商中删除
    await deleteTeamonesVendorItem(id)
  }

  // 兼容 VendorDetail 组件的状态切换方法
  async function toggleVendorStatus(id: number | string, enabled: boolean, sourceType?: 'local' | 'teamones') {
    const status = enabled ? 1 : 0
    if (sourceType === 'local') {
      await updateLocalVendorItem({ id, status })
      if (selectedVendor.value?.id === id) {
        selectedVendor.value = { ...selectedVendor.value, status }
      }
      return
    }
    if (sourceType === 'teamones') {
      await updateTeamonesVendorItem({ id, status })
      if (selectedVendor.value?.id === id) {
        selectedVendor.value = { ...selectedVendor.value, status }
      }
      return
    }
    // 先在本地供应商中查找
    const localVendor = localVendors.value.find(v => v.id === id)
    if (localVendor) {
      await updateLocalVendorItem({ id, status })
      // 更新本地状态
      if (selectedVendor.value?.id === id) {
        selectedVendor.value = { ...selectedVendor.value, status }
      }
      return
    }
    // 否则在 Teamones 供应商中更新
    await updateTeamonesVendorItem({ id, status })
    // 更新本地状态
    if (selectedVendor.value?.id === id) {
      selectedVendor.value = { ...selectedVendor.value, status }
    }
  }

  return {
    localVendors,
    teamonesVendors,
    vendors,  // 添加合并后的供应商列表
    loading,
    localLoading,
    teamonesLoading,
    selectedVendor,
    selectedVendorType,
    localTotal,
    teamonesTotal,
    localCurrentPage,
    teamonesCurrentPage,
    perPage,
    fetchLocalVendors,
    fetchTeamonesVendors,
    fetchAllVendors,
    fetchVendors,  // 添加兼容方法
    createLocalVendorItem,
    createTeamonesVendorItem,
    updateLocalVendorItem,
    updateTeamonesVendorItem,
    deleteLocalVendorItem,
    deleteTeamonesVendorItem,
    deleteExistingVendor,  // 添加兼容方法
    toggleVendorStatus,  // 添加兼容方法
    selectVendor
  }
})


