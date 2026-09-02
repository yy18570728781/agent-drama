<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})
</script>

<template>
  <div class="waypoint-root relative flex items-center justify-center w-[14px] h-[14px] group overflow-visible">
    <div
      class="waypoint-dot absolute w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center pointer-events-auto transition-all group-hover:scale-110 z-[50]"
      style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
      :style="{ borderColor: selected ? '#6366f1' : '#c7d2fe', boxShadow: selected ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none' }"
    >
      <div
        class="w-[6px] h-[6px] rounded-full transition-colors pointer-events-none"
        :style="{ backgroundColor: selected ? '#6366f1' : '#818cf8' }"
      />
    </div>

    <Handle
      id="target"
      type="target"
      :position="Position.Left"
      class="waypoint-target-handle"
    />
    <Handle
      id="source"
      type="source"
      :position="Position.Right"
      class="waypoint-source-handle"
    />
  </div>
</template>

<style scoped>
.waypoint-dot {
  background: #818cf8;
}
.waypoint-root:hover .waypoint-dot {
  box-shadow: 0 0 8px rgba(129, 140, 248, 0.6);
}

:deep(.vue-flow__handle.waypoint-target-handle),
:deep(.vue-flow__handle.waypoint-source-handle) {
  width: 1px !important;
  height: 1px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: none !important;
  background: transparent !important;
  opacity: 1 !important;
  top: 50% !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 10;
  cursor: crosshair !important;
}

:deep(.vue-flow__handle.waypoint-target-handle) {
  left: calc(50% - 7px) !important;
  transform: translate(-50%, -50%) !important;
}

:deep(.vue-flow__handle.waypoint-source-handle) {
  right: calc(50% - 7px) !important;
  transform: translate(50%, -50%) !important;
}

:deep(.vue-flow__handle.waypoint-target-handle::before) {
  content: '';
  position: absolute;
  top: 50%;
  right: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 72px;
  background: transparent;
  cursor: crosshair;
}

:deep(.vue-flow__handle.waypoint-source-handle::before) {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 72px;
  background: transparent;
  cursor: crosshair;
}

:deep(.vue-flow__handle.waypoint-target-handle::after),
:deep(.vue-flow__handle.waypoint-source-handle::after) {
  display: none !important;
}
</style>
