<template>
  <!-- Primary params (toolbar buttons) -->
  <template v-for="item in primaryItems" :key="item.name">
    <ParamPopover :item="item" v-model="formData[item.name]" />
  </template>

  <!-- Advanced params (single popover, inline content) -->
  <el-popover
    v-if="advancedItems.length > 0"
    trigger="click"
    :width="360"
    role="dialog"
    popper-class="dark-popover topaz-param-popover"
    placement="top-start"
  >
    <template #reference>
      <button class="toolbar-select-btn">
        <span class="btn-value">高级调整</span>
        <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
      </button>
    </template>
    <div class="adv-content">
      <template v-for="item in advancedItems" :key="item.name">
        <div v-if="isCustomResVisible(item.name)" class="adv-row">
          <span class="adv-label">{{ item.label }}</span>
          <div class="adv-slider">
            <el-slider
              v-model="formData[item.name]"
              :min="(item as SliderItem).min"
              :max="(item as SliderItem).max"
              :step="(item as SliderItem).step"
              :show-tooltip="false"
            />
          </div>
          <span class="adv-val">{{ formatNum(item, formData[item.name]) }}</span>
        </div>
        <div v-else-if="!isCustomResField(item.name)" class="adv-row">
          <span class="adv-label">{{ item.label }}</span>
          <div v-if="item.kind === 'select'" class="adv-chips">
            <button
              v-for="opt in (item as SelectItem).options"
              :key="String(opt.value)"
              class="adv-chip"
              :class="{ active: formData[item.name] === opt.value }"
              @click="formData[item.name] = opt.value"
            >{{ opt.label }}</button>
          </div>
          <template v-else>
            <div class="adv-slider">
              <el-slider
                v-model="formData[item.name]"
                :min="(item as SliderItem).min"
                :max="(item as SliderItem).max"
                :step="(item as SliderItem).step"
                :show-tooltip="false"
              />
            </div>
            <span class="adv-val">{{ formatNum(item, formData[item.name]) }}</span>
          </template>
        </div>
      </template>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import {
  TVAI_UP_PARAMS,
  TVAI_FI_PARAMS,
} from '@/services/generation/topaz.constants'
import type { ModelParamSchema } from '@/api/models'
import ParamPopover from './ParamPopover.vue'

type OptionItem = { value: string; label: string }
type SelectItem = { name: string; label: string; kind: 'select'; options: OptionItem[] }
type SliderItem = { name: string; label: string; kind: 'slider'; min: number; max: number; step: number }
type RenderItem = SelectItem | SliderItem

const props = defineProps<{
  modelType: 'up' | 'fi'
  initialValues?: Record<string, any>
}>()

const emit = defineEmits<{
  change: [data: Record<string, any>]
}>()

const PRIMARY_NAMES_UP = new Set(['topaz_model', 'scale', 'noise', 'details'])
const PRIMARY_NAMES_FI = new Set(['topaz_model', 'fps', 'slowmo', 'rdt', 'output_format'])
const CUSTOM_RES_FIELDS = new Set(['custom_width', 'custom_height'])

const paramSchema = computed(() => props.modelType === 'fi' ? TVAI_FI_PARAMS : TVAI_UP_PARAMS)
const primaryNames = computed(() => props.modelType === 'fi' ? PRIMARY_NAMES_FI : PRIMARY_NAMES_UP)

const defaults = computed<Record<string, any>>(() => {
  const d: Record<string, any> = {}
  paramSchema.value.forEach((p) => {
    if (p.default !== undefined) d[p.name] = p.default
  })
  return d
})

const formData = reactive<Record<string, any>>({ ...defaults.value })

function buildSliderItem(p: ModelParamSchema): RenderItem {
  const isFloat = p.type === 'float'
  const range = (p.max ?? 100) - (p.min ?? 0)
  return {
    name: p.name,
    label: p.label,
    kind: 'slider',
    min: p.min ?? 0,
    max: p.max ?? 100,
    step: isFloat ? (range <= 1 ? 0.01 : 0.1) : 1,
  }
}

function toRenderItem(p: ModelParamSchema): RenderItem {
  if (p.type === 'select') {
    return {
      name: p.name,
      label: p.label,
      kind: 'select',
      options: (p.options || []) as OptionItem[],
    }
  }
  return buildSliderItem(p)
}

const primaryItems = computed(() =>
  paramSchema.value
    .filter((p) => p.name !== 'file_urls' && primaryNames.value.has(p.name))
    .map(toRenderItem),
)

const advancedItems = computed(() =>
  paramSchema.value
    .filter((p) => p.name !== 'file_urls' && !primaryNames.value.has(p.name))
    .map(toRenderItem),
)

function isCustomResField(name: string): boolean {
  return CUSTOM_RES_FIELDS.has(name)
}

function isCustomResVisible(name: string): boolean {
  if (!CUSTOM_RES_FIELDS.has(name)) return false
  return formData.output_resolution === 'custom'
}

function formatNum(item: RenderItem, val: any): string {
  if (item.kind !== 'slider') return String(val ?? '')
  const num = Number(val ?? 0)
  if (item.step >= 1) return String(Math.round(num))
  if (item.step >= 0.1) return num.toFixed(1)
  return num.toFixed(2)
}

watch(
  () => props.modelType,
  () => {
    Object.keys(formData).forEach(k => delete formData[k])
    Object.assign(formData, defaults.value)
  },
)

watch(
  () => props.initialValues,
  (values) => {
    if (!values) return
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null && k in formData) {
        formData[k] = v
      }
    }
  },
  { immediate: false },
)

watch(formData, (val) => {
  emit('change', { ...val })
}, { deep: true })
</script>

<style scoped src="./TopazParamForm.css"></style>

<style>
.topaz-param-popover.el-popover {
  max-width: calc(100vw - 16px);
}
</style>
