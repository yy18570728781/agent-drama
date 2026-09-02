<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Camera, Copy, Check } from '@/components/common/icon/lucide'
import { useCameraPreview } from '@/composables/flow/useCameraPreview'
import { useCameraPreviewActivity } from '@/composables/flow/useCameraPreviewActivity'
import { useTheme } from '@/styles/theme/composables/useTheme'
import {
  HORIZONTAL_ANGLES,
  VERTICAL_ANGLES,
  SHOT_SIZES,
} from '@/composables/director-3d/canvas/useCameraPresets'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const { showNodeTitle } = useTheme()

const focalLengths = ['12mm (超广角)', '24mm (广角)', '35mm (人文)', '50mm (标准)', '85mm (人像)', '135mm (特写)', '200mm (长焦)']
const movements = ['Static (固定机位)', 'Handheld (手持摇晃)', 'Steadicam (斯坦尼康平稳)', 'Pan (水平摇摄)', 'Tilt (垂直摇摄)', 'Dolly In (推镜头)', 'Dolly Out (拉镜头)', 'Tracking (跟随拍摄)', 'Drone (无人机航拍)']

const form = ref({
  movement: '',
  focalLength: '',
  presetH: '',
  presetV: '',
  presetShot: '',
})

const copied = ref(false)
const previewRef = ref(null)

let _isSyncingFromControls = false

const {
  dispose: disposePreview,
  init: initPreview,
  resize: resizePreview,
  updateFov,
  updateViewpoint,
} = useCameraPreview(previewRef, {
  onInferred(h, v, shot) {
    _isSyncingFromControls = true
    form.value.presetH = h
    form.value.presetV = v
    form.value.presetShot = shot
    const sOpt = SHOT_SIZES.find(s => s.key === shot)
    if (sOpt) form.value.focalLength = focalLengthFromShotFov(sOpt.fov)
    nextTick(() => { _isSyncingFromControls = false })
  },
})

const inferredLabel = computed(() => {
  const hOpt = HORIZONTAL_ANGLES.find(h => h.key === form.value.presetH)
  const vOpt = VERTICAL_ANGLES.find(v => v.key === form.value.presetV)
  const sOpt = SHOT_SIZES.find(s => s.key === form.value.presetShot)
  return [hOpt?.label, vOpt?.label, sOpt?.label].filter(Boolean).join(' / ') || '未设定'
})

function focalLengthFromShotFov(fov) {
  const fl = 12 / Math.tan((fov / 2) * (Math.PI / 180))
  const flVal = parseFloat(fl.toFixed(0))
  const match = focalLengths.find(f => parseInt(f) === flVal)
  return match || ''
}

function fovFromFocalLength(flStr) {
  const val = parseFloat(flStr)
  if (!val || val <= 0) return 50
  return 2 * Math.atan(12 / val) * (180 / Math.PI)
}

const H_PROMPT = { front: 'front', 'front-right': 'front-right', right: 'right', 'back-right': 'back-right', back: 'back', 'back-left': 'back-left', left: 'left', 'front-left': 'front-left' }
const V_PROMPT = { 'low-angle': 'low angle', 'eye-level': 'eye level', elevated: 'elevated', 'high-angle': 'high angle' }
const S_PROMPT = { wide: 'wide shot', medium: 'medium shot', 'close-up': 'close-up shot' }

function generatePresetLabel() {
  const parts = []
  const hOpt = HORIZONTAL_ANGLES.find(h => h.key === form.value.presetH)
  const vOpt = VERTICAL_ANGLES.find(v => v.key === form.value.presetV)
  const sOpt = SHOT_SIZES.find(s => s.key === form.value.presetShot)
  if (hOpt) parts.push(`from ${H_PROMPT[form.value.presetH]}`)
  if (vOpt) parts.push(V_PROMPT[form.value.presetV])
  if (sOpt) parts.push(S_PROMPT[form.value.presetShot])
  return parts.join(', ')
}

const generatePrompt = () => {
  const parts = []
  const presetLabel = generatePresetLabel()
  if (presetLabel) parts.push(presetLabel)
  if (form.value.movement) parts.push(form.value.movement.split(' (')[0])
  if (form.value.focalLength) parts.push(`${form.value.focalLength.split(' ')[0]} focal length`)

  const prompt = parts.join(', ')
  props.data.content = prompt
  if (!props.data.cameraData) props.data.cameraData = {}
  props.data.cameraData = { ...form.value }
}

