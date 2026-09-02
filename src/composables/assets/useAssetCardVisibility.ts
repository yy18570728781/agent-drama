import { onMounted, onUnmounted, ref, type Ref } from 'vue'

type VisibilityCallback = (visible: boolean) => void

const callbacks = new WeakMap<Element, VisibilityCallback>()
let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (sharedObserver) return sharedObserver
  sharedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => callbacks.get(entry.target)?.(entry.isIntersecting))
  }, { rootMargin: '600px 0px' })
  return sharedObserver
}

/**
 * 通过共享观察器控制资产卡片是否挂载，避免每张卡片各自创建观察器。
 * @param elementRef 卡片占位容器。
 * @returns 当前卡片是否处于预渲染范围。
 */
export function useAssetCardVisibility(elementRef: Ref<HTMLElement | null>): Ref<boolean> {
  const visible = ref(false)
  let observedElement: HTMLElement | null = null

  onMounted(() => {
    observedElement = elementRef.value
    const observer = getSharedObserver()
    if (!observedElement || !observer) {
      visible.value = true
      return
    }
    callbacks.set(observedElement, (nextVisible) => {
      visible.value = nextVisible
    })
    observer.observe(observedElement)
  })

  onUnmounted(() => {
    if (!observedElement || !sharedObserver) return
    sharedObserver.unobserve(observedElement)
    callbacks.delete(observedElement)
  })

  return visible
}
