<script setup lang="ts">
import type { DiscoverCase, DiscoverCategory } from './discover.types'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search } from '@/components/common/icon/lucide'
import DiscoverCaseCard from './DiscoverCaseCard.vue'

defineOptions({ name: 'DiscoverCaseGallery' })

const props = defineProps<{
  activeCategory: DiscoverCategory
  cases: readonly DiscoverCase[]
  categories: readonly DiscoverCategory[]
  errorMessage: string
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
}>()

const emit = defineEmits<{
  categoryChange: [category: DiscoverCategory]
  loadMore: []
  retry: []
  search: [keyword: string]
  select: [workflowId: string]
}>()

const searchQuery = ref('')
const loadMoreTrigger = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

function selectCategory(category: DiscoverCategory): void {
  emit('categoryChange', category)
}

function handleSelect(workflowId: string): void {
  emit('select', workflowId)
}

function handleRetry(): void {
  emit('retry')
}

function observeLoadMoreTrigger(): void {
  const trigger = loadMoreTrigger.value
  if (!loadMoreObserver || !trigger) return
  loadMoreObserver.unobserve(trigger)
  loadMoreObserver.observe(trigger)
}

function handleLoadMoreIntersection(entries: IntersectionObserverEntry[]): void {
  if (!entries.some((entry) => entry.isIntersecting)) return
  if (props.loading || props.loadingMore || !props.hasMore) return
  emit('loadMore')
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  loadMoreObserver = new IntersectionObserver(handleLoadMoreIntersection, {
    rootMargin: '320px 0px',
  })
  observeLoadMoreTrigger()
})

watch(
  () => [props.loading, props.loadingMore, props.hasMore] as const,
  ([loading, loadingMore, hasMore]) => {
    if (!loading && !loadingMore && hasMore) observeLoadMoreTrigger()
  },
  { flush: 'post' },
)

watch(searchQuery, (keyword) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emit('search', keyword.trim()), 300)
})

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect()
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <section class="discover-gallery" aria-labelledby="discover-gallery-title">
    <header class="discover-gallery__sticky">
      <h2 id="discover-gallery-title">优秀案例</h2>

      <div class="discover-gallery__toolbar">
        <nav class="discover-gallery__categories" aria-label="案例分类">
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            :class="{ 'is-active': category === activeCategory }"
            :aria-pressed="category === activeCategory"
            :disabled="loading"
            @click="selectCategory(category)"
          >
            {{ category }}
          </button>
        </nav>

        <label class="discover-gallery__search">
          <span class="discover-sr-only">搜索优秀案例</span>
          <input
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="请输入搜索内容"
          >
          <Search :size="14" :stroke-width="1.8" aria-hidden="true" />
        </label>
      </div>
    </header>

    <p class="discover-sr-only" aria-live="polite">
      当前显示 {{ cases.length }} 个案例
    </p>

    <div v-if="loading" class="discover-gallery__empty" role="status">
      <p>案例加载中...</p>
    </div>

    <div v-else-if="errorMessage && !cases.length" class="discover-gallery__empty" role="alert">
      <p>{{ errorMessage }}</p>
      <button type="button" @click="handleRetry">重新加载</button>
    </div>

    <div v-else-if="cases.length" class="discover-gallery__grid">
      <DiscoverCaseCard
        v-for="item in cases"
        :key="item.id"
        :item="item"
        @select="handleSelect"
      />
    </div>

    <div v-else class="discover-gallery__empty" role="status">
      <p>没有找到匹配的案例</p>
    </div>

    <div ref="loadMoreTrigger" class="discover-gallery__pagination" aria-live="polite">
      <p v-if="loadingMore">正在加载更多案例...</p>
      <template v-else-if="errorMessage && cases.length">
        <p>{{ errorMessage }}</p>
        <button type="button" @click="handleRetry">重新加载</button>
      </template>
    </div>
  </section>
</template>

<style scoped src="./DiscoverCaseGallery.scss"></style>
