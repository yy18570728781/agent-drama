<template>
  <Teleport to="body">
    <Transition name="reference-modal-fade">
      <div v-if="visible && url" class="reference-modal-mask" @click="close">
        <div class="reference-modal-panel" @click.stop>
          <button type="button" class="reference-modal-close" aria-label="关闭预览" @click="close">
            x
          </button>
          <div class="reference-modal-stage">
            <video
              v-if="mediaType === 'video'"
              :src="url"
              class="reference-modal-media"
              controls
              autoplay
              playsinline
            />
            <img
              v-else
              :src="url"
              class="reference-modal-media"
              alt="参考预览"
              draggable="false"
              referrerpolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  url: string
  mediaType?: 'image' | 'video'
}>(), {
  mediaType: 'image',
})

const visible = defineModel<boolean>('visible', { default: false })

function close(): void {
  visible.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(visible, (nextVisible) => {
  if (nextVisible) {
    window.addEventListener('keydown', onKeydown)
    return
  }
  window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.reference-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgba(15, 15, 18, 0.56);
  backdrop-filter: blur(4px);
}

.reference-modal-panel {
  position: relative;
  width: min(960px, 92vw);
  max-height: 86vh;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #18181b;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}

.reference-modal-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.reference-modal-media {
  display: block;
  max-width: 100%;
  max-height: calc(86vh - 40px);
  border-radius: 10px;
  background: #000;
  object-fit: contain;
}

.reference-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.9);
  color: #fafafa;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.reference-modal-fade-enter-active,
.reference-modal-fade-leave-active {
  transition: opacity 0.16s ease;
}

.reference-modal-fade-enter-from,
.reference-modal-fade-leave-to {
  opacity: 0;
}
</style>
