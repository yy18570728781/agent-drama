<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AlertCircle, Inbox, Loader2, Plus, Search } from '@/components/common/icon/lucide'
import SubjectCard from '@/components/subjects/SubjectCard.vue'
import type { Subject } from '@/api/subjects'

const props = defineProps<{
  subjects: Subject[]
  totalCount: number
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  errorMessage: string
}>()
const emit = defineEmits<{
  create: []
  edit: [subject: Subject]
  addToCanvas: [subject: Subject]
  rename: [subject: Subject]
  delete: [subject: Subject]
  loadMore: []
}>()
const searchName = defineModel<string>('searchName', { default: '' })
const scrollRef = ref<HTMLElement | null>(null)

async function fillViewport(): Promise<void> {
  await nextTick()
  const element = scrollRef.value
  if (!element || props.loading || props.loadingMore || !props.hasMore) return
  const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
  if (remaining <= 160) emit('loadMore')
}

function handleScroll(): void {
  void fillViewport()
}

watch(
  [() => props.subjects.length, () => props.loading, () => props.loadingMore, () => props.hasMore],
  () => { void fillViewport() },
  { flush: 'post' },
)
</script>

<template>
  <div class="subject-library-content">
    <div class="subject-content-toolbar">
      <button class="create-subject-button" type="button" @click="emit('create')">
        <Plus :size="17" /><span>新建主体</span>
      </button>
      <label class="subject-search">
        <Search :size="16" />
        <input v-model="searchName" type="search" placeholder="搜索主体名称" />
      </label>
    </div>

    <div ref="scrollRef" class="subject-scroll" @scroll.passive="handleScroll">
      <div v-if="loading" class="subject-library-state">
        <Loader2 :size="20" class="spin" />正在加载主体
      </div>
      <div v-else-if="errorMessage" class="subject-library-state error">
        <AlertCircle :size="20" />{{ errorMessage }}
      </div>
      <div v-else-if="!subjects.length" class="subject-library-state empty">
        <Inbox :size="30" /><strong>暂无主体</strong><span>新建主体或切换其他文件夹</span>
      </div>
      <div v-else class="subject-grid">
        <SubjectCard
          v-for="subject in subjects"
          :key="subject.id"
          :subject="subject"
          @edit="emit('edit', $event)"
          @add-to-canvas="emit('addToCanvas', $event)"
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
        />
      </div>
      <div v-if="loadingMore" class="subject-pagination-state">
        <Loader2 :size="15" class="spin" />正在加载更多主体
      </div>
      <div v-else-if="subjects.length && !hasMore" class="subject-pagination-state">
        共 {{ totalCount }} 个主体，没有更多了
      </div>
    </div>
  </div>
</template>

<style scoped src="./SubjectLibraryContent.scss"></style>
