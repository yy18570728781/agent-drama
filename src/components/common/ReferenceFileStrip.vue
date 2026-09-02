<script setup lang="ts">
import { computed, ref } from 'vue'
import ReferenceMediaPreviewModal from './ReferenceMediaPreviewModal.vue'
import { inferReferenceMediaTypeFromUrl } from '@/composables/useFileDrop'

const props = defineProps<{
  urls: string[]
}>()

const referenceItems = computed(() => (
  props.urls.map((url) => ({
    url,
    mediaType: inferReferenceMediaTypeFromUrl(url),
  }))
))

const previewVisible = ref(false)
const previewUrl = ref('')
const previewIsVideo = ref(false)

function openPreview(url: string, mediaType: string): void {
  previewUrl.value = url
  previewIsVideo.value = mediaType === 'video'
  previewVisible.value = true
}
</script>

<template>
  <div class="section ref-section">
    <h3 class="section-title">参考文件</h3>
    <div class="ref-row">
      <button
        v-for="item in referenceItems"
        :key="item.url"
        type="button"
        class="ref-thumb"
        :class="{ 'ref-thumb-video': item.mediaType === 'video' }"
        :title="item.url"
        @click="openPreview(item.url, item.mediaType)"
      >
        <video
          v-if="item.mediaType === 'video'"
          :src="item.url"
          class="ref-thumb-media"
          preload="metadata"
          playsinline
        />
        <span v-if="item.mediaType === 'video'" class="ref-play-mask">
          <span class="ref-play-icon"></span>
        </span>
        <img
          v-else
          :src="item.url"
          class="ref-thumb-media"
          alt="参考图"
          draggable="false"
          referrerpolicy="no-referrer"
        />
      </button>
    </div>
  </div>

  <ReferenceMediaPreviewModal
    v-model:visible="previewVisible"
    :url="previewUrl"
    :media-type="previewIsVideo ? 'video' : 'image'"
  />
</template>

<style scoped>
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 11px;
  font-weight: 500;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.ref-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex-wrap: wrap;
}

.ref-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #27272a;
  border: 1px solid rgba(251, 191, 36, 0.28);
  text-decoration: none;
  flex: 0 0 auto;
  transition: border-color 0.15s, transform 0.15s;
  padding: 0;
  appearance: none;
  cursor: pointer;
}

.ref-thumb:hover {
  border-color: rgba(251, 191, 36, 0.45);
  transform: translateY(-1px);
}

.ref-thumb-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ref-thumb-video {
  cursor: pointer;
}

.ref-play-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.16);
  pointer-events: none;
}

.ref-play-icon {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
  position: relative;
}

.ref-play-icon::after {
  content: '';
  position: absolute;
  left: 9px;
  top: 7px;
  border-left: 8px solid #ffffff;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
}
</style>
