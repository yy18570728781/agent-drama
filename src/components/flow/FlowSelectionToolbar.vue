<template>
  <!-- 选择工具栏（多选时跟随连接锚点下方；组选中时顶部居中） -->
  <Transition name="fade-slide">
    <div
      v-if="showToolbar"
      class="selection-toolbar"
      :class="{ 'is-follow-hotspot': shouldFollowHotspot }"
      :style="toolbarStyle"
      @mouseleave="toolbarDropdown = null"
    >
        <button
          class="toolbar-btn texture-tool-btn"
          :class="{ 'opacity-30 pointer-events-none': !canOpenTextureMaterialTool || openingTextureMaterialTool }"
          title="打开到 3D 材质工具"
          @click="openTextureMaterialTool"
        >
          <Package class="w-4 h-4" />
        </button>

        <!-- 对齐下拉 -->
        <div class="toolbar-dropdown" @mouseenter="toolbarDropdown = 'align'">
          <button
            class="toolbar-btn toolbar-trigger"
            :class="{ 'opacity-30 pointer-events-none': effectiveNodes.length < 2 }"
            title="对齐"
          >
            <AlignStartVertical class="w-4 h-4" />
            <ChevronDown class="w-3 h-3 toolbar-chevron" />
          </button>
          <div v-if="toolbarDropdown === 'align' && effectiveNodes.length >= 2" class="toolbar-submenu">
            <button class="toolbar-submenu-item" @click="emitAction('align', 'alignLeft')">
              <AlignStartVertical class="w-4 h-4" /><span>左对齐</span><span class="shortcut-hint">Shift+A</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('align', 'alignRight')">
              <AlignEndVertical class="w-4 h-4" /><span>右对齐</span><span class="shortcut-hint">Shift+D</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('align', 'alignTop')">
              <AlignStartHorizontal class="w-4 h-4" /><span>顶对齐</span><span class="shortcut-hint">Shift+W</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('align', 'alignBottom')">
              <AlignEndHorizontal class="w-4 h-4" /><span>底对齐</span><span class="shortcut-hint">Shift+S</span>
            </button>
          </div>
        </div>

        <!-- 分布下拉 -->
        <div class="toolbar-dropdown" @mouseenter="toolbarDropdown = 'distribute'">
          <button
            class="toolbar-btn toolbar-trigger"
            :class="{ 'opacity-30 pointer-events-none': effectiveNodes.length < 3 }"
            title="等间距分布"
          >
            <AlignHorizontalDistributeCenter class="w-4 h-4" />
            <ChevronDown class="w-3 h-3 toolbar-chevron" />
          </button>
          <div v-if="toolbarDropdown === 'distribute' && effectiveNodes.length >= 3" class="toolbar-submenu">
            <button class="toolbar-submenu-item" @click="emitAction('distribute', 'horizontal')">
              <AlignHorizontalDistributeCenter class="w-4 h-4" /><span>水平等间距</span><span class="shortcut-hint">Shift+H</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('distribute', 'vertical')">
              <AlignVerticalDistributeCenter class="w-4 h-4" /><span>垂直等间距</span><span class="shortcut-hint">Shift+V</span>
            </button>
          </div>
        </div>

        <!-- 布局下拉 -->
        <div class="toolbar-dropdown" @mouseenter="toolbarDropdown = 'layout'">
          <button class="toolbar-btn toolbar-trigger" title="布局">
            <Workflow class="w-4 h-4" />
            <ChevronDown class="w-3 h-3 toolbar-chevron" />
          </button>
          <div v-if="toolbarDropdown === 'layout'" class="toolbar-submenu">
            <button class="toolbar-submenu-item" @click="emitAction('autoLayout')">
              <Workflow class="w-4 h-4" /><span>自动布局</span><span class="shortcut-hint">Ctrl+Shift+P</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('tidyNodes')">
              <LayoutGrid class="w-4 h-4" /><span>整理对齐</span><span class="shortcut-hint">Ctrl+P</span>
            </button>
          </div>
        </div>

        <!-- 颜色标记下拉 -->
        <div class="toolbar-dropdown" @mouseenter="toolbarDropdown = 'highlight'">
          <button class="toolbar-btn toolbar-trigger" title="颜色标记">
            <span class="highlight-dot" />
            <ChevronDown class="w-3 h-3 toolbar-chevron" />
          </button>
          <div v-if="toolbarDropdown === 'highlight'" class="toolbar-submenu">
            <button class="toolbar-submenu-item" @click="emitAction('applyHighlight', 0)">
              <span class="highlight-color-swatch" style="background:#ec4899" /><span>玫红</span><span class="shortcut-hint">Ctrl+1</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('applyHighlight', 1)">
              <span class="highlight-color-swatch" style="background:#6366f1" /><span>靛蓝</span><span class="shortcut-hint">Ctrl+2</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('applyHighlight', 2)">
              <span class="highlight-color-swatch" style="background:#10b981" /><span>翠绿</span><span class="shortcut-hint">Ctrl+3</span>
            </button>
            <button class="toolbar-submenu-item" @click="emitAction('applyHighlight', 3)">
              <span class="highlight-color-swatch" style="background:#f59e0b" /><span>琥珀</span><span class="shortcut-hint">Ctrl+4</span>
            </button>
          </div>
        </div>

      <!-- 清除颜色 -->
      <button class="toolbar-btn" title="清除颜色标记" @click="emitAction('clearHighlight')">
        <X class="w-4 h-4" />
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  ChevronDown,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Workflow,
  LayoutGrid,
  Package,
  X,
} from '@/components/common/icon/lucide'
import { useSelectionTextureMaterialTool } from './useSelectionTextureMaterialTool'

