<template>
  <div :class="['filter-bar w-full', { 'is-flat': flat }]">
    <template v-if="showSearch">
      <div v-if="isSearchActive" class="search-box">
        <Search :size="16" class="search-icon shrink-0" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="搜索"
          class="search-input"
          @blur="handleSearchBlur"
        />
      </div>
      <button v-else type="button" class="search-toggle" @click="activateSearch">
        <Search :size="16" />
      </button>

      <div class="filter-divider"></div>
    </template>

    <div class="filter-group" aria-label="资源类型筛选">
      <button
        v-for="opt in genTypeOptions"
        :key="opt.id"
        type="button"
        :title="opt.label"
        :aria-label="opt.label"
        :class="['filter-chip', { 'is-active': genTypeFilter === opt.id, 'is-icon-only': iconOnlyTypeFilters }]"
        @click="genTypeFilter = opt.id"
      >
        <component :is="opt.icon" :size="chipIconSize" class="chip-icon" />
        <span v-if="!iconOnlyTypeFilters">{{ opt.label }}</span>
      </button>
    </div>

    <div v-if="showFavoriteFilter" class="filter-divider"></div>

    <label v-if="showFavoriteFilter" class="filter-chip show-group-chip" :class="{ 'is-active': favoriteOnly }">
      <input v-model="favoriteOnly" type="checkbox" class="group-checkbox" />
      <span>只看收藏</span>
    </label>

    <div v-if="showTime" class="filter-divider"></div>

    <div v-if="showTime" class="filter-group" aria-label="时间筛选">
      <button
        v-for="opt in timeOptions"
        :key="opt.id"
        type="button"
        :class="['filter-chip', { 'is-active': timeFilter === opt.id }]"
        @click="selectTime(opt.id)"
      >
        <component :is="opt.icon" :size="chipIconSize" class="chip-icon" />
        {{ opt.label }}
      </button>

      <el-popover
        v-model:visible="isCustomTimeOpen"
        placement="bottom-start"
        trigger="click"
        :width="280"
        :teleported="false"
        popper-class="history-filter-popover"
        :show-arrow="false"
      >
        <template #reference>
          <button
            type="button"
            :class="['filter-chip', { 'is-active': timeFilter === 'custom' || isCustomTimeOpen }]"
            @click="openCustomTime"
          >
            <Calendar :size="14" class="shrink-0" />
            <span>{{ customTimeButtonLabel }}</span>
          </button>
        </template>

        <div class="custom-time-panel">
          <label class="date-field">
            <span>开始日期</span>
            <input v-model="customStartDate" type="date" class="date-input" />
          </label>

          <label class="date-field">
            <span>结束日期</span>
            <input
              v-model="customEndDate"
              type="date"
              class="date-input"
              :min="customStartDate || undefined"
            />
          </label>

          <div class="custom-time-actions">
            <button type="button" class="ghost-btn" @click="resetCustomTime">重置</button>
            <button type="button" class="primary-btn" :disabled="isCustomRangeInvalid" @click="applyCustomTime">
              应用
            </button>
          </div>
        </div>
      </el-popover>
    </div>

    <div class="filter-divider"></div>

    <label class="filter-chip show-group-chip" :class="{ 'is-active': showDateGroups }">
      <input type="checkbox" v-model="showDateGroups" class="group-checkbox" />
      <span>显示日期分组标题</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Search, Calendar, Image, Video, AudioLines, Box, LayoutGrid } from '@/components/common/icon/lucide'

const props = withDefaults(defineProps<{
  initialSearch?: string
  initialGenType?: string
  initialTimeFilter?: string
  initialStartDate?: string
  initialEndDate?: string
  showAllGenType?: boolean
  showAllTime?: boolean
  showSearch?: boolean
  showTime?: boolean
  showFavoriteFilter?: boolean
  initialFavoriteOnly?: boolean
  flat?: boolean
}>(), {
  initialSearch: '',
  initialGenType: 'all',
  initialTimeFilter: 'all',
  initialStartDate: '',
  initialEndDate: '',
  showAllGenType: true,
  showAllTime: true,
  showSearch: true,
  showTime: true,
  showFavoriteFilter: false,
  initialFavoriteOnly: false,
  flat: false,
})

const emit = defineEmits(['filter-change'])

const defaultGenType = props.showAllGenType ? 'all' : 'image'
const defaultTimeFilter = props.initialTimeFilter === 'custom'
  ? (props.showAllTime ? 'all' : 'week')
  : (props.initialTimeFilter || (props.showAllTime ? 'all' : 'week'))

const isSearchActive = ref(Boolean(props.initialSearch))
const searchQuery = ref(props.initialSearch)
const searchInputRef = ref<HTMLInputElement | null>(null)
const showDateGroups = ref(true)
const favoriteOnly = ref(props.initialFavoriteOnly)

const timeFilter = ref(props.initialTimeFilter || defaultTimeFilter)
const startDate = ref(props.initialStartDate)
const endDate = ref(props.initialEndDate)
const customStartDate = ref(props.initialStartDate)
const customEndDate = ref(props.initialEndDate)
const isCustomTimeOpen = ref(false)

const genTypeFilter = ref(props.initialGenType || defaultGenType)
const chipIconSize = computed(() => props.flat ? 12 : 14)
const iconOnlyTypeFilters = computed(() => props.flat)

