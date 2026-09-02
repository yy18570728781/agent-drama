<script setup lang="ts">
import type { BackendModelInfo } from '@/api/models'
import { Check } from '@/components/common/icon/lucide'

import CapabilitySelector from './CapabilitySelector.vue'
import GeneratorTopToolbar from './GeneratorTopToolbar.vue'

type ScreenshotMode = 'hide-window' | 'keep-window'

const props = withDefaults(defineProps<{
  capability: string
  selectedModelInfo: BackendModelInfo | null
  lockedCapability?: string
  hasPromptParam: boolean
  multilineBatchMode: boolean
  smartMultiFrameAvailable: boolean
  smartMultiFrameEnabled: boolean
  isTextExpanded: boolean
  screenshotCapturing?: boolean
  screenshotMenuVisible?: boolean
  showCapabilitySelector?: boolean
  showTopToolbar?: boolean
  showScreenshot?: boolean
  showTextExpand?: boolean
  showSyncUpstream?: boolean
  showCollapsePanel?: boolean
  showClose?: boolean
}>(), {
  lockedCapability: '',
  screenshotCapturing: false,
  screenshotMenuVisible: false,
  showCapabilitySelector: true,
  showTopToolbar: true,
  showScreenshot: false,
  showTextExpand: false,
  showSyncUpstream: false,
  showCollapsePanel: false,
  showClose: false,
})

const emit = defineEmits<{
  'update:capability': [capId: string]
  'capability-change': [capId: string]
  'switch-model-for-capability': [capId: string]
  'reload-current-model': [capId: string]
  'set-multiline-batch-mode': [enabled: boolean]
  'set-smart-multi-frame-enabled': [enabled: boolean]
  'request-preferred-screenshot': []
  'request-screenshot-mode': [mode: ScreenshotMode]
  'update:screenshot-menu-visible': [value: boolean]
  'toggle-text-expanded': []
  'sync-upstream': []
  'collapse-panel': []
  'close-panel': []
}>()

function setMultilineBatchMode(enabled: boolean): void {
  emit('set-multiline-batch-mode', enabled)
}

function setSmartMultiFrameEnabled(enabled: boolean): void {
  emit('set-smart-multi-frame-enabled', enabled)
}
</script>

<template>
  <header class="generator-composer-header">
    <div v-if="props.showTopToolbar" class="generator-composer-toolbar">
      <GeneratorTopToolbar
        :integrated="true"
        :is-text-expanded="props.isTextExpanded"
        :screenshot-capturing="props.screenshotCapturing"
        :screenshot-menu-visible="props.screenshotMenuVisible"
        :show-screenshot="props.showScreenshot"
        :show-text-expand="props.showTextExpand"
        :show-sync-upstream="props.showSyncUpstream"
        :show-collapse-panel="props.showCollapsePanel"
        :show-close="props.showClose"
        @request-preferred-screenshot="emit('request-preferred-screenshot')"
        @request-screenshot-mode="emit('request-screenshot-mode', $event)"
        @update:screenshot-menu-visible="emit('update:screenshot-menu-visible', $event)"
        @toggle-text-expanded="emit('toggle-text-expanded')"
        @sync-upstream="emit('sync-upstream')"
        @collapse-panel="emit('collapse-panel')"
        @close-panel="emit('close-panel')"
      >
        <template #prepend-control>
          <slot name="top-toolbar-prepend-control" />
        </template>
      </GeneratorTopToolbar>
    </div>

    <CapabilitySelector
      v-if="props.showCapabilitySelector"
      :capability="props.capability"
      :locked-capability="props.lockedCapability"
      :selected-model-info="props.selectedModelInfo"
      @update:capability="emit('update:capability', $event)"
      @capability-change="emit('capability-change', $event)"
      @switch-model-for-capability="emit('switch-model-for-capability', $event)"
      @reload-current-model="emit('reload-current-model', $event)"
    >
      <template #actions>
        <div class="generator-mode-actions">
          <slot
            name="mode-row-prefix"
            :multiline-batch-mode="props.multilineBatchMode"
            :smart-multi-frame-enabled="props.smartMultiFrameEnabled"
            :set-multiline-batch-mode="setMultilineBatchMode"
            :set-smart-multi-frame-enabled="setSmartMultiFrameEnabled"
          />
          <button
            class="generator-mode-chip"
            :class="{ 'is-active': props.multilineBatchMode }"
            type="button"
            :disabled="!props.hasPromptParam"
            :aria-pressed="props.multilineBatchMode"
            @click="setMultilineBatchMode(!props.multilineBatchMode)"
          >
            <Check v-if="props.multilineBatchMode" :size="13" :stroke-width="2.4" />
            <span>多行提示词</span>
          </button>
          <button
            v-if="props.smartMultiFrameAvailable"
            class="generator-mode-chip"
            :class="{ 'is-active': props.smartMultiFrameEnabled }"
            type="button"
            :disabled="!props.hasPromptParam"
            :aria-pressed="props.smartMultiFrameEnabled"
            @click="setSmartMultiFrameEnabled(!props.smartMultiFrameEnabled)"
          >
            <Check v-if="props.smartMultiFrameEnabled" :size="13" :stroke-width="2.4" />
            <span>智能多帧</span>
          </button>
        </div>
      </template>
    </CapabilitySelector>
  </header>
</template>

<style scoped src="./GeneratorComposerHeader.css"></style>
