import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import {
  getUserPresets,
  createUserPreset,
  updateUserPreset,
  deleteUserPreset,
  getBuiltinPresets,
  getCapabilityParams,
  getParamsTemplates,
  type UserPreset,
  type BuiltinPreset,
  type ParamSchemaItem,
} from '@/api/presets'

export const usePresetsStore = defineStore('presets', () => {
  // State
  const userPresets = ref<UserPreset[]>([])
  const builtinPresets = ref<BuiltinPreset[]>([])
  const paramsTemplates = ref<Record<string, Record<string, ParamSchemaItem>>>({})
  const loading = ref(false)
  const currentCapability = ref<string>('')

  // Computed: combined presets by capability
  const presetsByCapability = computed(() => {
    const result: Record<string, (UserPreset | BuiltinPreset)[]> = {}

    for (const preset of builtinPresets.value) {
      if (!result[preset.capability]) {
        result[preset.capability] = []
      }
      result[preset.capability].push(preset)
    }

    for (const preset of userPresets.value) {
      if (!result[preset.capability]) {
        result[preset.capability] = []
      }
      result[preset.capability].push(preset)
    }

    return result
  })

  // Actions
  async function fetchUserPresets(capability?: string) {
    loading.value = true
    try {
      const response = await getUserPresets(capability)
      userPresets.value = response.presets || []
    } catch (e) {
      logger.error('presets', 'Failed to fetch user presets', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchBuiltinPresets() {
    try {
      const response = await getBuiltinPresets()
      builtinPresets.value = response.presets || []
    } catch (e) {
      logger.error('presets', 'Failed to fetch builtin presets', e)
    }
  }

  async function fetchParamsTemplates() {
    try {
      const response = await getParamsTemplates()
      paramsTemplates.value = response.templates || {}
    } catch (e) {
      logger.error('presets', 'Failed to fetch params templates', e)
    }
  }

  async function createPreset(name: string, capability: string, params: Record<string, any>, description?: string) {
    try {
      const preset = await createUserPreset({ name, capability, params, description })
      userPresets.value.push(preset)
      return preset
    } catch (e) {
      logger.error('presets', 'Failed to create preset', e)
      throw e
    }
  }

  async function updatePreset(presetId: string, updates: { name?: string; description?: string; params?: Record<string, any> }) {
    try {
      const preset = await updateUserPreset(presetId, updates)
      const index = userPresets.value.findIndex(p => p.id === presetId)
      if (index >= 0) {
        userPresets.value[index] = preset
      }
      return preset
    } catch (e) {
      logger.error('presets', 'Failed to update preset', e)
      throw e
    }
  }

  async function deletePreset(presetId: string) {
    try {
      await deleteUserPreset(presetId)
      userPresets.value = userPresets.value.filter(p => p.id !== presetId)
    } catch (e) {
      logger.error('presets', 'Failed to delete preset', e)
      throw e
    }
  }

  function getPresetsForCapability(capability: string): (UserPreset | BuiltinPreset)[] {
    return presetsByCapability.value[capability] || []
  }

  function getTemplateForCapability(capability: string): Record<string, ParamSchemaItem> | undefined {
    return paramsTemplates.value[capability]
  }

  return {
    userPresets,
    builtinPresets,
    paramsTemplates,
    loading,
    currentCapability,
    presetsByCapability,

    fetchUserPresets,
    fetchBuiltinPresets,
    fetchParamsTemplates,
    createPreset,
    updatePreset,
    deletePreset,
    getPresetsForCapability,
    getTemplateForCapability,
  }
})
