<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const store = usePBRStore()
const p = store.tilingParams
const isProcessing = computed(() => store.isGenerating)
const isTiling = computed(() => store.viewportMode === 'tiling')

function resetParams() {
  p.technique = 'overlap'
  p.falloff = 0.1
  p.overlapX = 0.2
  p.overlapY = 0.2
  p.splatRotation = 0.0
  p.splatRotationRandom = 0.25
  p.splatScale = 1.0
  p.splatWobble = 0.2
  p.splatRandomize = 0.0
  p.outputResolution = 2048
}

const emit = defineEmits<{
  apply: []
  preview: []
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2 flex items-center justify-between">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">无缝贴图</span>
      <button @click="resetParams" class="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 border border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors">重置</button>
    </div>

    <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex items-center justify-between text-xs">
      <label class="text-zinc-400">混合技术</label>
      <div class="flex gap-1">
        <button @click="p.technique = 'overlap'"
          :class="p.technique === 'overlap' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500'"
          class="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer">重叠</button>
        <button @click="p.technique = 'splat'"
          :class="p.technique === 'splat' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500'"
          class="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer">喷溅</button>
      </div>
    </div>

    <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl space-y-1.5">
      <div class="flex items-center justify-between text-xs mb-1">
        <label class="text-zinc-400">输出分辨率</label>
      </div>
      <div class="grid grid-cols-4 gap-1">
        <button v-for="res in [512, 1024, 2048, 4096]" :key="res"
          @click="p.outputResolution = res"
          :class="p.outputResolution === res ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'"
          class="py-1 rounded text-[10px] font-bold transition-all border cursor-pointer">
          {{ res }}
        </button>
      </div>
    </div>

    <MapSlider v-model="p.falloff" :defaultValue="0.1" :min="0.01" :max="1" step="0.01" label="边缘过渡" />

    <template v-if="p.technique === 'overlap'">
      <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1">重叠参数</div>
      <MapSlider v-model="p.overlapX" :defaultValue="0.2" :min="0" :max="1" step="0.01" label="水平重叠" />
      <MapSlider v-model="p.overlapY" :defaultValue="0.2" :min="0" :max="1" step="0.01" label="垂直重叠" />
    </template>

    <template v-if="p.technique === 'splat'">
      <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1">喷溅参数</div>
      <MapSlider v-model="p.splatRotation" :defaultValue="0" :min="0" :max="1" step="0.01" label="旋转" />
      <MapSlider v-model="p.splatRotationRandom" :defaultValue="0.25" :min="0" :max="1" step="0.01" label="随机旋转" />
      <MapSlider v-model="p.splatScale" :defaultValue="1" :min="0.5" :max="2" step="0.01" label="缩放" />
      <MapSlider v-model="p.splatWobble" :defaultValue="0.2" :min="0" :max="1" step="0.01" label="抖动" />
      <MapSlider v-model="p.splatRandomize" :defaultValue="0" :min="0" :max="1" step="0.01" label="随机种子" />
    </template>

    <div class="flex gap-2 pt-2">
      <button @click="emit('preview')"
        :disabled="isProcessing || !store.sourceImage"
        class="flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        :class="isTiling ? 'bg-amber-600 hover:bg-amber-500 text-white' : (!isProcessing && store.sourceImage) ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'">
        <Icon :icon="isTiling ? 'lucide:eye-off' : 'lucide:eye'" class="w-3.5 h-3.5" />
        {{ isTiling ? '关闭预览' : '预览' }}
      </button>
      <button @click="emit('apply')"
        :disabled="isProcessing || !store.sourceImage"
        class="flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border"
        :class="(!isProcessing && store.sourceImage) ? 'border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10' : 'border-zinc-800 text-zinc-600 cursor-not-allowed'">
        <Icon icon="lucide:check" class="w-3.5 h-3.5" />
        应用到当前通道
      </button>
    </div>

    <div v-if="store.tilingResults.albedo" class="space-y-2 pt-2 border-t border-zinc-800">
      <div class="text-[10px] text-zinc-500 uppercase tracking-widest">平铺测试</div>
      <MapSlider v-model="store.uvTiling" :defaultValue="1" :min="1" :max="5" step="0.1" label="平铺倍数" />
    </div>
  </div>
</template>
