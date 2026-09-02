<script setup lang="ts">
import type { CSSProperties } from 'vue'

import { ChevronDown } from '@/components/common/icon/lucide'

interface GeneratorStatusCard {
  url: string | null
  done: boolean
}

const props = withDefaults(defineProps<{
  cards?: readonly GeneratorStatusCard[]
  showGeneratingCards?: boolean
  showBackToBottom?: boolean
}>(), {
  cards: () => [],
  showGeneratingCards: false,
  showBackToBottom: false,
})

const emit = defineEmits<{
  'scroll-to-bottom': []
}>()

const CARD_ROTATIONS = [-12, -6, 0, 8, 15, -10, 12] as const

function getCardStyle(index: number, total: number): CSSProperties {
  const rotation = CARD_ROTATIONS[index % CARD_ROTATIONS.length]
  const offsetY = (total - 1 - index) * 0.75
  const offsetX = rotation * 0.15

  return {
    transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
    zIndex: index + 1,
    transitionDelay: `${(total - 1 - index) * 40}ms`,
  }
}
</script>

<template>
  <div class="generator-status-overlay" aria-live="polite">
    <button
      v-if="props.showGeneratingCards && props.cards.length"
      class="generating-cards"
      type="button"
      :aria-label="`${props.cards.length} 个任务生成中，回到最新结果`"
      @click="emit('scroll-to-bottom')"
    >
      <span class="generating-cards-stack" aria-hidden="true">
        <span
          v-for="(card, index) in props.cards"
          :key="index"
          class="gen-card"
          :class="{ 'is-done': card.done }"
          :style="getCardStyle(index, props.cards.length)"
        >
          <img v-if="card.url" :src="card.url" class="gen-card-img" alt="" />
          <span v-else class="gen-card-placeholder">
            <span class="gen-card-spinner" />
            <span class="gen-card-label">生成中</span>
          </span>
        </span>
      </span>
    </button>

    <button
      v-if="props.showBackToBottom"
      class="back-to-bottom-btn"
      type="button"
      aria-label="回到最新结果"
      @click="emit('scroll-to-bottom')"
    >
      <ChevronDown :size="18" />
    </button>
  </div>
</template>

<style scoped src="./GeneratorStatusOverlay.css"></style>
