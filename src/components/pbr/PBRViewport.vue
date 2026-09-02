<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick, inject } from 'vue'
import * as THREE from 'three'
import { usePBRStore } from '@/stores/pbr.store'
import { ALL_CHANNELS, CHANNEL_LABELS, CHANNEL_SHORT_LABELS } from '@/types/pbr.types'
import type { PBRChannel } from '@/types/pbr.types'
import { usePBRPreview } from '@/composables/pbr/usePBRPreview'
import { useChannelThumbnails } from '@/composables/pbr/useChannelThumbnails'

const store = usePBRStore()
const viewportRoot = ref<HTMLElement | null>(null)
const preview3dContainer = ref<HTMLElement | null>(null)
const canvas2d = ref<HTMLCanvasElement | null>(null)
const container2d = ref<HTMLElement | null>(null)
const hdrFileInput = ref<HTMLInputElement | null>(null)
const modelFileInput = ref<HTMLInputElement | null>(null)

const sharedRenderer = inject<THREE.WebGLRenderer>('pbrRenderer')!
const generator = inject<any>('pbrGenerator')
const expandPanel = inject<() => void>('expandPanel', () => {})

const PBR_DEBUG = false
function pbrLog(...args: unknown[]): void {
  if (PBR_DEBUG) console.warn('[PBR]', ...args)
}

const { updateTextures, handleResize, loadImportedModel } = usePBRPreview(preview3dContainer, sharedRenderer)
const { urls: thumbUrls, dispose: disposeThumbs } = useChannelThumbnails()

function switchChannel(ch: PBRChannel) {
  store.activeChannel = ch
  expandPanel()
}

const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const isViewportDragOver = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const panStartX = ref(0)
const panStartY = ref(0)
const isThumbStripVisible = ref(true)

const DISPLAY_SIZE = 1024
let readbackRafId = 0
let resizeObserver: ResizeObserver | null = null

function schedule2DReadback() {
  cancelAnimationFrame(readbackRafId)
  readbackRafId = requestAnimationFrame(draw2DPreview)
}

function draw2DPreview() {
  const canvas = canvas2d.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  let channelCanvas: HTMLCanvasElement | null
  if (store.viewportMode === 'tiling') {
    channelCanvas = store.tilingResults[store.activeChannel]
  } else {
    channelCanvas = store.channels[store.activeChannel]?.canvas ?? null
  }

  if (!channelCanvas && store.renderTargets[store.activeChannel] && generator) {
    pbrLog('draw2DPreview() no canvas, reading back RT for:', store.activeChannel)
    channelCanvas = generator.readbackForDisplay(store.activeChannel)
  }

  if (!channelCanvas) {
    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }
  canvas.width = DISPLAY_SIZE
  canvas.height = DISPLAY_SIZE
  ctx.imageSmoothingEnabled = zoom.value <= 4
  ctx.imageSmoothingQuality = 'high'
  const cw = channelCanvas.width
  const ch = channelCanvas.height
  const scale = Math.min(DISPLAY_SIZE / cw, DISPLAY_SIZE / ch)
  const dw = cw * scale
  const dh = ch * scale
  const dx = (DISPLAY_SIZE - dw) / 2
  const dy = (DISPLAY_SIZE - dh) / 2
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
  const tiling = Math.max(1, Math.round(store.uvTiling))
  if (tiling > 1) {
    const tileScale = Math.min(DISPLAY_SIZE / (cw * tiling), DISPLAY_SIZE / (ch * tiling))
    const tileW = cw * tileScale
    const tileH = ch * tileScale
    const ox = (DISPLAY_SIZE - tileW * tiling) / 2
    const oy = (DISPLAY_SIZE - tileH * tiling) / 2
    for (let ty = 0; ty < tiling; ty++) {
      for (let tx = 0; tx < tiling; tx++) {
        ctx.drawImage(channelCanvas, ox + tx * tileW, oy + ty * tileH, tileW, tileH)
      }
    }
  } else {
    ctx.drawImage(channelCanvas, dx, dy, dw, dh)
  }
}

