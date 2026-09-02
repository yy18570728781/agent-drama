<script setup lang="ts">
import { ref, inject, computed, onMounted, watch, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { usePBRStore } from '@/stores/pbr.store'
import { usePBRExport, type ExportFormat, type ExportMode } from '@/composables/pbr/usePBRExport'
import { ALL_CHANNELS, UE_SUFFIX, PACK_SUFFIX, CHANNEL_LABELS } from '@/types/pbr.types'
import type { PBRChannel } from '@/types/pbr.types'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = usePBRStore()
const exporter = usePBRExport()
const generator: any = inject('pbrGenerator')

const exportRes = ref<number>(0)
const exportFormat = ref<ExportFormat>('png')
const exportMode = ref<ExportMode>('all')
const isExporting = ref(false)
const exportProgress = ref({ current: 0, total: 0, channel: '' as PBRChannel | '' })
const dirHandle = ref<FileSystemDirectoryHandle | null>(null)
const dirDisplayName = ref('未选择 (将打包为 ZIP 下载)')
const baseName = ref('')

type PackChannel = PBRChannel | 'none'
const PACK_CHANNEL_OPTIONS: { value: PackChannel; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'displacement', label: 'Height' },
  { value: 'roughness', label: 'Roughness' },
  { value: 'metallic', label: 'Metallic' },
  { value: 'ao', label: 'AO' },
  { value: 'edge', label: 'Edge' },
]

const packMap = reactive({ R: 'ao' as PackChannel, G: 'roughness' as PackChannel, B: 'metallic' as PackChannel, A: 'none' as PackChannel })
const packInvertA = ref(false)

watch(exportMode, (mode) => {
  if (mode === 'pack') {
    packMap.R = 'ao'; packMap.G = 'roughness'; packMap.B = 'metallic'; packMap.A = 'none'
    packInvertA.value = false
  }
})

const RESOLUTION_OPTIONS = [
  { label: `当前·${store.targetResolution}`, value: 0 },
  { label: '1K', value: 1024 },
  { label: '2K', value: 2048 },
  { label: '4K', value: 4096 },
]

const CHANNEL_PROGRESS_LABELS: Record<PBRChannel, string> = {
  albedo: 'Base Color', displacement: 'Height', normal: 'Normal',
  roughness: 'Roughness', metallic: 'Metallic', ao: 'AO', edge: 'Edge',
}

onMounted(() => {
  baseName.value = store.sourceFileName.replace(/\.[^.]+$/, '')
})

function getBaseName(): string {
  return store.sourceFileName.replace(/\.[^.]+$/, '')
}

async function pickDirectory() {
  if (typeof (window as any).showDirectoryPicker !== 'function') {
    dirDisplayName.value = '不支持写入目录（请使用 HTTPS 访问），将使用 ZIP 下载'
    return
  }
  try {
    const handle = await (window as any).showDirectoryPicker()
    dirHandle.value = handle as FileSystemDirectoryHandle
    dirDisplayName.value = handle.name
  } catch {
    // 用户取消 — 保持之前状态
  }
}

function clearDirectory() {
  dirHandle.value = null
  dirDisplayName.value = '未选择 (将打包为 ZIP 下载)'
}

const CHANNEL_PACK_ABBR: Record<string, string> = {
  ao: 'O', roughness: 'R', metallic: 'M',
  displacement: 'H', normal: 'N', edge: 'E',
}

function getPackSuffix(): string {
  const abbr = (ch: PBRChannel | 'none') => ch === 'none' ? '_' : (CHANNEL_PACK_ABBR[ch] ?? ch[0].toUpperCase())
  let suffix = abbr(packMap.R) + abbr(packMap.G) + abbr(packMap.B) + abbr(packMap.A)
  if (packMap.A !== 'none' && packInvertA.value) suffix += '_invA'
  return suffix
}

