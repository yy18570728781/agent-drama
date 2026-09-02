<template>
  <div class="test-canvas-container">
    <InfiniteCanvas />
  </div>
</template>

<script setup lang="ts">
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas.vue'
</script>

<style scoped>
.test-canvas-container {
  width: 100vw;
  height: 100vh;
  background-color: #1a1a2e;
}
</style>
