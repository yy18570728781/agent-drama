<template>
  <template v-for="item in renderItems" :key="item.name">
    <el-popover
      trigger="click"
      :width="item.kind === 'slider' ? 280 : 220"
      popper-class="dark-popover"
      placement="top-start"
    >
      <template #reference>
        <button class="toolbar-select-btn">
          <span class="btn-value">{{ getDisplayValue(item) }}</span>
          <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
        </button>
      </template>
      <div class="param-popover">
        <div class="param-title">{{ item.label }}</div>

        <div v-if="item.kind === 'select'" class="option-grid">
          <button
            v-for="opt in item.options"
            :key="String(opt.value)"
            class="option-chip"
            :class="{ active: formData[item.name] === opt.value }"
            @click="formData[item.name] = opt.value"
          >{{ opt.label }}</button>
        </div>

        <div v-else-if="item.kind === 'slider'" class="slider-group">
          <el-slider
            v-model="formData[item.name]"
            :min="item.min"
            :max="item.max"
            :step="item.step"
            :show-input="false"
            :show-tooltip="true"
          />
          <div class="slider-value">{{ formatSliderValue(item, formData[item.name]) }}</div>
        </div>
      </div>
    </el-popover>
  </template>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import { GIGA_PARAMS } from '@/services/generation/topaz.constants'

type OptionItem = { value: string; label: string }
type RenderItem =
  | { name: string; label: string; kind: 'select'; options: OptionItem[] }
  | { name: string; label: string; kind: 'slider'; min: number; max: number; step: number }

const props = defineProps<{
  initialValues?: Record<string, any>
}>()

const emit = defineEmits<{
  change: [data: Record<string, any>]
}>()

const defaults: Record<string, any> = {}
GIGA_PARAMS.forEach((p) => {
  if (p.default !== undefined) defaults[p.name] = p.default
})

const formData = reactive<Record<string, any>>({ ...defaults })

function buildRenderItems(): RenderItem[] {
  const items: RenderItem[] = []
  for (const p of GIGA_PARAMS) {
    if (p.name === 'file_urls') continue
    if (p.type === 'select') {
      items.push({
        name: p.name,
        label: p.label,
        kind: 'select',
        options: (p.options || []) as OptionItem[],
      })
    } else if (p.type === 'number' || p.type === 'float' || p.type === 'integer') {
      items.push({
        name: p.name,
        label: p.label,
        kind: 'slider',
        min: p.min ?? 0,
        max: p.max ?? 100,
        step: p.type === 'float' ? 0.1 : 1,
      })
    }
  }
  return items
}

const renderItems = buildRenderItems()

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

function getDisplayValue(item: RenderItem): string {
  const val = formData[item.name]
  if (item.kind === 'select') {
    const opt = item.options.find((o) => o.value === val)
    return opt?.label || String(val || item.label)
  }
  return `${item.label}: ${formatSliderValue(item, val)}`
}

function formatSliderValue(item: Extract<RenderItem, { kind: 'slider' }>, val: any): string {
  const num = Number(val ?? 0)
  return item.step < 1 ? num.toFixed(1) : String(Math.round(num))
}
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
.slider-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.slider-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}
</style>
