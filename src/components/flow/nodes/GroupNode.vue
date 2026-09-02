<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { useVueFlow } from '@vue-flow/core'
import '@vue-flow/node-resizer/dist/style.css'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { GROUP_AGGREGATE_SOURCE_HANDLE, GROUP_EXPANDED_SOURCE_HANDLE } from '@/composables/flow/groupConnection.constants'
import { useGroupNodeLayout } from './useGroupNodeLayout'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const { updateNodeInternals, updateNodeData, getNodes } = useVueFlow()
const { showNodeTitle } = useTheme()
const CONNECTION_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 30 30'%3E%3Ccircle cx='15' cy='15' r='8.5' fill='none' stroke='rgba(129,140,248,0.42)' stroke-width='1.5'/%3E%3Cpath d='M15 9.5v11M9.5 15h11' stroke='%23818cf8' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='15' cy='15' r='2.5' fill='%2338bdf8' fill-opacity='0.95'/%3E%3C/svg%3E") 24 24, crosshair`

const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const isEditing = ref(false)
const title = ref(props.data.label || 'Group')

const colors = inject('groupPresetColors')
const flowUpdateGroupColor = inject('flowUpdateGroupColor', null)
const flowStartGroupConnection = inject('flowStartGroupConnection', null)
const flowSetGroupConnectionIntent = inject('flowSetGroupConnectionIntent', null)
const flowClearGroupConnectionIntent = inject('flowClearGroupConnectionIntent', null)
const flowToggleGroupCollapse = inject('flowToggleGroupCollapse', null)
const flowToggleGroupLock = inject('flowToggleGroupLock', null)
const flowLayoutGridChildren = inject('flowLayoutGridChildren', null)
const flowSaveHistory = inject('flowSaveHistory', null)
const flowViewportZoom = inject('flowViewportZoom', computed(() => 1))

// 颜色选择器的背景色（使用第一个颜色预设）
const pickerBgColor = 'rgba(39, 39, 42, 0.9)'

// 初始化背景色：如果未设置则随机选择
const bgColor = ref(props.data.bgColor)
const isCollapsed = computed(() => !!props.data?.collapsed)
const isLocked = computed(() => !!props.data?.locked)
const headerScaleStyle = computed(() => {
  const zoom = Math.max(Number(flowViewportZoom.value || 1), 0.01)
  const inverseScale = Math.min(Math.max(1 / zoom, 1), 4)
  return {
    transform: `scale(${inverseScale})`,
    transformOrigin: 'left bottom',
  }
})

const lockScaleStyle = computed(() => {
  const zoom = Math.max(Number(flowViewportZoom.value || 1), 0.01)
  const inverseScale = Math.min(Math.max(1 / zoom, 1), 4)
  return {
    transform: `translateX(-50%) scale(${inverseScale})`,
    transformOrigin: 'top center',
  }
})

const shaperScaleStyle = computed(() => {
  const zoom = Math.max(Number(flowViewportZoom.value || 1), 0.01)
  const inverseScale = Math.min(Math.max(1 / zoom, 1), 4)
  return {
    transform: `scale(${inverseScale})`,
    transformOrigin: 'top left',
  }
})

onMounted(() => {
  if (!bgColor.value) {
    const randomColor = colors.value[Math.floor(Math.random() * colors.value.length)]
    bgColor.value = randomColor
    props.data.bgColor = randomColor
  }

})

const customColorHex = computed(() => {
  if (bgColor.value.startsWith('#')) return bgColor.value
  const match = bgColor.value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#27272a'
})

function handleCustomColor(event) {
  const hex = event.target.value
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const newColor = `rgba(${r}, ${g}, ${b}, 0.5)`
  changeColor(newColor)
}

function saveTitle() {
  isEditing.value = false
  updateNodeData(props.id, { label: title.value })
  flowSaveHistory?.()
}

watch(() => props.data.bgColor, (newVal) => {
  if (newVal && newVal !== bgColor.value) {
    bgColor.value = newVal
  }
})

function changeColor(color) {
  bgColor.value = color
  props.data.bgColor = color
  flowUpdateGroupColor?.(props.id, color)
}

function handleConnectorPointerDown(event, handleId = GROUP_EXPANDED_SOURCE_HANDLE) {
  if (event?.target?.closest?.('.vue-flow__handle')) return
  event?.preventDefault?.()
  event?.stopPropagation?.()
  flowStartGroupConnection?.(props.id, event, handleId)
}

function handleConnectorEnter() {
  flowSetGroupConnectionIntent?.(props.id)
}

function handleConnectorLeave() {
  flowClearGroupConnectionIntent?.(props.id)
}

function toggleCollapsed() {
  flowToggleGroupCollapse?.(props.id)
}

function toggleLock() {
  flowToggleGroupLock?.(props.id)
}

const { isGridMode, gridCols, incCols, decCols } = useGroupNodeLayout({
  id: props.id,
  data: props.data,
  getNodes,
  updateNodeData,
  updateNodeInternals,
  layoutGridChildren: flowLayoutGridChildren,
  saveHistory: flowSaveHistory,
})

