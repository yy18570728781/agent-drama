<!-- web-ui/src/views/CanvasTestView.vue -->
<!-- Temporary test view for isolated canvas testing -->
<template>
  <div class="canvas-test-view">
    <InfiniteCanvas />
  </div>
</template>

<script setup lang="ts">
import InfiniteCanvas from '@/components/canvas/InfiniteCanvas.vue'
</script>

<style scoped>
.canvas-test-view {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
