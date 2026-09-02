<script setup lang="ts">
import { useAttrs } from 'vue'
import type { Component } from 'vue'

interface Props {
  icon: Component
  size?: number
  stroke?: number
}

withDefaults(defineProps<Props>(), {
  size: 16,
  stroke: 2
})

const attrs = useAttrs()
</script>

<template>
  <component 
    :is="icon" 
    :size="size" 
    :stroke-width="stroke"
    v-bind="attrs"
  />
</template>
