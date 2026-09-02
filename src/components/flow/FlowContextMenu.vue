<script setup lang="ts">
import { computed } from 'vue'
import {
  Shield,
  Box,
  Star,
  Trash2,
  ChevronsLeft,
  Layers,
  LayoutGrid,
} from '@/components/common/icon/lucide'
import { buildFlowCreationMenuItems } from '@/utils/flowCreationMenu'
import type { FlowCreationMenuItem } from '@/utils/flowCreationMenu'

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  canvasX?: number
  canvasY?: number
}

const props = withDefaults(defineProps<{
  contextMenu: ContextMenuState
  ctxSubmenu: string | null
  selectedNodes: any[]
  batchInferUpstream: () => void
  ungroupSelected: () => void
  groupSelected: () => void
  packToBatch?: (nodes: any[]) => void
  createSubgraph: () => void
  createEmptySubgraph: () => void
  forceRepairSelectedNodes: () => void
  hasSelectedResultRecords?: boolean
  areSelectedResultRecordsFavorited?: boolean
  toggleSelectedResultFavorites?: () => void
  deleteSelectedResultRecords?: () => void
  addNodeFromContext: (item: FlowCreationMenuItem) => void
  contextMenuPrimaryNodes?: FlowCreationMenuItem[]
  contextMenuOtherNodes?: FlowCreationMenuItem[]
  contextMenuGenerationNodes?: FlowCreationMenuItem[]
  allowSubgraphCreate?: boolean
}>(), {
  contextMenuPrimaryNodes: () => [],
  contextMenuOtherNodes: () => [],
  contextMenuGenerationNodes: () => [],
  allowSubgraphCreate: true,
  hasSelectedResultRecords: false,
  areSelectedResultRecordsFavorited: false,
  toggleSelectedResultFavorites: () => {},
  deleteSelectedResultRecords: () => {},
  packToBatch: () => {},
})

const emit = defineEmits<{
  'update:ctxSubmenu': [value: string | null]
  close: []
}>()

const orderedCreationNodes = computed(() => {
  return buildFlowCreationMenuItems([
    ...props.contextMenuGenerationNodes,
    ...props.contextMenuPrimaryNodes,
  ])
})

async function onAction(fn: () => void | Promise<void>) {
  await fn()
  emit('close')
}
</script>

<template>
  <Transition name="fade-slide">
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
    >
      <div class="context-menu-scroll">
        <template v-if="orderedCreationNodes.length > 0">
          <div
            v-for="item in orderedCreationNodes"
            :key="item.key || `${item.type}-${item.label}`"
            class="context-menu-item"
            @click="onAction(() => addNodeFromContext(item))"
          >
            <component :is="item.icon" class="w-4 h-4" :class="item.color" />
            <span>{{ item.label }}</span>
            <span v-if="item.type === 'annotation_note'" class="ctx-shortcut">T</span>
          </div>
          <div class="context-menu-divider"></div>
        </template>
        <div
          v-if="allowSubgraphCreate"
          class="context-menu-item"
          @click="onAction(createEmptySubgraph)"
        >
          <Box class="w-4 h-4 text-indigo-400" />
          <span>新建子图</span>
        </div>
        <div
          v-if="selectedNodes.length >= 1 && allowSubgraphCreate"
          class="context-menu-item"
          @click="onAction(createSubgraph)"
        >
          <Box class="w-4 h-4 text-indigo-400" />
          <span>打成子图</span>
        </div>
        <template v-if="contextMenuOtherNodes.length > 0">
          <div
            v-for="item in contextMenuOtherNodes"
            :key="item.key || `${item.type}-${item.label}`"
            class="context-menu-item"
            @click="onAction(() => addNodeFromContext(item))"
          >
            <component :is="item.icon" class="w-4 h-4" :class="item.color" />
            <span>{{ item.label }}</span>
          </div>
        </template>

        <template v-if="selectedNodes.length >= 1">
          <div class="context-menu-divider"></div>
          <div
            v-if="hasSelectedResultRecords"
            class="context-menu-item"
            @click="onAction(toggleSelectedResultFavorites)"
          >
            <Star class="w-4 h-4 text-amber-400" />
            <span>{{ areSelectedResultRecordsFavorited ? '取消收藏结果' : '收藏结果' }}</span>
          </div>
          <div
            v-if="hasSelectedResultRecords"
            class="context-menu-item"
            @click="onAction(deleteSelectedResultRecords)"
          >
            <Trash2 class="w-4 h-4 text-red-400" />
            <span>删除节点</span>
          </div>
          <div class="context-menu-item" @click="onAction(batchInferUpstream)">
            <ChevronsLeft class="w-4 h-4 text-amber-400" />
            <span>批量反推上游</span>
          </div>
          <div
            v-if="selectedNodes.length >= 1"
            class="context-menu-item"
            @click="onAction(forceRepairSelectedNodes)"
          >
            <Shield class="w-4 h-4 text-orange-400" />
            <span>强制修复</span>
          </div>
          <div class="context-menu-item" @click="onAction(groupSelected)">
            <Layers class="w-4 h-4 text-zinc-400" />
            <span>将选中节点打组</span>
          </div>
          <div
            v-if="selectedNodes.length >= 2"
            class="context-menu-item"
            @click="onAction(() => packToBatch(selectedNodes))"
          >
            <LayoutGrid class="w-4 h-4 text-zinc-400" />
            <span>打包为批量节点</span>
          </div>
          <div
            v-if="selectedNodes.some(node => node?.type === 'groupNode')"
            class="context-menu-item"
            @click="onAction(ungroupSelected)"
          >
            <Layers class="w-4 h-4 text-zinc-400" />
            <span>取消打组</span>
            <span class="ctx-shortcut">Ctrl+Shift+G</span>
          </div>
        </template>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 右键菜单 */
.context-menu {
  position: fixed;
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

.context-menu-divider {
  height: 1px;
  background: #27272a;
  margin: 6px 4px;
}

/* 右键菜单二级菜单 */
.context-submenu-wrap {
  position: relative;
}

.context-submenu-trigger {
  position: relative;
}

.submenu-arrow {
  flex-shrink: 0;
}

.context-submenu {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 1px;
  min-width: 164px;
  background: rgba(24, 24, 27, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid #27272a;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  padding: 2px;
  z-index: 300;
}

.ctx-shortcut {
  margin-left: auto;
  color: #52525b;
  font-size: 9px;
  font-family: monospace;
}

/* 过渡动画 */
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
