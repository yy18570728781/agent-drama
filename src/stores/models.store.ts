import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/utils/logger'
import { getVendorModels } from '@/api/vendors'

export interface ModelInfo {
  alias: string
  capabilities: string[]
}

export interface CompanyModelGroup {
  display_name: string
  icon: string
  models: Record<string, ModelInfo>
}

export const useModelsStore = defineStore('models', () => {
  const groups = ref<Record<string, CompanyModelGroup>>({})
  const loading = ref(false)
  const selectedModel = ref('')
  const currentVendor = ref('')

  async function fetchByVendor(vendorName: string) {
    loading.value = true
    currentVendor.value = vendorName
    try {
      const models = await getVendorModels(vendorName)
      groups.value = (models as { groups?: Record<string, CompanyModelGroup> }).groups || {}
    } catch (e) {
      logger.error('models', 'Failed to fetch models', e)
      groups.value = {}
    } finally {
      loading.value = false
    }
  }

  function selectModel(modelId: string) {
    selectedModel.value = modelId
  }

  function clear() {
    groups.value = {}
    selectedModel.value = ''
    currentVendor.value = ''
  }

  return {
    groups, loading, selectedModel, currentVendor,
    fetchByVendor, selectModel, clear,
  }
})
