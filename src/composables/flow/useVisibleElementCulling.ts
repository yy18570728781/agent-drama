import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  VISIBLE_ELEMENT_INITIAL_NODE_THRESHOLD,
  VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD,
  VISIBLE_ELEMENT_RENDER_SETTLE_MS,
} from './flowPerformance.constants'

/**
 * 中型画布先完整挂载一次以测量端口，再切换到可见元素裁剪；超大画布直接裁剪。
 * @param nodes 当前画布节点集合。
 * @returns 是否启用 Vue Flow 可见元素裁剪。
 */
export function useVisibleElementCulling(nodes: Ref<unknown[]>): ComputedRef<boolean> {
  const settled = ref(false)
  let settleTimer = 0

  function clearSettleTimer(): void {
    if (!settleTimer) return
    clearTimeout(settleTimer)
    settleTimer = 0
  }

  watch(() => nodes.value.length, (nodeCount) => {
    clearSettleTimer()
    if (nodeCount <= VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD) {
      settled.value = false
      return
    }
    if (nodeCount > VISIBLE_ELEMENT_INITIAL_NODE_THRESHOLD) {
      settled.value = true
      return
    }
    settled.value = false
    settleTimer = window.setTimeout(() => {
      settleTimer = 0
      settled.value = true
    }, VISIBLE_ELEMENT_RENDER_SETTLE_MS)
  }, { immediate: true })

  onUnmounted(clearSettleTimer)
  return computed(() => settled.value && nodes.value.length > VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD)
}
