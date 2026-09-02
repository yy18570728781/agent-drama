<template>
  <el-popover
    trigger="click"
    :width="item.kind === 'slider' ? 280 : 220"
    popper-class="dark-popover"
    placement="top-start"
  >
    <template #reference>
      <button class="toolbar-select-btn">
        <span class="btn-value">{{ displayValue }}</span>
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
          :class="{ active: modelValue === opt.value }"
          @click="emit('update:modelValue', opt.value)"
        >{{ opt.label }}</button>
      </div>

      <div v-else-if="item.kind === 'slider'" class="slider-group">
        <el-slider
          :model-value="modelValue"
          :min="item.min"
          :max="item.max"
          :step="item.step"
          :show-input="false"
          :show-tooltip="true"
          @update:model-value="emit('update:modelValue', $event)"
        />
        <div class="slider-value">{{ sliderLabel }}</div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'

type OptionItem = { value: string; label: string }
type RenderItem =
  | { name: string; label: string; kind: 'select'; options: OptionItem[] }
  | { name: string; label: string; kind: 'slider'; min: number; max: number; step: number }

const props = defineProps<{
  item: RenderItem
  modelValue: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const displayValue = computed(() => {
  if (props.item.kind === 'select') {
    const opt = props.item.options.find((o) => o.value === props.modelValue)
    return opt?.label || String(props.modelValue ?? props.item.label)
  }
  return `${props.item.label}: ${sliderLabel.value}`
})

const sliderLabel = computed(() => {
  const num = Number(props.modelValue ?? 0)
  if (props.item.kind !== 'slider') return ''
  if (props.item.step >= 1) return String(Math.round(num))
  if (props.item.step >= 0.1) return num.toFixed(1)
  return num.toFixed(2)
})
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
