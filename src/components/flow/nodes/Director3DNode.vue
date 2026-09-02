<script setup lang="ts">
import { computed, inject } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Monitor } from '@/components/common/icon/lucide'
import NodePortsOverlay from '../NodePortsOverlay.vue'
import { useTheme } from '@/styles/theme/composables/useTheme'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const flowLightweightNodeMode = inject('flowLightweightNodeMode', computed(() => false))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const { showNodeTitle } = useTheme()

const visibleInputPorts = computed(() => {
  const ports = props.data.ports?.inputs || []
  return ports.filter((p: any) => p.visible !== false)
})

const visibleOutputPorts = computed(() => {
  const ports = props.data.ports?.outputs || []
  return ports.filter((p: any) => p.visible !== false)
})
</script>

<template>
  <div class="w-full h-full relative group animate-node-enter flex flex-col">
    <NodeResizer v-if="selected && !flowLightweightNodeMode && !flowUltraLightNodeMode" :is-visible="true" :min-width="240" :min-height="140" />

    <div v-if="!flowUltraLightNodeMode && showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
        <Monitor class="w-3.5 h-3.5" />
      </div>
      <span class="text-xs font-medium text-zinc-300 drop-shadow-md">
        {{ data.label || '3D导演台' }}
      </span>
    </div>

    <div
      class="w-full h-full border rounded-none shadow-lg relative flex flex-col"
      :class="[
        flowUltraLightNodeMode
          ? 'border-zinc-700/80 bg-[#18181b]/95 shadow-[0_8px_24px_rgba(15,23,42,0.2)]'
          : selected ? 'border-white shadow-white/10 ring-1 ring-white/30 group-hover:shadow-white/20 group-hover:shadow-2xl' : 'border-zinc-800 hover:border-zinc-700',
      ]"
    >
      <NodePortsOverlay
        :input-ports="visibleInputPorts"
        :output-ports="visibleOutputPorts"
        :disable-input-ports="!!data.disableInputPorts"
        :disable-output-ports="!!data.disableOutputPorts"
      />

      <div class="rounded-none overflow-hidden flex flex-col h-full">
        <div class="flex-1 flex flex-col items-center justify-center min-h-0 h-full bg-[#18181b]">
          <template v-if="data.thumbnail && !flowUltraLightNodeMode">
            <img :src="data.thumbnail" class="w-full h-full object-cover" />
          </template>
          <template v-else-if="flowUltraLightNodeMode">
            <div class="w-full h-full relative">
              <div
                class="absolute inset-[10px] rounded-none border border-dashed bg-zinc-900/80"
                :class="selected ? 'border-zinc-200/70 shadow-[0_0_0_1px_rgba(244,244,245,0.18),0_8px_24px_rgba(15,23,42,0.22)]' : 'border-zinc-300/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'"
              ></div>
            </div>
          </template>
          <div v-else class="flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Monitor class="w-8 h-8 opacity-40" />
            <span class="text-[11px] text-zinc-500">双击展开导演台</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