function getTransformStyle() {
  return {
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
    transformOrigin: 'center center',
    transition: isDragging.value ? 'none' : 'transform 0.1s ease-out',
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.85 : 1.18
  const newZoom = Math.min(32, Math.max(0.1, zoom.value * delta))

  const rect = container2d.value?.getBoundingClientRect()
  if (rect) {
    const mx = e.clientX - rect.left - rect.width / 2 - panX.value
    const my = e.clientY - rect.top - rect.height / 2 - panY.value
    const ratio = newZoom / zoom.value
    panX.value -= mx * (ratio - 1)
    panY.value -= my * (ratio - 1)
  }
  zoom.value = newZoom
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 1) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  panStartX.value = panX.value
  panStartY.value = panY.value
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  panX.value = panStartX.value + (e.clientX - dragStartX.value)
  panY.value = panStartY.value + (e.clientY - dragStartY.value)
}

function onMouseUp() {
  isDragging.value = false
}

function onContextMenu(e: Event) {
  e.preventDefault()
}

function on2dClick(e: MouseEvent) {
  if (!store.pickingTarget) return
  const rect = container2d.value?.getBoundingClientRect()
  if (!rect) return
  const canvas = canvas2d.value
  if (!canvas) return
  const canvasRect = canvas.getBoundingClientRect()
  const nx = (e.clientX - canvasRect.left) / canvasRect.width
  const ny = (e.clientY - canvasRect.top) / canvasRect.height
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return
  store.applyPickedColor(nx, ny)
}

async function onViewportDrop(e: DragEvent) {
  e.preventDefault()
  isViewportDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file || !store.dropFileHandler) return
  await store.dropFileHandler(file)
}

function resetZoom() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function fitToView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function triggerHdrImport() {
  hdrFileInput.value?.click()
}

function onHdrFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  store.loadCustomHdr(url, file.name)
  input.value = ''
}

function clearHdr() {
  store.clearCustomHdr()
}

function triggerModelImport() {
  modelFileInput.value?.click()
}

function onModelFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  store.importedModelUrl = url
  store.importedModelName = file.name
  loadImportedModel(url)
  input.value = ''
}

watch([() => store.generationVersion, () => store.activeChannel, () => store.uvTiling], () => {
  resetZoom()
  if (store.viewportMode !== '3d') {
    schedule2DReadback()
  }
  updateTextures()
})

watch(() => store.tilingResults[store.activeChannel], () => {
  if (store.viewportMode === 'tiling') {
    draw2DPreview()
  }
})

  watch(() => store.viewportMode, () => {
    nextTick(() => {
      handleResize()
      requestAnimationFrame(() => handleResize())
    })
    updateTextures()
    if (store.viewportMode !== '3d') {
      schedule2DReadback()
    }
  })

  watch(() => isThumbStripVisible.value, () => {
    nextTick(() => {
      handleResize()
      requestAnimationFrame(() => handleResize())
    })
  })

