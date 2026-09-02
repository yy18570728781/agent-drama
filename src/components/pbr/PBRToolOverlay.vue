<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import PBRGeneratorWindow from '@/components/pbr/PBRGeneratorWindow.vue'
import { usePbrOverlayStore } from '@/stores/pbrOverlay.store'

const overlayStore = usePbrOverlayStore()
const visible = computed(() => overlayStore.visible)

function closeOverlay(): void {
  overlayStore.closeOverlay()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && visible.value) {
    closeOverlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="visible" class="pbr-overlay">
    <div class="pbr-overlay-backdrop" @click="closeOverlay" />
    <div class="pbr-overlay-panel">
      <PBRGeneratorWindow :back-to="closeOverlay" />
    </div>
  </div>
</template>

<style scoped>
.pbr-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
}

.pbr-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(9, 9, 11, 0.72);
  backdrop-filter: blur(6px);
}

.pbr-overlay-panel {
  position: absolute;
  inset: 20px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(63, 63, 70, 0.9);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}
</style>