</script>

<template>
  <div
    class="group-node animate-node-enter relative w-full h-full rounded-xl border-2 border-dashed transition-colors"
    :class="[selected ? 'border-indigo-500' : 'border-zinc-700']"
    :style="{ backgroundColor: bgColor }"
    @animationend="onAnimationEnd"
  >
    <NodeResizer :is-visible="selected && !isCollapsed" min-width="200" min-height="100" />
    <div class="group-connector-zone">
      <!-- 聚合输出端口：只连组节点本身，下游生成时按组内文件批量输出新的分组 -->
      <div
        class="group-connector-hotspot group-connector-aggregate nodrag"
        :style="{ cursor: CONNECTION_CURSOR }"
        @mouseenter="handleConnectorEnter"
        @mouseleave="handleConnectorLeave"
        @pointerdown="(event) => handleConnectorPointerDown(event, GROUP_AGGREGATE_SOURCE_HANDLE)"
      >
        <span class="group-connector-label">分组连接</span>
        <span class="group-connector-plus">+</span>
        <Handle
          type="source"
          :position="Position.Right"
          :id="GROUP_AGGREGATE_SOURCE_HANDLE"
          class="group-output-handle group-output-handle-aggregate nodrag"
        />
      </div>
      <!-- 展开输出端口：拖出后把组内子节点逐个连到目标节点 -->
      <div
        class="group-connector-hotspot group-connector-expanded nodrag"
        :style="{ cursor: CONNECTION_CURSOR }"
        @mouseenter="handleConnectorEnter"
        @mouseleave="handleConnectorLeave"
        @pointerdown="(event) => handleConnectorPointerDown(event, GROUP_EXPANDED_SOURCE_HANDLE)"
      >
        <span class="group-connector-label">节点连接</span>
        <span class="group-connector-plus">+</span>
        <Handle
          type="source"
          :position="Position.Right"
          :id="GROUP_EXPANDED_SOURCE_HANDLE"
          class="group-output-handle group-output-handle-expanded nodrag"
        />
      </div>
    </div>

    <div class="group-header absolute -top-10 left-0 flex items-center gap-2" :style="headerScaleStyle">
      <button
        class="group-collapse-btn nodrag"
        :title="isCollapsed ? '展开分组' : '折叠分组'"
        @click.stop="toggleCollapsed"
        @pointerdown.stop
      >
        {{ isCollapsed ? '▸' : '▾' }}
      </button>
      <template v-if="showNodeTitle">
        <span
          v-if="!isEditing"
          class="text-xl font-bold text-zinc-400 hover:text-zinc-200 cursor-text px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors"
          @dblclick="isEditing = true"
        >
          {{ title }}
        </span>
        <input
          v-else
          v-model="title"
          class="text-xl font-bold bg-zinc-800 text-zinc-200 px-2 py-1 rounded outline-none border border-indigo-500"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          @keydown.stop
          @mousedown.stop
          @pointerdown.stop
          autofocus
        />
      </template>

      <!-- Color Picker (visible when selected) -->
      <div v-if="selected" class="color-picker-container">
        <div
          v-for="color in colors"
          :key="color"
          class="color-dot"
          :class="{ 'ring-2 ring-white': bgColor === color }"
          :style="{ backgroundColor: color }"
          @click="changeColor(color)"
        />
        <div class="color-divider" />
        <div
          class="color-dot custom-color-dot"
          :style="{ backgroundColor: customColorHex }"
          title="自定义颜色"
        >
          <input
            type="color"
            :value="customColorHex"
            class="color-input"
            @input="handleCustomColor"
          />
        </div>
      </div>

      <!-- 列数调整已移到组体左下角（见下方 .grid-shaper-bottom） -->
    </div>

    <!-- 底部居中锁定按钮 -->
    <button
      v-if="selected && !isCollapsed"
      class="group-lock-btn nodrag"
      :class="{ locked: isLocked }"
      :style="lockScaleStyle"
      :title="isLocked ? '解除分组锁定' : '锁定分组内节点'"
      @click.stop="toggleLock"
      @pointerdown.stop
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      </svg>
      <span v-if="isLocked" class="lock-badge" />
    </button>

    <!-- 底部左下角列数调整（行数按子节点数自动推导） -->
    <div
      v-if="selected && !isCollapsed && isGridMode"
      class="grid-shaper grid-shaper-bottom nodrag"
      :style="shaperScaleStyle"
      @pointerdown.stop
    >
      <span class="gs-label">列</span>
      <button class="gs-btn" title="减少列" @click.stop="decCols">−</button>
      <span class="gs-value">{{ gridCols }}</span>
      <button class="gs-btn" title="增加列" @click.stop="incCols">+</button>
    </div>
  </div>
</template>

<style scoped>
.group-node {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  border: 2px dashed #9AA2AA;
  transition: border-color 0.2s;
  cursor: grab;
  overflow: visible;
}

.group-connector-zone {
  position: absolute;
  right: -30px;
  top: 0;
  bottom: 36px;
  width: 60px;
  z-index: 40;
  pointer-events: none;
}

