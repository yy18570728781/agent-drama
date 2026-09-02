<script setup lang="ts">
import { computed } from 'vue'
import { GENERATION_TYPE_OPTIONS } from './generationResults.constants'
import MenuButton from './GenerationResultsMenuButton.vue'

type FilterOverrides = { genType?: string; favoriteOnly?: boolean; showDateGroups?: boolean }

const props = defineProps<{
  genType: string
  favoriteOnly: boolean
  showDateGroups: boolean
}>()

const emit = defineEmits<{
  'filter-change': [filters: Record<string, unknown>]
}>()

const typeFilterItems = computed(() => (
  GENERATION_TYPE_OPTIONS.map(item => ({ ...item, kind: 'type' as const, active: props.genType === item.id }))
))

function emitFilterChange(overrides: FilterOverrides): void {
  emit('filter-change', {
    search: '',
    time: 'all',
    startDate: '',
    endDate: '',
    genType: overrides.genType ?? props.genType,
    favoriteOnly: overrides.favoriteOnly ?? props.favoriteOnly,
    showDateGroups: overrides.showDateGroups ?? props.showDateGroups,
  })
}

function selectFilter(_kind: 'type', id: string): void {
  emitFilterChange({ genType: id })
}
</script>

<template>
  <div class="results-filter-menu" aria-label="结果筛选">
    <section class="filter-section">
      <p class="filter-section-title">媒体类型</p>
      <div class="results-filter-grid type-grid">
        <MenuButton
          v-for="item in typeFilterItems"
          :key="item.id"
          :active="item.active"
          :icon="item.icon"
          :label="item.label"
          @click="selectFilter(item.kind, item.id)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.results-filter-menu,
.filter-section {
  display: flex;
  flex-direction: column;
}

.results-filter-menu {
  gap: 8px;
}

.filter-section {
  gap: 6px;
}

.filter-section-title {
  margin: 0 2px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.results-filter-grid {
  display: grid;
  gap: 5px;
}

.type-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
</style>
