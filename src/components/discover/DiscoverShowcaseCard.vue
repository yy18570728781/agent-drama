<script setup lang="ts">
import type { DiscoverShowcaseItem } from './discover.types'
import { ref } from 'vue'

defineOptions({ name: 'DiscoverShowcaseCard' })

const props = defineProps<{
  item: DiscoverShowcaseItem
}>()

const emit = defineEmits<{
  select: [workflowId: string]
}>()

const previewVideo = ref<HTMLVideoElement | null>(null)

function handleSelect(): void {
  emit('select', props.item.id)
}

function playPreview(): void {
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!previewVideo.value || !supportsHover || reduceMotion) return
  void previewVideo.value.play().catch(() => undefined)
}

function resetPreview(): void {
  const video = previewVideo.value
  if (!video) return
  video.pause()
  video.currentTime = 0
}
</script>

<template>
  <button
    class="discover-showcase-card"
    type="button"
    :aria-label="`查看“${item.title}”案例详情`"
    @click="handleSelect"
    @mouseenter="playPreview"
    @mouseleave="resetPreview"
  >
    <span class="discover-showcase-card__media">
      <img
        v-if="item.image"
        :src="item.image"
        :alt="item.imageAlt"
        loading="eager"
        decoding="async"
      >
      <video
        v-if="item.video"
        ref="previewVideo"
        :class="{ 'is-primary': !item.image }"
        :src="item.video"
        :poster="item.image"
        muted
        loop
        playsinline
        preload="none"
        tabindex="-1"
        aria-hidden="true"
      ></video>
      <span class="discover-showcase-card__badges">
        <span
          v-for="badge in item.badges"
          :key="badge.label"
          class="discover-showcase-card__badge"
          :class="{ 'is-exclusive': badge.tone === 'exclusive' }"
        >
          {{ badge.label }}
        </span>
      </span>
    </span>

    <span class="discover-showcase-card__copy">
      <strong>{{ item.title }}</strong>
      <small>{{ item.description }}</small>
    </span>
  </button>
</template>

<style scoped src="./DiscoverShowcaseCard.scss"></style>