.group-connector-hotspot {
  position: absolute;
  right: 0;
  top: 0;
  height: 50%;
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  pointer-events: all;
}

.group-connector-aggregate {
  top: 0;
  color: #38bdf8;
}

.group-connector-expanded {
  top: 50%;
  bottom: 0;
  height: auto;
  color: #a78bfa;
}

.group-output-handle {
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.group-connector-zone:hover .group-output-handle,
.group-connector-zone:focus-within .group-output-handle {
  opacity: 1;
}

.group-connector-label {
  position: absolute;
  right: 18px;
  padding: 14px 3px;
  border-radius: 9px;
  border: 1px solid currentColor;
  background: rgba(24, 24, 27, 0.9);
  color: currentColor;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.08;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 1px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(0);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.group-connector-aggregate .group-connector-label {
  bottom: calc(50% + 16px);
}

.group-connector-expanded .group-connector-label {
  top: calc(50% + 16px);
}

.group-connector-plus {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid currentColor;
  background: rgba(24, 24, 27, 0.95);
  color: currentColor;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.45);
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.group-connector-zone:hover .group-connector-label,
.group-connector-zone:focus-within .group-connector-label {
  opacity: 1;
}

.group-connector-zone:hover .group-connector-plus,
.group-connector-zone:focus-within .group-connector-plus {
  opacity: 1;
  transform: scale(1);
}

.group-output-handle::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 9999px;
  border: 2px solid rgba(129, 140, 248, 0.52);
  animation: group-output-pulse 1.6s ease-out infinite;
}

.group-output-handle-aggregate::before {
  border-color: rgba(56, 189, 248, 0.66);
}

.group-output-handle-expanded::before {
  border-style: dashed;
  border-color: rgba(167, 139, 250, 0.66);
}

@keyframes group-output-pulse {
  0% {
    transform: scale(0.88);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

.group-node.selected {
  border-color: #6366f1;
}

.group-header {
  position: absolute;
  top: -40px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  /* 标题栏需要接收点击 */
  pointer-events: auto;
}

.group-collapse-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  background: rgba(24, 24, 27, 0.92);
  color: #d4d4d8;
  font-size: 16px;
  line-height: 1;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.group-collapse-btn:hover {
  background: rgba(39, 39, 42, 0.98);
  border-color: rgba(99, 102, 241, 0.72);
  color: #ffffff;
}

.group-layout-btn {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  background: rgba(24, 24, 27, 0.92);
  color: #d4d4d8;
  font-size: 12px;
  line-height: 1;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.group-layout-btn:hover {
  background: rgba(39, 39, 42, 0.98);
  border-color: rgba(99, 102, 241, 0.72);
  color: #ffffff;
}

.group-layout-btn.active {
  background: rgba(99, 102, 241, 0.22);
  border-color: rgba(99, 102, 241, 0.72);
  color: #c7d2fe;
}

/* 行列 +/− 调整器 */
.grid-shaper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border-radius: 9999px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  background: rgba(24, 24, 27, 0.92);
  color: #d4d4d8;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.grid-shaper-bottom {
  position: absolute;
  bottom: -36px;
  left: 6px;
  z-index: 41;
}
.gs-label {
  color: #a1a1aa;
  font-size: 11px;
}
.gs-label-cols {
  margin-left: 6px;
}
.gs-value {
  min-width: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: #c7d2fe;
}
.gs-btn {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  background: rgba(39, 39, 42, 0.95);
  color: #d4d4d8;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.gs-btn:hover {
  background: rgba(99, 102, 241, 0.32);
  border-color: rgba(99, 102, 241, 0.72);
  color: #ffffff;
}

.group-title {
  font-size: 16px;
  font-weight: 700;
  color: #52525b;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: text;
  transition: color 0.15s, background-color 0.15s;
}

.group-title:hover {
  color: #27272a;
  background-color: rgba(154, 162, 170, 0.5);
}

.group-title-input {
  font-size: 16px;
  font-weight: 700;
  background: #f4f4f5;
  color: #27272a;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #6366f1;
  outline: none;
  min-width: 100px;
}

.color-picker-container {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(39, 39, 42, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 9999px;
  padding: 5px 8px;
  border: 1px solid #3f3f46;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #52525b;
  transition: transform 0.15s;
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-divider {
  width: 1px;
  height: 12px;
  background: #52525b;
  margin: 0 2px;
}

.custom-color-dot {
  position: relative;
  overflow: hidden;
}

.color-input {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  opacity: 0;
}

.group-lock-btn {
  position: absolute;
  bottom: -36px;
  left: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  background: rgba(24, 24, 27, 0.92);
  color: #a1a1aa;
  cursor: pointer;
  z-index: 41;
  transition: all 0.15s ease;
}

.group-lock-btn:hover {
  background: rgba(39, 39, 42, 0.98);
  border-color: rgba(99, 102, 241, 0.72);
  color: #fff;
}

.group-lock-btn.locked {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.5);
  background: rgba(120, 53, 15, 0.9);
}

.lock-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.65);
}
</style>
