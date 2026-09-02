<script setup lang="ts">
import { Plus, SendHorizontal } from '@/components/common/icon/lucide'

const props = withDefaults(defineProps<{
  summary: string
  canSend: boolean
  expandLabel?: string
  sendLabel?: string
}>(), {
  expandLabel: '展开生成器',
  sendLabel: '开始生成',
})

const emit = defineEmits<{
  expand: []
  send: []
}>()
</script>

<template>
  <div class="generator-collapsed-bar" role="group" aria-label="已收起的生成器">
    <button
      class="collapsed-upload-trigger"
      type="button"
      :aria-label="props.expandLabel"
      @click="emit('expand')"
    >
      <Plus :size="17" />
    </button>

    <button
      class="collapsed-summary"
      type="button"
      :title="props.summary"
      @click="emit('expand')"
    >
      {{ props.summary }}
    </button>

    <button
      class="collapsed-send-btn"
      :class="{ 'is-active': props.canSend }"
      type="button"
      :disabled="!props.canSend"
      :aria-label="props.sendLabel"
      @click="emit('send')"
    >
      <SendHorizontal :size="18" />
    </button>
  </div>
</template>

<style scoped src="./GeneratorCollapsedBar.css"></style>
