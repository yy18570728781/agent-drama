<template>
  <div class="reference-area-root">
    <FileUrlsParameter
      v-if="hasFileParam"
      ref="fileUrlsParamRef"
      :file-param="fileParamDef"
      :images="refImages"
      :max-items="maxItems"
      :max-items-warning="maxItemsWarning"
      :delegate-external-drop="delegateExternalDrop"
      :delegate-preview="delegatePreview"
      @update:images="onRefImagesUpdate"
      @preview="onThumbClick"
      @remove="onRefImageRemove"
      @clear-all="onClearAllReferences"
      @auto-collapse-change="onReferenceAutoCollapseChange"
      @external-drop="onExternalDrop"
    />

    <!-- 参考编辑界面 -->
    <Teleport to="body">
      <VideoReferenceEditor
        v-if="previewIndex >= 0 && editorVideoUrl && editorVideoFile"
        :video-url="editorVideoUrl"
        :video-file="editorVideoFile"
        :current-index="previewIndex"
        :total-count="refImages.length"
        @close="closeRefEditor"
        @prev="previewIndex--"
        @next="previewIndex++"
        @apply="onVideoEditApply"
      />
      <ImageReferenceEditor
        v-else-if="previewIndex >= 0 && editorImageUrl && editorImageFile"
        :image-url="editorImageUrl"
        :image-file="editorImageFile"
        :current-index="previewIndex"
        :total-count="refImages.length"
        @close="closeRefEditor"
        @prev="previewIndex--"
        @next="previewIndex++"
        @apply="onImageEditApply"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import FileUrlsParameter from './FileUrlsParameter.vue'
import VideoReferenceEditor from './VideoReferenceEditor.vue'
import ImageReferenceEditor from './ImageReferenceEditor.vue'
import type { ReferenceImage } from './referenceMedia.types'
import { useReferenceArea } from './useReferenceArea'

const props = defineProps<{
  refImages: ReferenceImage[]
  hasFileParam: boolean
  fileParamDef: any
  maxItems: number | undefined
  maxItemsWarning: string
  isPromptBelowReference: boolean
  isTextExpanded: boolean
  delegateExternalDrop?: boolean
  delegatePreview?: boolean
}>()

const emit = defineEmits<{
  'update:ref-images': [images: ReferenceImage[]]
  'preview': [index: number]
  'remove': [index: number]
  'clear-all': []
  'auto-collapse-change': [enabled: boolean]
  'reference-url-updated': [index: number, url: string]
  'before-remove-reference': [item: any]
  'request-payload-change': []
  'remove-upstream': [nodeId: string, paramKey: string]
  'files-dropped': [payload: { files?: File[]; urls?: string[]; assetInfo?: unknown; replaceIndex?: number }]
}>()

const {
  fileUrlsParamRef,
  previewIndex,
  editorImageUrl,
  editorImageFile,
  editorVideoUrl,
  editorVideoFile,
  appendReferenceImageUnique,
  hasReferenceUrl,
  onRefImagesUpdate,
  onThumbClick,
  onRefImageRemove,
  onClearAllReferences,
  closeRefEditor,
  onVideoEditApply,
  onImageEditApply,
  onReferenceAutoCollapseChange,
  onExternalDrop,
} = useReferenceArea(props, emit)

defineExpose({
  appendReferenceImageUnique,
  hasReferenceUrl,
  closeRefEditor,
  fileUrlsParamRef,
})
</script>
