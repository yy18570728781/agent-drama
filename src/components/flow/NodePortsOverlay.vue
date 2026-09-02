<template>
  <Handle
    v-for="inp in visibleInputPorts"
    :key="'in-' + inp.id"
    type="target"
    :id="inp.id"
    :position="Position.Left"
    :style="portStyle(inp, visibleInputPorts)"
    :class="inputHandleClass(inp)"
    :connectable="!(inp.disabled || disableInputPorts)"
  />

  <Handle
    v-for="out in visibleOutputPorts"
    :key="'out-' + out.id"
    type="source"
    :id="out.id"
    :position="Position.Right"
    :style="portStyle(out, visibleOutputPorts)"
    :class="outputHandleClass(out)"
    :connectable="!(out.disabled || disableOutputPorts)"
  />
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  inputPorts: { type: Array, default: () => [] },
  outputPorts: { type: Array, default: () => [] },
  disableInputPorts: { type: Boolean, default: false },
  disableOutputPorts: { type: Boolean, default: false },
  inputBaseClass: {
    type: String,
    default: 'w-3 h-3 bg-zinc-700 border-2 border-zinc-900 rounded-full !-left-1.5 opacity-100',
  },
  outputBaseClass: {
    type: String,
    default: 'w-3 h-3 bg-zinc-700 border-2 border-zinc-900 rounded-full !-right-1.5 opacity-100',
  },
})

const visibleInputPorts = computed(() => (props.inputPorts || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (props.outputPorts || []).filter((port) => port?.visible !== false))

function portStyle(port, all) {
  const index = all.indexOf(port)
  const total = all.length || 1
  if (total === 1) return { top: '50%' }
  return { top: `${(100 / (total - 1)) * index}%` }
}

function inputHandleClass(port) {
  return [
    props.inputBaseClass,
    (port?.disabled || props.disableInputPorts) ? 'opacity-100 cursor-not-allowed bg-zinc-500 border-zinc-700' : '',
  ]
}

function outputHandleClass(port) {
  return [
    props.outputBaseClass,
    (port?.disabled || props.disableOutputPorts) ? 'opacity-100 cursor-not-allowed bg-zinc-500 border-zinc-700' : '',
  ]
}
</script>
