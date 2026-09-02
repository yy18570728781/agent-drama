<script setup lang="ts">
import FlowMultiSelectionCompareDialog, { type CompareSelectionItem } from './FlowMultiSelectionCompareDialog.vue'
import VideoReferenceEditor from '@/components/generation/VideoReferenceEditor.vue'

defineProps<{
  compareVisible: boolean
  compareItems: CompareSelectionItem[]
  videoVisible: boolean
  videoUrls: string[]
  videoSourceNodeIds: string[]
}>()

defineEmits<{
  'update:compareVisible': [value: boolean]
  'update:videoVisible': [value: boolean]
  'capture-frame': [data: { url: string; sourceNodeId: string }]
}>()
</script>

<template>
  <FlowMultiSelectionCompareDialog
    :visible="compareVisible"
    :items="compareItems"
    title="图片对比"
    subtitle="基于当前多选顺序保留上下文，快速比对图片差异"
    @update:visible="$emit('update:compareVisible', $event)"
  />

  <VideoReferenceEditor
    v-if="videoVisible && videoUrls.length"
    :initial-video-urls="videoUrls"
    @close="$emit('update:videoVisible', false)"
    @capture-frame="$emit('capture-frame', { url: $event.url, sourceNodeId: videoSourceNodeIds[$event.trackIndex ?? 0] || videoSourceNodeIds[0] })"
  />
</template>
