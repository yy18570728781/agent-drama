<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, type EdgeProps } from '@vue-flow/core'
import { getFlowEdgePath } from './flowEdgePaths'
import { useEdgeCustomStyle } from './useEdgeStyle'

const props = defineProps<EdgeProps>()
const { customStyle, markerEndValue } = useEdgeCustomStyle(props)

const path = computed(() => getFlowEdgePath('step', props))
</script>

<template>
  <BaseEdge :id="id" :style="customStyle" :path="path" :marker-end="markerEndValue" :marker-start="markerStart" />
</template>
