<script setup lang="ts">
import { useDiscoverAmbientCanvas } from '@/composables/discover/useDiscoverAmbientCanvas'

defineOptions({ name: 'DiscoverShowcaseAmbientCanvas' })

const { canvas } = useDiscoverAmbientCanvas()
</script>

<template>
  <div class="discover-showcase-ambient" aria-hidden="true">
    <div class="discover-showcase-ambient__fallback"></div>
    <canvas ref="canvas" class="discover-showcase-ambient__canvas"></canvas>
  </div>
</template>

<style scoped>
.discover-showcase-ambient,
.discover-showcase-ambient__fallback,
.discover-showcase-ambient__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.discover-showcase-ambient {
  z-index: 0;
  pointer-events: none;
  mask-image: linear-gradient(to right, #000 0%, #000 20%, transparent 40%);
  -webkit-mask-image: linear-gradient(to right, #000 0%, #000 20%, transparent 40%);
}

.discover-showcase-ambient__fallback {
  background:
    radial-gradient(ellipse at 18% 78%, rgba(255, 255, 255, 0.18), transparent 34%),
    radial-gradient(ellipse at 15% 35%, rgba(137, 151, 154, 0.14), transparent 38%),
    radial-gradient(circle at 1px 1px, rgba(155, 159, 161, 0.3) 1px, transparent 1.2px) 0 0 / 19px 19px;
}

.discover-showcase-ambient__canvas {
  display: block;
  opacity: 0;
}

.discover-showcase-ambient__canvas.is-ready {
  opacity: 1;
}

@media (max-width: 767px), (hover: none), (pointer: coarse) {
  .discover-showcase-ambient__fallback {
    opacity: 0.34;
  }
}
</style>
