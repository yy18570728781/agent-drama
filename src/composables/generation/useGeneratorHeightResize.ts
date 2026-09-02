import { computed, type ComputedRef, type CSSProperties, type Ref } from 'vue'
import type { DragResizeEndPayload, DragResizeValue } from '@/directives/dragResize/dragResize.types'

interface GeneratorHeightResizeClasses {
  'is-height-resizable': boolean
  'is-text-expanded': boolean
}

interface UseGeneratorHeightResizeOptions {
  getOptions: () => Readonly<{
    height?: number
    max: number
    min: number
  }> | false | undefined
  isExpanded: Ref<boolean>
  isTextExpanded: Ref<boolean>
  onResizeEnd: (height: number) => void
}

interface UseGeneratorHeightResizeReturn {
  heightResizeBinding: ComputedRef<DragResizeValue>
  heightResizeClasses: ComputedRef<GeneratorHeightResizeClasses>
  heightResizeStyle: ComputedRef<CSSProperties>
}

/**
 * Adapts optional generator height settings to the global resize directive.
 *
 * @param options - Reactive panel state and the committed-height callback.
 * @returns Directive binding, host classes, and the persisted inline height.
 */
export function useGeneratorHeightResize(
  options: UseGeneratorHeightResizeOptions,
): UseGeneratorHeightResizeReturn {
  const heightResizeBinding = computed<DragResizeValue>(() => {
    const resize = options.getOptions()
    if (!resize) return false
    return {
      min: { top: resize.min },
      max: { top: resize.max },
      onDragEnd: (payload: DragResizeEndPayload): void => options.onResizeEnd(payload.height),
    }
  })
  const heightResizeClasses = computed<GeneratorHeightResizeClasses>(() => ({
    'is-height-resizable': Boolean(options.getOptions()),
    'is-text-expanded': options.isExpanded.value && options.isTextExpanded.value,
  }))
  const heightResizeStyle = computed<CSSProperties>(() => {
    const resize = options.getOptions()
    const height = resize && resize.height
    return typeof height === 'number' && Number.isFinite(height)
      ? { height: `${height}px` }
      : {}
  })

  return { heightResizeBinding, heightResizeClasses, heightResizeStyle }
}
