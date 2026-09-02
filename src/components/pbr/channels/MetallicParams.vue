<script setup lang="ts">
import { computed } from 'vue'
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'

const store = usePBRStore()
const s = store.params.metallic.sample

const colorHex = computed(() => {
  const [r, g, b] = s.color
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
})

const isPicking = computed(() =>
  store.pickingTarget?.channel === 'metallic' && store.pickingTarget?.index === 0,
)

function startPicking() {
  if (isPicking.value) store.stopPicking()
  else store.startPicking('metallic', 0)
}

function onColorInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value
  s.color = [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

function resetValues() {
  s.color = [0, 0, 0]
  s.hueWeight = 1.0
  s.satWeight = 0.5
  s.lumWeight = 0.2
  s.maskLow = 0
  s.maskHigh = 1
  store.params.metallic.blurSize = 0
  store.params.metallic.overlayBlurSize = 30
  store.params.metallic.highPassOverlay = 1.0
  store.params.metallic.finalContrast = 1.0
  store.params.metallic.finalBias = 0
  store.params.metallic.invert = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2 flex items-center justify-between">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Metallic Map</span>
      <button @click="resetValues" class="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 border border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors">重置全部</button>
    </div>

    <div class="border border-zinc-800/60 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-3 py-2 bg-zinc-900/60 cursor-pointer select-none hover:bg-zinc-800/60 transition-colors"
        @click="s.enabled = !s.enabled">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center"
            :class="s.enabled ? 'bg-indigo-500 border-indigo-400' : 'bg-zinc-800'">
            <svg v-if="s.enabled" class="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M5 12l5 5L20 7"/></svg>
          </div>
          <span class="text-[11px] font-bold text-zinc-300">颜色匹配</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded border border-zinc-600" :style="{ backgroundColor: colorHex }"></div>
          <button @click.stop="startPicking"
            class="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer"
            :class="isPicking ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50'">
            {{ isPicking ? '取消' : '取色' }}
          </button>
        </div>
      </div>
      <div v-show="s.enabled" class="px-3 py-3 space-y-3">
        <div class="flex items-center gap-2">
          <label class="text-[10px] text-zinc-500 w-12">颜色</label>
          <input type="color" :value="colorHex" @input="onColorInput"
            class="w-8 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent" />
          <span class="text-[10px] font-mono text-zinc-400">{{ colorHex }}</span>
        </div>
        <MapSlider v-model="s.hueWeight" :defaultValue="1.0" :min="0" :max="2" step="0.01" label="色相权重" />
        <MapSlider v-model="s.satWeight" :defaultValue="0.5" :min="0" :max="2" step="0.01" label="饱和度权重" />
        <MapSlider v-model="s.lumWeight" :defaultValue="0.2" :min="0" :max="2" step="0.01" label="亮度权重" />
        <div class="flex gap-4">
          <div class="w-full"><MapSlider v-model="s.maskLow" :defaultValue="0" :min="0" :max="1" step="0.01" label="遮罩低" /></div>
          <div class="w-full"><MapSlider v-model="s.maskHigh" :defaultValue="1" :min="0" :max="1" step="0.01" label="遮罩高" /></div>
        </div>
      </div>
    </div>

    <MapSlider v-model="store.params.metallic.blurSize" :defaultValue="0" :min="0" :max="100" step="1" label="模糊大小" />
    <MapSlider v-model="store.params.metallic.overlayBlurSize" :defaultValue="30" :min="1" :max="100" step="1" label="叠加模糊" />
    <MapSlider v-model="store.params.metallic.highPassOverlay" :defaultValue="1.0" :min="0" :max="10" step="0.1" label="高反差叠加" />
    <MapSlider v-model="store.params.metallic.finalContrast" :defaultValue="1.0" :min="0" :max="5" step="0.1" label="最终对比度" />
    <MapSlider v-model="store.params.metallic.finalBias" :defaultValue="0" :min="-1" :max="1" step="0.01" label="偏移" />
    <div class="pt-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="store.params.metallic.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转</span>
      </label>
    </div>
  </div>
</template>
