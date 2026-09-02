import type { MaybeRefOrGetter } from 'vue'
import { onBeforeUnmount, toValue, watchEffect } from 'vue'

/**
 * 将浏览器标签页标题同步为响应式页面标题，并在页面卸载时恢复原标题。
 * @param title 当前页面标题
 * @returns 无返回值
 * @throws 标题求值函数执行失败时透传原始异常
 */
export function useDocumentTitle(title: MaybeRefOrGetter<string>): void {
  const fallbackTitle = document.title

  watchEffect(() => {
    document.title = toValue(title).trim() || fallbackTitle
  })

  onBeforeUnmount(() => {
    document.title = fallbackTitle
  })
}