onMounted(() => {
  if (store.viewportMode !== '3d') {
    draw2DPreview()
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  if (viewportRoot.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
      requestAnimationFrame(() => handleResize())
    })
    resizeObserver.observe(viewportRoot.value)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(readbackRafId)
  resizeObserver?.disconnect()
  disposeThumbs()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div ref="viewportRoot" class="flex-1 flex flex-col bg-black relative">
    <div class="p-2 flex gap-3 bg-[#18181b] border-b border-zinc-800 text-xs flex-wrap items-center">
      <div class="flex items-center gap-1.5">
        <span class="text-zinc-500 font-bold">视口</span>
        <select v-model="store.viewportMode" class="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 outline-none text-zinc-300">
          <option value="3d">仅 3D</option>
          <option value="2d">仅 2D</option>
          <option value="split">双屏分割</option>
        </select>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-zinc-500 font-bold">模型</span>
        <select v-model="store.activeGeometry" class="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 outline-none text-zinc-300">
          <option value="plane">Plane</option>
          <option value="sphere">Sphere</option>
          <option value="cube">Cube</option>
          <option value="cylinder">Cylinder</option>
          <option value="imported" v-if="store.importedModelUrl">{{ store.importedModelName || '导入模型' }}</option>
        </select>
        <button @click="triggerModelImport" class="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-[10px] font-bold transition-colors">
          导入模型
        </button>
        <input ref="modelFileInput" type="file" accept=".glb,.gltf" class="hidden" @change="onModelFileSelected" />
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-zinc-500 font-bold">细分</span>
        <input type="range" v-model.number="store.subdivisionsDetail" min="64" max="360" class="accent-indigo-500 w-20" />
      </div>
      <label class="flex items-center gap-1 cursor-pointer select-none">
        <input type="checkbox" v-model="store.wireframe" class="accent-indigo-500" />
        <span class="text-zinc-500 text-[10px]">线框</span>
      </label>

      <div class="h-4 w-px bg-zinc-700 mx-1"></div>

      <div class="flex items-center gap-1.5">
        <span class="text-zinc-500 font-bold">HDR</span>
        <button @click="triggerHdrImport" class="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-[10px] font-bold transition-colors">
          导入
        </button>
        <button v-if="store.customHdrFileName" @click="clearHdr" class="text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-900/40 rounded px-1.5 py-0.5 transition-colors">
          清除
        </button>
        <span v-if="store.customHdrFileName" class="text-[10px] text-zinc-500 max-w-[100px] truncate" :title="store.customHdrFileName">{{ store.customHdrFileName }}</span>
        <span v-else class="text-[10px] text-zinc-600">默认</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-zinc-600 text-[10px]">强度</span>
        <input type="range" v-model.number="store.hdrIntensity" min="0" max="1" step="0.01" class="accent-indigo-500 w-16" />
        <span class="text-indigo-400 font-mono text-[10px] w-8 text-right">{{ store.hdrIntensity.toFixed(2) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-zinc-600 text-[10px]">旋转</span>
        <input type="range" v-model.number="store.hdrRotation" min="0" max="360" step="1" class="accent-indigo-500 w-16" />
        <span class="text-indigo-400 font-mono text-[10px] w-7 text-right">{{ Math.round(store.hdrRotation) }}°</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-zinc-600 text-[10px]">灯光</span>
        <input type="range" v-model.number="store.lightIntensity" min="0" max="1" step="0.01" class="accent-indigo-500 w-16" />
        <span class="text-indigo-400 font-mono text-[10px] w-8 text-right">{{ store.lightIntensity.toFixed(2) }}</span>
      </div>

      <div class="h-4 w-px bg-zinc-700 mx-1"></div>

      <div class="flex items-center gap-1.5">
        <span class="text-zinc-500 font-bold text-[10px]">光照</span>
        <select v-model="store.lightingPreset" class="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 outline-none text-zinc-300 text-[10px]">
          <option value="studio">影棚</option>
          <option value="daylight">日光</option>
          <option value="warm">暖光</option>
          <option value="cyberpunk">赛博</option>
          <option value="custom">中性</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-zinc-600 text-[10px]">方向</span>
        <input type="range" v-model.number="store.lightAngle" min="0" max="360" step="1" class="accent-indigo-500 w-16" />
        <span class="text-indigo-400 font-mono text-[10px] w-7 text-right">{{ Math.round(store.lightAngle) }}°</span>
      </div>
      <label class="flex items-center gap-1 cursor-pointer select-none">
        <input type="checkbox" v-model="store.showHdriBackground" class="accent-indigo-500" />
        <span class="text-zinc-500 text-[10px]">背景</span>
      </label>
      <div v-if="store.showHdriBackground" class="flex items-center gap-1">
        <span class="text-zinc-600 text-[10px]">模糊</span>
        <input type="range" v-model.number="store.hdriBlur" min="0" max="1" step="0.01" class="accent-indigo-500 w-14" />
        <span class="text-indigo-400 font-mono text-[10px] w-6 text-right">{{ store.hdriBlur.toFixed(2) }}</span>
      </div>
      <label class="flex items-center gap-1 cursor-pointer select-none">
        <input type="checkbox" v-model="isThumbStripVisible" class="accent-indigo-500" />
        <span class="text-zinc-500 text-[10px]">通道</span>
      </label>

      <div v-if="store.viewportMode !== '3d'" class="flex items-center gap-2 ml-auto">
        <span class="text-indigo-400 font-mono font-bold text-[11px]">{{ Math.round(zoom * 100) }}%</span>
        <button @click="fitToView" class="text-zinc-500 hover:text-indigo-400 text-[10px] font-bold border border-zinc-700 rounded px-1.5 py-0.5 hover:border-zinc-600 transition-colors">适应</button>
        <button @click="resetZoom" class="text-zinc-500 hover:text-indigo-400 text-[10px] font-bold border border-zinc-700 rounded px-1.5 py-0.5 hover:border-zinc-600 transition-colors">1:1</button>
      </div>
    </div>

    <input ref="hdrFileInput" type="file" accept=".hdr,.exr,.png,.jpg,.jpeg,.bmp,.webp" class="hidden" @change="onHdrFileSelected" />

    <div v-if="isThumbStripVisible" class="shrink-0 bg-[#18181b] border-b border-zinc-800 flex items-stretch">
      <div class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5">
        <button v-for="ch in ALL_CHANNELS" :key="ch" @click="switchChannel(ch)"
          class="flex flex-col items-center gap-0.5 py-1 rounded-md transition-all border cursor-pointer flex-1"
          :class="store.activeChannel === ch ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent hover:bg-zinc-800'">
          <div class="w-[90px] h-[90px] rounded bg-zinc-900 border overflow-hidden"
            :class="store.activeChannel === ch ? 'border-indigo-400' : 'border-zinc-700'"
            :style="thumbUrls[ch] ? { backgroundImage: `url(${thumbUrls[ch]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
            <div v-if="!thumbUrls[ch]" class="w-full h-full flex items-center justify-center text-zinc-600 text-[8px] select-none">—</div>
          </div>
          <span class="text-[9px] font-bold leading-none select-none"
            :class="store.activeChannel === ch ? 'text-indigo-400' : 'text-zinc-500'">
            {{ CHANNEL_SHORT_LABELS[ch] }}
          </span>
        </button>
      </div>
    </div>

    <div class="flex-1 flex w-full h-full relative overflow-hidden"
      @dragover.prevent="isViewportDragOver = true" @dragleave.prevent="isViewportDragOver = false" @drop="onViewportDrop">
      <div v-if="isViewportDragOver"
        class="absolute inset-0 z-50 flex items-center justify-center bg-indigo-600/20 backdrop-blur-sm pointer-events-none">
        <div class="bg-zinc-900/90 border-2 border-dashed border-indigo-400 rounded-2xl px-8 py-6 text-center">
          <div class="text-indigo-300 text-sm font-bold">释放加载到当前通道</div>
          <div class="text-zinc-500 text-[10px] mt-1">{{ CHANNEL_LABELS[store.activeChannel] }}</div>
        </div>
      </div>
      <div v-show="store.viewportMode === '3d' || store.viewportMode === 'split'"
        class="flex-1 relative border-r border-zinc-800 bg-[#060608] overflow-hidden">
        <div ref="preview3dContainer" class="absolute inset-0"></div>
        <div v-if="!store.sourceImage" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="text-zinc-600 text-xs font-mono">Load Base Color Texture</div>
        </div>
        <div v-if="store.isBakingHighRes[store.activeChannel]"
          class="absolute bottom-3 left-3 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm pointer-events-none">
          <div class="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-[10px] text-amber-300 font-bold">高分辨率渲染中</span>
        </div>
      </div>
      <div v-show="store.viewportMode === '2d' || store.viewportMode === 'split' || store.viewportMode === 'tiling'"
        class="flex-1 relative flex flex-col border-l border-zinc-800">
        <div ref="container2d"
          class="flex-1 relative overflow-hidden bg-zinc-950 flex items-center justify-center checkered-bg select-none"
          :class="{ 'cursor-crosshair': store.pickingTarget }"
          @wheel.prevent="onWheel"
          @mousedown="onMouseDown"
          @contextmenu.prevent="onContextMenu"
          @click="on2dClick"
          @dblclick="fitToView">
          <canvas ref="canvas2d" class="pointer-events-none max-w-full max-h-full" :style="getTransformStyle()" />
          <div v-if="store.pickingTarget"
            class="absolute inset-0 pointer-events-none border-2 border-indigo-500/50 flex items-center justify-center">
            <div class="bg-indigo-500/80 text-white text-[10px] font-bold px-3 py-1 rounded">点击取色</div>
          </div>
          <div v-if="store.isBakingHighRes[store.activeChannel]"
            class="absolute bottom-3 left-3 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm pointer-events-none z-10">
            <div class="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-[10px] text-amber-300 font-bold">高分辨率渲染中</span>
          </div>
          <div v-if="!store.channels[store.activeChannel]?.canvas && !store.channels[store.activeChannel]?.hasCustomMap && !store.renderTargets[store.activeChannel]"
            class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-zinc-600 text-xs font-mono">{{ store.activeChannel === 'albedo' ? 'Load Base Color in right panel' : 'Not Generated' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkered-bg {
  background-image:
    linear-gradient(45deg, #111 25%, transparent 25%),
    linear-gradient(-45deg, #111 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #111 75%),
    linear-gradient(-45deg, transparent 75%, #111 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
</style>
