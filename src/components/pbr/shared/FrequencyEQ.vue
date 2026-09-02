<script setup lang="ts">
const BAND_LABELS = ['超大', '巨大', '较大', '中等', '细小', '微细', '原始']
const BAND_INDEX = [6, 5, 4, 3, 2, 1, 0]

const weights = defineModel<number[]>('weights', { required: true })

const props = withDefaults(defineProps<{
  defaults?: number[]
  presets?: { name: string; values: number[] }[]
  min?: number
  max?: number
  step?: number
  showZeroLine?: boolean
}>(), {
  defaults: () => [1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  min: 0,
  max: 1,
  step: 0.01,
  showZeroLine: false,
})

function applyPreset(values: number[]) {
  for (let i = 0; i < 7; i++) {
    weights.value[i] = values[i] ?? weights.value[i]
  }
}

function zeroLineTop(): string {
  if (!props.showZeroLine) return '50%'
  const range = props.max - props.min
  const pct = ((props.max - 0) / range) * 100
  return pct + '%'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between border-b border-zinc-800 pb-1 mt-4">
      <span class="text-[10px] text-zinc-500 uppercase tracking-widest">
        <slot name="title">频率权重均衡器</slot>
      </span>
      <div v-if="presets && presets.length > 0" class="flex gap-1">
        <button v-for="p in presets" :key="p.name"
          @click="applyPreset(p.values)"
          class="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 cursor-pointer">
          {{ p.name }}
        </button>
      </div>
    </div>
    <div class="flex items-start justify-center gap-0 mt-2">
      <div v-for="(label, i) in BAND_LABELS" :key="i" class="flex flex-col items-center" style="width:32px">
        <div class="slider-col">
          <input
            type="range"
            :value="weights[BAND_INDEX[i]] ?? defaults[BAND_INDEX[i]]"
            :min="min"
            :max="max"
            :step="step"
            class="vslider"
            @input="(e: Event) => { weights[BAND_INDEX[i]] = Number((e.target as HTMLInputElement).value) }"
          />
          <div v-if="showZeroLine" class="zero-line" :style="{ top: zeroLineTop() }"></div>
        </div>
        <span class="text-[7px] text-zinc-600 mt-1 select-none leading-none">{{ label }}</span>
        <span class="text-[7px] text-zinc-500 font-mono select-none leading-none">{{ (weights[BAND_INDEX[i]] ?? defaults[BAND_INDEX[i]]).toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slider-col {
  position: relative;
  width: 20px;
  height: 100px;
}
.vslider {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  width: 100px;
  height: 20px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  background: transparent;
  cursor: pointer;
  outline: none;
  margin: 0;
  padding: 0;
}
.vslider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: #27272a;
  border-radius: 2px;
  border: 1px solid #3f3f46;
}
.vslider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #6366f1;
  border-radius: 2px;
  cursor: pointer;
  margin-top: -5px;
}
.vslider::-moz-range-track {
  width: 100%;
  height: 4px;
  background: #27272a;
  border-radius: 2px;
  border: 1px solid #3f3f46;
}
.vslider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #6366f1;
  border-radius: 2px;
  cursor: pointer;
  border: none;
}
.zero-line {
  position: absolute;
  left: 2px;
  right: 2px;
  border-top: 1px dashed #52525b;
  pointer-events: none;
}
</style>
