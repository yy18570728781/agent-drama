import { ref } from 'vue'

/**
 * 通用"加载中"状态原语。
 *
 * 配合 Element Plus 的 `v-loading` 指令使用，覆盖任何耗时操作：
 *
 * ```vue
 * <div v-loading="loading" element-loading-text="加载中">
 *   <!-- 任意内容 -->
 * </div>
 * ```
 *
 * - `start()` / `stop()`：显式控制（如生成按钮点击后的预处理阶段）。
 * - `onComplete()` / `onFailed()`：作为事件回调直接绑定（如 `<img @load>`）。
 * - `reset()`：等价于 `start()`，语义上用于"重新触发加载"的场景。
 */
export function useLoadingState(initial = false) {
  const loading = ref(initial)

  const start = () => {
    loading.value = true
  }

  const stop = () => {
    loading.value = false
  }

  /** 通用完成回调，可直接绑到 `@load` / `@error` 等事件。 */
  const onComplete = () => {
    loading.value = false
  }

  /** 通用失败回调，可直接绑到 `@error` 等事件。失败同样结束 loading，让错误处理接管 UI。 */
  const onFailed = () => {
    loading.value = false
  }

  const reset = start

  return { loading, start, stop, onComplete, onFailed, reset }
}
