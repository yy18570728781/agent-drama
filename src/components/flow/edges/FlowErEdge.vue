<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, type EdgeProps } from '@vue-flow/core'
import { getFlowErEdgePaths } from './flowEdgePaths'
import { useEdgeCustomStyle } from './useEdgeStyle'

const props = defineProps<EdgeProps>()
const { customStyle, markerEndValue } = useEdgeCustomStyle(props)

const paths = computed(() => getFlowErEdgePaths(props))
</script>

<template>
  <g>
    <BaseEdge :id="`${id}-a`" :style="customStyle" :path="paths[0]" />
    <BaseEdge :id="`${id}-b`" :style="customStyle" :path="paths[1]" :marker-end="markerEndValue" :marker-start="markerStart" />
  </g>
</template>
