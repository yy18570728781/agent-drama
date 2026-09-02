<script setup lang="ts">
import { ImagePlus, LoaderCircle } from '@/components/common/icon/lucide'

defineOptions({ name: 'DiscoverCaseCover' })

defineProps<{
  alt: string
  canManage: boolean
  image: string
  pending: boolean
  video?: string
}>()

const emit = defineEmits<{
  selectCover: [file: File]
}>()

function selectCover(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (file) emit('selectCover', file)
}
</script>

<template>
  <div class="discover-case-cover">
    <img v-if="image" :src="image" :alt="alt">
    <video
      v-else-if="video"
      :src="video"
      controls
      playsinline
      preload="metadata"
    ></video>
    <div v-else class="discover-case-cover__empty">
      <span>暂无案例封面</span>
      <label v-if="canManage" :class="{ 'is-pending': pending }">
        <LoaderCircle v-if="pending" class="discover-case-cover__spinner" :size="15" aria-hidden="true" />
        <ImagePlus v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ pending ? '设置中...' : '设置封面' }}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          :disabled="pending"
          @change="selectCover"
        >
      </label>
    </div>
  </div>
</template>

<style scoped src="./DiscoverCaseCover.scss"></style>
