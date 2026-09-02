<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, X } from '@/components/common/icon/lucide'
import type { DraggedReferenceImagePayload, ReferenceImage } from './referenceMedia.types'

const props = defineProps<{
  images: ReferenceImage[]
}>()

const emit = defineEmits<{
  (event: 'update:images', images: ReferenceImage[]): void
}>()

const isDragOver = ref(false)

function removeAt(index: number): void {
  emit('update:images', props.images.filter((_, imageIndex) => imageIndex !== index))
}

function onDrop(event: DragEvent): void {
  isDragOver.value = false
  const raw = event.dataTransfer?.getData('application/x-reference-image') || ''
  if (!raw) return
  try {
    const payload = JSON.parse(raw) as DraggedReferenceImagePayload
    if (!payload?.url) return
    const nextImage = buildReferenceImage(payload)
    const exists = props.images.some((image) => (image.sourceUrl || image.url) === (nextImage.sourceUrl || nextImage.url))
    if (exists) return
    emit('update:images', [...props.images, nextImage])
  } catch {
    return
  }
}

function buildReferenceImage(payload: DraggedReferenceImagePayload): ReferenceImage {
  return {
    url: payload.url,
    file: new File([], payload.fileName || 'reference'),
    isVideo: payload.isVideo,
    mediaType: payload.mediaType,
    sourceUrl: payload.sourceUrl || payload.url,
    uploaded: payload.uploaded,
  }
}
</script>

<template>
  <div
    class="multiline-row-refs"
    :class="{ 'multiline-row-refs--dragover': isDragOver }"
    aria-label="当前提示词的参考素材"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <div v-if="images.length" class="multiline-row-refs__list">
      <div
        v-for="(image, index) in images"
        :key="`${image.sourceUrl || image.url}-${index}`"
        class="multiline-row-refs__item"
      >
        <img :src="image.url" alt="" class="multiline-row-refs__image" />
        <button
          type="button"
          class="multiline-row-refs__remove"
          :aria-label="`移除第 ${index + 1} 张参考图`"
          title="移除参考图"
          @click="removeAt(index)"
        >
          <X :size="12" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-else class="multiline-row-refs__empty">
      <ImagePlus :size="17" aria-hidden="true" />
      <span class="multiline-row-refs__empty-copy">
        <strong>拖入参考素材</strong>
        <small>仅用于当前提示词</small>
      </span>
    </div>
  </div>
</template>

<style scoped>
.multiline-row-refs {
  min-height: 74px;
  padding: 6px;
  border: 1px dashed color-mix(in srgb, var(--generator-text-muted) 30%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--generator-surface) 18%, transparent);
  transition: border-color 160ms ease, background 160ms ease;
}

.multiline-row-refs--dragover {
  border-color: var(--generator-accent);
  background: color-mix(in srgb, var(--generator-accent) 10%, transparent);
}

.multiline-row-refs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.multiline-row-refs__item {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 8px;
  background: var(--generator-surface-muted);
  border: 1px solid var(--generator-border-muted);
}

.multiline-row-refs__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.28);
}

.multiline-row-refs__remove {
  position: absolute;
  top: 3px;
  right: 3px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 7px;
  background: rgb(0 0 0 / 62%);
  color: white;
  cursor: pointer;
}

.multiline-row-refs__remove:hover { background: color-mix(in srgb, var(--error) 74%, black); }
.multiline-row-refs__remove:focus-visible { outline: 2px solid var(--generator-accent); outline-offset: 2px; }

.multiline-row-refs__empty {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 7px;
  color: var(--generator-text-secondary);
  text-align: left;
}

.multiline-row-refs__empty > svg { flex: 0 0 auto; color: var(--generator-text-muted); }
.multiline-row-refs__empty-copy { display: grid; min-width: 0; gap: 2px; }
.multiline-row-refs__empty strong { font-size: 12px; font-weight: 500; white-space: nowrap; }
.multiline-row-refs__empty small { color: var(--generator-text-muted); font-size: 10px; white-space: nowrap; }

@media (max-width: 720px), (pointer: coarse) {
  .multiline-row-refs__remove { width: 44px; height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .multiline-row-refs { transition: none; }
}
</style>
