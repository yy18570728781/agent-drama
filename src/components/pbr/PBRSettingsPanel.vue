<script setup lang="ts">
import { ref, computed, inject, watch, onBeforeUnmount } from 'vue'
import { usePBRStore } from '@/stores/pbr.store'
import { ALL_CHANNELS, CHANNEL_LABELS, CHANNEL_SHORT_LABELS } from '@/types/pbr.types'
import type { PBRChannel } from '@/types/pbr.types'
import HeightParams from './channels/HeightParams.vue'
import NormalParams from './channels/NormalParams.vue'
import RoughnessParams from './channels/RoughnessParams.vue'
import MetallicParams from './channels/MetallicParams.vue'
import AOParams from './channels/AOParams.vue'
import EdgeParams from './channels/EdgeParams.vue'
import AlbedoParams from './channels/AlbedoParams.vue'
import TilingParams from './channels/TilingParams.vue'
import ExportDialog from './ExportDialog.vue'
import { useChannelThumbnails } from '@/composables/pbr/useChannelThumbnails'

const props = defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ 'update:collapsed': [value: boolean] }>()

const store = usePBRStore()
const generator: any = inject('pbrGenerator')
const { urls: thumbUrls, dispose: disposeThumbs } = useChannelThumbnails()

const hiddenFileInput = ref<HTMLInputElement | null>(null)
const showTiling = ref(false)
const showExportDialog = ref(false)
const isDragOver = ref(false)

store.dropFileHandler = loadFile

function importMap() {
  hiddenFileInput.value?.click()
}

function linearToSRGB(x: number): number {
  const d = Math.max(0, Math.min(1, x))
  return d <= 0.0031308 ? d * 12.92 : 1.055 * Math.pow(d, 1.0 / 2.4) - 0.055
}

function getFloatValue(data: Float32Array | Uint16Array, index: number): number {
  if (data instanceof Uint16Array) {
    const binary = data[index]
    const exponent = (binary & 0x7c00) >> 10
    const fraction = binary & 0x03ff
    const sign = (binary & 0x8000) ? -1 : 1
    if (exponent === 0) return sign * Math.pow(2, -24) * fraction
    if (exponent === 31) return fraction ? NaN : sign * Infinity
    return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024)
  }
  return data[index]
}

async function loadHdrCanvas(file: File, ext: string): Promise<HTMLCanvasElement | null> {
  try {
    const buffer = await file.arrayBuffer()
    const { EXRLoader } = await import('three/examples/jsm/loaders/EXRLoader.js')
    const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js')
    const { FloatType } = await import('three')
    const loader = ext === 'exr' ? new EXRLoader() : new HDRLoader()
    loader.setDataType(FloatType)
    const row = loader.parse(buffer) as { data: Float32Array | Uint16Array; width: number; height: number }
    const { data } = row
    const width = row.width || 0
    const height = row.height || 0
    if (!width || !height || !data || data.length === 0) return null

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.createImageData(width, height)
    const pix = imgData.data
    const totalPixels = width * height
    const channels = Math.max(1, Math.min(4, Math.round(data.length / totalPixels)))

    let maxVal = 1.0
    for (let i = 0; i < data.length; i++) {
      const v = getFloatValue(data, i)
      if (!isNaN(v) && isFinite(v) && v > maxVal) maxVal = v
    }
    const scale = maxVal > 1.05 ? 1.0 / maxVal : 1.0

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y
      for (let x = 0; x < width; x++) {
        const srcIdx = (srcY * width + x) * channels
        const destIdx = (y * width + x) * 4
        let r = 0, g = 0, b = 0, a = 1.0
        if (channels === 1) {
          r = getFloatValue(data, srcIdx); g = r; b = r
        } else if (channels === 2) {
          r = getFloatValue(data, srcIdx); g = getFloatValue(data, srcIdx + 1); b = 1.0
        } else {
          r = getFloatValue(data, srcIdx); g = getFloatValue(data, srcIdx + 1); b = getFloatValue(data, srcIdx + 2)
          if (channels === 4) a = getFloatValue(data, srcIdx + 3)
        }
        r *= scale; g *= scale; b *= scale
        const sr = linearToSRGB(r); const sg = linearToSRGB(g); const sb = linearToSRGB(b)
        pix[destIdx] = Math.min(255, Math.max(0, Math.round(sr * 255)))
        pix[destIdx + 1] = Math.min(255, Math.max(0, Math.round(sg * 255)))
        pix[destIdx + 2] = Math.min(255, Math.max(0, Math.round(sb * 255)))
        pix[destIdx + 3] = Math.min(255, Math.max(0, Math.round(a * 255)))
      }
    }
    ctx.putImageData(imgData, 0, 0)
    return canvas
  } catch (err) {
    console.error('[PBR] Failed to load EXR/HDR:', err)
    return null
  }
}

