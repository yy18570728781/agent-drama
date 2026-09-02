<template>
  <template v-for="item in renderItems" :key="item.kind === 'combo' ? `combo-${item.comboType}` : item.param.name">
    <!-- Dimension combo: width + height merged -->
    <el-popover
      v-if="item.kind === 'combo'"
      trigger="click"
      :width="280"
      popper-class="dark-popover"
      placement="top-start"
    >
      <template #reference>
        <button class="toolbar-select-btn">
          <span class="btn-value">{{ getDimensionSummary(item, formData) }}</span>
          <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
        </button>
      </template>
      <div class="param-popover">
        <div class="param-title">尺寸</div>

        <div v-if="getDimensionPresets(item).length" class="dimension-section">
          <div class="param-subtitle">快捷预设</div>
          <div class="option-grid">
            <button
              v-for="preset in getDimensionPresets(item)"
              :key="`${preset.width}x${preset.height}`"
              class="option-chip"
              :class="{ active: isDimensionPresetActive(item, preset) }"
              @click="applyDimensionPreset(item, formData, preset)"
            >{{ preset.label }}</button>
          </div>
        </div>

        <div class="dimension-section">
          <div class="param-subtitle">自定义</div>
          <div class="dimension-inputs">
            <div class="dimension-input-group">
              <span class="dimension-label">宽</span>
              <el-input-number
                v-model="formData[item.widthParam.name]"
                :min="item.widthParam.min"
                :max="item.widthParam.max"
                :step="8"
                size="small"
                controls-position="right"
              />
            </div>
            <div class="dimension-input-group">
              <span class="dimension-label">高</span>
              <el-input-number
                v-model="formData[item.heightParam.name]"
                :min="item.heightParam.min"
                :max="item.heightParam.max"
                :step="8"
                size="small"
                controls-position="right"
              />
            </div>
          </div>
        </div>
      </div>
    </el-popover>

    <template v-else>
      <!-- Select type -->
      <el-popover
        v-if="isSelectParam(item.param)"
        trigger="click"
        :width="220"
        popper-class="dark-popover"
        placement="top-start"
      >
        <template #reference>
          <button class="toolbar-select-btn">
            <span class="btn-value">{{ getOptionLabelByValue(item.param, formData[item.param.name]) || getParamTitle(item.param) }}</span>
            <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
          </button>
        </template>
        <div class="param-popover">
          <div class="param-title">{{ getParamTitle(item.param) }}</div>
          <div class="option-grid">
            <button
              v-for="opt in item.param.options || []"
              :key="String(getOptionValue(opt))"
              class="option-chip"
              :class="{ active: formData[item.param.name] === getOptionValue(opt) }"
              @click="formData[item.param.name] = getOptionValue(opt)"
            >{{ getOptionDisplay(opt) }}</button>
          </div>
        </div>
      </el-popover>

      <!-- Number type -->
      <el-popover
        v-else-if="isNumberParam(item.param)"
        trigger="click"
        :width="200"
        popper-class="dark-popover"
        placement="top-start"
      >
        <template #reference>
          <button class="toolbar-select-btn">
            <span class="btn-value">{{ formData[item.param.name] ?? '-' }}</span>
            <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
          </button>
        </template>
        <div class="param-popover">
          <div class="param-title">{{ getParamTitle(item.param) }}</div>
          <el-input-number
            v-model="formData[item.param.name]"
            :min="item.param.min"
            :max="item.param.max"
            size="small"
            controls-position="right"
            style="width: 100%"
          />
        </div>
      </el-popover>

      <!-- Text type -->
      <el-popover
        v-else-if="isTextParam(item.param)"
        trigger="click"
        :width="240"
        popper-class="dark-popover"
        placement="top-start"
      >
        <template #reference>
          <button class="toolbar-select-btn">
            <span class="btn-value">{{ formData[item.param.name] || getParamTitle(item.param) }}</span>
            <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
          </button>
        </template>
        <div class="param-popover">
          <div class="param-title">{{ getParamTitle(item.param) }}</div>
          <el-input
            v-model="formData[item.param.name]"
            size="small"
            :placeholder="'输入' + getParamTitle(item.param)"
          />
        </div>
      </el-popover>
    </template>
  </template>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import type { ModelParamSchema } from '@/api/models'
