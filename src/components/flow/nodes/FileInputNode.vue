<script setup>
import { computed, provide } from 'vue'
import TextNode from './TextNode.vue'
import ImageNode from './ImageNode.vue'
import VideoNode from './VideoNode.vue'
import AudioNodeComponent from './AudioNodeComponent.vue'
import FlowNodeDragOutButton from './FlowNodeDragOutButton.vue'
import { useFlowNodeDragOut } from './useFlowNodeDragOut'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const mediaType = computed(() => props.data?.mediaType || (props.data?.content ? 'text' : 'image'))
const originalNodeType = computed(() => (
  props.data?.defaultCapability
  || props.data?.capability
  || props.data?._genState?.capability
  || props.data?.request?.capability
  || props.type
  || ''
))
const childUltraLightNodeMode = computed(() => false)
const nodeData = computed(() => props.data || {})

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

const legacyType = computed(() => {
  if (mediaType.value === 'text') return 'text_input'
  if (mediaType.value === 'video') return 'video_input'
  if (mediaType.value === 'audio') return 'file_input'
  return 'image_input'
})
</script>

<template>
  <div class="flow-media-node-wrap" :class="{ 'is-dragging-out': isDraggingOut }">
    <component
      :is="resolvedComponent"
      :id="id"
      :data="data"
      :selected="selected"
      :type="legacyType"
      :node-type="originalNodeType"
    />
    <FlowNodeDragOutButton
      :visible="canDragOut && selected"
      @dragstart="handleDragOutStart"
      @dragend="handleDragOutEnd"
    />
  </div>
</template>

<style scoped>
.flow-media-node-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.flow-media-node-wrap.is-dragging-out {
  opacity: 0.76;
  filter: saturate(1.08) brightness(1.04);
}
</style>
