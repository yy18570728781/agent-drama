<script setup lang="ts">
import { LoaderCircle, SendHorizontal } from '@/components/common/icon/lucide'

const props = defineProps<{
  canSend: boolean
  countLabel: string
  countMax?: number
  countMin: number
  countValue: number
  displayGroupPoints: string
  displayReservePoints: string
  displayUserPoints: string
  isGenerating: boolean
  pointInfoTooltip: string
  pointInfoVisible: boolean
  showCount: boolean
  showGroupPoints: boolean
  showReservePoints: boolean
  showUserPoints: boolean
}>()

const emit = defineEmits<{
  'send': []
  'step-count': [delta: number]
}>()
</script>

<template>
  <div class="generator-submit-cluster">
    <div v-if="props.showCount" class="generator-count" :title="props.countLabel">
      <button
        type="button"
        aria-label="减少生成数量"
        :disabled="props.countValue <= props.countMin"
        @click="emit('step-count', -1)"
      >−</button>
      <span aria-live="polite">{{ props.countValue }}</span>
      <button
        type="button"
        aria-label="增加生成数量"
        :disabled="props.countMax !== undefined && props.countValue >= props.countMax"
        @click="emit('step-count', 1)"
      >＋</button>
    </div>

    <div v-if="props.pointInfoVisible" class="generator-cost" :title="props.pointInfoTooltip">
      <span v-if="props.showReservePoints" class="generator-cost__primary">
        预计 {{ props.displayReservePoints }} 积分
      </span>
      <span v-else-if="props.showUserPoints">积分 {{ props.displayUserPoints }}</span>
      <span v-else-if="props.showGroupPoints">组积分 {{ props.displayGroupPoints }}</span>
    </div>

    <button
      class="generator-submit"
      :class="{ 'is-active': props.canSend }"
      type="button"
      :disabled="!props.canSend"
      :aria-busy="props.isGenerating"
      @click="emit('send')"
    >
      <LoaderCircle v-if="props.isGenerating" :size="16" class="generator-submit__spinner" />
      <SendHorizontal v-else :size="16" />
      <span>生成</span>
    </button>
  </div>
</template>

<style scoped src="./GeneratorSubmitCluster.css"></style>
