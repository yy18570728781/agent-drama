<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { usePBRStore } from '@/stores/pbr.store'
import type { ColorSample } from '@/types/pbr.types'
import MapSlider from './MapSlider.vue'

const props = defineProps<{
  channel: string
  index: number
  sample: ColorSample
  showTarget?: boolean
}>()

const store = usePBRStore()

const isPicking = computed(() =>
  store.pickingTarget?.channel === props.channel && store.pickingTarget?.index === props.index,
)

const colorHex = computed(() => {
  const [r, g, b] = props.sample.color
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
})

function startPicking() {
  if (isPicking.value) {
    store.stopPicking()
  } else {
    store.startPicking(props.channel, props.index)
  }
}

function onColorInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  props.sample.color = [r, g, b]
}
</script>

<template>
  <div class="border border-zinc-800/60 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 bg-zinc-900/60 cursor-pointer select-none hover:bg-zinc-800/60 transition-colors"
      @click="sample.enabled = !sample.enabled">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full border border-zinc-600 flex items-center justify-center"
          :class="sample.enabled ? 'bg-indigo-500 border-indigo-400' : 'bg-zinc-800'">
          <Icon v-if="sample.enabled" icon="lucide:check" class="w-2 h-2 text-white" />
        </div>
        <span class="text-[11px] font-bold text-zinc-300">采样 {{ index + 1 }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded border border-zinc-600" :style="{ backgroundColor: colorHex }"></div>
        <button @click.stop="startPicking"
          class="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer"
          :class="isPicking ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50'">
          {{ isPicking ? '取消' : '取色' }}
        </button>
        <label class="flex items-center gap-1 cursor-pointer" @click.stop>
          <input type="checkbox" v-model="sample.isolate" class="w-3 h-3 rounded accent-indigo-500 cursor-pointer" />
          <span class="text-[9px] text-zinc-500">隔离</span>
        </label>
      </div>
    </div>
    <div v-show="sample.enabled" class="px-3 py-3 space-y-2">
      <div class="flex items-center gap-2">
        <label class="text-[10px] text-zinc-500 w-12">颜色</label>
        <input type="color" :value="colorHex" @input="onColorInput"
          class="w-8 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent" />
        <span class="text-[10px] font-mono text-zinc-400">{{ colorHex }}</span>
      </div>
      <MapSlider v-model="sample.hueWeight" :defaultValue="1.0" :min="0" :max="2" step="0.01" label="色相权重" />
      <MapSlider v-model="sample.satWeight" :defaultValue="0.5" :min="0" :max="2" step="0.01" label="饱和度权重" />
      <MapSlider v-model="sample.lumWeight" :defaultValue="0.2" :min="0" :max="2" step="0.01" label="亮度权重" />
      <div class="flex gap-3">
        <div class="flex-1"><MapSlider v-model="sample.maskLow" :defaultValue="0" :min="0" :max="1" step="0.01" label="遮罩低" /></div>
        <div class="flex-1"><MapSlider v-model="sample.maskHigh" :defaultValue="1" :min="0" :max="1" step="0.01" label="遮罩高" /></div>
      </div>
      <MapSlider v-if="showTarget" v-model="sample.targetValue" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="目标高度" />
    </div>
  </div>
</template>