const namingPreview = computed(() => {
  const prefix = baseName.value || '前缀'
  const fmt = exportFormat.value
  const items: string[] = []

  if (exportMode.value === 'single') {
    items.push(`${prefix}_${UE_SUFFIX[store.activeChannel]}.${fmt}`)
  } else if (exportMode.value === 'all') {
    for (const ch of ALL_CHANNELS) items.push(`${prefix}_${UE_SUFFIX[ch]}.${fmt}`)
  } else if (exportMode.value === 'pack') {
    items.push(`${prefix}_PACK_${getPackSuffix()}.${fmt}`)
    const packed = new Set(
      [packMap.R, packMap.G, packMap.B, packMap.A].filter((ch): ch is PBRChannel => ch !== 'none')
    )
    for (const ch of ALL_CHANNELS) {
      if (!packed.has(ch)) items.push(`${prefix}_${UE_SUFFIX[ch]}.${fmt}`)
    }
  }

  return items
})

async function handleExport() {
  isExporting.value = true
  try {
    const res = exportRes.value === 0 ? store.targetResolution : exportRes.value
    const needsRegen = exportRes.value !== 0 && exportRes.value !== store.targetResolution

    let canvases: Record<PBRChannel, HTMLCanvasElement | null>
    if (needsRegen) {
      const needed = exportMode.value === 'single'
        ? [store.activeChannel]
        : [...ALL_CHANNELS]
      canvases = await generator.exportGenerateAtResolution(res, needed, (cur: number, total: number, ch: PBRChannel) => {
        exportProgress.value = { current: cur + 1, total, channel: ch }
      })
    } else {
      canvases = {} as any
      for (const ch of ALL_CHANNELS) canvases[ch] = generator.readbackForDisplay(ch)
    }

    const prefix = baseName.value || getBaseName()
    const files = exporter.buildExportFileList(canvases, prefix, exportFormat.value, exportMode.value, store.activeChannel, {
      packR: packMap.R, packG: packMap.G, packB: packMap.B, packA: packMap.A,
      invertA: packInvertA.value,
    })
    if (files.length === 0) return

    if (dirHandle.value) {
      exportProgress.value = { current: 0, total: files.length, channel: '' }
      await exporter.saveToDirectory(files, dirHandle.value, (cur, total) => {
        exportProgress.value = { current: cur, total, channel: '' as PBRChannel | '' }
      })
    } else {
      exportProgress.value = { current: 0, total: 0, channel: '' }
      await exporter.saveAsZip(files, prefix)
    }
  } finally {
    isExporting.value = false
    emit('close')
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
    <div class="relative bg-[#18181b] border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl flex flex-col">

      <div v-if="isExporting"
        class="absolute inset-0 z-[160] flex flex-col items-center justify-center bg-zinc-950/95 rounded-xl">
        <Icon icon="lucide:loader-circle" class="w-7 h-7 text-indigo-500 animate-spin mb-3" />
        <p class="text-xs text-zinc-300 font-bold">
          {{ exportProgress.channel ? '正在生成贴图...' : exportProgress.total > 0 ? '正在保存文件...' : '正在打包贴图...' }}
        </p>
        <p class="text-[10px] text-zinc-500 mt-1 font-mono">
          {{ exportProgress.channel
            ? `${exportProgress.current}/${exportProgress.total} · ${CHANNEL_PROGRESS_LABELS[exportProgress.channel as PBRChannel]}`
            : exportProgress.total > 0
              ? `保存文件 ${exportProgress.current}/${exportProgress.total}`
              : exportProgress.total === 0 && exportProgress.current === 0 ? '' : ''
          }}
        </p>
        <div v-if="exportProgress.total > 0" class="w-40 mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full transition-all duration-300"
            :style="{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }" />
        </div>
      </div>

      <div class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800">
        <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Icon icon="lucide:download" class="w-4 h-4 text-indigo-500" />
          导出贴图
        </h3>
        <button @click="emit('close')" class="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
          <Icon icon="lucide:x" class="w-4 h-4" />
        </button>
      </div>

      <div class="p-4 space-y-3 flex-1">

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">分辨率</div>
          <div class="grid grid-cols-4 gap-1.5">
            <button v-for="opt in RESOLUTION_OPTIONS" :key="opt.value"
              @click="exportRes = opt.value"
              class="py-1.5 rounded text-[11px] font-bold transition-all border cursor-pointer"
              :class="exportRes === opt.value
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'">
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">导出模式</div>
          <div class="flex flex-col gap-1">
            <button v-for="mode in [
              { label: '仅当前通道', desc: '', value: 'single' },
              { label: '全部独立通道', desc: '', value: 'all' },
              { label: '通道打包 (RGBA)', desc: '自定义 RGBA 通道映射', value: 'pack' },
            ]" :key="mode.value"
              @click="exportMode = mode.value as any"
              class="text-left px-3 py-1.5 rounded-lg transition-all border cursor-pointer"
              :class="exportMode === mode.value
                ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-300'
                : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'">
              <div class="text-[11px] font-bold leading-tight">{{ mode.label }}</div>
              <div v-if="mode.desc" class="text-[10px] mt-0.5"
                :class="exportMode === mode.value ? 'text-indigo-400/50' : 'text-zinc-600'">
                ({{ mode.desc }})
              </div>
            </button>
          </div>
        </div>

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl min-h-[110px] flex flex-col">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">通道映射</div>
          <template v-if="exportMode === 'pack'">
            <div class="grid grid-cols-4 gap-2">
              <div v-for="slot in (['R','G','B','A'] as const)" :key="slot" class="flex flex-col gap-1">
                <div class="text-[10px] font-bold text-center"
                  :class="{ 'text-red-400': slot === 'R', 'text-green-400': slot === 'G', 'text-blue-400': slot === 'B', 'text-zinc-400': slot === 'A' }">
                  {{ slot }}
                </div>
                <select v-model="packMap[slot]"
                  class="w-full bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[10px] outline-none text-zinc-300 focus:border-indigo-500/50">
                  <option v-for="opt in PACK_CHANNEL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
            <label class="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
              <input type="checkbox" v-model="packInvertA" class="accent-indigo-500 w-3 h-3" />
              <span class="text-[10px] text-zinc-400">反转 A 通道 (255 - value)</span>
            </label>
          </template>
          <div v-else class="flex-1 flex items-center">
            <div class="text-[10px] text-zinc-600">选择「通道打包」模式以配置 RGBA 通道映射</div>
          </div>
        </div>

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">导出位置</div>
          <div class="flex items-center gap-1.5">
            <span class="flex-1 text-[10px] text-zinc-400 truncate">{{ dirDisplayName }}</span>
            <button @click="pickDirectory"
              class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded text-[10px] font-bold transition-colors cursor-pointer">
              选择目录
            </button>
            <button v-if="dirHandle" @click="clearDirectory"
              class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded text-[10px] font-bold transition-colors cursor-pointer">
              清除
            </button>
          </div>
        </div>

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">贴图命名</div>
          <input v-model="baseName" placeholder="输入前缀名称"
            class="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500 mb-2" />
          <div class="h-24 overflow-y-auto space-y-0.5 custom-scrollbar">
            <div v-for="item in namingPreview" :key="item"
              class="text-[10px] font-mono text-zinc-500">
              {{ item }}
            </div>
          </div>
        </div>

        <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <div class="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">格式</div>
          <div class="grid grid-cols-5 gap-1.5">
            <button v-for="fmt in (['png','jpg','bmp','tga','exr'] as const)" :key="fmt"
              @click="exportFormat = fmt"
              class="py-1.5 rounded text-[11px] font-bold uppercase transition-all border cursor-pointer"
              :class="exportFormat === fmt
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'">
              {{ fmt }}
            </button>
          </div>
        </div>

      </div>

      <div class="flex gap-2 px-4 pb-4 pt-1">
        <button @click="emit('close')"
          class="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-lg text-[11px] font-bold transition-colors cursor-pointer">
          取消
        </button>
        <button @click="handleExport" :disabled="isExporting || !store.sourceImage"
          class="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-800 border border-indigo-500 disabled:border-zinc-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer">
          导出
        </button>
      </div>

    </div>
  </div>
</template>
