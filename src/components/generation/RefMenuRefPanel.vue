<template>
  <div class="ref-col ref-col-left">
    <div class="ref-section-title">已加入的参考图</div>
    <div v-if="filteredImages.length" class="ref-grid">
      <div v-for="img in filteredImages" :key="'ref-' + originalIndex(img)"
        class="ref-grid-item"
        :class="{ active: activeItemId === `ref-${originalIndex(img)}` }"
        @mousedown.prevent
        @click.stop="$emit('select-ref', originalIndex(img))"
        @mouseenter="$emit('set-active', `ref-${originalIndex(img)}`)">
        <div class="ref-grid-thumb">
          <video v-if="img.mediaType === 'video'" :src="img.url" class="ref-grid-media" muted playsinline preload="metadata" disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" />
          <img v-else-if="img.mediaType === 'image'" :src="img.url" class="ref-grid-media" />
          <div v-else class="ref-grid-file flex flex-col items-center gap-2 py-2 cursor-pointer">
            <component :is="img.mediaType === 'audio' ? AudioLines : Box" class="w-4 h-4" />
            <span>{{ img.mediaType === 'audio' ? '音频' : '模型' }}</span>
          </div>
        </div>
        <span class="ref-grid-label">{{ displayLabel(originalIndex(img)) }}</span>
      </div>
    </div>
    <div v-else class="ref-empty-hint">拖拽或粘贴图片到输入框</div>
  </div>
</template>

<script setup lang="ts">
import type { ReferenceImage } from './ReferenceMenu.vue'
import { AudioLines, Box } from '@/components/common/icon/lucide'

const props = defineProps<{
  filteredImages: ReferenceImage[]
  refImages: ReferenceImage[]
  activeItemId: string
  getDisplayLabel: (index: number) => string
}>()

defineEmits<{
  'select-ref': [index: number]
  'set-active': [id: string]
}>()

function originalIndex(img: ReferenceImage): number {
  return props.refImages.indexOf(img)
}

function displayLabel(index: number): string {
  return props.getDisplayLabel(index)
}
</script>
