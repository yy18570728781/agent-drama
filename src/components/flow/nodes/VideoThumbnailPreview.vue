<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Image as ImageIcon, Video } from 'lucide-vue-next'

const props = defineProps<{
  src: string
  mediaType?: string
}>()

const emit = defineEmits<{
  preview: []
}>()

const loadFailed = ref(false)
const placeholderIcon = computed(() => props.mediaType === 'image' ? ImageIcon : Video)

watch(() => props.src, () => {
  loadFailed.value = false
})
</script>

<template>
  <button
    type="button"
    class="video-thumb-preview"
    @dblclick.stop="emit('preview')"
  >
    <img
      v-if="!loadFailed"
      :src="src"
      loading="lazy"
      decoding="async"
      class="video-thumb-preview__image"
      draggable="false"
      @error="loadFailed = true"
    />
    <span v-else class="video-thumb-preview__placeholder">
      <component :is="placeholderIcon" class="video-thumb-preview__icon" />
    </span>
  </button>
</template>

<style scoped>
.video-thumb-preview {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: #18181b;
  cursor: pointer;
  overflow: hidden;
}

.video-thumb-preview__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.video-thumb-preview__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: rgb(161 161 170);
  background:
    radial-gradient(circle at center, rgba(39, 39, 42, 0.96), rgba(24, 24, 27, 0.9) 58%),
    #18181b;
}

.video-thumb-preview__icon {
  width: clamp(36px, 22%, 72px);
  height: clamp(36px, 22%, 72px);
  opacity: 0.88;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35));
}
</style>
