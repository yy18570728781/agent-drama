<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue'
import type {
  CardGeneratorInputInstance,
  CardViewGeneration,
  CardViewSingleFileBatch,
} from './cardView.types'
import type { GeneratorHeightResizeOptions } from './generatorInput.types'
import CardGeneratorInput from '@/components/flow/CardGeneratorInput.vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import { useCardGeneratorPanelHeight } from '@/composables/generation/useCardGeneratorPanelHeight'

const props = defineProps<{
  externalSendOverride: () => Promise<boolean>
  generation: CardViewGeneration
  scrollEl: HTMLElement | null
  selectionMode: boolean
  singleFileBatch: CardViewSingleFileBatch
  visible: boolean
}>()

const emit = defineEmits<{
  'input-change': [instance: CardGeneratorInputInstance | null]
  'update:visible': [visible: boolean]
}>()

const { height, maxHeight, minHeight, setHeight } = useCardGeneratorPanelHeight()
const heightResize = computed<GeneratorHeightResizeOptions>(() => ({
  height: height.value,
  max: maxHeight.value,
  min: minHeight,
}))

function setInputRef(instance: Element | ComponentPublicInstance | null): void {
  emit('input-change', instance as CardGeneratorInputInstance | null)
}
</script>

<template>
  <div class="card-generator-section">
    <CardGeneratorInput
      v-show="props.visible && !props.generation.isBatchMode.value && !props.selectionMode"
      :ref="setInputRef"
      debug-source="card-view"
      :scroll-el="props.scrollEl"
      :compact="false"
      :is-generating="props.generation.isGenerating.value"
      :embedded-mode-row="true"
      :external-single-file-batch-mode="props.singleFileBatch.enabled.value"
      :external-send-override="props.externalSendOverride"
      :height-resize="heightResize"
      @generate-start="props.generation.onGenerateStart"
      @generate-created="props.generation.onGenerateCreated"
      @generate-progress="props.generation.onGenerateProgress"
      @generate-complete="props.generation.onGenerateComplete"
      @generate-error="props.generation.onGenerateError"
      @batch-mode-change="props.generation.onBatchModeChange"
      @request-payload-change="props.singleFileBatch.syncRequestPayload"
      @mode-row-state-change="props.singleFileBatch.handleModeRowStateChange"
      @height-resize-end="setHeight"
    >
      <template #mode-row-prefix="{ multilineBatchMode, smartMultiFrameEnabled, setMultilineBatchMode, setSmartMultiFrameEnabled }">
        <button
          class="cap-tab"
          :class="{ active: props.singleFileBatch.enabled.value }"
          type="button"
          :aria-pressed="props.singleFileBatch.enabled.value"
          @click="props.singleFileBatch.toggle(multilineBatchMode, smartMultiFrameEnabled, setMultilineBatchMode, setSmartMultiFrameEnabled)"
        >
          <svg v-if="props.singleFileBatch.enabled.value" viewBox="0 0 16 16" width="12" height="12">
            <path d="M3.5 8.5l3 3 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>单文件批量</span>
        </button>
      </template>
      <template #top-toolbar-prepend-control>
        <button class="card-input-toggle" type="button" aria-label="隐藏输入面板" title="隐藏输入面板" @click="emit('update:visible', false)">
          <ChevronDown :size="14" />
        </button>
      </template>
    </CardGeneratorInput>

    <button
      v-if="!props.visible"
      class="card-input-reveal"
      type="button"
      aria-label="显示输入面板"
      title="显示输入面板"
      @click="emit('update:visible', true)"
    >
      <ChevronDown :size="16" class="reveal-icon" />
    </button>
  </div>
</template>

<style scoped src="./CardGeneratorSection.css"></style>
