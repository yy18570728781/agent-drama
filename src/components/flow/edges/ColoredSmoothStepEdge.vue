<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'
import { getFlowEdgePath } from './flowEdgePaths'
import { useEdgeCustomStyle } from './useEdgeStyle'

const props = defineProps<EdgeProps>()
const { customStyle, markerEndValue, shouldRenderEdge } = useEdgeCustomStyle(props)

const path = computed(() => getFlowEdgePath('smoothstep', props))
</script>

<template>
  <BaseEdge
    v-if="shouldRenderEdge"
    :id="id"
    :style="customStyle"
    :path="path"
    :marker-end="markerEndValue"
    :marker-start="markerStart"
  />
</template>
