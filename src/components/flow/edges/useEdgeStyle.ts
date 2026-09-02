import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import type { EdgeProps } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { getNodeColor, getUpstreamNodeType } from '@/utils/nodeColors'

export function useEdgeCustomStyle(props: EdgeProps) {
  const {
    edgeAnimStyle,
    edgeArrow,
    edgeColorMode,
    edgeHighlightColor,
    edgeTypeHighlightColors,
  } = useTheme()
  const { getIncomers } = useVueFlow()
  const isUltraLightCanvasMode = inject<Ref<boolean>>('flowUltraLightNodeMode', computed(() => false))
  const shouldRenderEdge = computed(() => !isUltraLightCanvasMode.value)

  function getAnimatedStyle() {
    if (!props.animated || edgeAnimStyle.value === 'none') return { animation: 'none', strokeDasharray: 'none' }
    if (edgeAnimStyle.value === 'flow') return { strokeDasharray: '6 6', animation: 'flow-edge-dash 0.9s linear infinite' }
    if (edgeAnimStyle.value === 'trail') return { strokeDasharray: '12 6', animation: 'flow-edge-dash 1.2s linear infinite' }
    if (edgeAnimStyle.value === 'pulse') return { animation: 'flow-edge-pulse 1.1s ease-in-out infinite alternate' }
    if (edgeAnimStyle.value === 'blink') return { animation: 'flow-edge-blink 0.55s step-end infinite' }
    return {}
  }

  const customStyle = computed(() => {
    const isByType = edgeColorMode.value === 'byType'

    let strokeColor = edgeHighlightColor.value || '#93c5fd'
    if (isByType && props.sourceNode) {
      const sourceType = getUpstreamNodeType(props.sourceNode, getIncomers)
      strokeColor = edgeTypeHighlightColors.value[sourceType] || getNodeColor(sourceType)
    }

    return {
      ...props.style,
      stroke: props.selected ? '#ffffff' : strokeColor,
      strokeWidth: props.selected ? 3 : 2,
      ...getAnimatedStyle(),
    }
  })

  const markerEndValue = computed(() => (edgeArrow.value ? props.markerEnd || 'url(#1__type=arrowclosed)' : undefined))

  return { customStyle, markerEndValue, shouldRenderEdge }
}
