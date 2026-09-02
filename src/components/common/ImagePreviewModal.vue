<template>
  <ImagePreviewModalContent
    v-bind="forwardedProps"
    v-model:visible="visible"
    v-model:currentIndex="currentIndex"
    @close="emit('close')"
    @navigate="emit('navigate', $event)"
    @reEdit="(image, index) => emit('reEdit', image, index)"
    @regenerate="(image, index) => emit('regenerate', image, index)"
    @toolAction="(tool, image) => emit('toolAction', tool, image)"
    @workflowAction="(action, image) => emit('workflowAction', action, image)"
    @download="emit('download', $event)"
    @copy="emit('copy', $event)"
    @favorite="emit('favorite', $event)"
    @share="emit('share', $event)"
    @delete="emit('delete', $event)"
    @selectHistory="emit('selectHistory', $event)"
    @editImage="emit('editImage')"
    @editVideo="emit('editVideo')"
    @prevRecord="emit('prevRecord')"
    @nextRecord="emit('nextRecord')"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import ImagePreviewModalContent from './ImagePreviewModalContent.vue'

defineOptions({ name: 'ImagePreviewModal' })

interface ImageInfo {
  prompt?: string
  model?: string
  ratio?: string
  size?: string
  createTime?: string
  vendor?: string
  usedTools?: string
  generationHint?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  images: string[]
  initialIndex?: number
  alt?: string
  imageInfo?: ImageInfo | null
  fullMode?: boolean
  showInspector?: boolean
  showActions?: boolean
  showAITools?: boolean
  showWorkflowActions?: boolean
  showFavorite?: boolean
  showShare?: boolean
  showDelete?: boolean
  isFavorited?: boolean
  isVideo?: boolean
  isModel?: boolean
  is360?: boolean
  modelUrl?: string
  recordId?: number | string
  historyItemsOverride?: any[]
  showRecordNav?: boolean
  hasPrevRecord?: boolean
  hasNextRecord?: boolean
}>(), {
  initialIndex: 0,
  alt: 'Preview Image',
  imageInfo: null,
  fullMode: true,
  showInspector: true,
  showActions: true,
  showAITools: true,
  showWorkflowActions: true,
  showFavorite: false,
  showShare: false,
  showDelete: true,
  isFavorited: false,
  isVideo: false,
  isModel: false,
  is360: false,
  modelUrl: '',
  recordId: undefined,
  historyItemsOverride: () => [],
  showRecordNav: false,
  hasPrevRecord: false,
  hasNextRecord: false,
})

const emit = defineEmits<{
  close: []
  navigate: [index: number]
  reEdit: [image: string, index: number]
  regenerate: [image: string, index: number]
  toolAction: [tool: string, image: string]
  workflowAction: [action: string, image: string]
  download: [url: string]
  copy: [url: string]
  favorite: [recordId: string | number]
  share: [image: string]
  delete: [id: number | string]
  selectHistory: [id: number | string]
  editImage: []
  editVideo: []
  prevRecord: []
  nextRecord: []
}>()

const attrs = useAttrs()
const visible = defineModel<boolean>('visible', { default: true })
const currentIndex = defineModel<number>('currentIndex', { default: 0 })
const forwardedProps = computed(() => ({
  ...attrs,
  ...props,
}))
</script>
