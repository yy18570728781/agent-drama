<template>
  <div v-if="visible" class="capability-selector-shell generator-capability-selector m-0 min-w-0 overflow-hidden p-0">
    <CapabilityBar
      :model-value="capability"
      theme="light"
      :counts="counts"
      :allowed-ids="allowedIds"
      @update:model-value="onSelect"
      @change="onChange"
    >
      <template #actions><slot name="actions" /></template>
    </CapabilityBar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CapabilityBar from '@/components/common/CapabilityBar.vue'
import type { BackendModelInfo } from '@/api/models'

const props = withDefaults(defineProps<{
  visible?: boolean
  capability: string
  lockedCapability?: string
  selectedModelInfo: BackendModelInfo | null
}>(), {
  visible: true,
})

const emit = defineEmits<{
  'update:capability': [capId: string]
  'capability-change': [capId: string]
  'switch-model-for-capability': [capId: string]
  'reload-current-model': [capId: string]
}>()

const allowedIds = computed(() => props.lockedCapability ? [props.lockedCapability] : [])
const counts = computed<Record<string, number>>(() => ({}))

function capListIncludes(caps: any[], capId: string): boolean {
  return caps.some((c: any) => {
    const id = typeof c === 'string' ? c : (c?.name || c?.id)
    return id === capId
  })
}

function onSelect(capId: string) {
  emit('update:capability', capId)
}

function onChange(capId: string) {
  emit('capability-change', capId)
  if (props.selectedModelInfo && !capListIncludes(props.selectedModelInfo.capabilities || [], capId)) {
    emit('switch-model-for-capability', capId)
    return
  }
  if (props.selectedModelInfo) {
    emit('reload-current-model', capId)
  }
}
</script>