async function loadTgaCanvas(file: File): Promise<HTMLCanvasElement | null> {
  try {
    const buffer = await file.arrayBuffer()
    const { TGALoader } = await import('three/examples/jsm/loaders/TGALoader.js')
    const loader = new TGALoader()
    const tex: any = loader.parse(buffer)
    const width = tex.width ?? tex.image?.width ?? 0
    const height = tex.height ?? tex.image?.height ?? 0
    const data: Uint8Array = tex.data ?? tex.image?.data
    if (!width || !height || !data || data.length === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.createImageData(width, height)
    const isRGBA = data.length >= width * height * 4
    if (isRGBA) {
      imgData.data.set(data.subarray(0, width * height * 4))
    } else {
      const ch = Math.round(data.length / (width * height))
      const pd = imgData.data
      for (let i = 0; i < width * height; i++) {
        const si = i * ch, di = i * 4
        pd[di] = data[si]; pd[di + 1] = data[si + 1]; pd[di + 2] = data[si + 2]
        pd[di + 3] = ch === 4 ? data[si + 3] : 255
      }
    }
    ctx.putImageData(imgData, 0, 0)
    return canvas
  } catch (err) {
    console.error('[PBR] Failed to load TGA:', err)
    return null
  }
}

async function loadFile(file: File) {
  const ext = file.name.toLowerCase().split('.').pop()

  if (ext === 'exr' || ext === 'hdr') {
    const canvas = await loadHdrCanvas(file, ext!)
    if (!canvas) return
    if (store.activeChannel === 'albedo') {
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        const img = new Image()
        img.onload = () => {
          store.loadAlbedoAsSource(img, file.name, canvas)
          URL.revokeObjectURL(pngUrl)
        }
        img.src = pngUrl
      }, 'image/png')
    } else {
      store.importChannelMap(store.activeChannel, canvas)
    }
    return
  }

  if (ext === 'tga') {
    const canvas = await loadTgaCanvas(file)
    if (!canvas) return
    if (store.activeChannel === 'albedo') {
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        const img = new Image()
        img.onload = () => {
          store.loadAlbedoAsSource(img, file.name, canvas)
          URL.revokeObjectURL(pngUrl)
        }
        img.src = pngUrl
      }, 'image/png')
    } else {
      store.importChannelMap(store.activeChannel, canvas)
    }
    return
  }

  const img = new Image()
  img.onload = async () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    if (store.activeChannel === 'albedo') {
      store.loadAlbedoAsSource(img, file.name, canvas)
    } else {
      store.importChannelMap(store.activeChannel, canvas)
    }
  }
  img.src = URL.createObjectURL(file)
}

async function onFileImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await loadFile(file)
  input.value = ''
}

async function onDropFile(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  await loadFile(file)
}

function deleteMap() {
  if (store.activeChannel === 'albedo') {
    store.sourceImage = null
    store.sourceFileName = ''
    store.albedoBaseCanvas = null
    store.channels.albedo.canvas = null
    store.channels.albedo.hasCustomMap = false
    store.channels.albedo.dirty = true
    store.params.albedo.editDiffuse.enabled = false
    store.tilingResults['albedo'] = null
    if (store.viewportMode === 'tiling') store.viewportMode = '3d'
    store.generationVersion++
  } else {
    store.deleteChannelMap(store.activeChannel)
  }
}

async function triggerGenerate() {
  await generator.generateSingle(store.activeChannel)
}

async function generateAll() {
  await generator.generateAll()
}

const previousViewportMode = ref<'3d' | '2d' | 'split'>('3d')

async function previewTiling() {
  if (store.viewportMode === 'tiling') {
    store.viewportMode = previousViewportMode.value
    return
  }
  previousViewportMode.value = store.viewportMode as '3d' | '2d' | 'split'
  const canvas = await generator.generateTilingPreview()
  if (canvas) {
    store.viewportMode = 'tiling'
  }
}

async function applyTiling() {
  await generator.applyTilingCurrentChannel()
  if (store.viewportMode === 'tiling') {
    store.viewportMode = previousViewportMode.value
  }
}

let tilingPreviewTimer: ReturnType<typeof setTimeout> | null = null
watch(() => JSON.stringify(store.tilingParams), () => {
  if (store.viewportMode !== 'tiling') return
  if (tilingPreviewTimer) clearTimeout(tilingPreviewTimer)
  tilingPreviewTimer = setTimeout(async () => {
    await generator.generateTilingPreview()
  }, 500)
})

