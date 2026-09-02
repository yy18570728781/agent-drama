<script setup>
import { ref, computed, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { ArrowLeftRight } from 'lucide-vue-next'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { useCompareSliderDrag } from './useCompareSliderDrag'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const { findNode, getEdges, updateNodeInternals } = useVueFlow()
const { showNodeTitle } = useTheme()

const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const {
  compareSliderPosition,
  compareContainerRef,
  startCompareDrag,
} = useCompareSliderDrag()

const selectedA = ref(null)
const selectedB = ref(null)

const incomingEdges = computed(() => {
  return getEdges.value.filter(e => e.target === props.id)
})

const upstreamItems = computed(() => {
  return incomingEdges.value
    .map(e => {
      const node = findNode(e.source)
      if (!node) return null
      const url = node.data?.preview || node.data?.imageUrl
      if (!url) return null
      return { nodeId: node.id, url, label: node.data?.label || node.label || '图片', edgeId: e.id, sourceId: e.source }
    })
    .filter(Boolean)
})

const showGallery = computed(() => upstreamItems.value.length > 2)
const galleryCount = computed(() => upstreamItems.value.length)
const galleryPaneHeight = computed(() => {
  const count = Math.max(2, galleryCount.value)
  const thumb = 36
  const gap = 4
  const padding = 8
  const minHeight = 170
  const maxHeight = 420
  return Math.max(minHeight, Math.min(maxHeight, count * thumb + (count - 1) * gap + padding))
})
const nodeContainerStyle = computed(() => ({
  minHeight: `${galleryPaneHeight.value}px`,
  height: `${galleryPaneHeight.value}px`,
}))

watch(galleryPaneHeight, () => {
  updateNodeInternals([props.id])
})

watch(() => upstreamItems.value.length, (len) => {
  if (len <= 2) {
    selectedA.value = upstreamItems.value[0] || null
    selectedB.value = upstreamItems.value[1] || null
  } else {
    if (!selectedA.value || !upstreamItems.value.find(i => i.nodeId === selectedA.value.nodeId)) {
      selectedA.value = upstreamItems.value[0] || null
    }
    if (!selectedB.value || !upstreamItems.value.find(i => i.nodeId === selectedB.value.nodeId)) {
      selectedB.value = upstreamItems.value[1] || null
    }
  }
}, { immediate: true })

const imageA = computed(() => selectedA.value?.url || null)
const imageB = computed(() => selectedB.value?.url || null)
const hasBothImages = computed(() => !!imageA.value && !!imageB.value)

const sameImageWarn = ref(false)

function selectSideA(item) {
  if (selectedB.value && selectedB.value.nodeId === item.nodeId) {
    sameImageWarn.value = true
    setTimeout(() => { sameImageWarn.value = false }, 1500)
    return
  }
  selectedA.value = item
}

function selectSideB(item) {
  if (selectedA.value && selectedA.value.nodeId === item.nodeId) {
    sameImageWarn.value = true
    setTimeout(() => { sameImageWarn.value = false }, 1500)
    return
  }
  selectedB.value = item
}

const highlightEdges = computed(() => {
  const ids = new Set()
  if (selectedA.value) ids.add(selectedA.value.sourceId)
  if (selectedB.value) ids.add(selectedB.value.sourceId)
  return ids
})

watch(highlightEdges, (sourceIds) => {
  incomingEdges.value.forEach(edge => {
    const isHighlighted = sourceIds.has(edge.source)
    const stroke = isHighlighted ? '#22d3ee' : '#52525b'
    const strokeWidth = isHighlighted ? 3 : 2
    edge.style = { ...(edge.style || {}), stroke, strokeWidth }
    edge.animated = isHighlighted
  })
}, { deep: true })

</script>

<template>
  <div
    class="w-full relative group animate-node-enter flex flex-col"
    @animationend="onAnimationEnd"
  >
    <div v-if="showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
        <ArrowLeftRight class="w-3.5 h-3.5" />
      </div>
      <span class="text-xs font-medium text-zinc-300 drop-shadow-md">
        {{ data.label || '图片对比' }}
      </span>
    </div>

    <div
      class="w-full bg-[#18181b] border rounded-none shadow-lg relative flex"
      :style="nodeContainerStyle"
      :class="[
        selected ? 'border-white shadow-white/10 ring-1 ring-white/30 group-hover:shadow-white/20 group-hover:shadow-2xl' : 'border-zinc-800 hover:border-zinc-700',
      ]"
    >
      <Handle type="target" :position="Position.Left" class="w-3 h-3 bg-zinc-700 border-2 border-zinc-900 rounded-full !-left-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <Transition name="fade">
        <div v-if="sameImageWarn" class="absolute top-1 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">不能选择相同图片</div>
      </Transition>

      <div v-if="showGallery" class="flex flex-col gap-1 py-1 pl-1.5 pr-0.5 bg-[#111113] rounded-none border-r border-zinc-800 overflow-y-auto shrink-0" style="width: 44px">
        <div
          v-for="item in upstreamItems"
          :key="'a-' + item.nodeId"
          class="relative rounded-none overflow-hidden cursor-pointer border-2 shrink-0 transition-all"
          :class="[
            selectedA?.nodeId === item.nodeId
              ? 'border-cyan-400 ring-1 ring-cyan-400/50'
              : 'border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-100'
          ]"
          @click="selectSideA(item)"
        >
          <img :src="item.url" class="w-full aspect-square object-cover" />
        </div>
      </div>

      <div class="flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center relative overflow-hidden">
        <div v-if="hasBothImages" class="absolute inset-0 select-none z-10 bg-black overflow-hidden" ref="compareContainerRef">
          <img :src="imageB" draggable="false" class="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div class="absolute inset-0 pointer-events-none" :style="{ clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)` }">
            <img :src="imageA" draggable="false" class="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          </div>
          <div
            class="absolute top-0 bottom-0 w-6 pointer-events-auto cursor-ew-resize flex items-center justify-center transform -translate-x-1/2"
            :style="{ left: `${compareSliderPosition}%` }"
            @mousedown.stop="startCompareDrag"
          >
            <div class="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"></div>
            <div class="w-6 h-6 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg pointer-events-none">
              <ArrowLeftRight class="w-3 h-3" />
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col items-center gap-2 text-zinc-500">
          <ArrowLeftRight class="w-8 h-8 opacity-50" />
          <span class="text-xs italic text-center px-4">连接图片节点进行对比</span>
        </div>
      </div>

      <div v-if="showGallery" class="flex flex-col gap-1 py-1 pl-0.5 pr-1.5 bg-[#111113] rounded-none border-l border-zinc-800 overflow-y-auto shrink-0" style="width: 44px">
        <div
          v-for="item in upstreamItems"
          :key="'b-' + item.nodeId"
          class="relative rounded-none overflow-hidden cursor-pointer border-2 shrink-0 transition-all"
          :class="[
            selectedB?.nodeId === item.nodeId
              ? 'border-violet-400 ring-1 ring-violet-400/50'
              : 'border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-100'
          ]"
          @click="selectSideB(item)"
        >
          <img :src="item.url" class="w-full aspect-square object-cover" />
        </div>
      </div>

    </div>
  </div>
</template>