const activateSearch = async () => {
  isSearchActive.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

const handleSearchBlur = () => {
  if (!searchQuery.value.trim()) isSearchActive.value = false
}

const genTypeOptions = computed(() => {
  const base = [
    { id: 'image', label: '图片', icon: Image },
    { id: 'video', label: '视频', icon: Video },
    { id: 'audio', label: '音频', icon: AudioLines },
    { id: 'model', label: '模型', icon: Box },
  ]

  return props.showAllGenType ? [{ id: 'all', label: '全部', icon: LayoutGrid }, ...base] : base
})

const timeOptions = computed(() => {
  const base = [
    { id: '3days', label: props.flat ? '近3天' : '最近三天', icon: Calendar },
    { id: 'week', label: props.flat ? '近1周' : '最近一周', icon: Calendar },
    { id: 'month', label: props.flat ? '近1月' : '最近一个月', icon: Calendar },
    { id: '3months', label: props.flat ? '近3月' : '最近三个月', icon: Calendar },
  ]

  return props.showAllTime ? [{ id: 'all', label: '全部', icon: Calendar }, ...base] : base
})

const formatShortDate = (value: string) => {
  const [, month, day] = value.split('-')
  return month && day ? `${month}/${day}` : value
}

const customTimeButtonLabel = computed(() => {
  if (timeFilter.value !== 'custom') return '自定义'
  if (startDate.value && endDate.value) return `${formatShortDate(startDate.value)} - ${formatShortDate(endDate.value)}`
  if (startDate.value) return `${formatShortDate(startDate.value)} 起`
  if (endDate.value) return `至 ${formatShortDate(endDate.value)}`
  return '自定义'
})

const isCustomRangeInvalid = computed(() => {
  return Boolean(customStartDate.value && customEndDate.value && customEndDate.value < customStartDate.value)
})

const selectTime = (id: string) => {
  isCustomTimeOpen.value = false
  timeFilter.value = id
  startDate.value = ''
  endDate.value = ''
}

const openCustomTime = () => {
  customStartDate.value = startDate.value
  customEndDate.value = endDate.value
}

const resetCustomTime = () => {
  customStartDate.value = ''
  customEndDate.value = ''
  isCustomTimeOpen.value = false
  timeFilter.value = defaultTimeFilter
  startDate.value = ''
  endDate.value = ''
}

const applyCustomTime = () => {
  if (isCustomRangeInvalid.value) return
  timeFilter.value = 'custom'
  startDate.value = customStartDate.value
  endDate.value = customEndDate.value
  isCustomTimeOpen.value = false
}

watch([searchQuery, timeFilter, startDate, endDate, genTypeFilter, favoriteOnly, showDateGroups], () => {
  emit('filter-change', {
    search: searchQuery.value,
    time: timeFilter.value,
    startDate: startDate.value,
    endDate: endDate.value,
    genType: genTypeFilter.value,
    favoriteOnly: favoriteOnly.value,
    showDateGroups: showDateGroups.value,
  })
}, { immediate: false })
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  box-shadow: var(--sys-shadow-surface);
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.filter-bar.is-flat {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  padding: 0;
  gap: 6px;
}

.filter-bar:hover {
  background: var(--bg-elevated);
}

.filter-bar.is-flat:hover {
  background: transparent;
}

.search-box {
  min-width: 180px;
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-hover) 78%, transparent);
}

.search-icon {
  color: var(--text-muted);
}

.filter-bar.is-flat .search-box {
  min-width: 156px;
  flex-basis: 180px;
  height: 28px;
  gap: 6px;
  padding: 0 8px;
}

.search-input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.filter-bar.is-flat .search-input {
  font-size: 12px;
}

.search-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-bar.is-flat .search-toggle {
  width: 28px;
  height: 28px;
}

.search-toggle:hover {
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
  color: var(--text-primary);
}

.filter-divider {
  width: 1px;
  height: 18px;
  background: var(--border);
  flex-shrink: 0;
}

.filter-bar.is-flat .filter-divider {
  height: 14px;
}

.filter-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-bar.is-flat .filter-group {
  gap: 4px;
}

.filter-chip {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-hover) 40%, transparent);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chip-icon {
  flex-shrink: 0;
  opacity: 0.9;
}

.filter-bar.is-flat .filter-chip {
  height: 28px;
  padding: 0 10px;
  gap: 5px;
  font-size: 11px;
}

.filter-chip.is-icon-only {
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}

.filter-bar.is-flat .filter-chip.is-icon-only {
  width: 28px;
  min-width: 28px;
}

.filter-chip:hover {
  color: var(--text-primary);
  border-color: var(--border);
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
}

.filter-chip.is-active {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 36%, transparent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
}

.custom-time-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-field span {
  font-size: 12px;
  color: var(--text-secondary);
}

.date-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.custom-time-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.ghost-btn,
.primary-btn {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-btn {
  background: color-mix(in srgb, var(--bg-hover) 68%, transparent);
  color: var(--text-primary);
}

.ghost-btn:hover {
  background: color-mix(in srgb, var(--bg-hover) 88%, transparent);
}

.primary-btn {
  background: var(--accent);
  color: var(--sys-action-primary-fg);
}

.primary-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 85%, white);
}

.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

:deep(.history-filter-popover) {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 12px !important;
  box-shadow: var(--sys-shadow-elevated) !important;
  color: var(--text-primary) !important;
}

:global(html[data-mode='dark']) .date-input {
  color-scheme: dark;
}

.show-group-chip {
  cursor: pointer;
  user-select: none;
}

.group-checkbox {
  width: 13px;
  height: 13px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

:global(html[data-mode='light']) .date-input {
  color-scheme: light;
}

@media (max-width: 900px) {
  .filter-divider {
    display: none;
  }

  .search-box {
    flex-basis: 100%;
  }
}
</style>
