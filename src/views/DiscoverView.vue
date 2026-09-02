<script setup lang="ts">
import type { DiscoverCase } from '@/components/discover/discover.types'
import { ref } from 'vue'
import DiscoverCaseGallery from '@/components/discover/DiscoverCaseGallery.vue'
import DiscoverCaseDetailDialog from '@/components/discover/DiscoverCaseDetailDialog.vue'
import DiscoverCreationShowcase from '@/components/discover/DiscoverCreationShowcase.vue'
import { useDiscoverCases } from '@/composables/discover/useDiscoverCases'
import { useDiscoverCreation } from '@/composables/discover/useDiscoverCreation'

defineOptions({ name: 'DiscoverView' })

const { startNewCreation } = useDiscoverCreation()
const {
  activeCategory,
  cases,
  categories,
  categoryAccessById,
  errorMessage,
  findCaseById,
  hasMore,
  loadMore,
  loading,
  loadingMore,
  reload,
  removeCase,
  searchCases,
  selectCategory,
  showcaseItems,
  showcaseLoading,
  updateCase,
  updateCaseRecommendation,
} = useDiscoverCases()
const selectedCase = ref<DiscoverCase | null>(null)

function openCaseDetail(caseId: string): void {
  selectedCase.value = findCaseById(caseId)
}

function closeCaseDetail(): void {
  selectedCase.value = null
}

function handleCaseChange(item: DiscoverCase): void {
  updateCase(item.id, item)
}

function handleCaseDeleted(caseId: string): void {
  removeCase(caseId)
  closeCaseDetail()
}
</script>

<template>
  <section class="discover-view" aria-labelledby="discover-page-title">
    <h1 id="discover-page-title" class="discover-sr-only">发现优秀创作案例</h1>
    <div class="discover-view__content">
      <DiscoverCreationShowcase
        :items="showcaseItems"
        :loading="showcaseLoading"
        @create="startNewCreation"
        @select="openCaseDetail"
      />
      <DiscoverCaseGallery
        :active-category="activeCategory"
        :cases="cases"
        :categories="categories"
        :error-message="errorMessage"
        :has-more="hasMore"
        :loading="loading"
        :loading-more="loadingMore"
        @category-change="selectCategory"
        @load-more="loadMore"
        @retry="reload"
        @search="searchCases"
        @select="openCaseDetail"
      />
    </div>
    <DiscoverCaseDetailDialog
      :category-access-by-id="categoryAccessById"
      :item="selectedCase"
      @case-change="handleCaseChange"
      @close="closeCaseDetail"
      @deleted="handleCaseDeleted"
      @recommendation-change="updateCaseRecommendation"
    />
  </section>
</template>

<style scoped src="./DiscoverView.scss"></style>
