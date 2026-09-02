<template>
  <div class="smart-multi-frame-row-params">
    <DynamicParamForm
      v-if="params.length"
      :params="params"
      :initial-values="values"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { ModelParamSchema } from '@/api/models'
import DynamicParamForm from './DynamicParamForm.vue'

const props = defineProps<{
  params: ModelParamSchema[]
  values: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', values: Record<string, unknown>): void
}>()

function onChange(values: Record<string, unknown>): void {
  emit('change', values)
}
</script>

<style scoped>
.smart-multi-frame-row-params {
  min-width: 0;
}

.smart-multi-frame-row-params :deep(.toolbar-select-btn) {
  min-width: 0;
  max-width: 140px;
}

.smart-multi-frame-row-params :deep(.btn-label) {
  display: none;
}

.smart-multi-frame-row-params :deep(.btn-value) {
  font-size: 10px;
}
</style>