const props = defineProps({
  selectedNodes: { type: Array, default: () => [] },
  selectedGroupNodeForToolbar: { type: Object, default: null },
  selectedGroupChildNodes: { type: Array, default: () => [] },
  isSelectedGroupCollapsed: { type: Boolean, default: false },
  showGroupAlignmentToolbar: { type: Boolean, default: false },
  multiSelectionToolbarStyle: { type: Object, default: null },
})

const emit = defineEmits([
  'align', 'distribute', 'autoLayout', 'tidyNodes',
  'groupAlign', 'groupDistribute', 'groupAutoLayout', 'groupTidyNodes',
  'applyHighlight', 'clearHighlight',
])

const toolbarDropdown = ref(null)

const isGroupMode = computed(() => !!props.selectedGroupNodeForToolbar)

const effectiveNodes = computed(() =>
  isGroupMode.value ? props.selectedGroupChildNodes : props.selectedNodes,
)

const {
  openingTextureMaterialTool,
  canOpenTextureMaterialTool,
  openTextureMaterialTool,
} = useSelectionTextureMaterialTool({ nodes: effectiveNodes })

const showToolbar = computed(() => {
  if (isGroupMode.value) {
    return props.showGroupAlignmentToolbar && !props.isSelectedGroupCollapsed
  }
  return props.selectedNodes.length >= 2
})

// 多选模式且有选区边界时，工具栏锚定在连接锚点下方；其它情况退回顶部居中
const shouldFollowHotspot = computed(() =>
  !isGroupMode.value && !!props.multiSelectionToolbarStyle,
)

const toolbarStyle = computed(() => {
  if (shouldFollowHotspot.value) return props.multiSelectionToolbarStyle
  return {
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
  }
})

function emitAction(action, ...args) {
  toolbarDropdown.value = null
  const prefix = isGroupMode.value ? 'group' : ''
  const key = prefix
    ? ('group' + action.charAt(0).toUpperCase() + action.slice(1))
    : action
  emit(key, ...args)
}

function closeDropdowns() {
  toolbarDropdown.value = null
}

defineExpose({ closeDropdowns })
</script>

<style scoped>
.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  transition: all 0.15s ease;
  cursor: pointer;
  border: none;
  background: transparent;
  flex-shrink: 0;
}
.toolbar-btn:hover:not(.opacity-30) {
  color: #fff;
  background: #27272a;
}
.toolbar-btn:active:not(.opacity-30) {
  background: #3f3f46;
  transform: scale(0.92);
}

.selection-toolbar {
  position: absolute;
  z-index: 31;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: rgba(24, 24, 27, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid #27272a;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.toolbar-dropdown {
  position: relative;
}
.toolbar-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  width: auto;
  padding: 0 4px;
}
.toolbar-chevron {
  opacity: 0.5;
}
.toolbar-submenu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0;
  min-width: 170px;
  background: rgba(24, 24, 27, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid #27272a;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  padding: 4px;
  z-index: 100;
}
.toolbar-submenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 5px;
  color: #a1a1aa;
  font-size: 12px;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  white-space: nowrap;
}
.toolbar-submenu-item:hover {
  background: #27272a;
  color: #fff;
}
.shortcut-hint {
  margin-left: auto;
  color: #52525b;
  font-size: 11px;
  font-family: monospace;
}
.highlight-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: conic-gradient(#ec4899, #6366f1, #10b981, #f59e0b, #ec4899);
  flex-shrink: 0;
}
.highlight-color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}
</style>