import {
  applyDimensionPreset,
  buildDynamicParamRenderItems,
  filterDynamicVisibleParams,
  getDimensionSummary,
  resolveDimensionPresets,
} from './dynamicParamFormCombos'

type DynamicParamSchema = Omit<ModelParamSchema, 'type'> & {
  type: string
}

const props = defineProps<{
  params: DynamicParamSchema[]
  initialValues?: Record<string, any>
}>()

const emit = defineEmits<{
  change: [data: Record<string, any>]
}>()

const formData = reactive<Record<string, any>>({})

const visibleParams = computed(() => filterDynamicVisibleParams(props.params))

const renderItems = computed<any[]>(() =>
  buildDynamicParamRenderItems(visibleParams.value)
)

const getParamByName = (name: string) => props.params.find(param => param.name === name)

const isNumberParam = (param: DynamicParamSchema) => (
  param.type === 'number' || param.type === 'integer' || param.type === 'float'
)

const normalizeParamValue = (param: DynamicParamSchema | undefined, value: any) => {
  if (!param) return value
  if (value === undefined || value === null || value === '') return value

  if (isNumberParam(param)) {
    const next = Number(value)
    return Number.isFinite(next) ? next : value
  }

  if (param.type === 'boolean') {
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase()
      if (lowered === 'true' || lowered === '1') return true
      if (lowered === 'false' || lowered === '0' || lowered === '') return false
    }
    return Boolean(value)
  }

  return value
}

watch(
  () => props.params,
  (params) => {
    const names = new Set(params.map(p => p.name))
    for (const k of Object.keys(formData)) {
      if (!names.has(k)) delete formData[k]
    }
    for (const p of params) {
      if (!(p.name in formData)) {
        const rawValue = props.initialValues?.[p.name] ?? p.default ?? null
        formData[p.name] = normalizeParamValue(p, rawValue)
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.initialValues,
  (values) => {
    if (!values) return
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null && k in formData) {
        formData[k] = normalizeParamValue(getParamByName(k), v)
      }
    }
  },
  { immediate: false }
)

watch(formData, (val) => {
  emit('change', { ...val })
}, { deep: true })

const getOptionValue = (option: any) => typeof option === 'object' ? option.value : option
const getOptionDisplay = (option: any) => typeof option === 'object' ? option.label : option
const getParamTitle = (param: DynamicParamSchema) => param.label || param.name

const isSelectParam = (param: DynamicParamSchema) => (
  param.type === 'select' || param.type === 'enum'
)

const isTextParam = (param: DynamicParamSchema) => (
  param.type === 'text' || param.type === 'string'
)

const getOptionLabelByValue = (param: DynamicParamSchema, value: any) => {
  if (!param.options) return value
  const opt = param.options.find(o => getOptionValue(o) === value)
  return opt ? getOptionDisplay(opt) : value
}

const getDimensionPresets = (combo: any) => (
  resolveDimensionPresets(combo.widthParam, combo.heightParam)
)

const isDimensionPresetActive = (combo: any, preset: any) => (
  formData[combo.widthParam.name] === preset.width
  && formData[combo.heightParam.name] === preset.height
)
</script>

<style scoped>
.toolbar-select-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.toolbar-select-btn:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.btn-value {
  font-size: 12px;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Popover content */
.param-popover {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.param-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.param-subtitle {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.dimension-section {
  margin-top: 4px;
}
.dimension-inputs {
  display: flex;
  gap: 10px;
}
.dimension-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.dimension-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.option-chip {
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.option-chip:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.option-chip.active {
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--accent-light);
  font-weight: 500;
}
</style>

<style>
.dark-popover {
  background: #1a1a1c !important;
  border: 1px solid #2a2a2e !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
}
</style>
