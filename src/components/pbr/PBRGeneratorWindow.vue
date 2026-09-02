<script setup lang="ts">
import { ref, provide, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { usePBRStore } from '@/stores/pbr.store'
import { usePBRGenerator } from '@/composables/pbr/usePBRGenerator'
import PBRViewport from './PBRViewport.vue'
import PBRSettingsPanel from './PBRSettingsPanel.vue'
import { Icon } from '@iconify/vue'

defineProps<{ backTo?: () => void }>()

const store = usePBRStore()
const isCollapsed = ref(false)

const sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping
sharedRenderer.toneMappingExposure = store.lightIntensity

provide('pbrRenderer', sharedRenderer)

const generator = usePBRGenerator(sharedRenderer)
provide('pbrGenerator', generator)

function expandPanel() {
  isCollapsed.value = false
}
provide('expandPanel', expandPanel)

onBeforeUnmount(() => {
  sharedRenderer.dispose()
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#111] text-zinc-300 font-sans">
    <div class="flex items-center justify-between px-6 py-3 bg-[#18181b] border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <button v-if="backTo" @click="backTo" class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
          <Icon icon="lucide:arrow-left" class="w-3.5 h-3.5" />
          <span>返回</span>
        </button>
        <div class="font-bold text-zinc-100 flex items-center gap-2">
          <Icon icon="lucide:layers" class="w-5 h-5 text-indigo-500" />
          材质贴图通道面板
        </div>
      </div>
      <span v-if="store.sourceFileName" class="text-xs text-zinc-500 flex items-center gap-1.5">
        <Icon icon="lucide:image" class="w-3.5 h-3.5" />
        {{ store.sourceFileName }}
      </span>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <PBRViewport />
      <PBRSettingsPanel :collapsed="isCollapsed" @update:collapsed="isCollapsed = $event" />
    </div>
  </div>
</template>
