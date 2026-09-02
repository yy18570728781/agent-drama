<template>
  <div ref="overlayRef" class="video-ref-editor-overlay" @dragstart="onOverlayDragStart" @dragend="onOverlayDragEnd">
    <div class="video-ref-editor-modal" @click.stop>
      <!-- 顶部标题栏 -->
      <div class="video-ref-editor-header">
        <div class="video-ref-editor-title">
          <Video :size="16" />
          <span>视频编辑器</span>
          <span class="video-ref-editor-index">{{ currentIndex + 1 }} / {{ totalCount }}</span>
        </div>
        <div class="video-ref-editor-nav">
          <button class="video-ref-editor-nav-btn" :disabled="currentIndex === 0" @click="$emit('prev')">‹</button>
          <button class="video-ref-editor-nav-btn" :disabled="currentIndex >= totalCount - 1" @click="$emit('next')">›</button>
        </div>
        <button class="video-ref-editor-close" @click="handleClose"><X :size="18" /></button>
      </div>

      <VideoReferenceEditorContent
        ref="contentRef"
        :video-url="videoUrl"
        :video-file="videoFile"
        :initial-video-urls="initialVideoUrls"
        @apply="onApply"
        @close="$emit('close')"
        @capture-frame="$emit('capture-frame', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Video, X } from '@/components/common/icon/lucide'
import { ElMessageBox } from 'element-plus'
import VideoReferenceEditorContent from './VideoReferenceEditorContent.vue'

interface Props {
  videoUrl?: string
  videoFile?: File
  currentIndex?: number
  totalCount?: number
  initialVideoUrls?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  currentIndex: 0,
  totalCount: 1,
})
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'apply', data: any): void
  (e: 'capture-frame', data: { url: string; file: File; trackIndex?: number }): void
}>()

const overlayRef = ref<HTMLElement | null>(null)
const contentRef = ref<InstanceType<typeof VideoReferenceEditorContent> | null>(null)
const suppressClick = ref(false)

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

function onOverlayDragStart() {
  suppressClick.value = true
}

function onOverlayDragEnd() {
  setTimeout(() => { suppressClick.value = false }, 0)
}

async function handleClose() {
  if (suppressClick.value) return
  if (!contentRef.value?.isDirty) {
    emit('close')
    return
  }
  try {
    await ElMessageBox.confirm('尚未应用替换，是否直接退出？', '提示', {
      confirmButtonText: '替换',
      cancelButtonText: '退出',
      distinguishCancelAndClose: true,
      closeOnClickModal: false,
      type: 'warning',
      appendTo: overlayRef.value || undefined,
    })
    contentRef.value?.applyVideoEdit?.()
  } catch (action) {
    if (action === 'cancel') {
      emit('close')
    }
  }
}

function onApply(data: any) {
  emit('apply', data)
}
</script>

<style scoped src="./VideoReferenceEditor.css"></style>
