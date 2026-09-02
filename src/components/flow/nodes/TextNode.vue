<script setup>
import { ref, computed, inject, nextTick, onBeforeUnmount } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Type, RotateCcw, Loader2, Upload, Download, X, Copy, Check } from 'lucide-vue-next'
import { uploadFileToCosUrl } from '@/api/uploadHelpers'
import { copyText } from '@/utils/copyText'
import { buildPortsForNode } from '@/utils/workflowNodeData'
import NodePortsOverlay from '../NodePortsOverlay.vue'
import { useFlowNodeRemoval } from '../useFlowNodeRemoval'
import { useTheme } from '@/styles/theme/composables/useTheme'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const isTextInput = computed(() => props.type === 'text_input')
const isTextEditing = ref(false)
const textareaRef = ref(null)
const failureReason = computed(() => props.data.failReason || props.data.statusText || props.data.fail_reason?.error_message || props.data.fail_reason?.message || '未知错误')
const generationStatusLabel = computed(() => {
  const status = String(props.data?.status || '').trim()
  if (status === 'waiting_submit') return '等待提交'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  return String(props.data?.statusText || '').trim() || '生成中'
})
const generationProgressLabel = computed(() => (
  typeof props.data?.progress === 'number' && Number.isFinite(props.data.progress)
    ? ` ${Math.round(props.data.progress * 100)}%`
    : ''
))
const copiedFailReason = ref(false)

