<script setup lang="ts">
import type { DiscoverCase } from './discover.types'
import { computed, ref } from 'vue'
import { ArrowUpRight, Heart, Workflow } from '@/components/common/icon/lucide'

defineOptions({ name: 'DiscoverCaseCard' })

const props = defineProps<{
  item: DiscoverCase
}>()

const emit = defineEmits<{
  select: [workflowId: string]
}>()

const previewVideo = ref<HTMLVideoElement | null>(null)
const authorInitial = computed(() => props.item.author.trim().charAt(0) || '创')

function handleSelect(): void {
  emit('select', props.item.id)
}

function playPreview(): void {
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!previewVideo.value || !supportsHover || reduceMotion) {
    return
  }

  void previewVideo.value.play().catch(() => undefined)
}

function resetPreview(): void {
  const video = previewVideo.value
  if (!video) {
    return
  }

  video.pause()
  video.currentTime = 0
}

function handlePreviewFocusOut(event: FocusEvent): void {
  const media = event.currentTarget
  const nextTarget = event.relatedTarget
  if (media instanceof HTMLElement && nextTarget instanceof Node && media.contains(nextTarget)) {
    return
  }

  resetPreview()
}
</script>

<template>
  <article class="discover-case-card">
    <div
      class="discover-case-card__media"
      @mouseenter="playPreview"
      @mouseleave="resetPreview"
      @focusin="playPreview"
      @focusout="handlePreviewFocusOut"
    >
      <button
        class="discover-case-card__cover"
        type="button"
        :aria-label="`查看案例“${item.title}”详情`"
        @click="handleSelect"
      >
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.imageAlt"
          loading="lazy"
          decoding="async"
        >
        <video
          v-if="item.video"
          ref="previewVideo"
          class="discover-case-card__video"
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
        <span v-if="item.likes" class="discover-case-card__likes" aria-hidden="true">
          <Heart :size="13" :stroke-width="1.8" fill="currentColor" />
          {{ item.likes }}
        </span>
      </button>

      <button
        class="discover-case-card__process discover-case-card__process--mobile"
        type="button"
        :aria-label="`查看“${item.title}”详情`"
        @click="handleSelect"
      >
        <span class="discover-case-card__process-surface">
          <Workflow :size="13" :stroke-width="1.9" aria-hidden="true" />
        </span>
      </button>
    </div>

    <div class="discover-case-card__info">
      <div class="discover-case-card__copy">
        <div class="discover-case-card__author">
          <img
            v-if="item.authorAvatar"
            class="discover-case-card__avatar"
            :src="item.authorAvatar"
            alt=""
            loading="lazy"
            decoding="async"
          >
          <span v-else class="discover-case-card__avatar" aria-hidden="true">{{ authorInitial }}</span>
          <span>{{ item.author }}</span>
        </div>
        <h3 :title="item.title">{{ item.title }}</h3>
      </div>

      <span class="discover-case-card__process-reveal">
        <button
          class="discover-case-card__process discover-case-card__process--desktop"
          type="button"
          :aria-label="`查看“${item.title}”详情`"
          @click="handleSelect"
        >
          <Workflow :size="14" :stroke-width="1.8" aria-hidden="true" />
          <span>查看详情</span>
          <ArrowUpRight :size="13" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </span>
    </div>
  </article>
</template>

<style scoped src="./DiscoverCaseCard.scss"></style>
