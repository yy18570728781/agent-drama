<script setup>
import { computed, provide } from 'vue'
import TextNode from './TextNode.vue'
import ImageNode from './ImageNode.vue'
import VideoNode from './VideoNode.vue'
import AudioNodeComponent from './AudioNodeComponent.vue'
import FlowNodeDragOutButton from './FlowNodeDragOutButton.vue'
import { useFlowNodeDragOut } from './useFlowNodeDragOut'
import { getTextureMaterialPortLabel } from '@/composables/flow/textureMaterialConsumerNode'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const mediaType = computed(() => props.data?.mediaType || (props.data?.content ? 'text' : 'image'))
const childUltraLightNodeMode = computed(() => false)
const childData = computed(() => ({
  ...(props.data || {}),
  _suppressEmptyMediaPlaceholderIcon: true,
}))
const nodeData = computed(() => props.data || {})
const pbrChannelLabel = computed(() => {
  const channel = String(props.data?.pbrChannel || '').trim()
  return channel ? getTextureMaterialPortLabel(channel) : ''
})

provide('flowUltraLightNodeMode', childUltraLightNodeMode)

const { canDragOut, isDraggingOut, handleDragOutStart, handleDragOutEnd } = useFlowNodeDragOut(
  String(props.id || ''),
  mediaType,
  nodeData,
)

const resolvedComponent = computed(() => {
  if (mediaType.value === 'text') return TextNode
  if (mediaType.value === 'video') return VideoNode
  if (mediaType.value === 'audio') return AudioNodeComponent
  return ImageNode
})
</script>

<template>
  <div class="aigc-result-node" :class="{ 'is-dragging-out': isDraggingOut }">
    <div v-if="pbrChannelLabel" class="aigc-result-node__channel">{{ pbrChannelLabel }}</div>
    <component
      :is="resolvedComponent"
      :id="id"
      :data="childData"
      :selected="selected"
    />
    <FlowNodeDragOutButton
      :visible="canDragOut && selected"
      @dragstart="handleDragOutStart"
      @dragend="handleDragOutEnd"
    />
  </div>
</template>

<style scoped>
.aigc-result-node {
  position: relative;
  width: 100%;
  height: 100%;
}

.aigc-result-node__channel {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(12, 14, 18, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  font-size: 10px;
  line-height: 1.4;
  pointer-events: none;
}

.aigc-result-node.is-dragging-out {
  opacity: 0.76;
  filter: saturate(1.08) brightness(1.04);
}
</style>
