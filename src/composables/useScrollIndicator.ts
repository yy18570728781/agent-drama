/**
 * useScrollIndicator — extracts scroll-position tracking for GeneratorInput.
 *
 * Provides:
 * - isAtBottom ref
 * - scrollToBottom() helper
 * - Automatic watchEffect binding to scrollEl
 */
import { ref, watchEffect, type Ref } from 'vue'

// ── Options ───────────────────────────────────────────────────
export interface UseScrollIndicatorOptions {
  scrollEl: Ref<HTMLElement | null | undefined>
}

// ── Composable ────────────────────────────────────────────────
export function useScrollIndicator(options: UseScrollIndicatorOptions) {
  const { scrollEl } = options

  const isAtBottom = ref(true)

  function checkScroll() {
    const el = scrollEl.value
    if (!el) return
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
    isAtBottom.value = distanceFromBottom < 50
  }

  function scrollToBottom() {
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  }

  // Auto-bind scroll event when scrollEl changes
  watchEffect((onCleanup) => {
    const el = scrollEl.value
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true })
      checkScroll()
      onCleanup(() => el.removeEventListener('scroll', checkScroll))
    }
  })

  return {
    isAtBottom,
    scrollToBottom,
  }
}
