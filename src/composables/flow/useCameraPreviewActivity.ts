import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

interface CameraPreviewActivityOptions {
  containerRef: Ref<HTMLElement | null>
  dispose: () => void
  init: () => void
  syncControls: () => void
}

/**
 * 仅在相机预览接近视口且页面可见时保留 WebGL 上下文和动画循环。
 * @param options 相机预览生命周期依赖。
 * @returns 无返回值，生命周期随所属组件自动释放。
 */
export function useCameraPreviewActivity(options: CameraPreviewActivityOptions): void {
  const visible = ref(false)
  const ultraLightMode = inject('flowUltraLightNodeMode', computed(() => false))
  let observer: IntersectionObserver | null = null

  function syncActivity(): void {
    const shouldRun = visible.value && !ultraLightMode.value && !document.hidden
    if (!shouldRun) {
      options.dispose()
      return
    }
    options.init()
    options.syncControls()
  }

  function observeVisibility(): void {
    const element = options.containerRef.value
    if (!element || typeof IntersectionObserver === 'undefined') {
      visible.value = true
      return
    }
    observer = new IntersectionObserver(([entry]) => {
      visible.value = !!entry?.isIntersecting
    }, { rootMargin: '240px' })
    observer.observe(element)
  }

  watch([visible, ultraLightMode], syncActivity)

  onMounted(() => {
    nextTick(observeVisibility)
    document.addEventListener('visibilitychange', syncActivity)
  })

  onUnmounted(() => {
    observer?.disconnect()
    document.removeEventListener('visibilitychange', syncActivity)
  })
}
