<script setup lang="ts">
import { Copy, Eye } from '@/components/common/icon/lucide'

defineOptions({ name: 'DiscoverCaseDetailActions' })

defineProps<{
  canMakeSame: boolean
  categoryLoading: boolean
  makingSame: boolean
}>()

const emit = defineEmits<{
  makeSame: []
  preview: []
}>()
</script>

<template>
  <div class="discover-case-actions">
    <button type="button" class="is-secondary" @click="emit('preview')">
      <Eye :size="15" :stroke-width="1.8" aria-hidden="true" />
      浏览画布
    </button>
    <button
      v-if="canMakeSame"
      type="button"
      class="is-primary"
      :disabled="makingSame || categoryLoading"
      @click="emit('makeSame')"
    >
      <Copy :size="15" :stroke-width="1.8" aria-hidden="true" />
      {{ categoryLoading ? '正在加载目录...' : '制作同款' }}
    </button>
  </div>
</template>

<style scoped src="./DiscoverCaseDetailActions.scss"></style>