function getThumbStyle(ch: PBRChannel) {
  const url = thumbUrls[ch]
  if (!url) return {}
  return { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

const CHANNEL_COMPONENT_MAP: Record<PBRChannel, any> = {
  albedo: AlbedoParams,
  displacement: HeightParams,
  normal: NormalParams,
  roughness: RoughnessParams,
  metallic: MetallicParams,
  ao: AOParams,
  edge: EdgeParams,
}

onBeforeUnmount(() => {
  disposeThumbs()
})
</script>

<template>
  <div class="flex shrink-0">
    <div v-show="!collapsed" class="w-[420px] bg-[#111] flex flex-col border-l border-zinc-800">
      <input ref="hiddenFileInput" type="file" accept="image/*,.exr,.hdr,.tga" class="hidden" @change="onFileImport" />

      <div class="p-4 border-b border-zinc-800 bg-[#18181b] space-y-3">
        <div class="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
          纹理分辨率
        </div>
        <div class="grid grid-cols-4 gap-2">
          <button v-for="res in [512, 1024, 2048, 4096]" :key="res"
            @click="store.targetResolution = res"
            class="py-1 rounded text-xs font-bold transition-all border"
            :class="store.targetResolution === res ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'">
            {{ res }}
          </button>
        </div>
        <div class="flex items-center justify-between mt-2 gap-4">
          <span class="text-xs font-bold text-zinc-400 shrink-0">UV 平铺</span>
          <input type="range" v-model.number="store.uvTiling" min="0.1" max="5.0" step="0.1" class="accent-indigo-500 flex-1" />
          <span class="text-xs text-indigo-400 font-mono w-8 text-right">{{ store.uvTiling.toFixed(1) }}x</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
        <div class="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex gap-3 shadow-inner">
          <div class="shrink-0 flex flex-col items-center gap-1">
            <div class="w-[94px] h-[94px] bg-black rounded-lg border p-0.5 relative checkered-bg cursor-pointer transition-colors"
              :class="isDragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-zinc-700'"
              :style="getThumbStyle(store.activeChannel)" @click="importMap"
              @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false" @drop="onDropFile">
              <div v-if="!getThumbStyle(store.activeChannel).backgroundImage"
                class="absolute inset-0 flex items-center justify-center text-[9px] text-zinc-500 font-bold select-none pointer-events-none text-center leading-tight px-1">
                {{ store.activeChannel === 'albedo' ? '点击加载' : '无贴图' }}
              </div>
              <div v-if="isDragOver"
                class="absolute inset-0 flex items-center justify-center bg-indigo-500/20 rounded-lg pointer-events-none">
                <span class="text-[9px] text-indigo-300 font-bold">释放加载</span>
              </div>
            </div>
            <span class="text-[9px] font-bold leading-none select-none text-indigo-400">
              {{ CHANNEL_SHORT_LABELS[store.activeChannel] }}
            </span>
          </div>
          <div class="flex-1 flex flex-col gap-2">
            <div class="flex gap-1.5">
              <button @click="showExportDialog = true" :disabled="!store.sourceImage"
                class="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 border border-indigo-500 disabled:border-zinc-700 text-white rounded text-[11px] font-bold py-1.5 transition-colors shadow-sm">
                导出
              </button>
              <button @click="deleteMap"
                class="bg-red-950/30 hover:bg-red-900/50 border border-red-900/40 text-red-400 rounded text-[11px] font-bold px-3 transition-colors shadow-sm">
                删除
              </button>
            </div>
            <div class="flex gap-1.5">
              <button @click="triggerGenerate" :disabled="store.isGenerating"
                class="flex-1 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:border-zinc-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:shadow-none text-white rounded-lg text-[11px] font-bold py-2 transition-all border bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-indigo-500/80 shadow-lg shadow-indigo-500/20">
                {{ store.isGenerating ? '生成中...' : '生成当前通道' }}
              </button>
              <button @click="generateAll" :disabled="store.isGenerating || !store.sourceImage"
                class="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-600 text-zinc-300 rounded-lg text-[11px] font-bold px-3 py-2 transition-colors shadow-sm">
                全部
              </button>
            </div>
          </div>
        </div>

        <component v-for="(comp, ch) in CHANNEL_COMPONENT_MAP" :key="ch"
          v-show="store.activeChannel === ch"
          :is="comp" />

        <div v-if="store.activeChannel === 'albedo'" class="border-t border-zinc-800 pt-3 mt-2">
          <button @click="showTiling = !showTiling"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border"
            :class="showTiling ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-300'">
            <span>无缝贴图</span>
            <span class="text-[10px]" :class="showTiling ? 'rotate-180' : ''">▼</span>
          </button>
          <div v-if="showTiling" class="mt-3">
            <TilingParams @apply="applyTiling" @preview="previewTiling" />
          </div>
        </div>
      </div>
    </div>

    <div @click="emit('update:collapsed', !collapsed)"
      class="w-[24px] shrink-0 bg-[#18181b] border-l border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors select-none"
      :title="collapsed ? '展开面板' : '折叠面板'">
      <span class="text-zinc-500 text-[10px] font-bold transition-transform" :class="collapsed ? '' : 'rotate-180'">◀</span>
    </div>
  </div>
  <ExportDialog v-if="showExportDialog" @close="showExportDialog = false" />
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
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 6px; }
</style>
