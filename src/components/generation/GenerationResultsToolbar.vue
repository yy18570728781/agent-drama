<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DISPLAY_MODE_OPTIONS, GENERATION_TYPE_OPTIONS } from './generationResults.constants'
import GenerationResultsFilterMenu from './GenerationResultsFilterMenu.vue'
import MenuButton from './GenerationResultsMenuButton.vue'
import { ChevronDown, Heart, RotateCw, Trash2 } from '@/components/common/icon/lucide'

type DisplayMode = 'detailed-card' | 'compact-card' | 'table'
type FitMode = 'contain' | 'cover'
type ToolbarMenu = 'view' | 'filter' | 'action'

const emit = defineEmits<{
  'filter-change': [filters: Record<string, unknown>]
  'display-mode-change': [mode: DisplayMode]
  'waterfall-mode-change': [enabled: boolean]
  'display-ratio-change': [ratio: string]
  'display-fit-mode-change': [mode: FitMode]
  'show-failed-change': [enabled: boolean]
  refresh: []
  'open-trash': []
  'batch-action': [action: 'favorite' | 'delete']
}>()

const props = defineProps<{
  displayMode: DisplayMode
  waterfallEnabled: boolean
  displayRatio: string
  displayFitMode: FitMode
  showFailed: boolean
  genType: string
  favoriteOnly: boolean
  showDateGroups: boolean
}>()

const fitModeOptions = [
  { label: '看全图', value: 'contain' as const },
  { label: '铺满', value: 'cover' as const },
]
const ratioOptions = ['1:1', '4:3', '3:4', '16:9', '9:16']
const activeMenu = ref<ToolbarMenu | null>(null)
const refreshRotation = ref(0)
const activeDisplayModeOption = computed(() => DISPLAY_MODE_OPTIONS.find(option => option.value === props.displayMode) ?? DISPLAY_MODE_OPTIONS[0])
const activeFilterOption = computed(() => GENERATION_TYPE_OPTIONS.find(option => option.id === props.genType) ?? GENERATION_TYPE_OPTIONS[0])

function toggleMenu(menu: ToolbarMenu): void {
  activeMenu.value = activeMenu.value === menu ? null : menu
}

function runAction(action: 'refresh' | 'open-trash' | 'batch-favorite' | 'batch-delete'): void {
  if (action === 'refresh') emit('refresh')
  if (action === 'open-trash') emit('open-trash')
  if (action === 'batch-favorite') emit('batch-action', 'favorite')
  if (action === 'batch-delete') emit('batch-action', 'delete')
  activeMenu.value = null
}

function handleRefreshClick(event: MouseEvent): void {
  if (event.detail > 0) refreshRotation.value += 720
  runAction('refresh')
}

