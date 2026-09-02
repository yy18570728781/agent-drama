<script setup lang="ts">
import type { DiscoverShowcaseItem } from './discover.types'
import { ArrowRight, Star } from '@/components/common/icon/lucide'
import DiscoverShowcaseAmbientCanvas from './DiscoverShowcaseAmbientCanvas.vue'
import DiscoverShowcaseCard from './DiscoverShowcaseCard.vue'

defineOptions({ name: 'DiscoverCreationShowcase' })

defineProps<{
  items: readonly DiscoverShowcaseItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  create: []
  select: [workflowId: string]
}>()

function handleSelect(workflowId: string): void {
  emit('select', workflowId)
}
</script>

<template>
  <section class="discover-showcase" aria-labelledby="discover-showcase-title">
    <DiscoverShowcaseAmbientCanvas />

    <div class="discover-showcase__layout">
      <div class="discover-showcase__intro">
        <div class="discover-showcase__intro-content">
          <h2 id="discover-showcase-title">
            <span>选择优秀案例</span>
            <span>直接开始 AI-Comic-Director-Canvas 之旅</span>
          </h2>
          <button
            class="discover-showcase__create"
            type="button"
            @click="emit('create')"
          >
            <span>去创作</span>
            <ArrowRight :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="discover-showcase__grid">
        <div v-if="!items.length" class="discover-showcase__empty" role="status">
          <span class="discover-showcase__empty-icon" aria-hidden="true">
            <Star :size="22" :stroke-width="1.7" />
          </span>
          <strong>{{ loading ? '推荐案例加载中...' : '暂无推荐案例' }}</strong>
          <template v-if="!loading">
            <span>请在下方优秀案例详情中设置推荐</span>
          </template>
        </div>
        <DiscoverShowcaseCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          @select="handleSelect"
        />
      </div>
    </div>
  </section>
</template>

<style scoped src="./DiscoverCreationShowcase.scss"></style>
