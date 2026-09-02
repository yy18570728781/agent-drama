<template>
  <div class="asset-grid">
    <div
      v-for="model in models"
      :key="model.id"
      class="asset-card"
      :class="{ selected: props.selectedId === model.id }"
      @click="emit('select', model.id)"
    >
      <div class="thumbnail" :class="model.thumbClass">
        <div class="mini-cube">
          <div class="cube-face cube-top"></div>
          <div class="cube-face cube-left"></div>
          <div class="cube-face cube-right"></div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-model">{{ model.name }}</div>
        <div class="card-meta">
          <span class="format-badge" :class="`badge-${model.format}`">{{ model.format.toUpperCase() }}</span>
          <span class="card-size">{{ model.size }}</span>
        </div>
        <div class="card-time">{{ model.time }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Model3D {
  id: string
  name: string
  format: 'glb' | 'gltf' | 'obj' | 'fbx'
  size: string
  time: string
  thumbClass: string
}

const props = defineProps<{ selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const models = ref<Model3D[]>([
  { id: '1', name: 'robot_arm.glb', format: 'glb', size: '12.4 MB', time: '今天 14:20', thumbClass: 'model-thumb-blue' },
  { id: '2', name: 'spaceship.gltf', format: 'gltf', size: '8.7 MB', time: '今天 13:55', thumbClass: 'model-thumb-purple' },
  { id: '3', name: 'character.obj', format: 'obj', size: '3.2 MB', time: '今天 12:30', thumbClass: 'model-thumb-green' },
  { id: '4', name: 'building.fbx', format: 'fbx', size: '21.6 MB', time: '今天 11:15', thumbClass: 'model-thumb-orange' },
  { id: '5', name: 'vehicle.glb', format: 'glb', size: '6.8 MB', time: '昨天 16:40', thumbClass: 'model-thumb-blue' },
  { id: '6', name: 'environment.gltf', format: 'gltf', size: '45.2 MB', time: '昨天 10:20', thumbClass: 'model-thumb-purple' },
])
</script>

<style scoped>
.asset-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* Thumbnail backgrounds */
.model-thumb-blue   { background: #1a1a3e; }
.model-thumb-purple { background: #2a1a3a; }
.model-thumb-green  { background: #0a2a1a; }
.model-thumb-orange { background: #2a1a0a; }

/* Mini 3D cube inside thumbnail */
.mini-cube {
  width: 48px;
  height: 48px;
  position: relative;
  transform-style: preserve-3d;
  animation: rotateMiniCube 4s linear infinite;
}

.cube-face {
  position: absolute;
  width: 28px;
  height: 28px;
}

.cube-top {
  background: rgba(124, 110, 246, 0.7);
  top: 0;
  left: 10px;
  transform: rotateX(60deg) rotateZ(45deg);
}

.cube-left {
  background: rgba(124, 110, 246, 0.45);
  bottom: 0;
  left: 0;
  transform: skewY(15deg);
}

.cube-right {
  background: rgba(124, 110, 246, 0.25);
  bottom: 0;
  right: 0;
  transform: skewY(-15deg);
}

@keyframes rotateMiniCube {
  from { transform: rotateY(0deg); }
  to   { transform: rotateY(360deg); }
}

/* Card meta row */
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.format-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.badge-glb  { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.badge-gltf { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.badge-obj  { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.badge-fbx  { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }

.card-size {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
