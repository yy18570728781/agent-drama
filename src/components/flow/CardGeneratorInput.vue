<template>
  <GeneratorInput
    ref="generatorRef"
    v-bind="$attrs"
    ui-remember-key="infinite_canvas_ui_remember"
    cap-model-remember-key="infinite_canvas_cap_model_remember"
  >
    <template #mode-row-prefix="slotProps">
      <slot name="mode-row-prefix" v-bind="slotProps" />
    </template>
    <template #top-toolbar-prepend-control>
      <slot name="top-toolbar-prepend-control" />
    </template>
  </GeneratorInput>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GeneratorInput from '@/components/generation/GeneratorInput.vue'
import { useCardGeneratorInputProxy } from '@/composables/flow/useCardGeneratorInputProxy'

type GeneratorInstance = InstanceType<typeof GeneratorInput>

defineOptions({
  inheritAttrs: false,
})

const generatorRef = ref<GeneratorInstance | null>(null)
const generatorProxy = useCardGeneratorInputProxy(generatorRef)

defineExpose({
  getInner: () => generatorRef.value,
  ...generatorProxy,
  getCurrentState: () => generatorRef.value?.getCurrentState?.(),
  buildCurrentRequestPayload: () => generatorRef.value?.buildCurrentRequestPayload?.(),
  get selectedModelId() { return generatorRef.value?.selectedModelId || '' },
  get selectedModelInfo() { return generatorRef.value?.selectedModelInfo || null },
  get selectedCapability() { return generatorRef.value?.selectedCapability || 'image_generation' },
  get selectedMode() { return generatorRef.value?.selectedMode || 'standard' },
  get availableModes() { return generatorRef.value?.availableModes || [] },
  get modelParams() { return generatorRef.value?.modelParams || [] },
  get paramValues() { return generatorRef.value?.paramValues || {} },
})
</script>
