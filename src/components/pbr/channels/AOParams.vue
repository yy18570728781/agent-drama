<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'

const store = usePBRStore()
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">AO Map (from Height + Normal)</span>
    </div>
    <MapSlider v-model="store.params.ao.spread" :defaultValue="10" :min="1" :max="200" step="1" label="遮蔽扩散" />
    <MapSlider v-model="store.params.ao.depth" :defaultValue="50" :min="1" :max="255" step="1" label="遮蔽深度" />
    <MapSlider v-model="store.params.ao.iterations" :defaultValue="10" :min="5" :max="100" step="1" label="迭代次数" />
    <MapSlider v-model="store.params.ao.samples" :defaultValue="10" :min="5" :max="50" step="1" label="每迭代采样数" />
    <MapSlider v-model="store.params.ao.aoBlend" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="法线/深度混合" />
    <MapSlider v-model="store.params.ao.aoPower" :defaultValue="1.0" :min="0.1" :max="10" step="0.1" label="遮蔽强度" />
    <MapSlider v-model="store.params.ao.aoBias" :defaultValue="0" :min="-1" :max="1" step="0.01" label="偏移" />
    <div class="pt-2 space-y-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="store.params.ao.invertY" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转法线 Y</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="store.params.ao.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转遮蔽</span>
      </label>
    </div>
  </div>
</template>
