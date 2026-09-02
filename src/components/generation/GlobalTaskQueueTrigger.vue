<script setup lang="ts">
import type { Component } from 'vue'
import type { GlobalTaskQueueIndicatorState } from './globalTaskQueue.types'
import { computed, ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  History,
  List,
  Loader2,
} from '@/components/common/icon/lucide'

const props = defineProps<{
  count: number
  expanded: boolean
  label: string
  state: GlobalTaskQueueIndicatorState
}>()

const emit = defineEmits<{
  toggle: []
}>()

const buttonRef = ref<HTMLButtonElement | null>(null)
const displayCount = computed<string>(() => props.count > 99 ? '99+' : String(props.count))
const isBreathing = computed<boolean>(() => props.state !== 'idle')
const isSpinning = computed<boolean>(() => props.state === 'running')
const stateIcon = computed<Component>(() => {
  if (props.state === 'failed') return AlertCircle
  if (props.state === 'completed') return CheckCircle2
  if (props.state === 'running') return Loader2
  if (props.state === 'queued') return History
  return List
})

function focus(): void {
  buttonRef.value?.focus()
}

function contains(target: Node): boolean {
  return buttonRef.value?.contains(target) ?? false
}

defineExpose({ contains, focus })
</script>

<template>
  <button
    ref="buttonRef"
    class="gtq-trigger"
    :class="[`gtq-trigger--${state}`, { 'is-breathing': isBreathing, 'is-expanded': expanded }]"
    type="button"
    :title="label"
    :aria-label="label"
    :aria-expanded="expanded"
    aria-controls="global-task-queue-panel"
    @click="emit('toggle')"
  >
    <span class="gtq-trigger__halo" aria-hidden="true"></span>
    <span class="gtq-trigger__surface" aria-hidden="true">
      <component :is="stateIcon" :size="20" :stroke-width="2.25" :class="{ 'gtq-trigger__spin': isSpinning }" />
    </span>
    <span v-if="count > 0" class="gtq-trigger__count" aria-hidden="true">{{ displayCount }}</span>
  </button>
</template>

<style scoped src="./GlobalTaskQueueTrigger.scss"></style>
