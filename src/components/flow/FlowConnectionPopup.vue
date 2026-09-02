<template>
  <Transition name="fade-slide">
    <div
      v-if="connectionPopup.visible"
      class="context-menu"
      :style="{ left: `${connectionPopup.x}px`, top: `${connectionPopup.y}px` }"
    >
      <div class="context-menu-scroll">
        <div
          v-for="item in visibleCreationNodes"
          :key="item.key || `${item.type}-${item.label}`"
          class="context-menu-item"
          @click="addNode(item)"
        >
          <component :is="item.icon" class="w-4 h-4" :class="item.color" />
          <span>{{ item.label }}</span>
          <span v-if="item.type === 'annotation_note'" class="ctx-shortcut">T</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildFlowCreationMenuItems } from '@/utils/flowCreationMenu'
import type { FlowCreationMenuItem } from '@/utils/flowCreationMenu'

interface ConnectionPopupState {
  visible: boolean
  x: number
  y: number
}

const props = defineProps<{
  connectionPopup: ConnectionPopupState
  contextMenuNodes: FlowCreationMenuItem[]
  addNodeFromConnection: (item: FlowCreationMenuItem) => void
}>()

const visibleCreationNodes = computed(() => buildFlowCreationMenuItems(props.contextMenuNodes))

function addNode(item: FlowCreationMenuItem) {
  props.addNodeFromConnection(item)
}
</script>

<style scoped>
.context-menu {
  position: absolute;
  z-index: 2000;
  background: rgba(24, 24, 27, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 6px;
  width: 208px;
  overflow: visible;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.context-menu-scroll {
  max-height: min(70vh, 620px);
  overflow-y: auto;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: #d4d4d8;
  font-size: 12px;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: #27272a;
}

.ctx-shortcut {
  margin-left: auto;
  color: #52525b;
  font-size: 9px;
  font-family: monospace;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
