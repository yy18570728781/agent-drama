<template>
  <div class="left-toolbar">
    <div class="toolbar-top">
      <button
        class="toolbar-icon"
        :class="{ active: showSettingsPanel }"
        @click="togglePanel('settings')"
        title="个性化配置"
      >
        <Palette :size="18" />
      </button>
      <button
        class="toolbar-icon"
        :class="{ active: showShortcutsModal }"
        @click="togglePanel('shortcuts')"
        title="快捷键"
      >
        <Keyboard :size="18" />
      </button>
    </div>

    <div class="toolbar-divider-h" />

    <div class="toolbar-bottom">
      <button
        class="toolbar-icon"
        :class="{ active: showAssetsPanel }"
        @click="togglePanel('assets')"
        title="资产"
      >
        <FolderOpen :size="18" />
      </button>
      <button
        class="toolbar-icon"
        :class="{ active: showSubgraphPanel }"
        @click="togglePanel('subgraph')"
        title="子图导航"
      >
        <Network :size="18" />
      </button>
      <FlowToolboxButton :active="showToolboxPanel" @toggle="togglePanel('toolbox')" />
    </div>
  </div>

  <FlowAssetsPanel
    v-model:visible="showAssetsPanel"
    :model-nodes="modelNodes"
    @drop-asset="$emit('drop-asset', $event)"
    @focus-node="$emit('focus-node', $event)"
  />

  <FlowSubgraphPanel
    v-model:visible="showSubgraphPanel"
    :active-graph-id="activeGraphId"
    :active-path-labels="outlinePathLabels"
    :outline-tree="outlineTree"
    :expanded-keys="outlineExpandedKeys"
    @refresh="$emit('outline-refresh')"
    @select="$emit('outline-select', $event)"
  />

  <Transition name="slide">
    <div v-if="showToolboxPanel" class="toolbox-slide-panel">
      <div class="toolbox-slide-panel__header">
        <span class="toolbox-slide-panel__title">工具箱</span>
        <button class="toolbox-slide-panel__close" @click="showToolboxPanel = false">×</button>
      </div>
      <div class="toolbox-slide-panel__body">
        <button class="toolbox-tool-item" @click="openToolboxCompress">
          <Upload :size="16" />
          <span class="toolbox-tool-item__name">压缩工具</span>
        </button>
      </div>
    </div>
  </Transition>

  <FlowSettingsPanel v-model:visible="showSettingsPanel" />

  <FlowShortcutsModal
    v-model:visible="showShortcutsModal"
    @update:shortcuts="$emit('update:shortcuts', $event)"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FolderOpen, Keyboard, Network, Palette, Upload } from 'lucide-vue-next'
import FlowAssetsPanel from './FlowAssetsPanel.vue'
import FlowSettingsPanel from './FlowSettingsPanel.vue'
import FlowShortcutsModal from './FlowShortcutsModal.vue'
import FlowSubgraphPanel from './FlowSubgraphPanel.vue'
import FlowToolboxButton from './FlowToolboxButton.vue'
import { openImageCompressDialog } from '@/utils/imageCompressDialogService'
import { setPendingToolboxFiles } from '@/composables/flow/flowToolboxState'
import type { ProjectExample } from '@/composables/flow/projectExample.types'

defineOptions({ inheritAttrs: false })

type OutlineNode = {
  graphId: string
  label: string
  nodeCount: number
  descendantCount: number
  children: OutlineNode[]
}

defineProps<{
  modelNodes: unknown[]
  activeGraphId: string
  outlineExpandedKeys: string[]
  outlinePathLabels: string[]
  outlineTree: OutlineNode[]
  projectExamples: ProjectExample[]
}>()

defineEmits<{
  'drop-asset': [data: unknown]
  'focus-node': [nodeId: string]
  'update:shortcuts': [shortcuts: Record<string, unknown>]
  'outline-select': [graphId: string]
  'outline-refresh': []
  'save-example': [payload: unknown]
  'load-example': [payload: unknown]
  'overwrite-example': [payload: unknown]
  'delete-example': [payload: unknown]
  'rename-example': [id: string, name: string]
}>()

const showAssetsPanel = ref(false)
const showSubgraphPanel = ref(false)
const showSettingsPanel = ref(false)
const showToolboxPanel = ref(false)
const showShortcutsModal = ref(false)

function togglePanel(panel: 'assets' | 'subgraph' | 'settings' | 'toolbox' | 'shortcuts') {
  showAssetsPanel.value = panel === 'assets' ? !showAssetsPanel.value : false
  showSubgraphPanel.value = panel === 'subgraph' ? !showSubgraphPanel.value : false
  showSettingsPanel.value = panel === 'settings' ? !showSettingsPanel.value : false
  showToolboxPanel.value = panel === 'toolbox' ? !showToolboxPanel.value : false
  showShortcutsModal.value = panel === 'shortcuts' ? !showShortcutsModal.value : false
}

function closeAllPanels() {
  showAssetsPanel.value = false
  showSubgraphPanel.value = false
  showSettingsPanel.value = false
  showToolboxPanel.value = false
  showShortcutsModal.value = false
}

async function openToolboxCompress() {
  showToolboxPanel.value = false
  const prepared = await openImageCompressDialog([], undefined, { allowEmpty: true })
  if (!prepared?.length) return

  setPendingToolboxFiles(prepared)
}

defineExpose({ closeAllPanels })
</script>

<style scoped>
.left-toolbar {
  position: absolute;
  top: var(--flow-floating-edge);
  left: var(--flow-floating-edge);
  z-index: 200;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(24, 24, 27, 0.78);
  backdrop-filter: blur(10px);
  border: 1px solid #27272a;
  border-radius: 10px;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.28);
}

.toolbar-top,
.toolbar-bottom {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1px;
}

.toolbar-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toolbar-icon:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

.toolbar-icon.active {
  background: rgba(129, 140, 248, 0.15);
  color: #818cf8;
}

.toolbar-divider-h {
  width: 1px;
  height: 18px;
  background: #27272a;
  margin: 0 3px;
}

.toolbox-slide-panel {
  position: absolute;
  left: 24px;
  top: 80px;
  bottom: 24px;
  width: 292px;
  display: flex;
  flex-direction: column;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  z-index: 150;
  overflow: hidden;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.22);
}

.toolbox-slide-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
}

.toolbox-slide-panel__title {
  color: #f4f4f5;
  font-size: 13px;
  font-weight: 600;
}

.toolbox-slide-panel__close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
}

.toolbox-slide-panel__close:hover {
  color: #fff;
  background: #27272a;
}

.toolbox-slide-panel__body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
}

.toolbox-tool-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #27272a;
  background: #1f1f23;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.toolbox-tool-item:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  color: #f4f4f5;
}

.toolbox-tool-item__name {
  font-size: 13px;
  font-weight: 600;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>