function toggleFilterOption(option: 'favorite' | 'date-group'): void {
  emit('filter-change', {
    search: '',
    time: 'all',
    startDate: '',
    endDate: '',
    genType: props.genType,
    favoriteOnly: option === 'favorite' ? !props.favoriteOnly : props.favoriteOnly,
    showDateGroups: option === 'date-group' ? !props.showDateGroups : props.showDateGroups,
  })
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.closest('.results-toolbar')) activeMenu.value = null
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div class="results-toolbar">
    <div class="toolbar-side toolbar-side-left">
      <div class="toolbar-menu-wrap">
        <button class="toolbar-menu-trigger" :class="{ active: activeMenu === 'view' }" type="button" :title="`切换视图（当前：${activeDisplayModeOption.label}）`" :aria-label="`切换视图，当前为${activeDisplayModeOption.label}`" aria-controls="card-view-options" :aria-expanded="activeMenu === 'view'" @click="toggleMenu('view')">
          <component :is="activeDisplayModeOption.icon" :size="13" />
          <span>{{ activeDisplayModeOption.label }}</span>
          <ChevronDown :size="12" class="menu-chevron" />
        </button>
        <section v-if="activeMenu === 'view'" id="card-view-options" class="toolbar-menu-panel view-menu-panel" aria-label="视图设置选项">
          <p class="menu-section-title">布局方式</p>
          <div class="menu-option-grid three-columns">
            <button
              v-for="option in DISPLAY_MODE_OPTIONS"
              :key="option.value"
              class="menu-option-card"
              :class="{ active: props.displayMode === option.value }"
              type="button"
              :aria-pressed="props.displayMode === option.value"
              @click="emit('display-mode-change', option.value)"
            >
              <component :is="option.icon" :size="14" />
              <span>{{ option.label }}</span>
            </button>
          </div>
          <button class="menu-toggle-row" type="button" :aria-pressed="props.waterfallEnabled" @click="emit('waterfall-mode-change', !props.waterfallEnabled)">
            <span>瀑布流模式</span>
            <span class="menu-switch" :class="{ active: props.waterfallEnabled }" aria-hidden="true"><i /></span>
          </button>
          <template v-if="!props.waterfallEnabled">
            <p class="menu-section-title">画面适配</p>
            <div class="menu-option-grid two-columns">
              <button
                v-for="option in fitModeOptions"
                :key="option.value"
                class="menu-text-option"
                :class="{ active: props.displayFitMode === option.value }"
                type="button"
                :aria-pressed="props.displayFitMode === option.value"
                @click="emit('display-fit-mode-change', option.value)"
              >{{ option.label }}</button>
            </div>
            <p class="menu-section-title">显示比例</p>
            <div class="ratio-options">
              <button
                v-for="ratio in ratioOptions"
                :key="ratio"
                class="ratio-option"
                :class="{ active: props.displayRatio === ratio }"
                type="button"
                :aria-pressed="props.displayRatio === ratio"
                @click="emit('display-ratio-change', ratio)"
              >{{ ratio }}</button>
            </div>
          </template>
        </section>
      </div>

      <div class="toolbar-menu-wrap">
        <button class="toolbar-menu-trigger" :class="{ active: activeMenu === 'filter' }" type="button" :title="`筛选结果（当前：${activeFilterOption.label}）`" :aria-label="`筛选结果，当前为${activeFilterOption.label}`" aria-controls="card-filter-options" :aria-expanded="activeMenu === 'filter'" @click="toggleMenu('filter')">
          <component :is="activeFilterOption.icon" :size="13" />
          <span>{{ activeFilterOption.label }}</span>
          <ChevronDown :size="12" class="menu-chevron" />
        </button>
        <section v-if="activeMenu === 'filter'" id="card-filter-options" class="toolbar-menu-panel filter-menu-panel" aria-label="筛选选项">
          <GenerationResultsFilterMenu
            :gen-type="props.genType"
            :favorite-only="props.favoriteOnly"
            :show-date-groups="props.showDateGroups"
            @filter-change="emit('filter-change', $event)"
          />
        </section>
      </div>

      <div class="toolbar-checkbox-group" role="group" aria-label="显示选项">
        <label class="toolbar-checkbox">
          <input type="checkbox" :checked="props.showFailed" @change="emit('show-failed-change', !props.showFailed)">
          <span>失败结果</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" :checked="props.favoriteOnly" @change="toggleFilterOption('favorite')">
          <span>收藏结果</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" :checked="props.showDateGroups" @change="toggleFilterOption('date-group')">
          <span>日期分组</span>
        </label>
      </div>
    </div>

    <div class="toolbar-side toolbar-side-right">
      <div class="toolbar-direct-group" aria-label="结果操作">
        <button class="toolbar-menu-trigger" type="button" aria-label="刷新结果" @click="handleRefreshClick">
          <i class="refresh-icon" :style="{ transform: `rotate(${refreshRotation}deg)` }" aria-hidden="true"><RotateCw :size="13" /></i>
          <span>刷新结果</span>
        </button>
        <button class="toolbar-menu-trigger" type="button" aria-label="打开回收站" @click="runAction('open-trash')">
          <Trash2 :size="13" /><span>回收管理</span>
        </button>
      </div>

      <div class="toolbar-menu-wrap">
        <button class="toolbar-menu-trigger batch-menu-trigger" :class="{ active: activeMenu === 'action' }" type="button" aria-label="批量操作" aria-controls="card-batch-options" :aria-expanded="activeMenu === 'action'" @click="toggleMenu('action')">
          <span>批量</span>
          <ChevronDown :size="12" class="menu-chevron" />
        </button>
        <section v-if="activeMenu === 'action'" id="card-batch-options" class="toolbar-menu-panel action-menu-panel" aria-label="批量操作选项">
          <p class="menu-section-title">批量操作</p>
          <div class="action-menu-grid">
            <MenuButton :icon="Heart" label="批量收藏" @click="runAction('batch-favorite')" />
            <MenuButton :icon="Trash2" label="批量删除" danger @click="runAction('batch-delete')" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped src="./GenerationResultsToolbar.css"></style>
