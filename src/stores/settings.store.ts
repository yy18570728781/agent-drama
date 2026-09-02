import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/utils/logger'
import {
  getVendors,
  getVendorDetail,
  saveVendorApiKey,
  updateVendor,
  getVendorModels,
  type Vendor,
} from '@/api/vendors'

export const useSettingsStore = defineStore('settings', () => {
  const vendors = ref<Vendor[]>([])
  const selectedVendor = ref<Vendor | null>(null)
  const vendorModels = ref<Record<string, any>>({})
  const loading = ref(false)

  async function fetchVendors() {
    loading.value = true
    try {
      vendors.value = await getVendors()
    } catch (e) {
      logger.error('settings', 'Failed to fetch vendors', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchVendorDetail(name: string) {
    try {
      selectedVendor.value = await getVendorDetail(name)
      return selectedVendor.value
    } catch (e) {
      logger.error('settings', 'Failed to fetch vendor detail', e)
    }
  }

  async function saveApiKey(name: string, apiKey: string) {
    await saveVendorApiKey(name, apiKey)
    await fetchVendors()
  }

  async function toggleEnabled(id: number, enabled: boolean) {
    await updateVendor({ id, status: enabled ? 1 : 0 })
    await fetchVendors()
  }

  async function fetchModels(name: string) {
    try {
      const data = await getVendorModels(name)
      vendorModels.value = data
    } catch (e) {
      vendorModels.value = {}
    }
  }

  return {
    vendors, selectedVendor, vendorModels, loading,
    fetchVendors, fetchVendorDetail, saveApiKey, toggleEnabled, fetchModels,
  }
})