watch(form, generatePrompt, { deep: true })

watch(() => [form.value.presetH, form.value.presetV, form.value.presetShot], ([h, v, s]) => {
  if (_isSyncingFromControls) return
  if (h && v && s) updateViewpoint(h, v, s)
})

watch(() => form.value.focalLength, (fl) => {
  if (_isSyncingFromControls) return
  if (fl) updateFov(fovFromFocalLength(fl))
})

function syncPreviewControls() {
  if (form.value.presetH && form.value.presetV && form.value.presetShot) {
    updateViewpoint(form.value.presetH, form.value.presetV, form.value.presetShot)
  }
  if (form.value.focalLength) updateFov(fovFromFocalLength(form.value.focalLength))
}

useCameraPreviewActivity({
  containerRef: previewRef,
  dispose: disposePreview,
  init: initPreview,
  syncControls: syncPreviewControls,
})

onMounted(() => {
  if (props.data.cameraData) {
    form.value = { ...form.value, ...props.data.cameraData }
  }
})

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

const copyPrompt = async () => {
  if (!props.data.content) return
  try {
    await copyToClipboard(props.data.content)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

let lastW = 0, lastH = 0
function onNodeResize() {
  if (!previewRef.value) return
  const w = previewRef.value.clientWidth
  const h = previewRef.value.clientHeight
  if (w !== lastW || h !== lastH) {
    lastW = w
    lastH = h
    resizePreview()
  }
}

function onResizeEnd() {
  nextTick(onNodeResize)
}

watch(() => props.selected, (sel) => {
  if (sel) setTimeout(onNodeResize, 50)
})
</script>

<template>
  <div class="camera-node" :class="{ selected }">
    <NodeResizer :is-visible="selected" :min-width="600" :min-height="420" @resize="onResizeEnd" />
    <Handle type="target" :position="Position.Left" class="handle-dot" />

    <div class="camera-node-layout">
      <div class="camera-node-form">
        <div v-if="showNodeTitle" class="node-header">
          <div class="header-left">
            <div class="node-icon icon-emerald">
              <Camera class="icon-svg" />
            </div>
            <span class="node-title">摄影机参数</span>
          </div>
        </div>

        <div class="node-content custom-scrollbar">
          <div class="section-divider">机位预设</div>
          <div class="preset-grid">
            <div class="form-field">
              <label class="field-label">水平方向</label>
              <select v-model="form.presetH" class="field-select">
                <option value="">默认</option>
                <option v-for="h in HORIZONTAL_ANGLES" :key="h.key" :value="h.key">{{ h.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">垂直角度</label>
              <select v-model="form.presetV" class="field-select">
                <option value="">默认</option>
                <option v-for="v in VERTICAL_ANGLES" :key="v.key" :value="v.key">{{ v.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">景别</label>
              <select v-model="form.presetShot" class="field-select">
                <option value="">默认</option>
                <option v-for="s in SHOT_SIZES" :key="s.key" :value="s.key">{{ s.label }}</option>
              </select>
            </div>
          </div>

          <div class="section-divider">相机参数</div>
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label">运镜 (Movement)</label>
              <select v-model="form.movement" class="field-select">
                <option value="">默认</option>
                <option v-for="opt in movements" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">焦距 (Focal Length)</label>
              <select v-model="form.focalLength" class="field-select">
                <option value="">默认</option>
                <option v-for="opt in focalLengths" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </div>

          <div class="prompt-section">
            <div class="prompt-header">
              <label class="field-label">生成的提示词</label>
              <button @click="copyPrompt" class="copy-btn" title="复制提示词">
                <Check v-if="copied" class="icon-svg icon-check" />
                <Copy v-else class="icon-svg" />
              </button>
            </div>
            <textarea
              v-model="props.data.content"
              readonly
              placeholder="选择参数以生成运镜提示词..."
              class="prompt-textarea custom-scrollbar"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="camera-node-preview" @pointerdown.stop @mousedown.stop @wheel.stop>
        <div class="preview-header">
          <span class="preview-title">3D 取景器</span>
          <span class="preview-info">{{ inferredLabel }}</span>
        </div>
        <div ref="previewRef" class="preview-canvas"></div>
        <div class="preview-hint">拖拽旋转 / 滚轮缩放 / 松手反推参数</div>
      </div>
    </div>

    <Handle type="source" :position="Position.Right" class="handle-dot handle-dot-right" />
  </div>
</template>

<style scoped>
@import './CameraNode.style.scss';
</style>