const copyFailReason = async () => {
  try {
    await copyText(String(failureReason.value || ''))
    copiedFailReason.value = true
    window.setTimeout(() => {
      copiedFailReason.value = false
    }, 1200)
  } catch (error) {
    console.warn('[TextNode] 复制失败原因失败:', error)
  }
}
const ports = computed(() => props.data?.ports || { inputs: [], outputs: [] })
const visibleInputPorts = computed(() => (ports.value.inputs || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (ports.value.outputs || []).filter((port) => port?.visible !== false))

function enterEditMode() {
  if (!isTextInput.value) return
  isTextEditing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const { updateNodeInternals, updateNodeData } = useVueFlow()
const { showNodeTitle } = useTheme()

const flowConvertNode = inject('flowConvertNode', null)
const flowLightweightNodeMode = inject('flowLightweightNodeMode', computed(() => false))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const flowHasMultiSelection = inject('flowHasMultiSelection', computed(() => false))
const flowSaveHistory = inject('flowSaveHistory', null)
const flowPropagateDataFlow = inject('flowPropagateDataFlow', null)
const { removeNode } = useFlowNodeRemoval(props.id)
let propagateTimer = 0

function propagateText() {
  window.clearTimeout(propagateTimer)
  propagateTimer = window.setTimeout(() => flowPropagateDataFlow?.(), 0)
}

const contentModel = computed({
  get: () => String(props.data?.content || ''),
  set: (content) => {
    updateNodeData(props.id, { content })
    propagateText()
  },
})

function exitEditMode() {
  isTextEditing.value = false
  propagateText()
  flowSaveHistory?.()
}

const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const isEditing = ref(false)
const title = ref(props.data.label || '文本节点')

const saveTitle = () => {
  isEditing.value = false
  updateNodeData(props.id, { label: title.value })
  flowSaveHistory?.()
}

const isDragging = ref(false)
const toolbarFileInput = ref(null)

const triggerFileInput = () => {
  toolbarFileInput.value?.click()
}

const getTargetNodeType = (mimeType, fileName) => {
  if (mimeType.startsWith('image/')) return 'file_input'
  if (mimeType.startsWith('video/')) return 'file_input'
  if (mimeType.startsWith('audio/')) return 'file_input'
  if (mimeType.startsWith('text/')) return 'file_input'
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  if (['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) return 'file_input'
  return null
}

const handleFileWithConversion = async (file) => {
  if (!file) return
  const target = getTargetNodeType(file.type, file.name)
  if (!target) return

  if (target === 'file_input' && (file.type.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml'].includes((file.name || '').split('.').pop()?.toLowerCase() || ''))) {
    const reader = new FileReader()
    reader.onload = (event) => {
      updateNodeData(props.id, {
        content: String(event.target?.result || ''),
        mediaType: 'text',
        ports: buildPortsForNode('file_input', 'text'),
      })
      propagateText()
      flowSaveHistory?.()
    }
    reader.readAsText(file)
    return
  }

  const blobUrl = URL.createObjectURL(file)
  const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio'
  flowConvertNode?.(props.id, target, { url: blobUrl, mediaType })

  uploadFileToCosUrl(file, file.name).then(serverUrl => {
    flowConvertNode?.(props.id, target, { url: serverUrl }, { mergeOnly: true })
  }).catch(err => {
    console.warn('[TextNode] 上传失败，保留本地预览:', err)
  })
}

const onDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFileWithConversion(file)
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (file) handleFileWithConversion(file)
  if (toolbarFileInput.value) toolbarFileInput.value.value = ''
}

const clearText = () => {
  removeNode()
}

const handleDownload = () => {
  if (!props.data.content) return
  const blob = new Blob([props.data.content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.data.label || 'text'}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const displayContent = computed(() => {
  return props.data.content || ''
})

onBeforeUnmount(() => window.clearTimeout(propagateTimer))
</script>

<template>
  <div
    class="w-full h-full relative group animate-node-enter flex flex-col"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @animationend="onAnimationEnd"
  >
    <NodeResizer :is-visible="selected && !flowLightweightNodeMode && !flowUltraLightNodeMode" :min-width="200" :min-height="150" />

    <input type="file" ref="toolbarFileInput" accept="image/*,video/*,audio/*,.txt,.md,.csv,.json" class="hidden" @change="onFileChange" />

    <!-- Floating Label -->
    <div v-if="!flowUltraLightNodeMode && showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
        <Type class="w-3.5 h-3.5" />
      </div>
      <span
        v-if="!isEditing"
        @dblclick.stop="isEditing = true"
        class="text-xs font-medium text-zinc-300 hover:text-zinc-100 pointer-events-auto cursor-text transition-colors drop-shadow-md"
      >
        {{ data.label || '文本节点' }}
      </span>
      <input
        v-else
        v-model="title"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        class="text-xs font-medium bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded outline-none border border-indigo-500 w-24 pointer-events-auto"
        autofocus
      />
    </div>

    <!-- Action Toolbar -->
    <div v-if="!flowHasMultiSelection" class="node-toolbar-wrap" :class="{ active: selected }">
      <div class="tb-btn" title="上传文件" @click="triggerFileInput">
        <Upload class="w-4 h-4" />
      </div>
      <div v-if="data.content" class="tb-btn tb-danger" title="清除" @click="clearText">
        <RotateCcw class="w-4 h-4" />
      </div>
      <div class="tb-btn" title="下载" @click="handleDownload">
        <Download class="w-4 h-4" />
      </div>
    </div>

    <!-- Node Card -->
    <div
      class="w-full h-full border rounded-xl shadow-lg relative flex flex-col"
      :class="[
        flowUltraLightNodeMode
          ? 'border-zinc-700/80 bg-[#18181b]/95 shadow-[0_8px_24px_rgba(15,23,42,0.2)]'
          : selected ? 'border-white shadow-white/10 ring-1 ring-white/30 group-hover:shadow-white/20 group-hover:shadow-2xl' : 'border-zinc-800 hover:border-zinc-700',
        isDragging ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : ''
      ]"
    >
      <NodePortsOverlay
        :input-ports="visibleInputPorts"
        :output-ports="visibleOutputPorts"
        :disable-input-ports="!!data.disableInputPorts"
        :disable-output-ports="!!data.disableOutputPorts"
      />

      <div class="rounded-xl overflow-hidden flex flex-col h-full">
        <!-- Content Area -->
        <div class="node-content-area">
          <div v-if="data?.inputs?.text && !flowUltraLightNodeMode" class="upstream-input">
            <div class="font-medium text-indigo-400 mb-0.5 text-[10px]">[上游输入]</div>
            {{ data.inputs.text }}
          </div>

          <!-- text_input: 双击进入编辑模式，单击仅选中 -->
          <template v-if="flowUltraLightNodeMode">
            <div class="w-full h-full relative">
              <div
                class="absolute inset-[10px] rounded-md border border-dashed bg-zinc-900/80"
                :class="selected ? 'border-zinc-200/70 shadow-[0_0_0_1px_rgba(244,244,245,0.18),0_8px_24px_rgba(15,23,42,0.22)]' : 'border-zinc-300/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'"
              ></div>
            </div>
          </template>
          <template v-else-if="flowLightweightNodeMode">
            <div class="node-text-display">
              <span v-if="displayContent">{{ displayContent }}</span>
              <span v-else class="node-placeholder">文本节点</span>
            </div>
          </template>
          <template v-else-if="isTextInput">
            <div
              v-if="!isTextEditing"
              class="node-text-display"
              @dblclick.stop="enterEditMode"
            >
              <span v-if="displayContent">{{ displayContent }}</span>
              <span v-else class="node-placeholder">双击输入文本，或拖拽文本文件至此...</span>
            </div>
            <textarea
              v-else
              ref="textareaRef"
              v-model="contentModel"
              class="node-textarea"
              placeholder="输入文本，或拖拽文本文件至此..."
              @wheel.stop
              :disabled="data.isGenerating"
              @blur="exitEditMode"
            ></textarea>
          </template>

          <!-- output_text 等其他类型：保持原有行为 -->
          <template v-else>
            <textarea
              v-model="contentModel"
              class="node-textarea"
              placeholder="输入文本，或拖拽文本文件至此..."
              @wheel.stop
              :disabled="data.isGenerating"
            ></textarea>
          </template>

          <!-- Loading Overlay -->
          <div v-if="data.isGenerating" class="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-b-xl z-10">
            <Loader2 class="w-6 h-6 text-indigo-500 animate-spin mb-2" />
            <span class="text-xs text-indigo-400 font-medium">
              {{ generationStatusLabel }}{{ generationProgressLabel }}
            </span>
          </div>
          <div
            v-else-if="data.status === 'failed'"
            class="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-b-xl z-10 px-4 text-center node-failed-overlay"
            @mousedown.stop
            @click.stop
          >
            <button class="node-failed-copy-btn mb-2" @click.stop="copyFailReason">
              <Check v-if="copiedFailReason" class="w-3 h-3" />
              <Copy v-else class="w-3 h-3" />
              <span>{{ copiedFailReason ? '已复制' : '复制失败原因' }}</span>
            </button>
            <X class="w-6 h-6 text-red-300 mb-2" />
            <span class="text-xs text-red-200 font-medium">生成失败</span>
            <div class="text-[11px] text-red-100/90 mt-2 node-failed-text">{{ failureReason }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.node-failed-overlay { pointer-events: none; user-select: text; -webkit-user-select: text; }
.node-failed-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(254, 202, 202, 0.28);
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.72);
  color: #fee2e2;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.node-failed-copy-btn:hover { background: rgba(153, 27, 27, 0.82); }
.node-failed-text {
  user-select: text;
  -webkit-user-select: text;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
  cursor: text;
}
.node-toolbar-wrap {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1px;
  background: rgba(39, 39, 42, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #3f3f46;
  border-radius: 5px;
  padding: 3px 5px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.32);
  transition: all 0.2s;
  opacity: 0;
  z-index: 10;
}
.group:hover .node-toolbar-wrap {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.node-toolbar-wrap.active {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.tb-btn {
  padding: 4px;
  color: #a1a1aa;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
.tb-btn:hover {
  color: white;
  background: #3f3f46;
}
.tb-btn.tb-danger:hover {
  color: #f87171;
}
.tb-divider {
  width: 1px;
  height: 16px;
  background: #52525b;
  margin: 0 2px;
  flex-shrink: 0;
}
.node-content-area {
  padding: 12px;
  flex: 1;
  background: #18181b;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  min-height: 0;
  gap: 8px;
  height: 100%;
}
.upstream-input {
  padding: 6px 8px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.625;
  color: #a5b4fc;
  font-style: italic;
  max-height: 80px;
  overflow-y: auto;
  flex-shrink: 0;
}
.node-textarea {
  width: 100%;
  height: 100%;
  background: transparent;
  color: #d4d4d8;
  font-size: 14px;
  line-height: 1.625;
  resize: none;
  outline: none;
  border: none;
  font-family: inherit;
  flex: 1;
}
.node-textarea::placeholder {
  color: #71717a;
  font-style: italic;
}
.node-text-display {
  width: 100%;
  height: 100%;
  color: #d4d4d8;
  font-size: 14px;
  line-height: 1.625;
  flex: 1;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: default;
  user-select: none;
}
.node-placeholder {
  color: #71717a;
  font-style: italic;
}
</style>
