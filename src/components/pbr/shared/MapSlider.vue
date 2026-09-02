<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  label: string
  min: number | string
  max: number | string
  step?: number | string
  modelValue: number | string
  defaultValue: number | string
  isRed?: boolean
  isGreen?: boolean
  isBlue?: boolean
  disabled?: boolean
}>(), {
  step: 1,
})

const accentClass = computed(() => {
  if (props.isRed) return 'accent-red-500'
  if (props.isGreen) return 'accent-emerald-500'
  if (props.isBlue) return 'accent-blue-500'
  return 'accent-indigo-500'
})

const emit = defineEmits(['update:modelValue', 'change'])

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const val = parseFloat(target.value)
  if (!isNaN(val)) {
    emit('update:modelValue', val)
    emit('change', val)
  }
}

function resetVal() {
  emit('update:modelValue', props.defaultValue)
  emit('change', props.defaultValue)
}
</script>

<template>
  <div class="space-y-1.5 relative group">
    <div class="flex items-center justify-between text-xs">
      <label :class="[isRed ? 'text-red-400 text-[11px]' : isGreen ? 'text-emerald-400 text-[11px]' : isBlue ? 'text-blue-400 text-[11px]' : 'text-zinc-400']">{{ label }}</label>
      <div class="flex items-center gap-1.5">
        <input type="number" :min="min" :max="max" :step="step || 1" :value="modelValue" @input="onInput"
          :disabled="disabled"
          class="w-16 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-right font-mono text-zinc-300 pointer-events-auto focus:outline-none focus:border-indigo-500/50" />
        <button title="回到默认值" @click="resetVal" class="text-zinc-600 hover:text-indigo-400 cursor-pointer p-0.5" :class="isRed ? 'hover:text-red-400' : isGreen ? 'hover:text-emerald-400' : isBlue ? 'hover:text-blue-400' : ''">
          ↺
        </button>
      </div>
    </div>
    <input type="range" :min="min" :max="max" :step="step || 1" :value="modelValue" @input="onInput"
      :disabled="disabled"
      :class="['w-full cursor-pointer bg-zinc-800 h-1 rounded', accentClass]" />
  </div>
</template>
