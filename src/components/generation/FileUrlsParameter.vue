<template>
  <div
    class="file-urls-cards-wrapper"
    :class="{ 'file-urls-cards-wrapper--dragover': areaDragOver }"
    @dragover.prevent.stop="onAreaDragOver"
    @dragleave.stop="onAreaDragLeave"
    @drop.prevent.stop="onAreaDrop"
  >
    <button
      v-if="images.length"
      class="absolute right-0 top-0 z-30 inline-flex h-6 items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 text-[11px] text-white transition hover:bg-black/70"
      @click.stop="clearAllImages"
    >
      清除全部
    </button>
    <div class="file-urls-cards">
      <template v-for="(slot, i) in slotItems" :key="slot.key">
        <div
          class="fu-card"
          :class="{
            'fu-card--has-image': !!getImage(i),
            'fu-card--dragover': dragOverIndex === i,
            'fu-card--reorder-hover': reorderHoverIndex === i || reorderHoverIndex === i + 1,
            'fu-card--insert-before': reorderHoverIndex === i,
            'fu-card--reorder-after': reorderHoverIndex === i + 1,
            'fu-card--dragging': draggedIndex === i,
            'fu-card--reorderable': canReorder && !!getImage(i),
          }"
          :style="getCardStyle(i)"
          :title="getImage(i) ? (canReorder ? '拖动调整顺序' : '点击预览') : ''"
          :draggable="canReorder && !!getImage(i)"
          @click="onReferenceCardClick(i)"
          @dragstart="onCardDragStart($event, i)"
          @dragend="onCardDragEnd"
          @dragover.prevent.stop="onDragOver($event, i)"
          @dragleave.stop="onDragLeave($event, i)"
          @drop.prevent.stop="getImage(i) ? onFilledCardDrop($event, i) : onEmptyCardDrop($event)"
        >
          <template v-if="getImage(i) && !getImage(i)?.uploading">
            <div class="fu-card-thumb">
              <div v-if="isAudioReference(getImage(i))" class="fu-card-audio">
                <div class="fu-card-audio-icon">
                  <AudioLines :size="16" />
                </div>
                <div class="fu-card-audio-wave" aria-hidden="true">
                  <span
                    v-for="height in audioBarHeights"
                    :key="height"
                    :style="{ height: `${height}px` }"
                  ></span>
                </div>
                <span class="fu-card-audio-name">{{ getReferenceName(getImage(i), i) }}</span>
                <button
                  class="fu-card-audio-play"
                  type="button"
                  @click.stop="toggleAudioReference(i)"
                >
                  <Pause v-if="playingAudioIndex === i" :size="13" />
                  <Play v-else :size="13" />
                </button>
              </div>
              <img
                v-else-if="!getImage(i)?.isVideo"
                :src="getImage(i)!.sourceUrl || getImage(i)!.url"
                class="fu-card-media"
                draggable="false"
              />
              <video
                v-else
                :src="getImage(i)!.sourceUrl || getImage(i)!.url"
                class="fu-card-media"
                draggable="false"
                muted
                loop
                playsinline
                preload="metadata"
              />
              <div v-if="getImage(i)?.isVideo" class="fu-card-play-overlay">
                <Play :size="18" class="fu-card-play-icon" />
              </div>
            </div>
            <button
              class="fu-card-dragout"
              title="拖到外部"
              draggable="true"
              @click.stop
              @mouseenter="onExternalDragPrepare(i)"
              @mousedown.stop="onExternalDragPrepare(i)"
              @dragstart.stop="onExternalDragStart($event, i)"
              @dragend.stop="onExternalDragEnd($event, i)"
            >
              <GripHorizontal :size="14" />
            </button>
            <button class="fu-card-remove" @click.stop="removeImage(i)">
              <X :size="10" />
            </button>
          </template>
          <template v-else-if="getImage(i)?.uploading">
            <div class="fu-card-add fu-card-add--uploading">
              <span class="fu-card-upload-spinner" aria-hidden="true"></span>
              <span class="fu-card-upload-label">
                上传中 {{ Math.max(0, Math.min(100, Math.round(getImage(i)?.uploadProgress || 0))) }}%
              </span>
            </div>
          </template>
          <template v-else>
            <div class="fu-card-add">
              <Plus :size="20" />
              <span class="fu-card-label">{{ slot.label }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*,video/*,audio/*,.glb,.gltf,.fbx,.obj,.usdz,.blend,.abc,.dae,.stl,.ply"
      :multiple="fileParam.type !== 'file'"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { AudioLines, GripHorizontal, Pause, Plus, Play, X } from '@/components/common/icon/lucide'
import type { ModelParamSchema } from '@/api/models'
import type { ReferenceExternalDropPayload, ReferenceImage } from './referenceMedia.types'
import { inferReferenceMediaKindFromUrl } from './referenceImage.utils'
import { useFileUrlsParameter } from './useFileUrlsParameter'

const props = defineProps<{
  fileParam: ModelParamSchema
  images: ReferenceImage[]
  maxItems?: number
  maxItemsWarning?: string
  delegateExternalDrop?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:images', images: ReferenceImage[]): void
  (e: 'preview', index: number): void
  (e: 'remove', index: number): void
  (e: 'clear-all'): void
  (e: 'auto-collapse-change', val: boolean): void
  (e: 'external-drop', payload: ReferenceExternalDropPayload): void
}>()

const audioBarHeights = [10, 18, 28, 20, 14]
const playingAudioIndex = ref<number | null>(null)
const audioPlayers = new Map<number, { audio: HTMLAudioElement; url: string }>()

function getReferenceUrl(item: ReferenceImage | null): string {
  return String(item?.sourceUrl || item?.url || '').trim()
}

function isAudioReference(item: ReferenceImage | null): boolean {
  return item?.mediaType === 'audio' || inferReferenceMediaKindFromUrl(getReferenceUrl(item)) === 'audio'
}

function getReferenceName(item: ReferenceImage | null, index: number): string {
  return item?.referenceName || item?.file?.name || `音频${index + 1}`
}

  const {
    fileInputRef,
    areaDragOver,
    dragOverIndex,
  reorderHoverIndex,
  draggedIndex,
  canReorder,
  slotItems,
  getCardStyle,
  getImage,
  clearAllImages,
  onCardClick,
  onExternalDragPrepare,
  onExternalDragStart,
  onExternalDragEnd,
  onCardDragStart,
  onCardDragEnd,
  onFileChange,
  removeImage,
    onDragOver,
    onDragLeave,
    onAreaDragOver,
    onAreaDragLeave,
    onAreaDrop,
    onFilledCardDrop,
  onEmptyCardDrop,
  load_params,
  get_urls,
} = useFileUrlsParameter(props, emit)

function getAudioPlayer(index: number, url: string): HTMLAudioElement {
  const current = audioPlayers.get(index)
  if (current?.url === url) return current.audio
  current?.audio.pause()
  const audio = new Audio(url)
  audio.preload = 'metadata'
  audio.addEventListener('ended', () => {
    if (playingAudioIndex.value === index) playingAudioIndex.value = null
  })
  audioPlayers.set(index, { audio, url })
  return audio
}

function pauseOtherAudio(index: number): void {
  audioPlayers.forEach((player, playerIndex) => {
    if (playerIndex !== index) player.audio.pause()
  })
}

function toggleAudioReference(index: number): void {
  const item = getImage(index)
  const url = getReferenceUrl(item)
  if (!item || !url || !isAudioReference(item)) return
  const audio = getAudioPlayer(index, url)
  if (!audio.paused) {
    audio.pause()
    playingAudioIndex.value = null
    return
  }
  pauseOtherAudio(index)
  audio.play()
    .then(() => {
      playingAudioIndex.value = index
    })
    .catch(() => {
      playingAudioIndex.value = null
    })
}

function onReferenceCardClick(index: number): void {
  const item = getImage(index)
  if (isAudioReference(item)) {
    toggleAudioReference(index)
    return
  }
  onCardClick(index)
}

onBeforeUnmount(() => {
  audioPlayers.forEach((player) => player.audio.pause())
  audioPlayers.clear()
})

defineExpose({ load_params, get_urls })
</script>

<style scoped src="./FileUrlsParameter.css"></style>
